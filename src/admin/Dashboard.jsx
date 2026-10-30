import React, { useEffect, useState } from "react";
import { fmtWib } from "../api.js";
import { useToast, copyText, StatusBadge, useAdminApi } from "./ui.jsx";

export function FilterBar({ value, onChange, units, withSearch = false, extra }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="filters">
      {withSearch && (
        <div className="fld" style={{ flex: "1 1 220px" }}>
          <label htmlFor="f-q">Cari NIPP / nama</label>
          <input className="inp" id="f-q" type="search" placeholder="Ketik NIPP atau nama" value={value.q || ""} onChange={set("q")} />
        </div>
      )}
      <div className="fld" style={{ flex: "1 1 180px" }}>
        <label htmlFor="f-unit">Unit kerja</label>
        <select className="inp" id="f-unit" value={value.unit || ""} onChange={set("unit")}>
          <option value="">Semua unit</option>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="fld"><label htmlFor="f-from">Dari tanggal</label><input className="inp" id="f-from" type="date" value={value.from || ""} onChange={set("from")} /></div>
      <div className="fld"><label htmlFor="f-to">Sampai tanggal</label><input className="inp" id="f-to" type="date" value={value.to || ""} onChange={set("to")} /></div>
      {(value.unit || value.from || value.to || value.q) && <button type="button" className="btn-g" onClick={() => onChange({})}>Reset filter</button>}
      {extra}
    </div>
  );
}

export const qs = (f) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? "?" + s : "";
};

export default function Dashboard({ onAuthLost }) {
  const call = useAdminApi(onAuthLost);
  const toast = useToast();
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);
  const [units, setUnits] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () => call("/admin/summary" + qs(filters)).then((d) => alive && (setData(d), setErr(""))).catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 15000); // perbarui otomatis tiap 15 detik
    return () => { alive = false; clearInterval(t); };
  }, [filters, call]);
  useEffect(() => { call("/admin/units").then(setUnits).catch(() => {}); }, [call]);

  const gameUrl = `${window.location.origin}${window.location.pathname}#/`;
  const t = data?.totals;

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div><h2>Link game untuk pegawai</h2><p>Bagikan link ini. Pegawai masuk dengan NIPP, nama, dan unit kerja, lalu bisa main kapan saja.</p></div>
          <a className="btn-p" href={"/api/admin/export.xlsx" + qs(filters)}>⬇ Unduh Excel</a>
        </div>
        <div className="link-box">
          <code>{gameUrl}</code>
          <button type="button" className="btn-s" onClick={() => copyText(gameUrl, toast)}>Salin link</button>
          <a className="btn-s" href="#/" target="_blank" rel="noreferrer">Buka</a>
        </div>
        <div style={{ marginTop: 16 }}><FilterBar value={filters} onChange={setFilters} units={units} /></div>
      </section>

      {err && <p className="err-box" role="alert">{err}</p>}

      <section className="tiles" aria-label="Ringkasan">
        <div className="tile accent"><div className="lbl">Pegawai sudah akses</div><div className="val">{t ? t.players : "–"}</div><div className="sub">NIPP unik</div></div>
        <div className="tile"><div className="lbl">Total permainan</div><div className="val">{t ? t.plays : "–"}</div><div className="sub">{t ? `${t.finished} selesai · ${t.unfinished} belum` : ""}</div></div>
        <div className="tile"><div className="lbl">Rata-rata nilai</div><div className="val">{t?.avgPercent ?? "–"}</div><div className="sub">dari permainan selesai</div></div>
        <div className="tile"><div className="lbl">Pegawai lulus</div><div className="val">{t ? t.passedPlayers : "–"}</div><div className="sub">nilai terbaik ≥ {t?.passScore ?? 80}</div></div>
        <div className="tile"><div className="lbl">Tingkat kelulusan</div><div className="val">{t && t.players ? Math.round((t.passedPlayers / t.players) * 100) + "%" : "–"}</div><div className="sub">dari pegawai yang akses</div></div>
      </section>

      <div className="grid3">
        <section className="panel">
          <div className="panel-head"><div><h2>Ketepatan jawaban per kasus</h2><p>Persentase jawaban benar. Kasus dengan nilai rendah perlu penguatan materi.</p></div></div>
          {!data?.perCase.length ? <p className="empty">Belum ada jawaban.</p> : (
            <div className="hbars">
              {data.perCase.map((c) => (
                <div className="hbar" key={c.caseId} title={`${c.correct} dari ${c.answered} benar · A ${c.choices.A} · B ${c.choices.B} · C ${c.choices.C}`}>
                  <div className="name"><b>{String(c.no).padStart(2, "0")}</b>{c.title}</div>
                  <div className="pct">{c.percent}%</div>
                  <div className="track"><div className="fill" style={{ width: `${c.percent}%` }} /></div>
                  <div className="meta">
                    <span>{c.correct}/{c.answered} benar</span>
                    <span>Pilihan A {c.choices.A} · B {c.choices.B} · C {c.choices.C}</span>
                    {c.percent < 60 && <span className="badge bad">! Perlu penguatan</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <div style={{ display: "grid", gap: 18, alignContent: "start", minWidth: 0 }}>
          <section className="panel">
            <div className="panel-head"><div><h2>Sebaran nilai</h2><p>Jumlah permainan selesai per rentang nilai.</p></div></div>
            <VBars items={(data?.distribution || []).map((d) => ({ label: String(d.bucket), value: d.count, tip: `Nilai ${d.bucket}${d.bucket < 100 ? "–" + (d.bucket + 9) : ""}: ${d.count} permainan` }))} />
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Aktivitas harian</h2><p>Jumlah permainan per hari (WIB).</p></div></div>
            {!data?.daily.length ? <p className="empty">Belum ada aktivitas.</p> : (
              <VBars items={data.daily.slice(-14).map((d) => ({ label: d.date.slice(8) + "/" + d.date.slice(5, 7), value: d.count, tip: `${d.date}: ${d.count} permainan` }))} />
            )}
          </section>
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="panel-head"><div><h2>Per unit kerja</h2><p>Berdasarkan nilai terbaik tiap pegawai.</p></div></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Unit</th><th className="r">Pegawai</th><th className="r">Rata-rata</th><th className="r">Lulus</th></tr></thead>
              <tbody>
                {!data?.perUnit.length ? <tr><td colSpan={4} className="empty">Belum ada data.</td></tr> :
                  data.perUnit.map((u) => (
                    <tr key={u.unit}><td>{u.unit}</td><td className="r">{u.players}</td><td className="r">{u.avgBest ?? "–"}</td><td className="r">{u.passed}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h2>Aktivitas terbaru</h2><p>Diperbarui otomatis setiap 15 detik.</p></div><a className="btn-s" href="#/admin/peserta">Lihat semua</a></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Pegawai</th><th>Waktu</th><th className="r">Nilai</th><th>Status</th></tr></thead>
              <tbody>
                {!data?.recent.length ? <tr><td colSpan={4} className="empty">Belum ada yang bermain.</td></tr> :
                  data.recent.map((p) => (
                    <tr key={p.id}>
                      <td><b>{p.nama}</b><div className="small muted">{p.nipp} · {p.unit}</div></td>
                      <td className="small">{fmtWib(p.startedAt)}</td>
                      <td className="r"><b>{p.percent ?? "–"}</b></td>
                      <td><StatusBadge percent={p.percent} passScore={t?.passScore ?? 80} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function VBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <>
      <div className="vbars">
        {items.map((i, k) => (
          <div className="vbar" key={k} title={i.tip}>
            <div className={"b" + (i.value ? "" : " zero")} style={{ height: `${(i.value / max) * 100}%` }} />
            {i.value > 0 && <span className="v" style={{ bottom: `${(i.value / max) * 100}%` }}>{i.value}</span>}
          </div>
        ))}
      </div>
      <div className="vlabels">{items.map((i, k) => <span key={k}>{i.label}</span>)}</div>
    </>
  );
}
