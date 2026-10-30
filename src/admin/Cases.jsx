import React, { useEffect, useState } from "react";
import { useAdminApi, useToast, Drawer, Field, ConfirmButton } from "./ui.jsx";

const blank = () => ({
  title: "", topic: "", person: "", story: "",
  desk: [{ label: "Issue", value: "" }, { label: "Context", value: "" }, { label: "RIWP Focus", value: "" }],
  options: { A: "", B: "", C: "" }, answer: "A", basis: "", competency: "", aktif: true,
});

export default function Cases({ onAuthLost }) {
  const call = useAdminApi(onAuthLost);
  const toast = useToast();
  const [cases, setCases] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState("");

  const load = () => call("/admin/cases").then(setCases).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const move = async (i, dir) => {
    const ids = cases.map((c) => c.id);
    const j = i + dir;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { setCases(await call("/admin/cases/reorder", { method: "POST", body: { ids } })); }
    catch (e) { toast(e.message, "err"); }
  };
  const toggle = async (c) => {
    try {
      await call("/admin/cases/" + c.id, { method: "PUT", body: { ...c, aktif: !c.aktif } });
      toast(c.aktif ? "Kasus dinonaktifkan. Tidak muncul di game." : "Kasus diaktifkan lagi.");
      load();
    } catch (e) { toast(e.message, "err"); }
  };

  const active = cases?.filter((c) => c.aktif).length ?? 0;
  let no = 0;
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{cases ? `${cases.length} kasus · ${active} aktif di game` : "Memuat…"}</h2>
            <p>Perubahan langsung berlaku untuk pegawai yang mulai main setelahnya. Riwayat jawaban lama tidak berubah.</p>
          </div>
          <button type="button" className="btn-p" onClick={() => setEdit(blank())}>+ Tambah kasus</button>
        </div>
        {err && <p className="err-box">{err}</p>}
        {cases?.map((c, i) => {
          if (c.aktif) no++;
          return (
            <div className={"case-item" + (c.aktif ? "" : " off")} key={c.id}>
              <span className="case-no">{c.aktif ? String(no).padStart(2, "0") : "–"}</span>
              <div style={{ minWidth: 0 }}>
                <h3>{c.title}</h3>
                <p>{c.person} · {c.topic || "tanpa topik"} · kunci <b>{c.answer}</b>{!c.aktif && " · nonaktif"}</p>
              </div>
              <div className="case-tools">
                <button type="button" className="btn-g" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Naikkan">↑</button>
                <button type="button" className="btn-g" disabled={i === cases.length - 1} onClick={() => move(i, 1)} aria-label="Turunkan">↓</button>
                <button type="button" className="btn-s" onClick={() => toggle(c)}>{c.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
                <button type="button" className="btn-s" onClick={() => setEdit(c)}>Edit</button>
              </div>
            </div>
          );
        })}
      </section>
      {edit && <CaseEditor initial={edit} call={call} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function CaseEditor({ initial, call, onClose, onSaved }) {
  const toast = useToast();
  const [c, setC] = useState(() => JSON.parse(JSON.stringify(initial)));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = !initial.id;
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const setOpt = (k) => (e) => setC({ ...c, options: { ...c.options, [k]: e.target.value } });
  const setDesk = (i, k) => (e) => { const d = [...c.desk]; d[i] = { ...d[i], [k]: e.target.value }; setC({ ...c, desk: d }); };

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await call(isNew ? "/admin/cases" : "/admin/cases/" + c.id, { method: isNew ? "POST" : "PUT", body: c });
      toast(isNew ? "Kasus ditambahkan." : "Perubahan disimpan.");
      onSaved();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <Drawer onClose={onClose} label="Edit kasus">
      <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
        <div className="drawer-head">
          <h2>{isNew ? "Tambah kasus" : "Edit kasus"}</h2>
          <button className="btn-s" type="button" onClick={onClose}>Tutup</button>
        </div>
        {err && <p className="err-box" role="alert">{err}</p>}
        <section className="panel form-grid">
          <Field label="Judul kasus" id="c-title" className="full"><input className="inp" id="c-title" value={c.title} onChange={set("title")} placeholder='Contoh: The "Just a Joke" Comment' /></Field>
          <Field label="Topik" id="c-topic"><input className="inp" id="c-topic" value={c.topic} onChange={set("topic")} placeholder="Contoh: Larangan Pelecehan" /></Field>
          <Field label="Tokoh & jabatan" id="c-person"><input className="inp" id="c-person" value={c.person} onChange={set("person")} placeholder="Contoh: Dina, Frontliner" /></Field>
          <Field label="Narasi kasus" id="c-story" className="full"><textarea className="inp" id="c-story" rows={5} value={c.story} onChange={set("story")} /></Field>
        </section>
        <section className="panel" style={{ display: "grid", gap: 10 }}>
          <h3 style={{ fontSize: 15 }}>On the Desk</h3>
          {c.desk.map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 0.6fr) minmax(0, 1.4fr) auto", gap: 8 }}>
              <input className="inp" aria-label={`Label ${i + 1}`} value={d.label} onChange={setDesk(i, "label")} placeholder="Label" />
              <input className="inp" aria-label={`Isi ${i + 1}`} value={d.value} onChange={setDesk(i, "value")} placeholder="Isi" />
              <button type="button" className="btn-g" aria-label="Hapus baris" onClick={() => setC({ ...c, desk: c.desk.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          {c.desk.length < 6 && <div><button type="button" className="btn-s" onClick={() => setC({ ...c, desk: [...c.desk, { label: "", value: "" }] })}>+ Baris</button></div>}
        </section>
        <section className="panel" style={{ display: "grid", gap: 12 }}>
          <h3 style={{ fontSize: 15 }}>Pilihan jawaban</h3>
          <p className="small muted" style={{ margin: 0 }}>Klik huruf untuk menandai jawaban yang benar.</p>
          {["A", "B", "C"].map((k) => (
            <div className="opt-row" key={k}>
              <button type="button" className={"opt-key" + (c.answer === k ? " on" : "")} aria-pressed={c.answer === k} aria-label={`Jadikan ${k} jawaban benar`} onClick={() => setC({ ...c, answer: k })}>{k}</button>
              <textarea className="inp" rows={2} aria-label={`Pilihan ${k}`} value={c.options[k]} onChange={setOpt(k)} />
            </div>
          ))}
          <Field label="Dasar RIWP (muncul setelah pegawai menjawab)" id="c-basis"><textarea className="inp" id="c-basis" rows={3} value={c.basis} onChange={set("basis")} /></Field>
          <Field label="Kompetensi yang diuji" id="c-comp"><input className="inp" id="c-comp" value={c.competency} onChange={set("competency")} /></Field>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
            <input type="checkbox" checked={c.aktif} onChange={(e) => setC({ ...c, aktif: e.target.checked })} /> Tampilkan di game
          </label>
        </section>
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          {!isNew ? (
            <ConfirmButton label="Hapus kasus" question="Hapus kasus ini? Riwayat jawaban pegawai tetap tersimpan."
              onConfirm={async () => { await call("/admin/cases/" + c.id, { method: "DELETE" }); toast("Kasus dihapus."); onSaved(); }} />
          ) : <span />}
          <button className="btn-p" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan kasus"}</button>
        </div>
      </form>
    </Drawer>
  );
}
