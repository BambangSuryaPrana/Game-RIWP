import React, { useEffect, useState } from "react";
import { useAdminApi, useToast, Field } from "./ui.jsx";

export default function Settings({ onAuthLost }) {
  const call = useAdminApi(onAuthLost);
  const toast = useToast();
  const [s, setS] = useState(null);
  const [lists, setLists] = useState({ praises: "", units: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    call("/admin/settings").then((d) => {
      setS(d);
      setLists({ praises: (d.praises || []).join("\n"), units: (d.units || []).join("\n") });
    }).catch((e) => setErr(e.message));
  }, [call]);

  if (!s) return <section className="panel">{err ? <p className="err-box">{err}</p> : "Memuat…"}</section>;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const lines = (t) => t.split("\n").map((x) => x.trim()).filter(Boolean);

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const d = await call("/admin/settings", { method: "PUT", body: { ...s, praises: lines(lists.praises), units: lines(lists.units) } });
      setS(d);
      setLists({ praises: d.praises.join("\n"), units: d.units.join("\n") });
      toast("Pengaturan disimpan.");
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 18 }}>
      {err && <p className="err-box" role="alert">{err}</p>}
      <section className="panel">
        <div className="panel-head"><div><h2>Halaman pembuka</h2><p>Tampil saat pegawai membuka link game.</p></div></div>
        <div className="form-grid">
          <Field label="Judul" id="s-title"><input className="inp" id="s-title" value={s.title || ""} onChange={set("title")} /></Field>
          <Field label="Subjudul" id="s-sub"><input className="inp" id="s-sub" value={s.subtitle || ""} onChange={set("subtitle")} /></Field>
          <Field label="Keterangan pembuka" id="s-intro" className="full"><textarea className="inp" id="s-intro" rows={3} value={s.intro || ""} onChange={set("intro")} /></Field>
          <Field label="Dasar peraturan" id="s-reg" className="full"><textarea className="inp" id="s-reg" rows={3} value={s.regulation || ""} onChange={set("regulation")} /></Field>
          <Field label="Kalimat pertanyaan di setiap kasus" id="s-q" className="full"><input className="inp" id="s-q" value={s.question || ""} onChange={set("question")} /></Field>
        </div>
      </section>
      <div className="grid2">
        <section className="panel">
          <div className="panel-head"><div><h2>Umpan balik & kelulusan</h2></div></div>
          <div className="form-grid">
            <Field label="Pesan saat salah (merah)" id="s-wrong"><input className="inp" id="s-wrong" value={s.wrongText || ""} onChange={set("wrongText")} /></Field>
            <Field label="Batas lulus (nilai 0–100)" id="s-pass"><input className="inp" id="s-pass" type="number" min={0} max={100} value={s.passScore ?? 80} onChange={set("passScore")} /></Field>
            <Field label="Pujian saat benar (hijau), satu per baris, dipakai bergantian" id="s-praise" className="full">
              <textarea className="inp" id="s-praise" rows={5} value={lists.praises} onChange={(e) => setLists({ ...lists, praises: e.target.value })} />
            </Field>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h2>Daftar unit kerja</h2><p>Muncul sebagai pilihan saat pegawai mengisi unit. Pegawai tetap bisa mengetik unit lain.</p></div></div>
          <Field label="Satu unit per baris" id="s-units"><textarea className="inp" id="s-units" rows={10} value={lists.units} onChange={(e) => setLists({ ...lists, units: e.target.value })} /></Field>
        </section>
      </div>
      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
        <button className="btn-p" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan pengaturan"}</button>
      </div>
    </form>
  );
}
