import React, { useEffect, useRef, useState } from "react";
import { api, store } from "../api.js";
import { sound } from "../sound.js";
import "./game.css";

const KEYS = ["A", "B", "C"];
const PROGRESS_KEY = "riwp-progress";
const pad = (n) => String(n).padStart(2, "0");
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Game() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  // play = { playId, token, cases, question, wrongText, praises }, results = { [caseId]: {choice, correct, answer, basis} }
  const [play, setPlay] = useState(() => store.sget(PROGRESS_KEY)?.play || null);
  const [idx, setIdx] = useState(() => store.sget(PROGRESS_KEY)?.idx || 0);
  const [results, setResults] = useState(() => store.sget(PROGRESS_KEY)?.results || {});
  const [final, setFinal] = useState(null);
  const [muted, setMutedState] = useState(sound.isMuted());

  useEffect(() => {
    api("/game").then(setInfo).catch((e) => setError(e.message));
  }, []);

  // Simpan progres di tab ini, supaya refresh halaman tidak mengulang dari awal.
  useEffect(() => {
    store.sset(PROGRESS_KEY, play && !final ? { play, idx, results } : null);
  }, [play, idx, results, final]);

  const toggleMute = () => { sound.unlock(); sound.setMuted(!muted); setMutedState(!muted); };

  const startGame = async (player) => {
    setError("");
    const p = await api("/plays", { method: "POST", body: player });
    store.set("riwp-player", player);
    setResults({}); setIdx(0); setFinal(null); setPlay(p);
    window.scrollTo(0, 0);
  };

  const finish = async () => {
    const f = await api(`/plays/${play.playId}/finish`, { method: "POST", headers: { "x-play-token": play.token } });
    sound.musicStop(); sound.sfx("end");
    setFinal(f);
    window.scrollTo(0, 0);
  };

  const restart = (samePlayer) => {
    store.sset(PROGRESS_KEY, null);
    setPlay(null); setFinal(null); setResults({}); setIdx(0);
    if (samePlayer) {
      const p = store.get("riwp-player");
      if (p) { sound.musicStart(); startGame(p).catch((e) => setError(e.message)); }
    } else sound.musicStop();
    window.scrollTo(0, 0);
  };

  const topbar = (
    <div className="topbar">
      <div className="brand"><b>RIWP</b> Case Files</div>
      <div className="tools">
        {play && !final && <span className="chip-btn" style={{ boxShadow: "none" }}>{store.get("riwp-player")?.nama}</span>}
        <button className="chip-btn" type="button" aria-pressed={muted} onClick={toggleMute}>
          {muted ? "🔇 Suara mati" : "🔊 Suara nyala"}
        </button>
      </div>
    </div>
  );

  let body;
  if (!info && !error) body = <div className="loading">Memuat game…</div>;
  else if (final) body = <Result final={final} topbar={topbar} play={play} onAgain={() => restart(true)} onSwitch={() => restart(false)} />;
  else if (play) body = (
    <Round
      key={play.playId} play={play} idx={idx} setIdx={setIdx} results={results} setResults={setResults}
      topbar={topbar} onFinish={finish}
    />
  );
  else body = <Start info={info} error={error} topbar={topbar} onStart={startGame} />;

  return (
    <div className="game-root">
      {body}
      <a className="foot-link" href="#/admin">Admin</a>
    </div>
  );
}

function Start({ info, error, topbar, onStart }) {
  const saved = store.get("riwp-player") || {};
  const [form, setForm] = useState({ nipp: saved.nipp || "", nama: saved.nama || "", unit: saved.unit || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ready = form.nipp.trim().length >= 4 && form.nama.trim().length >= 2 && form.unit.trim().length >= 2;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    sound.unlock(); sound.musicStart(); sound.sfx("tap");
    setBusy(true); setErr("");
    try { await onStart({ nipp: form.nipp.trim(), nama: form.nama.trim(), unit: form.unit.trim() }); }
    catch (x) { setErr(x.message); sound.musicStop(); }
    finally { setBusy(false); }
  };

  const title = info?.title || "RIWP Case Files";
  return (
    <div className="board">
      {topbar}
      <div className="start">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow pink">Respectful &amp; Inclusive Workplace Policy</p>
          <h1 className="hero-title"><span>RIWP</span> {title.replace(/^RIWP\s*/i, "") || "Case Files"}</h1>
          <p className="hero-sub">{info?.subtitle}</p>
          <p className="intro">{info?.intro}</p>
          <p className="reg">{info?.regulation}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Cara bermain</p>
          <ul className="how">
            <li><span className="key">{info?.totalCases ?? "–"}</span><span>Baca setiap case file dan detail di meja kerjanya.</span></li>
            <li><span className="key">A</span><span>Pilih satu tindakan yang paling tepat: A, B, atau C.</span></li>
            <li><span className="key">✓</span><span>Kunci jawaban dan dasar RIWP muncul setelah kamu memilih. Skor tampil di akhir.</span></li>
          </ul>
          <form onSubmit={submit} noValidate>
            {(error || err) && <p className="error-box" role="alert">{err || error}</p>}
            <div className="field">
              <label htmlFor="nipp">NIPP</label>
              <input className="input" id="nipp" inputMode="numeric" autoComplete="off" maxLength={20} placeholder="Contoh: 12345" value={form.nipp} onChange={set("nipp")} />
            </div>
            <div className="field">
              <label htmlFor="nama">Nama lengkap</label>
              <input className="input" id="nama" autoComplete="name" maxLength={100} placeholder="Nama sesuai data pegawai" value={form.nama} onChange={set("nama")} />
            </div>
            <div className="field">
              <label htmlFor="unit">Unit kerja</label>
              <input className="input" id="unit" list="unit-list" maxLength={100} placeholder="Pilih atau ketik unit kerja" value={form.unit} onChange={set("unit")} />
              <datalist id="unit-list">{(info?.units || []).map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <button className="btn" type="submit" disabled={!ready || busy || !info}>{busy ? "Menyiapkan…" : "Mulai Main →"}</button>
            <p className="hint">Musik dan efek suara mulai saat kamu menekan Mulai Main. Matikan kapan saja lewat tombol suara.</p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Round({ play, idx, setIdx, results, setResults, topbar, onFinish }) {
  const c = play.cases[idx];
  const res = results[c.id];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const fbRef = useRef(null);
  const nextRef = useRef(null);
  const n = play.cases.length;
  const last = idx === n - 1;

  const correctCount = Object.values(results).filter((r) => r.correct).length;
  const praises = play.praises?.length ? play.praises : ["Kamu Hebat!"];

  const choose = async (k) => {
    if (res || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api(`/plays/${play.playId}/answers`, {
        method: "POST", headers: { "x-play-token": play.token }, body: { caseId: c.id, choice: k },
      });
      sound.sfx(r.correct ? "ok" : "bad");
      setShake(!r.correct);
      setResults((prev) => ({ ...prev, [c.id]: r }));
    } catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (res && fbRef.current) {
      fbRef.current.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" });
      nextRef.current?.focus({ preventScroll: true });
    }
  }, [res]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (!res && KEYS.includes(k)) { e.preventDefault(); choose(k); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const next = async () => {
    sound.sfx("tap");
    if (last) {
      setBusy(true); setErr("");
      try { await onFinish(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
    } else {
      setShake(false);
      setIdx(idx + 1);
      window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    }
  };

  return (
    <div className="board">
      {topbar}
      <div className="progress" style={{ "--n": n }} role="img" aria-label={`Kasus ${idx + 1} dari ${n}`}>
        {play.cases.map((x, i) => {
          const r = results[x.id];
          return <div key={x.id} className={"seg" + (r ? (r.correct ? " ok" : " bad") : i === idx ? " now" : "")} />;
        })}
      </div>
      <div className="row">
        <div className="card">
          <p className="eyebrow pink">Case File {pad(idx + 1)}</p>
          <p className="case-title">{c.title}</p>
          <h2 className="who">{c.person}</h2>
          <p className="story">{c.story}</p>
        </div>
        <div className="card desk">
          <p className="eyebrow">On the Desk</p>
          <ul>{(c.desk || []).map((d, i) => <li key={i}><b>{d.label}: </b>{d.value}</li>)}</ul>
          {c.topic && <span className="topic">Topik: {c.topic}</span>}
        </div>
      </div>
      <h2 className="q">{play.question}</h2>
      {err && <p className="error-box" role="alert">{err}</p>}
      <div className="choices" role="group" aria-label="Pilihan jawaban">
        {KEYS.filter((k) => c.options[k]).map((k) => {
          let cls = "choice";
          if (res) cls += k === res.answer ? " is-correct" : k === res.choice ? " is-wrong" + (shake ? " shake" : "") : " is-dim";
          return (
            <button key={k} type="button" className={cls} aria-disabled={!!res} aria-busy={busy && !res} onClick={() => choose(k)}>
              <span className="key">{k}</span><span className="choice-text">{c.options[k]}</span>
            </button>
          );
        })}
      </div>
      {res && (
        <section className="feedback" ref={fbRef} aria-live="polite">
          <div className={"fb-head " + (res.correct ? "ok" : "bad")}>
            <span className="fb-badge" aria-hidden="true">{res.correct ? "✓" : "✕"}</span>
            <h3>{res.correct ? praises[(correctCount - 1 + praises.length) % praises.length] : play.wrongText}</h3>
          </div>
          <div className="fb-body">
            <p className="fb-answer">JAWABAN YANG TEPAT: {res.answer}{res.correct ? "" : `  ·  JAWABANMU: ${res.choice}`}</p>
            <p><b>Dasar RIWP: </b>{res.basis}</p>
            <div className="fb-actions">
              <button className="btn" type="button" ref={nextRef} onClick={next} disabled={busy}>
                {last ? (busy ? "Menghitung skor…" : "Lihat Skor →") : "Kasus Berikutnya →"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Result({ final, topbar, play, onAgain, onSwitch }) {
  const { score, total, percent, passed, passScore } = final;
  const msg = percent === 100 ? "Sempurna! Kamu Insan KAI Superb!"
    : passed ? "Mantap, pemahaman RIWP-mu kuat!"
    : percent >= 60 ? "Sudah bagus, tinggal sedikit lagi!"
    : "Yuk pelajari lagi RIWP, lalu main ulang!";
  const byNo = new Map(final.answers.map((a) => [a.no, a]));
  return (
    <div className="board">
      {topbar}
      <div className="progress" style={{ "--n": total }}>
        {play.cases.map((x, i) => {
          const a = byNo.get(i + 1);
          return <div key={x.id} className={"seg" + (a ? (a.correct ? " ok" : " bad") : "")} />;
        })}
      </div>
      <div className="result-top">
        <div className="score-disc" role="img" aria-label={`Skor ${score} dari ${total}`}>
          <div><div className="score-num">{score}/{total}</div><div className="score-cap">Nilai {percent}</div></div>
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow pink">Hasil akhir</p>
          <h2 className="result-msg">{msg}</h2>
          <p style={{ margin: 0, fontSize: 17 }}>
            <b>{final.nama}</b> · NIPP {final.nipp} · {final.unit}
          </p>
          <span className={"pass-badge " + (passed ? "ok" : "no")}>
            {passed ? `LULUS (batas ${passScore})` : `BELUM LULUS (batas ${passScore})`}
          </span>
          <p className="hint">Skormu sudah tercatat. Kamu boleh main lagi kapan saja.</p>
          <div className="result-actions">
            <button className="btn" type="button" onClick={onAgain}>Main Lagi ↻</button>
            <button className="btn ghost" type="button" onClick={onSwitch}>Ganti Pemain</button>
          </div>
        </div>
      </div>
      <div className="recap">
        <p className="eyebrow" style={{ marginTop: 8 }}>Rekap jawaban</p>
        {play.cases.map((c, i) => {
          const a = byNo.get(i + 1);
          return (
            <div className="recap-row" key={c.id}>
              <span className="num">{pad(i + 1)}</span>
              <div style={{ minWidth: 0 }}><div className="t">{c.title}</div><div className="c">{c.topic}</div></div>
              <span className={"pill " + (a?.correct ? "ok" : "bad")}>
                {a ? (a.correct ? `✓ Benar · ${a.answer}` : `✕ ${a.choice} → ${a.answer}`) : "Tidak dijawab"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
