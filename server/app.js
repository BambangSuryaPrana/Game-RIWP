import express from "express";
import fs from "node:fs";
import path from "node:path";
import { publicRoutes } from "./routes/public.js";
import { adminRoutes } from "./routes/admin.js";

export function createApp(db, { setupCode, distDir, devHint = false } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "200kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });

  app.get("/api/health", (req, res) => res.json({ ok: true, database: db.kind }));
  app.use("/api", (req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.use("/api/admin", adminRoutes(db, { setupCode }));
  app.use("/api", publicRoutes(db));
  app.use("/api", (req, res) => res.status(404).json({ error: "Alamat API tidak dikenal." }));

  if (distDir && fs.existsSync(path.join(distDir, "index.html"))) {
    app.use(express.static(distDir, { index: false, maxAge: "1h" }));
    app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
  } else if (devHint) {
    // Tanpa hasil build, port ini hanya API. Beri petunjuk, bukan "Cannot GET /".
    app.get("*", (req, res) => {
      const host = (req.headers.host || "localhost").replace(/:\d+$/, "");
      const url = `http://${host}:5173`;
      res.status(200).type("html").send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIWP Case Files</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px;color:#18203f;line-height:1.6">
<h1 style="font-size:22px">Ini alamat server API, bukan tampilan aplikasi</h1>
<p>Saat <code>npm run dev</code>, tampilan aplikasi ada di port <b>5173</b>:</p>
<p><a href="${url}/" style="font-size:18px;font-weight:700">${url}</a></p>
<p style="color:#5f6886">Kalau ingin semuanya di satu alamat (port 3001), hentikan server lalu jalankan <code>npm run build</code> dan <code>npm start</code>.</p>
</body></html>`);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Format data tidak valid." });
    console.error("[server]", err);
    res.status(500).json({ error: "Terjadi kesalahan di server. Coba lagi." });
  });
  return app;
}
