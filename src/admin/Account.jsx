import React, { useEffect, useState } from "react";
import { fmtWib } from "../api.js";
import { useAdminApi, useToast, Field, ConfirmButton, PasswordInput } from "./ui.jsx";

const ROLE_LABEL = { superadmin: "Super Admin", admin: "Admin" };

export function RoleBadge({ role }) {
  return role === "superadmin"
    ? <span className="badge super">★ Super Admin</span>
    : <span className="badge info">Admin</span>;
}

export default function Account({ me, onAuthLost }) {
  const call = useAdminApi(onAuthLost);
  const toast = useToast();
  const isSuper = me.role === "superadmin";
  const [admins, setAdmins] = useState([]);
  const [nf, setNf] = useState({ username: "", nama: "", password: "", role: "admin" });
  const [pw, setPw] = useState({ current: "", password: "" });
  const [msg, setMsg] = useState({});
  const [resetFor, setResetFor] = useState(null); // id admin yang sedang direset password-nya
  const [resetPw, setResetPw] = useState("");

  const load = () => call("/admin/admins").then(setAdmins).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addAdmin = async (e) => {
    e.preventDefault(); setMsg({});
    try {
      await call("/admin/admins", { method: "POST", body: nf });
      setNf({ username: "", nama: "", password: "", role: "admin" });
      toast(`${ROLE_LABEL[nf.role]} ditambahkan.`);
      load();
    } catch (x) { setMsg({ add: x.message }); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setMsg({});
    try { await call("/admin/password", { method: "PUT", body: pw }); setPw({ current: "", password: "" }); setMsg({ pwOk: "Password berhasil diganti." }); }
    catch (x) { setMsg({ pw: x.message }); }
  };
  const changeRole = async (a, role) => {
    try { await call(`/admin/admins/${a.id}/role`, { method: "PUT", body: { role } }); toast(`@${a.username} sekarang ${ROLE_LABEL[role]}.`); load(); }
    catch (x) { toast(x.message, "err"); load(); }
  };
  const doReset = async (a) => {
    try {
      await call(`/admin/admins/${a.id}/password`, { method: "PUT", body: { password: resetPw } });
      toast(`Password @${a.username} direset. Beri tahu password barunya ke yang bersangkutan.`);
      setResetFor(null); setResetPw("");
    } catch (x) { toast(x.message, "err"); }
  };

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div><h2>Akun saya</h2><p>{me.nama} · @{me.username}</p></div>
          <RoleBadge role={me.role} />
        </div>
        <form onSubmit={changePw} className="form-grid">
          {msg.pw && <p className="err-box full" style={{ margin: 0 }}>{msg.pw}</p>}
          {msg.pwOk && <p className="ok-box full" style={{ margin: 0 }}>{msg.pwOk}</p>}
          <Field label="Password lama" id="pw-c"><PasswordInput id="pw-c" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="Password baru (min. 8 karakter, huruf & angka)" id="pw-n"><PasswordInput id="pw-n" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
          <div className="full"><button className="btn-p" type="submit" disabled={!pw.current || !pw.password}>Ganti password</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Daftar admin ({admins.length})</h2>
            <p>{isSuper ? "Ubah peran, reset password, atau hapus admin. Harus selalu ada minimal satu Super Admin." : "Hanya Super Admin yang bisa menambah, menghapus, atau mengubah peran admin."}</p>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Dibuat</th>{isSuper && <th></th>}</tr></thead>
            <tbody>
              {admins.map((a) => {
                const self = a.id === me.id;
                return (
                  <React.Fragment key={a.id}>
                    <tr>
                      <td><b>{a.nama}</b>{self && <span className="small muted"> (Anda)</span>}</td>
                      <td>@{a.username}</td>
                      <td>
                        {isSuper && !self ? (
                          <select className="inp" style={{ width: "auto", padding: "6px 10px" }} aria-label={`Peran @${a.username}`}
                            value={a.role} onChange={(e) => changeRole(a, e.target.value)}>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Super Admin</option>
                          </select>
                        ) : <RoleBadge role={a.role} />}
                      </td>
                      <td className="small">{fmtWib(a.createdAt, false)}</td>
                      {isSuper && (
                        <td style={{ textAlign: "right" }}>
                          {!self && (
                            <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                              <button type="button" className="btn-s" onClick={() => { setResetFor(resetFor === a.id ? null : a.id); setResetPw(""); }}>Reset password</button>
                              <ConfirmButton label="Hapus" question={`Hapus @${a.username}?`}
                                onConfirm={async () => {
                                  try { await call("/admin/admins/" + a.id, { method: "DELETE" }); toast("Admin dihapus."); load(); }
                                  catch (x) { toast(x.message, "err"); }
                                }} />
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    {resetFor === a.id && (
                      <tr>
                        <td colSpan={5} style={{ background: "var(--surface-2)" }}>
                          <form className="row-actions" onSubmit={(e) => { e.preventDefault(); doReset(a); }}>
                            <label htmlFor={`rp-${a.id}`} className="small" style={{ fontWeight: 700 }}>Password baru untuk @{a.username}</label>
                            <PasswordInput id={`rp-${a.id}`} autoComplete="new-password" wrapStyle={{ flex: "1 1 220px", width: "auto" }}
                              placeholder="min. 8 karakter, huruf & angka" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
                            <button type="submit" className="btn-p" disabled={!resetPw}>Simpan</button>
                            <button type="button" className="btn-g" onClick={() => setResetFor(null)}>Batal</button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {isSuper && (
          <form onSubmit={addAdmin} style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <h3 style={{ fontSize: 15 }}>Tambah admin</h3>
            {msg.add && <p className="err-box">{msg.add}</p>}
            <div className="form-grid">
              <Field label="Username" id="na-u"><input className="inp" id="na-u" autoComplete="off" value={nf.username} onChange={(e) => setNf({ ...nf, username: e.target.value })} /></Field>
              <Field label="Nama lengkap" id="na-n"><input className="inp" id="na-n" value={nf.nama} onChange={(e) => setNf({ ...nf, nama: e.target.value })} /></Field>
              <Field label="Password awal" id="na-p"><PasswordInput id="na-p" autoComplete="new-password" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} /></Field>
              <Field label="Peran" id="na-r">
                <select className="inp" id="na-r" value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </Field>
            </div>
            <div><button className="btn-p" type="submit" disabled={!nf.username || !nf.nama || !nf.password}>Tambah {ROLE_LABEL[nf.role]}</button></div>
          </form>
        )}
      </section>
    </>
  );
}
