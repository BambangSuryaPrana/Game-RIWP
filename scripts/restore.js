// npm run restore -- backups/riwp-backup-....json [--timpa]
// Memulihkan backup ke database yang sedang dipakai (DATABASE_URL atau SQLite lokal).
// Juga dipakai untuk pindah dari SQLite lokal ke Neon: backup dulu tanpa DATABASE_URL,
// lalu isi DATABASE_URL dan jalankan restore.
import "dotenv/config";
import fs from "node:fs";
import { openDatabase, TABLES } from "../server/db/index.js";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const overwrite = process.argv.includes("--timpa");
if (!file || !fs.existsSync(file)) {
  console.error("Pakai: npm run restore -- backups/riwp-backup-....json [--timpa]");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (data.app !== "riwp-case-files") { console.error("File ini bukan backup RIWP Case Files."); process.exit(1); }

const db = await openDatabase({ seed: false });
const filled = [];
for (const t of TABLES) if (Number((await db.get(`SELECT COUNT(*) AS n FROM ${t}`)).n) > 0) filled.push(t);
if (filled.length && !overwrite) {
  console.error(`Database tujuan (${db.label}) sudah berisi data: ${filled.join(", ")}.\nTambahkan --timpa untuk menghapus isi lama lalu memulihkan backup.`);
  await db.close();
  process.exit(1);
}

await db.tx(async (t) => {
  for (const tb of [...TABLES].reverse()) await t.run(`DELETE FROM ${tb}`);
  for (const tb of TABLES) {
    for (const row of data.tables[tb] || []) {
      const cols = Object.keys(row);
      await t.run(`INSERT INTO ${tb} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => row[c]));
    }
  }
});
if (db.kind === "postgres") {
  // Samakan penghitung id otomatis setelah menyalin id dari backup.
  for (const tb of ["riwp_admins", "riwp_cases"]) {
    await db.run(`SELECT setval(pg_get_serial_sequence('${tb}', 'id'), COALESCE((SELECT MAX(id) FROM ${tb}), 0) + 1, false)`);
  }
}
const counts = TABLES.map((t) => `${t.replace("riwp_", "")}: ${(data.tables[t] || []).length}`).join(", ");
console.log(`Backup dipulihkan ke ${db.label}\n  ${counts}`);
await db.close();
