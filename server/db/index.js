// Lapisan database: satu API untuk SQLite (lokal) dan PostgreSQL (Neon / Supabase).
// Semua query memakai placeholder "?"; untuk PostgreSQL otomatis diubah menjadi $1, $2, ...
import fs from "node:fs";
import path from "node:path";
import { schemaSql } from "./schema.js";
import { seedIfEmpty } from "../seed.js";

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => "$" + ++i);
}

function describePg(url) {
  try {
    const host = new URL(url).hostname;
    if (host.includes("neon.tech")) return `Neon (${host})`;
    if (host.includes("supabase")) return `Supabase (${host})`;
    return `PostgreSQL (${host})`;
  } catch {
    return "PostgreSQL";
  }
}

async function openPostgres(url) {
  const { default: pg } = await import("pg");
  const sslMode = (process.env.DATABASE_SSL || "").toLowerCase();
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /host=\/|@\//.test(url);
  let ssl;
  if (sslMode === "off" || (isLocal && sslMode !== "verify")) ssl = false;
  else if (sslMode === "no-verify") ssl = { rejectUnauthorized: false };
  else {
    ssl = { rejectUnauthorized: true };
    if (process.env.DATABASE_SSL_CA) ssl.ca = fs.readFileSync(path.resolve(process.env.DATABASE_SSL_CA), "utf8");
  }
  // sslmode di URL bisa menimpa opsi ssl di atas; buang supaya pengaturan dari .env yang berlaku.
  const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
  const pool = new pg.Pool({ connectionString: cleanUrl, ssl, max: 5, idleTimeoutMillis: 30000 });
  pool.on("error", (e) => console.error("[db] koneksi PostgreSQL error:", e.message));

  const run = async (client, sql, params = []) => client.query(toPg(sql), params);
  const api = {
    kind: "postgres",
    label: describePg(url),
    async all(sql, params) { return (await run(pool, sql, params)).rows; },
    async get(sql, params) { return (await run(pool, sql, params)).rows[0]; },
    async run(sql, params) { const r = await run(pool, sql, params); return { changes: r.rowCount, rows: r.rows }; },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const t = {
          all: async (s, p) => (await run(client, s, p)).rows,
          get: async (s, p) => (await run(client, s, p)).rows[0],
          run: async (s, p) => { const r = await run(client, s, p); return { changes: r.rowCount, rows: r.rows }; },
        };
        const out = await fn(t);
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    async close() { await pool.end(); },
  };
  for (const stmt of schemaSql("postgres")) await pool.query(stmt);
  return api;
}

async function openSqlite(file) {
  const { DatabaseSync } = await import("node:sqlite");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  for (const stmt of schemaSql("sqlite")) db.exec(stmt);
  let lock = Promise.resolve();
  const norm = (p = []) => p.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v));
  const api = {
    kind: "sqlite",
    label: file === ":memory:" ? "SQLite (memori)" : `SQLite (${path.relative(process.cwd(), file)})`,
    async all(sql, params) { return db.prepare(sql).all(...norm(params)); },
    async get(sql, params) { return db.prepare(sql).get(...norm(params)); },
    async run(sql, params) {
      const st = db.prepare(sql);
      if (/\breturning\b/i.test(sql)) { const rows = st.all(...norm(params)); return { changes: rows.length, rows }; }
      const r = st.run(...norm(params));
      return { changes: Number(r.changes), rows: [] };
    },
    tx(fn) {
      // Antrekan transaksi supaya dua permintaan tidak membuka BEGIN bersamaan.
      const job = lock.then(async () => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const out = await fn(api);
          db.exec("COMMIT");
          return out;
        } catch (e) {
          try { db.exec("ROLLBACK"); } catch {}
          throw e;
        }
      });
      lock = job.catch(() => {});
      return job;
    },
    async close() { db.close(); },
  };
  return api;
}

export async function openDatabase({ url = process.env.DATABASE_URL, sqliteFile, seed = true } = {}) {
  const db = url
    ? await openPostgres(url)
    : await openSqlite(sqliteFile || process.env.SQLITE_FILE || path.resolve("data/riwp.db"));
  await migrate(db);
  if (seed) await seedIfEmpty(db);
  return db;
}

// Pembaruan struktur untuk database yang dibuat versi lama aplikasi.
async function migrate(db) {
  // v1.1: kolom peran admin (superadmin / admin)
  try {
    await db.get("SELECT role FROM riwp_admins LIMIT 1");
  } catch {
    await db.run("ALTER TABLE riwp_admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
  }
  await ensureSuperAdmin(db);
}

// Harus selalu ada minimal satu super admin. Kalau belum ada (misalnya database lama),
// admin yang paling pertama dibuat dijadikan super admin.
export async function ensureSuperAdmin(db) {
  const s = await db.get("SELECT COUNT(*) AS n FROM riwp_admins WHERE role = 'superadmin'");
  if (Number(s.n) > 0) return;
  const first = await db.get("SELECT MIN(id) AS id FROM riwp_admins");
  if (first?.id != null) await db.run("UPDATE riwp_admins SET role = 'superadmin' WHERE id = ?", [first.id]);
}

export const TABLES = ["riwp_admins", "riwp_sessions", "riwp_settings", "riwp_cases", "riwp_plays", "riwp_answers"];
