// Hapus peserta per NIPP, hapus beberapa sekaligus, dan bersihkan data sesuai filter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db/index.js";
import { createApp } from "../server/app.js";

function client(base) {
  let cookie = "";
  return async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method, headers: { "content-type": "application/json", cookie, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

test("hapus & bersihkan data peserta", async (t) => {
  const db = await openDatabase({ url: "", sqliteFile: ":memory:" });
  const server = createApp(db, {}).listen(0);
  t.after(async () => { server.close(); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const sup = client(base), adm = client(base), pub = client(base);

  // 4 pegawai: A selesai 2x, B selesai, C belum selesai, D (unit lain) belum selesai
  async function play(nipp, unit, finish) {
    const s = (await pub("POST", "/plays", { nipp, nama: "Pegawai " + nipp, unit })).body;
    const h = { "x-play-token": s.token };
    await pub("POST", `/plays/${s.playId}/answers`, { caseId: s.cases[0].id, choice: "B" }, h);
    if (finish) await pub("POST", `/plays/${s.playId}/finish`, {}, h);
  }
  await play("11111", "Kantor Pusat", true);
  await play("11111", "Kantor Pusat", true);
  await play("22222", "Kantor Pusat", true);
  await play("33333", "Kantor Pusat", false);
  await play("44444", "Daop 2 Bandung", false);

  await sup("POST", "/admin/setup", { username: "boss", nama: "Super", password: "rahasia123" });
  await sup("POST", "/admin/admins", { username: "staf", nama: "Staf", password: "rahasia456" });
  await adm("POST", "/admin/login", { username: "staf", password: "rahasia456" });

  // admin biasa tidak boleh menghapus
  assert.equal((await adm("POST", "/admin/players/delete", { nipps: ["11111"] })).status, 403);
  assert.equal((await adm("POST", "/admin/plays/clear", { confirm: "HAPUS" })).status, 403);

  // hapus satu peserta = semua permainannya (2) + jawabannya
  const d1 = await sup("POST", "/admin/players/delete", { nipps: ["11111"] });
  assert.deepEqual(d1.body, { players: 1, plays: 2 });
  assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM riwp_answers")).n), 3);
  assert.equal((await sup("GET", "/admin/players")).body.length, 3);

  // bersihkan wajib ketik HAPUS
  assert.equal((await sup("POST", "/admin/plays/clear", { scope: "unfinished", confirm: "ya" })).status, 400);

  // hanya yang belum selesai, dibatasi filter unit -> hanya 33333
  const c1 = await sup("POST", "/admin/plays/clear", { scope: "unfinished", unit: "Kantor Pusat", confirm: "hapus" });
  assert.equal(c1.body.plays, 1);
  const left = (await sup("GET", "/admin/players")).body.map((p) => p.nipp).sort();
  assert.deepEqual(left, ["22222", "44444"]);

  // hapus beberapa sekaligus
  const d2 = await sup("POST", "/admin/players/delete", { nipps: ["22222", "44444"] });
  assert.deepEqual(d2.body, { players: 2, plays: 2 });
  assert.equal((await sup("GET", "/admin/summary")).body.totals.plays, 0);
  assert.equal(Number((await db.get("SELECT COUNT(*) AS n FROM riwp_answers")).n), 0);

  // soal & admin tidak ikut terhapus
  assert.equal((await sup("GET", "/admin/cases")).body.length, 10);
  assert.equal((await sup("GET", "/admin/admins")).body.length, 2);
});
