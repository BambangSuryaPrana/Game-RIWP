// Pintu masuk server untuk Vercel (serverless function).
// Semua permintaan /api/* diarahkan ke sini oleh vercel.json, lalu ditangani aplikasi Express yang sama.
// Di Vercel tidak ada penyimpanan file permanen, jadi DATABASE_URL (Neon/Supabase) wajib diisi.
import { openDatabase } from "../server/db/index.js";
import { createApp } from "../server/app.js";

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL belum diisi di Environment Variables Vercel. Isi dengan connection string Neon, lalu deploy ulang.");
      }
      const db = await openDatabase();
      return createApp(db, { setupCode: process.env.SETUP_KODE || null });
    })().catch((e) => {
      appPromise = null; // coba lagi di permintaan berikutnya
      throw e;
    });
  }
  return appPromise;
}

// Pulihkan alamat asli. Tergantung versi Vercel, permintaan /api/game bisa sampai di sini
// sebagai "/api/game" atau sebagai "/api?path=game".
function restoreUrl(req) {
  const u = new URL(req.url || "/", "http://x");
  if ((u.pathname === "/api" || u.pathname === "/api/") && u.searchParams.has("path")) {
    const p = u.searchParams.get("path");
    u.searchParams.delete("path");
    const q = u.searchParams.toString();
    req.url = "/api/" + p.replace(/^\/+/, "") + (q ? "?" + q : "");
  }
}

export default async function handler(req, res) {
  try {
    restoreUrl(req);
    const app = await getApp();
    return app(req, res);
  } catch (e) {
    console.error("[vercel]", e);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: e.message || "Server gagal dijalankan." }));
  }
}
