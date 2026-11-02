import React, { useCallback, useEffect, useState } from "react";
import { fmtWib } from "../api.js";
import { useAdminApi, useToast, Drawer, StatusBadge, ConfirmButton } from "./ui.jsx";
import { FilterBar, qs } from "./Dashboard.jsx";

export default function Players({ onAuthLost, isSuper }) {
  const call = useAdminApi(onAuthLost);
  const [filters, setFilters] = useState({});
  const [mode, setMode] = useState("pegawai");
  const [rows, setRows] = useState(null);
  const [units, setUnits] = useState([]);
  const [passScore, setPassScore] = useState(80);
  const [open, setOpen] = useState(null); // NIPP yang sedang dibuka
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState(() => new Set()); // NIPP yang dicentang (khusus Super Admin)
  const toast = useToast();
  const refresh = () => setTick((x) => x + 1);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      call((mode === "pegawai" ? "/admin/players" : "/admin/plays") + qs(filters))
        .then((d) => { if (!alive) return; setRows(d); setErr(""); setPicked((old) => new Set([...old].filter((n) => d.some((r) => r.nipp === n)))); })
        .catch((e) => alive && setErr(e.message));
    }, filters.q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [filters, mode, call, tick]);
  useEffect(() => {
    call("/admin/units").then(setUnits).catch(() => {});
    call("/admin/settings").then((s) => setPassScore(Number(s.passScore ?? 80))).catch(() => {});
  }, [call]);

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div><h2>{rows ? `${rows.length} ${mode === "pegawai" ? "pegawai" : "permainan"}` : "Memuat…"}</h2><p>Klik baris untuk melihat riwayat dan detail jawaban.</p></div>
          <div className="row-actions">
            <div className="seg-ctl" role="group" aria-label="Tampilan">
              <button type="button" aria-pressed={mode === "pegawai"} onClick={() => setMode("pegawai")}>Per pegawai</button>
              <button type="button" aria-pressed={mode === "main"} onClick={() => setMode("main")}>Semua permainan</button>
            </div>
            <a className="btn-p" href={"/api/admin/export.xlsx" + qs(filters)}>⬇ Unduh Excel</a>
          </div>
        </div>
        <FilterBar value={filters} onChange={setFilters} units={units} withSearch />
      </section>
      {err && <p className="err-box" role="alert">{err}</p>}
      {isSuper && mode === "pegawai" && picked.size > 0 && (
        <section className="panel bulk-bar" aria-live="polite">
          <div className="bulk-info">
            <b>{picked.size} pegawai dipilih</b>
            <span className="muted small">Semua permainan &amp; jawaban mereka akan ikut terhapus.</span>
            <button type="button" className="btn-s" onClick={() => setPicked(new Set())}>Batal pilih</button>
          </div>
          <div className="bulk-act">
            <ConfirmButton
              className="btn-danger"
              label={`🗑 Hapus ${picked.size} peserta`}
              question={`Hapus ${picked.size} peserta beserta semua permainannya? Tindakan ini tidak bisa dibatalkan.`}
              onConfirm={async () => {
                try {
                  const r = await call("/admin/players/delete", { method: "POST", body: { nipps: [...picked] } });
                  toast(`${r.players} peserta dihapus (${r.plays} permainan).`);
                  setPicked(new Set()); refresh();
                } catch (e) { toast(e.message, "err"); }
              }}
            />
          </div>
        </section>
      )}
      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}>
          {mode === "pegawai" ? (
            <table className="tbl">
              <thead><tr>{isSuper && (
                <th style={{ width: 44 }}>
                  <input type="checkbox" className="chk" aria-label="Pilih semua pegawai di daftar"
                    checked={!!rows?.length && rows.every((r) => picked.has(r.nipp))}
                    onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.nipp)) : new Set())} />
                </th>
              )}<th>NIPP</th><th>Nama</th><th>Unit kerja</th><th className="r">Main</th><th className="r">Terbaik</th><th className="r">Terakhir</th><th>Status</th><th>Terakhir akses</th></tr></thead>
              <tbody>
                {rows && !rows.length && <tr><td colSpan={isSuper ? 9 : 8} className="empty">Belum ada pegawai yang cocok dengan filter.</td></tr>}
                {rows?.map((p) => (
                  <tr key={p.nipp} className={"click" + (picked.has(p.nipp) ? " picked" : "")} tabIndex={0} onClick={() => setOpen(p.nipp)} onKeyDown={(e) => e.key === "Enter" && setOpen(p.nipp)}>
                    {isSuper && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="chk" aria-label={`Pilih ${p.nama}`} checked={picked.has(p.nipp)}
                          onChange={(e) => setPicked((old) => { const n = new Set(old); e.target.checked ? n.add(p.nipp) : n.delete(p.nipp); return n; })} />
                      </td>
                    )}
                    <td className="num"><b>{p.nipp}</b></td>
                    <td>{p.nama}</td>
                    <td>{p.unit}</td>
                    <td className="r">{p.attempts}</td>
                    <td className="r"><b>{p.bestPercent ?? "–"}</b>{p.best != null && <div className="small muted">{p.best}/{p.bestTotal}</div>}</td>
                    <td className="r">{p.lastPercent ?? "–"}</td>
                    <td><StatusBadge percent={p.bestPercent} passScore={passScore} /></td>
                    <td className="small">{fmtWib(p.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead><tr><th>Mulai</th><th>NIPP</th><th>Nama</th><th>Unit kerja</th><th className="r">Benar</th><th className="r">Nilai</th><th>Status</th></tr></thead>
              <tbody>
                {rows && !rows.length && <tr><td colSpan={7} className="empty">Belum ada permainan yang cocok dengan filter.</td></tr>}
                {rows?.map((p) => (
                  <tr key={p.id} className="click" tabIndex={0} onClick={() => setOpen(p.nipp)} onKeyDown={(e) => e.key === "Enter" && setOpen(p.nipp)}>
                    <td className="small">{fmtWib(p.startedAt)}</td>
                    <td className="num"><b>{p.nipp}</b></td>
                    <td>{p.nama}</td>
                    <td>{p.unit}</td>
                    <td className="r">{p.score ?? "–"}/{p.total}</td>
                    <td className="r"><b>{p.percent ?? "–"}</b></td>
                    <td><StatusBadge percent={p.percent} passScore={passScore} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {isSuper && <CleanupPanel call={call} filters={filters} onDone={refresh} />}
      {open && <PlayerDrawer nipp={open} call={call} passScore={passScore} isSuper={isSuper} onClose={() => setOpen(null)} onChanged={refresh} />}
    </>
  );
}

function PlayerDrawer({ nipp, call, passScore, isSuper, onClose, onChanged }) {
  const toast = useToast();
  const [plays, setPlays] = useState(null);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => call("/admin/plays?nipp=" + encodeURIComponent(nipp)).then((d) => {
    setPlays(d);
    setSel((s) => (s && d.some((p) => p.id === s) ? s : d[0]?.id || null));
  }), [call, nipp]);
  useEffect(() => { load().catch(() => {}); }, [load]);
  useEffect(() => {
    setDetail(null);
    if (sel) call("/admin/plays/" + sel).then(setDetail).catch(() => {});
  }, [sel, call]);

  const p0 = plays?.[0];
  return (
    <Drawer onClose={onClose} label={"Riwayat " + nipp}>
      <div className="drawer-head">
        <div>
          <p className="small muted" style={{ margin: 0 }}>NIPP {nipp}</p>
          <h2>{p0?.nama || "…"}</h2>
          <p className="muted" style={{ margin: 0 }}>{p0?.unit}</p>
        </div>
        <button className="btn-s" type="button" onClick={onClose}>Tutup</button>
      </div>
      {isSuper && plays?.length > 0 && (
        <ConfirmButton
          label="🗑 Hapus peserta ini"
          question={`Hapus ${p0?.nama || nipp} beserta ${plays.length} permainannya? Tindakan ini tidak bisa dibatalkan.`}
          onConfirm={async () => {
            try {
              const r = await call("/admin/players/delete", { method: "POST", body: { nipps: [nipp] } });
              toast(`Peserta dihapus (${r.plays} permainan).`);
              onChanged(); onClose();
            } catch (e) { toast(e.message, "err"); }
          }}
        />
      )}
      <section className="panel">
        <div className="panel-head"><div><h2>Riwayat permainan ({plays?.length ?? 0})</h2><p>Pilih salah satu untuk melihat jawabannya.</p></div></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Mulai</th><th className="r">Benar</th><th className="r">Nilai</th><th>Status</th></tr></thead>
            <tbody>
              {plays?.map((p) => (
                <tr key={p.id} className="click" tabIndex={0} onClick={() => setSel(p.id)} onKeyDown={(e) => e.key === "Enter" && setSel(p.id)}
                  style={p.id === sel ? { outline: "2px solid var(--blue)", outlineOffset: -2 } : undefined}>
                  <td className="small">{fmtWib(p.startedAt)}</td>
                  <td className="r">{p.score ?? "–"}/{p.total}</td>
                  <td className="r"><b>{p.percent ?? "–"}</b></td>
                  <td><StatusBadge percent={p.percent} passScore={passScore} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {detail && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Detail jawaban</h2>
              <p>Mulai {fmtWib(detail.startedAt)} · {detail.finishedAt ? "selesai " + fmtWib(detail.finishedAt) : "belum selesai"}</p>
            </div>
          </div>
          {!detail.answers.length ? <p className="empty">Belum ada soal yang dijawab.</p> : detail.answers.map((a) => (
            <div className="ans-row" key={a.no}>
              <span className="ans-no">{a.no}</span>
              <div style={{ minWidth: 0 }}><b>{a.title}</b><div className="small muted">Jawaban {a.choice} · kunci {a.answer}</div></div>
              {a.correct ? <span className="badge good">✓ Benar</span> : <span className="badge bad">✕ Salah</span>}
            </div>
          ))}
          {isSuper && <div style={{ marginTop: 14 }}>
            <ConfirmButton
              label="Hapus permainan ini"
              question="Hapus permainan ini beserta jawabannya? Pakai untuk data uji coba atau data dobel."
              onConfirm={async () => {
                await call("/admin/plays/" + detail.id, { method: "DELETE" });
                toast("Permainan dihapus.");
                onChanged();
                const rest = await call("/admin/plays?nipp=" + encodeURIComponent(nipp));
                if (!rest.length) onClose(); else { setPlays(rest); setSel(rest[0].id); }
              }}
            />
          </div>}
        </section>
      )}
    </Drawer>
  );
}

// Bersihkan data permainan sesuai filter aktif. Wajib ketik HAPUS.
function CleanupPanel({ call, filters, onDone }) {
  const toast = useToast();
  const [scope, setScope] = useState("unfinished");
  const [counts, setCounts] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const filtered = !!(filters.q || filters.unit || filters.from || filters.to);

  const loadCounts = useCallback(() => {
    call("/admin/plays" + qs(filters)).then((d) => setCounts({
      all: d.length,
      unfinished: d.filter((p) => !p.finishedAt).length,
      players: new Set(d.map((p) => p.nipp.toUpperCase())).size,
    })).catch(() => {});
  }, [call, filters]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const n = counts ? counts[scope] : 0;
  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call("/admin/plays/clear", { method: "POST", body: { ...filters, scope, confirm: text } });
      toast(r.plays ? `${r.plays} permainan dihapus.` : "Tidak ada data yang cocok.");
      setText(""); loadCounts(); onDone();
    } catch (x) { toast(x.message, "err"); }
    finally { setBusy(false); }
  };

  return (
    <section className="panel danger-zone">
      <div className="panel-head">
        <div>
          <h2>Bersihkan data peserta</h2>
          <p>{filtered ? "Hanya data yang cocok dengan filter di atas yang akan dihapus." : "Tidak ada filter aktif: berlaku untuk SEMUA data peserta."} Unduh Excel dulu sebagai cadangan.</p>
        </div>
      </div>
      <form onSubmit={run} style={{ display: "grid", gap: 14 }}>
        <div className="seg-ctl" role="radiogroup" aria-label="Data yang dihapus" style={{ justifySelf: "start", flexWrap: "wrap" }}>
          <button type="button" role="radio" aria-checked={scope === "unfinished"} aria-pressed={scope === "unfinished"} onClick={() => setScope("unfinished")}>
            Hanya yang belum selesai ({counts?.unfinished ?? "…"})
          </button>
          <button type="button" role="radio" aria-checked={scope === "all"} aria-pressed={scope === "all"} onClick={() => setScope("all")}>
            Semua permainan ({counts?.all ?? "…"} dari {counts?.players ?? "…"} pegawai)
          </button>
        </div>
        <div className="row-actions" style={{ alignItems: "flex-end" }}>
          <div className="fld" style={{ flex: "0 1 260px" }}>
            <label htmlFor="clr-confirm">Ketik <b>HAPUS</b> untuk konfirmasi</label>
            <input className="inp" id="clr-confirm" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="HAPUS" />
          </div>
          <button type="submit" className="btn-danger" disabled={busy || !n || text.trim().toUpperCase() !== "HAPUS"}>
            {busy ? "Menghapus…" : `Hapus ${n || 0} permainan`}
          </button>
        </div>
      </form>
    </section>
  );
}
