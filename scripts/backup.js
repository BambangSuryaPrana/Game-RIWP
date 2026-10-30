// npm run backup -> simpan seluruh isi database ke backups/riwp-backup-<tanggal>.json
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { openDatabase, TABLES } from "../server/db/index.js";

const db = await openDatabase({ seed: false });
const out = { app: "riwp-case-files", createdAt: new Date().toISOString(), database: db.label, tables: {} };
for (const t of TABLES) out.tables[t] = await db.all(`SELECT * FROM ${t}`);
await db.close();

fs.mkdirSync("backups", { recursive: true });
const stamp = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace(/[T:]/g, "-");
const file = path.join("backups", `riwp-backup-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
const counts = Object.entries(out.tables).map(([k, v]) => `${k.replace("riwp_", "")}: ${v.length}`).join(", ");
console.log(`Backup tersimpan: ${file}\n  dari ${out.database}\n  ${counts}`);
