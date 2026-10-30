// Mengisi soal dan pengaturan bawaan (dari dokumen RIWP Case Games) saat database masih kosong.
import fs from "node:fs";

const content = JSON.parse(fs.readFileSync(new URL("./defaultContent.json", import.meta.url), "utf8"));

export const DEFAULT_SETTINGS = content.settings;
export const DEFAULT_CASES = content.cases;

export async function seedIfEmpty(db) {
  const now = new Date().toISOString();
  const s = await db.get("SELECT COUNT(*) AS n FROM riwp_settings");
  if (Number(s.n) === 0) {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      await db.run("INSERT INTO riwp_settings (key, value) VALUES (?, ?)", [k, JSON.stringify(v)]);
    }
  } else {
    // Tambahkan kunci baru (dari versi aplikasi yang lebih baru) tanpa menimpa yang sudah ada.
    const have = new Set((await db.all("SELECT key FROM riwp_settings")).map((r) => r.key));
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      if (!have.has(k)) await db.run("INSERT INTO riwp_settings (key, value) VALUES (?, ?)", [k, JSON.stringify(v)]);
    }
  }
  const c = await db.get("SELECT COUNT(*) AS n FROM riwp_cases");
  if (Number(c.n) === 0) {
    let i = 1;
    for (const k of DEFAULT_CASES) {
      await db.run(
        `INSERT INTO riwp_cases (urutan, aktif, title, topic, person, story, desk_json, opt_a, opt_b, opt_c, answer, basis, competency, updated_at)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [i++, k.title, k.topic, k.person, k.story, JSON.stringify(k.desk), k.options.A, k.options.B, k.options.C, k.answer, k.basis, k.competency, now]
      );
    }
  }
}
