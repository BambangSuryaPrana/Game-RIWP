import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Dipakai semua halaman admin: panggil API, dan arahkan ke login kalau sesi habis.
export function useAdminApi(onAuthLost) {
  return useCallback(async (path, opts) => {
    try { return await api(path, opts); }
    catch (e) { if (e.status === 401) onAuthLost(); throw e; }
  }, [onAuthLost]);
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const show = useCallback((msg, kind = "ok") => {
    clearTimeout(timer.current);
    setT({ msg, kind });
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={"toast" + (t.kind === "err" ? " err" : "")} role="status">{t.msg}</div>}
    </ToastCtx.Provider>
  );
}

// Konfirmasi di dalam halaman (tanpa window.confirm).
export function ConfirmButton({ label, question, confirmLabel = "Ya, hapus", onConfirm, className = "btn-d" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="confirm">
      <p>{question}</p>
      <button type="button" className="btn-s" onClick={() => setOpen(false)} disabled={busy}>Batal</button>
      <button type="button" className="btn-d" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await onConfirm(); setOpen(false); } finally { setBusy(false); }
      }}>{busy ? "Memproses…" : confirmLabel}</button>
    </div>
  );
}

export function Drawer({ onClose, children, label }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

export function StatusBadge({ percent, passScore }) {
  if (percent == null) return <span className="badge off">○ Belum selesai</span>;
  return percent >= passScore
    ? <span className="badge good">✓ Lulus</span>
    : <span className="badge warn">! Belum lulus</span>;
}

export function Field({ label, id, children, className = "" }) {
  return (
    <div className={"fld " + className}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function copyText(text, toast) {
  const done = () => toast("Link disalin.");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => toast("Salin manual: " + text, "err"));
  else toast("Salin manual: " + text, "err");
}

// Kolom password dengan tombol ikon mata untuk menampilkan/menyembunyikan isinya.
export function PasswordInput({ id, wrapStyle, className = "inp", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap" style={wrapStyle}>
      <input {...props} id={id} className={className} type={show ? "text" : "password"} />
      <button
        type="button"
        className="pw-eye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={show}
        aria-controls={id}
        title={show ? "Sembunyikan password" : "Tampilkan password"}
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
