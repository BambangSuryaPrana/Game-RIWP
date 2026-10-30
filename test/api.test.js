// Uji alur lengkap: bermain, skor dihitung server, dashboard admin, bank soal, ekspor Excel.
// Berjalan di SQLite (memori). Set TEST_DATABASE_URL untuk menguji PostgreSQL juga.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db/index.js";
import { createApp } from "../server/app.js";
import { TABLES } from "../server/db/index.js";

const targets = [{ name: "SQLite", opts: { url: "", sqliteFile: ":memory:" } }];
if (process.env.TEST_DATABASE_URL) targets.push({ name: "PostgreSQL", opts: { url: process.env.TEST_DATABASE_URL } });

for (const t of targets) {
  test(`alur lengkap (${t.name})`, async (tt) => {
    if (t.name === "PostgreSQL") {
      const pre = await openDatabase({ ...t.opts, seed: false });
      for (const tb of [...TABLES].reverse()) await pre.run(`DROP TABLE IF EXISTS ${tb} CASCADE`);
      await pre.close();
    }
    const db = await openDatabase(t.opts);
    const app = createApp(db, { setupCode: "KODE123" });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api`;
    let cookie = "";
    const call = async (method, url, body, headers = {}) => {
      const res = await fetch(base + url, {
        method, headers: { "content-type": "application/json", cookie, ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0];
      const ct = res.headers.get("content-type") || "";
      return { status: res.status, body: ct.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
    };
    tt.after(async () => { server.close(); await db.close(); });

    // info game & soal bawaan
    const info = await call("GET", "/game");
    assert.equal(info.status, 200);
    assert.equal(info.body.totalCases, 10);

    // validasi data pemain
    assert.equal((await call("POST", "/plays", { nipp: "1", nama: "A", unit: "X" })).status, 400);

    // main: jawab semua benar kecuali soal 1
    const start = await call("POST", "/plays", { nipp: "12345", nama: "Dina Lestari", unit: "Daop 2 Bandung" });
    assert.equal(start.status, 201);
    const { playId, token, cases } = start.body;
    assert.equal(cases.length, 10);
    assert.equal(cases[0].answer, undefined, "kunci jawaban tidak boleh bocor ke pemain");
    const keys = ["B", "B", "B", "C", "B", "B", "A", "C", "B", "C"];
    const h = { "x-play-token": token };
    assert.equal((await call("POST", `/plays/${playId}/answers`, { caseId: cases[0].id, choice: "B" }, { "x-play-token": "salah" })).status, 404);
    for (let i = 0; i < cases.length; i++) {
      const choice = i === 0 ? "A" : keys[i];
      const r = await call("POST", `/plays/${playId}/answers`, { caseId: cases[i].id, choice }, h);
      assert.equal(r.status, 200);
      assert.equal(r.body.correct, i !== 0);
      assert.equal(r.body.answer, keys[i]);
    }
    // jawaban kedua untuk soal yang sama tidak mengubah hasil
    const again = await call("POST", `/plays/${playId}/answers`, { caseId: cases[0].id, choice: "B" }, h);
    assert.equal(again.body.correct, false);
    const fin = await call("POST", `/plays/${playId}/finish`, {}, h);
    assert.equal(fin.body.score, 9);
    assert.equal(fin.body.percent, 90);
    assert.equal(fin.body.passed, true);
    assert.equal((await call("POST", `/plays/${playId}/answers`, { caseId: cases[1].id, choice: "B" }, h)).status, 409);

    // pemain kedua belum selesai
    const s2 = await call("POST", "/plays", { nipp: "67890", nama: "Budi", unit: "Kantor Pusat" });
    await call("POST", `/plays/${s2.body.playId}/answers`, { caseId: s2.body.cases[0].id, choice: "B" }, { "x-play-token": s2.body.token });

    // admin: belum login ditolak, setup butuh kode
    assert.equal((await call("GET", "/admin/summary")).status, 401);
    assert.equal((await call("GET", "/admin/status")).body.needsSetup, true);
    assert.equal((await call("POST", "/admin/setup", { code: "SALAH", username: "admin", nama: "Admin", password: "rahasia123" })).status, 403);
    assert.equal((await call("POST", "/admin/setup", { code: "KODE123", username: "admin", nama: "Admin SDM", password: "pendek" })).status, 400);
    assert.equal((await call("POST", "/admin/setup", { code: "KODE123", username: "admin", nama: "Admin SDM", password: "rahasia123" })).status, 201);
    assert.equal((await call("GET", "/admin/me")).body.username, "admin");

    const sum = (await call("GET", "/admin/summary")).body;
    assert.equal(sum.totals.players, 2);
    assert.equal(sum.totals.plays, 2);
    assert.equal(sum.totals.finished, 1);
    assert.equal(sum.totals.avgPercent, 90);
    assert.equal(sum.totals.passedPlayers, 1);
    assert.equal(sum.perCase[0].answered, 2);
    assert.equal(sum.perCase[0].correct, 1);

    const players = (await call("GET", "/admin/players?q=dina")).body;
    assert.equal(players.length, 1);
    assert.equal(players[0].bestPercent, 90);
    const detail = (await call("GET", `/admin/plays/${playId}`)).body;
    assert.equal(detail.answers.length, 10);
    assert.equal(detail.answers[0].choice, "A");

    // ekspor Excel
    const x = await call("GET", "/admin/export.xlsx");
    assert.equal(x.status, 200);
    assert.equal(x.body.subarray(0, 2).toString(), "PK");

    // bank soal: tambah, nonaktifkan, urutkan, hapus
    const created = await call("POST", "/admin/cases", {
      title: "Kasus Uji", topic: "Uji", person: "Tes, Unit", story: "Cerita", desk: [{ label: "Issue", value: "x" }],
      options: { A: "a", B: "b", C: "c" }, answer: "c", basis: "dasar", competency: "k",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.answer, "C");
    assert.equal((await call("GET", "/game")).body.totalCases, 11);
    const upd = await call("PUT", `/admin/cases/${created.body.id}`, { ...created.body, aktif: false });
    assert.equal(upd.body.aktif, false);
    assert.equal((await call("GET", "/game")).body.totalCases, 10);
    const all = (await call("GET", "/admin/cases")).body;
    const reordered = (await call("POST", "/admin/cases/reorder", { ids: [created.body.id, ...all.filter((c) => c.id !== created.body.id).map((c) => c.id)] })).body;
    assert.equal(reordered[0].id, created.body.id);
    assert.equal((await call("DELETE", `/admin/cases/${created.body.id}`)).status, 200);

    // pengaturan
    const set = await call("PUT", "/admin/settings", { ...(await call("GET", "/admin/settings")).body, passScore: 95 });
    assert.equal(set.body.passScore, 95);
    assert.equal((await call("GET", "/admin/summary")).body.totals.passedPlayers, 0);

    // admin kedua & ganti password
    assert.equal((await call("POST", "/admin/admins", { username: "sdm2", nama: "Admin Dua", password: "rahasia456" })).status, 201);
    assert.equal((await call("PUT", "/admin/password", { current: "rahasia123", password: "baru12345" })).status, 200);

    // hapus data permainan
    assert.equal((await call("DELETE", `/admin/plays/${s2.body.playId}`)).status, 200);
    assert.equal((await call("GET", "/admin/summary")).body.totals.plays, 1);

    // keluar
    await call("POST", "/admin/logout");
    cookie = "";
    assert.equal((await call("GET", "/admin/me")).status, 401);
    assert.equal((await call("POST", "/admin/login", { username: "admin", password: "baru12345" })).status, 200);
  });
}
