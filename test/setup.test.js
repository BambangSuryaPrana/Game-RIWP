// Admin pertama tanpa kode setup (bawaan), dan halaman setup tertutup setelah ada admin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db/index.js";
import { createApp } from "../server/app.js";

test("admin pertama tanpa kode setup", async (t) => {
  const db = await openDatabase({ url: "", sqliteFile: ":memory:" });
  const server = createApp(db, { setupCode: null }).listen(0);
  t.after(async () => { server.close(); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (u, b) => fetch(base + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

  const st = await (await fetch(base + "/admin/status")).json();
  assert.equal(st.needsSetup, true);
  assert.equal(st.setupCodeRequired, false);

  const r = await post("/admin/setup", { username: "admin", nama: "Admin SDM", password: "rahasia123" });
  assert.equal(r.status, 201);

  // setelah ada admin, setup tidak bisa dipakai lagi
  const again = await post("/admin/setup", { username: "penyusup", nama: "X", password: "rahasia123" });
  assert.equal(again.status, 409);
  assert.equal((await (await fetch(base + "/admin/status")).json()).needsSetup, false);
});
