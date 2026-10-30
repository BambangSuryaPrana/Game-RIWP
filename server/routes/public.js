// API untuk pegawai yang bermain. Kunci jawaban tidak pernah dikirim sebelum pemain menjawab,
// dan skor dihitung di server, jadi nilai di dashboard tidak bisa diakali dari browser.
import express from "express";
import crypto from "node:crypto";
import { getSettings, listCases, publicCase } from "../content.js";
import { sha256, randomToken, rateLimiter } from "../auth.js";

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function publicRoutes(db) {
  const r = express.Router();

  r.get("/game", async (req, res, next) => {
    try {
      const s = await getSettings(db);
      const cases = await listCases(db, { activeOnly: true });
      res.json({
        title: s.title, subtitle: s.subtitle, intro: s.intro, regulation: s.regulation,
        units: s.units || [], totalCases: cases.length,
      });
    } catch (e) { next(e); }
  });

  const startLimit = rateLimiter({ windowMs: 10 * 60e3, max: 60, message: "Terlalu banyak percobaan dari perangkat ini. Coba lagi beberapa menit lagi." });

  r.post("/plays", startLimit, async (req, res, next) => {
    try {
      const nipp = clip(req.body?.nipp, 20).replace(/\s/g, "");
      const nama = clip(req.body?.nama, 100);
      const unit = clip(req.body?.unit, 100);
      if (!/^[0-9A-Za-z.-]{4,20}$/.test(nipp)) return res.status(400).json({ error: "NIPP harus 4–20 karakter (angka/huruf), tanpa spasi." });
      if (nama.length < 2) return res.status(400).json({ error: "Nama wajib diisi." });
      if (unit.length < 2) return res.status(400).json({ error: "Unit kerja wajib diisi." });
      const cases = await listCases(db, { activeOnly: true });
      if (!cases.length) return res.status(503).json({ error: "Belum ada soal aktif. Hubungi admin." });
      const s = await getSettings(db);
      const id = crypto.randomUUID();
      const token = randomToken();
      await db.run(
        `INSERT INTO riwp_plays (id, token_hash, nipp, nama, unit, case_ids, total, score, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
        [id, sha256(token), nipp, nama, unit, JSON.stringify(cases.map((c) => c.id)), cases.length, new Date().toISOString()]
      );
      res.status(201).json({
        playId: id, token,
        cases: cases.map((c, i) => publicCase(c, i + 1)),
        question: s.question, wrongText: s.wrongText, praises: s.praises || [],
      });
    } catch (e) { next(e); }
  });

  async function loadPlay(req, res) {
    const play = await db.get("SELECT * FROM riwp_plays WHERE id = ?", [String(req.params.id)]);
    const token = req.get("x-play-token") || "";
    if (!play || !token || play.token_hash !== sha256(token)) {
      res.status(404).json({ error: "Sesi permainan tidak ditemukan. Mulai ulang dari awal." });
      return null;
    }
    return play;
  }

  r.post("/plays/:id/answers", async (req, res, next) => {
    try {
      const play = await loadPlay(req, res);
      if (!play) return;
      if (play.finished_at) return res.status(409).json({ error: "Permainan ini sudah selesai." });
      const caseId = Number(req.body?.caseId);
      const choice = String(req.body?.choice || "").toUpperCase();
      const ids = JSON.parse(play.case_ids);
      const no = ids.indexOf(caseId) + 1;
      if (!no) return res.status(400).json({ error: "Soal tidak termasuk dalam permainan ini." });
      if (!["A", "B", "C"].includes(choice)) return res.status(400).json({ error: "Pilihan harus A, B, atau C." });
      const c = await db.get("SELECT * FROM riwp_cases WHERE id = ?", [caseId]);
      if (!c) return res.status(410).json({ error: "Soal ini sudah dihapus admin." });
      // Jawaban pertama yang dihitung; kiriman ulang mengembalikan hasil yang tersimpan.
      await db.run(
        `INSERT INTO riwp_answers (play_id, case_id, case_no, case_title, choice, correct_answer, is_correct, answered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (play_id, case_id) DO NOTHING`,
        [play.id, caseId, no, c.title, choice, c.answer, choice === c.answer ? 1 : 0, new Date().toISOString()]
      );
      const saved = await db.get("SELECT choice, correct_answer FROM riwp_answers WHERE play_id = ? AND case_id = ?", [play.id, caseId]);
      res.json({ choice: saved.choice, correct: saved.choice === saved.correct_answer, answer: saved.correct_answer, basis: c.basis });
    } catch (e) { next(e); }
  });

  r.post("/plays/:id/finish", async (req, res, next) => {
    try {
      const play = await loadPlay(req, res);
      if (!play) return;
      const rows = await db.all("SELECT * FROM riwp_answers WHERE play_id = ? ORDER BY case_no", [play.id]);
      const score = rows.filter((a) => Number(a.is_correct) === 1).length;
      const finishedAt = play.finished_at || new Date().toISOString();
      if (!play.finished_at) {
        await db.run("UPDATE riwp_plays SET score = ?, finished_at = ? WHERE id = ?", [score, finishedAt, play.id]);
      }
      const s = await getSettings(db);
      const total = Number(play.total);
      const pct = total ? Math.round((score / total) * 100) : 0;
      res.json({
        score, total, percent: pct, passed: pct >= Number(s.passScore ?? 80), passScore: Number(s.passScore ?? 80),
        finishedAt, nama: play.nama, nipp: play.nipp, unit: play.unit,
        answers: rows.map((a) => ({ no: Number(a.case_no), title: a.case_title, choice: a.choice, answer: a.correct_answer, correct: Number(a.is_correct) === 1 })),
      });
    } catch (e) { next(e); }
  });

  return r;
}
