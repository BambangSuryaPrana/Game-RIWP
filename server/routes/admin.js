// API admin: masuk/keluar, dashboard, data peserta, bank soal, pengaturan, dan akun admin.
import express from "express";
import crypto from "node:crypto";
import {
  COOKIE, hashPassword, verifyPassword, passwordProblem, createSession, readCookie,
  cookieOptions, requireAdmin, requireSuper, ROLES, rateLimiter, sha256,
} from "../auth.js";
import { getSettings, listCases, caseFromRow, cleanCaseInput } from "../content.js";
import { loadPlays, playersFromPlays, buildSummary } from "../stats.js";
import { buildWorkbook } from "../excel.js";

const clip = (v, n) => String(v ?? "").trim().slice(0, n);

export function adminRoutes(db, { setupCode }) {
  const r = express.Router();
  const loginLimit = rateLimiter({ windowMs: 15 * 60e3, max: 10, message: "Terlalu banyak percobaan masuk. Tunggu 15 menit." });
  const auth = requireAdmin(db);
  const superOnly = [auth, requireSuper]; // khusus Super Admin

  const adminCount = async () => Number((await db.get("SELECT COUNT(*) AS n FROM riwp_admins")).n);
  const passScore = async () => Number((await getSettings(db)).passScore ?? 80);
  const filters = (q) => ({ from: q.from, to: q.to, q: clip(q.q, 60), unit: clip(q.unit, 100) });

  // ---------- akses ----------
  r.get("/status", async (req, res, next) => {
    try { res.json({ needsSetup: (await adminCount()) === 0, setupCodeRequired: !!setupCode, database: db.label }); } catch (e) { next(e); }
  });

  // Membuat admin pertama. Hanya bisa dilakukan sekali (selama belum ada admin).
  // Kode setup bersifat opsional: hanya diminta kalau SETUP_KODE diisi di environment.
  r.post("/setup", loginLimit, async (req, res, next) => {
    try {
      if ((await adminCount()) > 0) return res.status(409).json({ error: "Akun admin sudah ada. Silakan masuk." });
      if (setupCode) {
        const code = String(req.body?.code || "");
        const a = Buffer.from(sha256(code)), b = Buffer.from(sha256(setupCode));
        if (!crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: "Kode setup salah. Lihat SETUP_KODE di pengaturan server." });
      }
      const username = clip(req.body?.username, 40).toLowerCase();
      const nama = clip(req.body?.nama, 100);
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: "Username 3–40 karakter: huruf kecil, angka, titik, minus, atau garis bawah." });
      if (!nama) return res.status(400).json({ error: "Nama lengkap wajib diisi." });
      const prob = passwordProblem(req.body?.password);
      if (prob) return res.status(400).json({ error: prob });
      const row = await db.run(
        "INSERT INTO riwp_admins (username, nama, pass_hash, role, created_at) VALUES (?, ?, ?, 'superadmin', ?) RETURNING id",
        [username, nama, hashPassword(req.body.password), new Date().toISOString()]
      );
      const s = await createSession(db, Number(row.rows[0].id));
      res.cookie(COOKIE, s.token, cookieOptions(req, s.maxAge));
      res.status(201).json({ ok: true });
    } catch (e) { next(e); }
  });

  r.post("/login", loginLimit, async (req, res, next) => {
    try {
      const username = clip(req.body?.username, 40).toLowerCase();
      const row = await db.get("SELECT * FROM riwp_admins WHERE username = ?", [username]);
      if (!row || !verifyPassword(String(req.body?.password || ""), row.pass_hash)) {
        return res.status(401).json({ error: "Username atau password salah." });
      }
      const s = await createSession(db, Number(row.id));
      res.cookie(COOKIE, s.token, cookieOptions(req, s.maxAge));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.post("/logout", async (req, res, next) => {
    try {
      const t = readCookie(req, COOKIE);
      if (t) await db.run("DELETE FROM riwp_sessions WHERE token_hash = ?", [sha256(t)]);
      res.clearCookie(COOKIE, { path: "/" });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/me", auth, (req, res) => res.json({ ...req.admin, database: db.label }));

  // ---------- dashboard & peserta ----------
  r.get("/summary", auth, async (req, res, next) => {
    try { res.json(await buildSummary(db, filters(req.query), await passScore())); } catch (e) { next(e); }
  });

  r.get("/units", auth, async (req, res, next) => {
    try {
      const rows = await db.all("SELECT DISTINCT unit FROM riwp_plays ORDER BY unit");
      res.json(rows.map((x) => x.unit));
    } catch (e) { next(e); }
  });

  r.get("/players", auth, async (req, res, next) => {
    try {
      const plays = await loadPlays(db, filters(req.query));
      res.json(playersFromPlays(plays, await passScore()));
    } catch (e) { next(e); }
  });

  r.get("/plays", auth, async (req, res, next) => {
    try {
      const f = filters(req.query);
      let plays = await loadPlays(db, f);
      if (req.query.nipp) plays = plays.filter((p) => p.nipp.toUpperCase() === String(req.query.nipp).toUpperCase());
      res.json(plays);
    } catch (e) { next(e); }
  });

  r.get("/plays/:id", auth, async (req, res, next) => {
    try {
      const p = await db.get("SELECT id, nipp, nama, unit, total, score, started_at, finished_at FROM riwp_plays WHERE id = ?", [req.params.id]);
      if (!p) return res.status(404).json({ error: "Data permainan tidak ditemukan." });
      const answers = await db.all("SELECT case_no, case_title, choice, correct_answer, is_correct, answered_at FROM riwp_answers WHERE play_id = ? ORDER BY case_no", [p.id]);
      res.json({
        id: p.id, nipp: p.nipp, nama: p.nama, unit: p.unit, total: Number(p.total),
        score: p.score == null ? null : Number(p.score), startedAt: p.started_at, finishedAt: p.finished_at,
        answers: answers.map((a) => ({ no: Number(a.case_no), title: a.case_title, choice: a.choice, answer: a.correct_answer, correct: Number(a.is_correct) === 1, at: a.answered_at })),
      });
    } catch (e) { next(e); }
  });

  r.delete("/plays/:id", superOnly, async (req, res, next) => {
    try {
      await db.tx(async (t) => {
        await t.run("DELETE FROM riwp_answers WHERE play_id = ?", [req.params.id]);
        await t.run("DELETE FROM riwp_plays WHERE id = ?", [req.params.id]);
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/export.xlsx", auth, async (req, res, next) => {
    try {
      const buf = await buildWorkbook(db, filters(req.query), await passScore());
      const stamp = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="Rekap-RIWP-Case-Files-${stamp}.xlsx"`);
      res.send(buf);
    } catch (e) { next(e); }
  });

  // ---------- bank soal ----------
  r.get("/cases", auth, async (req, res, next) => {
    try { res.json(await listCases(db)); } catch (e) { next(e); }
  });

  r.post("/cases", auth, async (req, res, next) => {
    try {
      const { c, errors } = cleanCaseInput(req.body || {});
      if (errors.length) return res.status(400).json({ error: errors.join(" ") });
      const max = await db.get("SELECT COALESCE(MAX(urutan), 0) AS m FROM riwp_cases");
      const row = await db.run(
        `INSERT INTO riwp_cases (urutan, aktif, title, topic, person, story, desk_json, opt_a, opt_b, opt_c, answer, basis, competency, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [Number(max.m) + 1, c.aktif ? 1 : 0, c.title, c.topic, c.person, c.story, JSON.stringify(c.desk), c.options.A, c.options.B, c.options.C, c.answer, c.basis, c.competency, new Date().toISOString()]
      );
      res.status(201).json(caseFromRow(row.rows[0]));
    } catch (e) { next(e); }
  });

  r.put("/cases/:id", auth, async (req, res, next) => {
    try {
      const { c, errors } = cleanCaseInput(req.body || {});
      if (errors.length) return res.status(400).json({ error: errors.join(" ") });
      const row = await db.run(
        `UPDATE riwp_cases SET aktif = ?, title = ?, topic = ?, person = ?, story = ?, desk_json = ?, opt_a = ?, opt_b = ?, opt_c = ?,
         answer = ?, basis = ?, competency = ?, updated_at = ? WHERE id = ? RETURNING *`,
        [c.aktif ? 1 : 0, c.title, c.topic, c.person, c.story, JSON.stringify(c.desk), c.options.A, c.options.B, c.options.C, c.answer, c.basis, c.competency, new Date().toISOString(), Number(req.params.id)]
      );
      if (!row.rows.length) return res.status(404).json({ error: "Soal tidak ditemukan." });
      res.json(caseFromRow(row.rows[0]));
    } catch (e) { next(e); }
  });

  r.delete("/cases/:id", superOnly, async (req, res, next) => {
    try {
      // Riwayat jawaban tetap tersimpan (judul kasus disalin saat menjawab).
      await db.run("DELETE FROM riwp_cases WHERE id = ?", [Number(req.params.id)]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.post("/cases/reorder", auth, async (req, res, next) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
      await db.tx(async (t) => {
        for (let i = 0; i < ids.length; i++) await t.run("UPDATE riwp_cases SET urutan = ? WHERE id = ?", [i + 1, ids[i]]);
      });
      res.json(await listCases(db));
    } catch (e) { next(e); }
  });

  // ---------- pengaturan ----------
  r.get("/settings", auth, async (req, res, next) => {
    try { res.json(await getSettings(db)); } catch (e) { next(e); }
  });

  r.put("/settings", superOnly, async (req, res, next) => {
    try {
      const b = req.body || {};
      const list = (v, n, len) => (Array.isArray(v) ? v : []).map((x) => clip(x, len)).filter(Boolean).slice(0, n);
      const next_ = {
        title: clip(b.title, 120) || "RIWP Case Files",
        subtitle: clip(b.subtitle, 120),
        intro: clip(b.intro, 2000),
        regulation: clip(b.regulation, 2000),
        question: clip(b.question, 200) || "Manakah tindakan yang tepat?",
        wrongText: clip(b.wrongText, 80) || "Coba Lagi Yuk!",
        praises: list(b.praises, 20, 80),
        units: list(b.units, 200, 100),
        passScore: Math.min(100, Math.max(0, Math.round(Number(b.passScore)) || 0)),
      };
      if (!next_.praises.length) next_.praises = ["Kamu Hebat!"];
      await db.tx(async (t) => {
        for (const [k, v] of Object.entries(next_)) {
          await t.run(
            "INSERT INTO riwp_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            [k, JSON.stringify(v)]
          );
        }
      });
      res.json(await getSettings(db));
    } catch (e) { next(e); }
  });

  // ---------- akun admin ----------
  // Semua admin bisa melihat daftar admin. Menambah, menghapus, mengubah peran,
  // dan mereset password admin lain hanya bisa dilakukan Super Admin.
  const superCount = async () => Number((await db.get("SELECT COUNT(*) AS n FROM riwp_admins WHERE role = 'superadmin'")).n);
  const cleanRole = (v) => (ROLES.includes(v) ? v : null);

  r.get("/admins", auth, async (req, res, next) => {
    try {
      const rows = await db.all("SELECT id, username, nama, role, created_at FROM riwp_admins ORDER BY id");
      res.json(rows.map((x) => ({ id: Number(x.id), username: x.username, nama: x.nama, role: x.role, createdAt: x.created_at })));
    } catch (e) { next(e); }
  });

  r.post("/admins", superOnly, async (req, res, next) => {
    try {
      const username = clip(req.body?.username, 40).toLowerCase();
      const nama = clip(req.body?.nama, 100);
      const role = cleanRole(req.body?.role || "admin");
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: "Username 3–40 karakter: huruf kecil, angka, titik, minus, atau garis bawah." });
      if (!nama) return res.status(400).json({ error: "Nama lengkap wajib diisi." });
      if (!role) return res.status(400).json({ error: "Peran tidak dikenal." });
      const prob = passwordProblem(req.body?.password);
      if (prob) return res.status(400).json({ error: prob });
      if (await db.get("SELECT id FROM riwp_admins WHERE username = ?", [username])) return res.status(409).json({ error: "Username sudah dipakai." });
      await db.run("INSERT INTO riwp_admins (username, nama, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)", [username, nama, hashPassword(req.body.password), role, new Date().toISOString()]);
      res.status(201).json({ ok: true });
    } catch (e) { next(e); }
  });

  r.put("/admins/:id/role", superOnly, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const role = cleanRole(req.body?.role);
      if (!role) return res.status(400).json({ error: "Peran tidak dikenal." });
      if (id === req.admin.id) return res.status(400).json({ error: "Tidak bisa mengubah peran akun sendiri." });
      const target = await db.get("SELECT role FROM riwp_admins WHERE id = ?", [id]);
      if (!target) return res.status(404).json({ error: "Admin tidak ditemukan." });
      if (target.role === "superadmin" && role !== "superadmin" && (await superCount()) <= 1) {
        return res.status(400).json({ error: "Harus ada minimal satu Super Admin." });
      }
      await db.run("UPDATE riwp_admins SET role = ? WHERE id = ?", [role, id]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.put("/admins/:id/password", superOnly, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const prob = passwordProblem(req.body?.password);
      if (prob) return res.status(400).json({ error: prob });
      const r2 = await db.run("UPDATE riwp_admins SET pass_hash = ? WHERE id = ?", [hashPassword(req.body.password), id]);
      if (!r2.changes) return res.status(404).json({ error: "Admin tidak ditemukan." });
      // Paksa admin tersebut login ulang dengan password baru.
      if (id !== req.admin.id) await db.run("DELETE FROM riwp_sessions WHERE admin_id = ?", [id]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.delete("/admins/:id", superOnly, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (id === req.admin.id) return res.status(400).json({ error: "Tidak bisa menghapus akun yang sedang dipakai." });
      const target = await db.get("SELECT role FROM riwp_admins WHERE id = ?", [id]);
      if (!target) return res.status(404).json({ error: "Admin tidak ditemukan." });
      if (target.role === "superadmin" && (await superCount()) <= 1) return res.status(400).json({ error: "Harus ada minimal satu Super Admin." });
      await db.run("DELETE FROM riwp_sessions WHERE admin_id = ?", [id]);
      await db.run("DELETE FROM riwp_admins WHERE id = ?", [id]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.put("/password", auth, async (req, res, next) => {
    try {
      const row = await db.get("SELECT pass_hash FROM riwp_admins WHERE id = ?", [req.admin.id]);
      if (!verifyPassword(String(req.body?.current || ""), row.pass_hash)) return res.status(400).json({ error: "Password lama salah." });
      const prob = passwordProblem(req.body?.password);
      if (prob) return res.status(400).json({ error: prob });
      await db.run("UPDATE riwp_admins SET pass_hash = ? WHERE id = ?", [hashPassword(req.body.password), req.admin.id]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  return r;
}
