import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "./db/index.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT || 3001);
const DEV = process.argv.includes("--dev");
const distDir = path.resolve("dist");
const hasBuild = fs.existsSync(path.join(distDir, "index.html"));

const db = await openDatabase();
const setupCode = process.env.SETUP_KODE || crypto.randomBytes(4).toString("hex").toUpperCase();
const app = createApp(db, { setupCode, distDir: DEV ? null : distDir, devHint: DEV || !hasBuild });

app.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal);
  console.log(`\nRIWP Case Files berjalan.`);
  console.log(`  Database      : ${db.label}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`  Alamat publik : ${process.env.RENDER_EXTERNAL_URL}`);
  } else if (DEV) {
    // Mode dev: tampilan disajikan Vite di port 5173; port ini hanya API.
    console.log(`  Buka aplikasi : http://localhost:5173`);
    if (lan) console.log(`  Dari HP/laptop lain (Wi-Fi sama): http://${lan.address}:5173`);
    console.log(`  (Port ${PORT} hanya server API, bukan tampilan.)`);
  } else if (hasBuild) {
    console.log(`  Buka aplikasi : http://localhost:${PORT}`);
    if (lan) console.log(`  Dari HP/laptop lain (Wi-Fi sama): http://${lan.address}:${PORT}`);
  } else {
    console.log(`  Tampilan belum di-build. Jalankan "npm run build" dulu, lalu "npm start" lagi.`);
    console.log(`  Atau pakai mode dev: "npm run dev" lalu buka http://localhost:5173`);
  }
  if (!process.env.SETUP_KODE) console.log(`  Kode setup    : ${setupCode}  (dipakai sekali untuk membuat akun admin pertama)`);
  if (db.kind === "sqlite" && process.env.RENDER) {
    console.warn("  PERINGATAN: di Render, file SQLite hilang setiap restart. Isi DATABASE_URL (Neon) supaya data permanen.");
  }
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => { await db.close().catch(() => {}); process.exit(0); });
}
