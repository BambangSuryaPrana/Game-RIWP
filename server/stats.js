// Perhitungan rekap untuk dashboard admin dan ekspor Excel.
import { wibDate, wibRange } from "./content.js";

export async function loadPlays(db, { from, to, q, unit } = {}) {
  const { fromIso, toIso } = wibRange(from, to);
  const where = [];
  const params = [];
  if (fromIso) { where.push("started_at >= ?"); params.push(fromIso); }
  if (toIso) { where.push("started_at < ?"); params.push(toIso); }
  if (unit) { where.push("unit = ?"); params.push(unit); }
  if (q) {
    where.push("(LOWER(nipp) LIKE ? OR LOWER(nama) LIKE ?)");
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like);
  }
  const rows = await db.all(
    `SELECT id, nipp, nama, unit, total, score, started_at, finished_at FROM riwp_plays
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY started_at DESC`,
    params
  );
  return rows.map((r) => ({
    id: r.id, nipp: r.nipp, nama: r.nama, unit: r.unit,
    total: Number(r.total), score: r.score == null ? null : Number(r.score),
    startedAt: r.started_at, finishedAt: r.finished_at || null,
    percent: r.score == null || !Number(r.total) ? null : Math.round((Number(r.score) / Number(r.total)) * 100),
  }));
}

// Satu baris per NIPP: nama & unit terakhir, jumlah main, skor terbaik & terakhir.
export function playersFromPlays(plays, passScore) {
  const map = new Map();
  for (const p of [...plays].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const key = p.nipp.toUpperCase();
    const cur = map.get(key) || { nipp: p.nipp, attempts: 0, finished: 0, best: null, bestPercent: null, last: null, lastPercent: null, firstAt: p.startedAt };
    cur.nama = p.nama;
    cur.unit = p.unit;
    cur.attempts += 1;
    cur.lastAt = p.startedAt;
    if (p.finishedAt) {
      cur.finished += 1;
      cur.last = p.score;
      cur.lastTotal = p.total;
      cur.lastPercent = p.percent;
      if (cur.bestPercent == null || p.percent > cur.bestPercent) { cur.best = p.score; cur.bestTotal = p.total; cur.bestPercent = p.percent; }
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map((x) => ({ ...x, passed: x.bestPercent != null && x.bestPercent >= passScore }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function buildSummary(db, filters, passScore) {
  const plays = await loadPlays(db, filters);
  const players = playersFromPlays(plays, passScore);
  const done = plays.filter((p) => p.finishedAt);
  const avg = done.length ? done.reduce((s, p) => s + p.percent, 0) / done.length : null;

  // Akurasi per soal, dari semua jawaban pada permainan yang terfilter.
  const ids = plays.map((p) => p.id);
  let perCase = [];
  if (ids.length) {
    const ans = [];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      ans.push(...(await db.all(
        `SELECT case_id, case_no, case_title, choice, is_correct FROM riwp_answers WHERE play_id IN (${chunk.map(() => "?").join(",")})`,
        chunk
      )));
    }
    const m = new Map();
    for (const a of ans) {
      const k = Number(a.case_id);
      const cur = m.get(k) || { caseId: k, no: Number(a.case_no), title: a.case_title, answered: 0, correct: 0, choices: { A: 0, B: 0, C: 0 } };
      cur.answered += 1;
      cur.correct += Number(a.is_correct) === 1 ? 1 : 0;
      if (cur.choices[a.choice] != null) cur.choices[a.choice] += 1;
      m.set(k, cur);
    }
    perCase = [...m.values()].map((x) => ({ ...x, percent: Math.round((x.correct / x.answered) * 100) })).sort((a, b) => a.no - b.no);
  }

  // Per unit kerja (berdasarkan pemain unik).
  const units = new Map();
  for (const pl of players) {
    const u = units.get(pl.unit) || { unit: pl.unit, players: 0, finishedPlayers: 0, sumBest: 0, passed: 0 };
    u.players += 1;
    if (pl.bestPercent != null) { u.finishedPlayers += 1; u.sumBest += pl.bestPercent; }
    if (pl.passed) u.passed += 1;
    units.set(pl.unit, u);
  }
  const perUnit = [...units.values()]
    .map((u) => ({ unit: u.unit, players: u.players, avgBest: u.finishedPlayers ? Math.round(u.sumBest / u.finishedPlayers) : null, passed: u.passed }))
    .sort((a, b) => b.players - a.players);

  // Aktivitas harian (WIB).
  const days = new Map();
  for (const p of plays) { const d = wibDate(p.startedAt); days.set(d, (days.get(d) || 0) + 1); }
  const daily = [...days.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

  // Sebaran skor (persen, kelompok per 10).
  const dist = Array.from({ length: 11 }, (_, i) => ({ bucket: i * 10, count: 0 }));
  for (const p of done) dist[Math.min(10, Math.floor(p.percent / 10))].count += 1;

  return {
    totals: {
      players: players.length,
      plays: plays.length,
      finished: done.length,
      unfinished: plays.length - done.length,
      avgPercent: avg == null ? null : Math.round(avg),
      passedPlayers: players.filter((p) => p.passed).length,
      passScore,
    },
    perCase, perUnit, daily, distribution: dist,
    recent: plays.slice(0, 8),
  };
}
