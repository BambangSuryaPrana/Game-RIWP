// Akun admin: password di-hash dengan scrypt, token sesi disimpan sebagai hash SHA-256.
import crypto from "node:crypto";

const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
export const COOKIE = "riwp_sess";

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(hashHex, "hex");
  return want.length === hash.length && crypto.timingSafeEqual(want, hash);
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = () => crypto.randomBytes(32).toString("base64url");

export function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password minimal 8 karakter.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password harus berisi huruf dan angka.";
  return null;
}

export async function createSession(db, adminId) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await db.run("DELETE FROM riwp_sessions WHERE expires_at < ?", [new Date().toISOString()]);
  await db.run("INSERT INTO riwp_sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)", [sha256(token), adminId, expires]);
  return { token, maxAge: SESSION_DAYS * 864e5 };
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function cookieOptions(req, maxAge) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge };
}

export function requireAdmin(db) {
  return async (req, res, next) => {
    try {
      const token = readCookie(req, COOKIE);
      if (!token) return res.status(401).json({ error: "Silakan masuk terlebih dahulu." });
      const row = await db.get(
        `SELECT a.id, a.username, a.nama, a.role FROM riwp_sessions s JOIN riwp_admins a ON a.id = s.admin_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
        [sha256(token), new Date().toISOString()]
      );
      if (!row) return res.status(401).json({ error: "Sesi berakhir. Silakan masuk lagi." });
      req.admin = { id: Number(row.id), username: row.username, nama: row.nama, role: row.role === "superadmin" ? "superadmin" : "admin" };
      next();
    } catch (e) {
      next(e);
    }
  };
}

// Hanya untuk super admin. Dipasang setelah requireAdmin.
export function requireSuper(req, res, next) {
  if (req.admin?.role !== "superadmin") return res.status(403).json({ error: "Hanya Super Admin yang bisa melakukan ini." });
  next();
}

export const ROLES = ["superadmin", "admin"];

// Pembatas percobaan sederhana di memori (per IP), untuk login dan pendaftaran pemain.
export function rateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || "x";
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: message });
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) hits.clear();
    next();
  };
}
