import React, { useCallback, useEffect, useState } from "react";
import { fmtWib } from "../api.js";
import { useAdminApi, useToast, Drawer, StatusBadge, ConfirmButton } from "./ui.jsx";
import { FilterBar, qs } from "./Dashboard.jsx";

export default function Players({ onAuthLost }) {
  const call = useAdminApi(onAuthLost);
  const [filters, setFilters] = useState({});
  const [mode, setMode] = useState("pegawai");
  const [rows, setRows] = useState(null);
  const [units, setUnits] = useState([]);
  const [passScore, setPassScore] = useState(80);
  const [open, setOpen] = useState(null); // NIPP yang sedang dibuka
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      call((mode === "pegawai" ? "/admin/players" : "/admin/plays") + qs(filters))
        .then((d) => alive && (setRows(d), setErr("")))
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
      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}>
          {mode === "pegawai" ? (
            <table className="tbl">
              <thead><tr><th>NIPP</th><th>Nama</th><th>Unit kerja</th><th className="r">Main</th><th className="r">Terbaik</th><th className="r">Terakhir</th><th>Status</th><th>Terakhir akses</th></tr></thead>
              <tbody>
                {rows && !rows.length && <tr><td colSpan={8} className="empty">Belum ada pegawai yang cocok dengan filter.</td></tr>}
                {rows?.map((p) => (
                  <tr key={p.nipp} className="click" tabIndex={0} onClick={() => setOpen(p.nipp)} onKeyDown={(e) => e.key === "Enter" && setOpen(p.nipp)}>
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
      {open && <PlayerDrawer nipp={open} call={call} passScore={passScore} onClose={() => setOpen(null)} onChanged={() => setTick((x) => x + 1)} />}
    </>
  );
}

function PlayerDrawer({ nipp, call, passScore, onClose, onChanged }) {
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
          <div style={{ marginTop: 14 }}>
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
          </div>
        </section>
      )}
    </Drawer>
  );
}
