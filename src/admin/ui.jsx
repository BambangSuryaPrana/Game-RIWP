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
