// Peran Super Admin vs Admin, dan migrasi database versi lama (tanpa kolom peran).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../server/db/index.js";
import { createApp } from "../server/app.js";

function client(base) {
  let cookie = "";
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method, headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const ct = res.headers.get("content-type") || "";
    return { status: res.status, body: ct.includes("json") ? await res.json() : null };
  };
}

test("hak akses Super Admin dan Admin", async (t) => {
  const db = await openDatabase({ url: "", sqliteFile: ":memory:" });
  const server = createApp(db, {}).listen(0);
  t.after(async () => { server.close(); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const sup = client(base);
  const adm = client(base);

  // admin pertama = super admin
  assert.equal((await sup("POST", "/admin/setup", { username: "boss", nama: "Super", password: "rahasia123" })).status, 201);
  assert.equal((await sup("GET", "/admin/me")).body.role, "superadmin");

  // super admin menambah admin biasa (peran bawaan: admin)
  assert.equal((await sup("POST", "/admin/admins", { username: "staf", nama: "Staf SDM", password: "rahasia456" })).status, 201);
  const list = (await sup("GET", "/admin/admins")).body;
  const staf = list.find((a) => a.username === "staf");
  assert.equal(staf.role, "admin");

  // admin biasa: bisa lihat & edit soal, tidak bisa aksi khusus super admin
  assert.equal((await adm("POST", "/admin/login", { username: "staf", password: "rahasia456" })).status, 200);
  assert.equal((await adm("GET", "/admin/me")).body.role, "admin");
  assert.equal((await adm("GET", "/admin/summary")).status, 200);
  assert.equal((await adm("GET", "/admin/admins")).status, 200);
  const cases = (await adm("GET", "/admin/cases")).body;
  assert.equal((await adm("PUT", `/admin/cases/${cases[0].id}`, { ...cases[0], topic: "Diubah staf" })).status, 200);
  assert.equal((await adm("DELETE", `/admin/cases/${cases[0].id}`)).status, 403);
  const settings = (await adm("GET", "/admin/settings")).body;
  assert.equal((await adm("PUT", "/admin/settings", settings)).status, 403);
  assert.equal((await adm("POST", "/admin/admins", { username: "x1", nama: "X", password: "rahasia789" })).status, 403);
  assert.equal((await adm("PUT", `/admin/admins/${staf.id}/role`, { role: "superadmin" })).status, 403);
  assert.equal((await adm("DELETE", "/admin/plays/apa-saja")).status, 403);

  // super admin tidak bisa mengubah peran / menghapus diri sendiri, dan harus tersisa 1 super admin
  const me = (await sup("GET", "/admin/me")).body;
  assert.equal((await sup("PUT", `/admin/admins/${me.id}/role`, { role: "admin" })).status, 400);
  assert.equal((await sup("DELETE", `/admin/admins/${me.id}`)).status, 400);

  // naikkan staf jadi super admin, lalu staf bisa menurunkan boss
  assert.equal((await sup("PUT", `/admin/admins/${staf.id}/role`, { role: "superadmin" })).status, 200);
  assert.equal((await adm("GET", "/admin/me")).body.role, "superadmin");
  assert.equal((await adm("PUT", `/admin/admins/${me.id}/role`, { role: "admin" })).status, 200);
  // sekarang staf satu-satunya super admin: boss (admin) tidak bisa apa-apa, dan staf tidak bisa dihapus
  assert.equal((await sup("DELETE", `/admin/admins/${staf.id}`)).status, 403);

  // reset password admin lain oleh super admin -> sesi lamanya diputus
  assert.equal((await adm("PUT", `/admin/admins/${me.id}/password`, { password: "baru12345" })).status, 200);
  assert.equal((await sup("GET", "/admin/me")).status, 401);
  assert.equal((await sup("POST", "/admin/login", { username: "boss", password: "baru12345" })).status, 200);
});

test("migrasi database lama: admin pertama jadi Super Admin", async (t) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "riwp-")), "lama.db");
  const { DatabaseSync } = await import("node:sqlite");
  const old = new DatabaseSync(file);
  // struktur tabel admin versi sebelum ada peran
  old.exec(`CREATE TABLE riwp_admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL)`);
  old.exec(`INSERT INTO riwp_admins (username, nama, pass_hash, created_at) VALUES
    ('pertama', 'Admin Pertama', 'x', '2026-10-01'), ('kedua', 'Admin Kedua', 'x', '2026-10-02')`);
  old.close();

  const db = await openDatabase({ url: "", sqliteFile: file });
  t.after(async () => { await db.close(); fs.rmSync(path.dirname(file), { recursive: true, force: true }); });
  const rows = await db.all("SELECT username, role FROM riwp_admins ORDER BY id");
  assert.deepEqual(rows.map((r) => [r.username, r.role]), [["pertama", "superadmin"], ["kedua", "admin"]]);
});
