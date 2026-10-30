// Helper untuk membaca soal dan pengaturan dari database.
export async function getSettings(db) {
  const rows = await db.all("SELECT key, value FROM riwp_settings");
  const out = {};
  for (const r of rows) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}

export function caseFromRow(r) {
  let desk = [];
  try { desk = JSON.parse(r.desk_json || "[]"); } catch {}
  return {
    id: Number(r.id),
    urutan: Number(r.urutan),
    aktif: Number(r.aktif) === 1,
    title: r.title,
    topic: r.topic,
    person: r.person,
    story: r.story,
    desk,
    options: { A: r.opt_a, B: r.opt_b, C: r.opt_c },
    answer: r.answer,
    basis: r.basis,
    competency: r.competency,
    updatedAt: r.updated_at,
  };
}

export async function listCases(db, { activeOnly = false } = {}) {
  const rows = await db.all(
    `SELECT * FROM riwp_cases ${activeOnly ? "WHERE aktif = 1" : ""} ORDER BY urutan, id`
  );
  return rows.map(caseFromRow);
}

// Versi soal untuk pemain: tanpa kunci jawaban dan penjelasan.
export function publicCase(c, no) {
  return { id: c.id, no, title: c.title, topic: c.topic, person: c.person, story: c.story, desk: c.desk, options: c.options };
}

const clip = (v, n) => String(v ?? "").trim().slice(0, n);

export function cleanCaseInput(b) {
  const desk = Array.isArray(b.desk)
    ? b.desk.map((d) => ({ label: clip(d?.label, 60), value: clip(d?.value, 200) })).filter((d) => d.label || d.value).slice(0, 6)
    : [];
  const c = {
    title: clip(b.title, 160),
    topic: clip(b.topic, 120),
    person: clip(b.person, 160),
    story: clip(b.story, 3000),
    desk,
    options: { A: clip(b.options?.A, 800), B: clip(b.options?.B, 800), C: clip(b.options?.C, 800) },
    answer: clip(b.answer, 1).toUpperCase(),
    basis: clip(b.basis, 2000),
    competency: clip(b.competency, 160),
    aktif: b.aktif !== false,
  };
  const errors = [];
  if (!c.title) errors.push("Judul kasus wajib diisi.");
  if (!c.person) errors.push("Nama tokoh wajib diisi.");
  if (!c.story) errors.push("Narasi kasus wajib diisi.");
  if (!c.options.A || !c.options.B || !c.options.C) errors.push("Pilihan A, B, dan C wajib diisi.");
  if (!["A", "B", "C"].includes(c.answer)) errors.push("Jawaban benar harus A, B, atau C.");
  return { c, errors };
}

// Hari dalam WIB (UTC+7) -> rentang waktu ISO UTC.
export function wibRange(from, to) {
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  return {
    fromIso: ok(from) ? new Date(`${from}T00:00:00+07:00`).toISOString() : null,
    toIso: ok(to) ? new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 864e5).toISOString() : null,
  };
}

export function wibDate(iso) {
  return new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
}
