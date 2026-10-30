import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { ToastProvider, Field } from "./ui.jsx";
import Dashboard from "./Dashboard.jsx";
import Players from "./Players.jsx";
import Cases from "./Cases.jsx";
import Settings from "./Settings.jsx";
import Account from "./Account.jsx";
import "./admin.css";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "▦", title: "Dashboard", sub: "Ringkasan siapa saja yang sudah bermain dan bagaimana hasilnya." },
  { id: "peserta", label: "Peserta", icon: "👥", title: "Data Peserta", sub: "Rekap per NIPP, riwayat permainan, dan detail jawaban." },
  { id: "soal", label: "Bank Soal", icon: "📁", title: "Bank Soal", sub: "Ubah, tambah, nonaktifkan, atau urutkan case file." },
  { id: "pengaturan", label: "Pengaturan", icon: "⚙", title: "Pengaturan Game", sub: "Teks pembuka, pesan umpan balik, batas lulus, dan daftar unit kerja." },
  { id: "akun", label: "Akun", icon: "👤", title: "Akun Admin", sub: "Kelola akun admin dan password." },
];

export default function AdminApp({ tab }) {
  const [state, setState] = useState({ loading: true });

  const load = useCallback(async () => {
    try {
      const st = await api("/admin/status");
      if (st.needsSetup) return setState({ needsSetup: true, codeRequired: !!st.setupCodeRequired });
      try {
        const me = await api("/admin/me");
        setState({ me });
      } catch (e) {
        setState({ login: true, database: st.database });
      }
    } catch (e) {
      setState({ error: e.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const onAuthLost = useCallback(() => setState({ login: true }), []);

  const logout = async () => { await api("/admin/logout", { method: "POST" }).catch(() => {}); setState({ login: true }); };

  let content;
  if (state.loading) content = <div className="auth"><div className="auth-card">Memuat…</div></div>;
  else if (state.error) content = <div className="auth"><div className="auth-card"><h1>Server tidak terjangkau</h1><p className="err-box">{state.error}</p><button className="btn-p" onClick={load}>Coba lagi</button></div></div>;
  else if (state.needsSetup) content = <Setup onDone={load} codeRequired={state.codeRequired} />;
  else if (state.login) content = <Login onDone={load} />;
  else {
    const active = TABS.find((t) => t.id === tab) || TABS[0];
    content = (
      <>
        <header className="adm-hero">
          <div className="adm-hero-in">
            <div className="adm-top">
              <div className="adm-logo"><i>R</i> RIWP Case Files · Admin</div>
              <div className="adm-user">
                <span>Halo, <b>{state.me.nama}</b></span>
                <button type="button" onClick={logout}>Keluar</button>
              </div>
            </div>
            <h1>{active.title}</h1>
            <p>{active.sub}</p>
            <nav className="adm-tabs" aria-label="Menu admin">
              {TABS.map((t) => (
                <a key={t.id} href={`#/admin/${t.id}`} aria-current={t.id === active.id ? "page" : undefined}><span aria-hidden="true">{t.icon}</span>{t.label}</a>
              ))}
            </nav>
          </div>
        </header>
        <main className="adm-main">
          {active.id === "dashboard" && <Dashboard onAuthLost={onAuthLost} />}
          {active.id === "peserta" && <Players onAuthLost={onAuthLost} />}
          {active.id === "soal" && <Cases onAuthLost={onAuthLost} />}
          {active.id === "pengaturan" && <Settings onAuthLost={onAuthLost} />}
          {active.id === "akun" && <Account me={state.me} onAuthLost={onAuthLost} />}
        </main>
        <nav className="adm-bottom" aria-label="Menu admin">
          {TABS.map((t) => (
            <a key={t.id} href={`#/admin/${t.id}`} aria-current={t.id === active.id ? "page" : undefined}><span aria-hidden="true">{t.icon}</span>{t.label}</a>
          ))}
        </nav>
      </>
    );
  }
  return <ToastProvider><div className="adm">{content}</div></ToastProvider>;
}

function Login({ onDone }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/admin/login", { method: "POST", body: f }); onDone(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="adm-logo" style={{ color: "var(--navy)" }}><i style={{ color: "#fff" }}>R</i> RIWP Case Files</div>
        <h1>Masuk admin</h1>
        {err && <p className="err-box" role="alert">{err}</p>}
        <Field label="Username" id="lu"><input className="inp" id="lu" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label="Password" id="lp"><input className="inp" id="lp" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <button className="btn-p" type="submit" disabled={busy || !f.username || !f.password}>{busy ? "Memeriksa…" : "Masuk"}</button>
        <a className="small muted" href="#/">← Kembali ke game</a>
      </form>
    </div>
  );
}

function Setup({ onDone, codeRequired }) {
  const [f, setF] = useState({ code: "", username: "", nama: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/admin/setup", { method: "POST", body: f }); onDone(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="adm-logo" style={{ color: "var(--navy)" }}><i style={{ color: "#fff" }}>R</i> RIWP Case Files</div>
        <h1>Buat akun admin pertama</h1>
        <p className="small muted" style={{ margin: 0 }}>Akun ini dipakai untuk masuk ke dashboard. Admin lain bisa ditambahkan nanti di menu Akun.</p>
        {err && <p className="err-box" role="alert">{err}</p>}
        {codeRequired && <Field label="Kode setup" id="sc"><input className="inp" id="sc" autoComplete="off" value={f.code} onChange={set("code")} /></Field>}
        <Field label="Username" id="su"><input className="inp" id="su" autoComplete="username" placeholder="contoh: admin.sdm" value={f.username} onChange={set("username")} /></Field>
        <Field label="Nama lengkap" id="sn"><input className="inp" id="sn" value={f.nama} onChange={set("nama")} /></Field>
        <Field label="Password (min. 8 karakter, huruf & angka)" id="sp"><input className="inp" id="sp" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
        <button className="btn-p" type="submit" disabled={busy}>{busy ? "Membuat…" : "Buat akun & masuk"}</button>
      </form>
    </div>
  );
}
