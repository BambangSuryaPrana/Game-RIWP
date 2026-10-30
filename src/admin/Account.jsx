import React, { useEffect, useState } from "react";
import { fmtWib } from "../api.js";
import { useAdminApi, useToast, Field, ConfirmButton } from "./ui.jsx";

export default function Account({ me, onAuthLost }) {
  const call = useAdminApi(onAuthLost);
  const toast = useToast();
  const [admins, setAdmins] = useState([]);
  const [nf, setNf] = useState({ username: "", nama: "", password: "" });
  const [pw, setPw] = useState({ current: "", password: "" });
  const [msg, setMsg] = useState({});

  const load = () => call("/admin/admins").then(setAdmins).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addAdmin = async (e) => {
    e.preventDefault(); setMsg({});
    try { await call("/admin/admins", { method: "POST", body: nf }); setNf({ username: "", nama: "", password: "" }); toast("Admin ditambahkan."); load(); }
    catch (x) { setMsg({ add: x.message }); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setMsg({});
    try { await call("/admin/password", { method: "PUT", body: pw }); setPw({ current: "", password: "" }); setMsg({ pwOk: "Password berhasil diganti." }); }
    catch (x) { setMsg({ pw: x.message }); }
  };

  return (
    <>
      <section className="panel">
        <div className="panel-head"><div><h2>Akun saya</h2><p>{me.nama} · @{me.username}</p></div></div>
        <form onSubmit={changePw} className="form-grid">
          {msg.pw && <p className="err-box full" style={{ margin: 0 }}>{msg.pw}</p>}
          {msg.pwOk && <p className="ok-box full" style={{ margin: 0 }}>{msg.pwOk}</p>}
          <Field label="Password lama" id="pw-c"><input className="inp" id="pw-c" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="Password baru (min. 8 karakter, huruf & angka)" id="pw-n"><input className="inp" id="pw-n" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
          <div className="full"><button className="btn-p" type="submit" disabled={!pw.current || !pw.password}>Ganti password</button></div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>Daftar admin ({admins.length})</h2><p>Semua admin punya akses yang sama ke dashboard, data peserta, dan bank soal.</p></div></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Nama</th><th>Username</th><th>Dibuat</th><th></th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.nama}</b></td><td>@{a.username}</td><td className="small">{fmtWib(a.createdAt, false)}</td>
                  <td style={{ textAlign: "right" }}>
                    {a.id === me.id ? <span className="badge info">Anda</span> : (
                      <ConfirmButton label="Hapus" question={`Hapus admin @${a.username}?`}
                        onConfirm={async () => { await call("/admin/admins/" + a.id, { method: "DELETE" }); toast("Admin dihapus."); load(); }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={addAdmin} style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <h3 style={{ fontSize: 15 }}>Tambah admin</h3>
          {msg.add && <p className="err-box">{msg.add}</p>}
          <div className="form-grid">
            <Field label="Username" id="na-u"><input className="inp" id="na-u" autoComplete="off" value={nf.username} onChange={(e) => setNf({ ...nf, username: e.target.value })} /></Field>
            <Field label="Nama lengkap" id="na-n"><input className="inp" id="na-n" value={nf.nama} onChange={(e) => setNf({ ...nf, nama: e.target.value })} /></Field>
            <Field label="Password awal" id="na-p" className="full"><input className="inp" id="na-p" type="password" autoComplete="new-password" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} /></Field>
          </div>
          <div><button className="btn-p" type="submit" disabled={!nf.username || !nf.nama || !nf.password}>Tambah admin</button></div>
        </form>
      </section>
    </>
  );
}
