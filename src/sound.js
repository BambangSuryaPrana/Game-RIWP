// Musik dan efek suara 8-bit, dibuat langsung dengan Web Audio (tanpa file lagu).
let AC = null, master = null, musicGain = null, sfxGain = null, timer = null, nextAt = 0, step = 0;
let muted = (() => { try { return localStorage.getItem("riwp-muted") === "1"; } catch { return false; } })();

const nf = (n) => 440 * Math.pow(2, (n - 69) / 12);
const MEL = [72,0,76,79, 76,0,74,72, 74,0,77,81, 79,77,76,74, 72,0,76,79, 81,79,77,76, 74,76,77,74, 72,0,0,0];
const BAS = [48,48,55,55, 48,48,55,55, 50,50,57,57, 55,55,55,55, 48,48,55,55, 53,53,57,57, 55,55,55,55, 48,48,48,48];
const TEMPO = 0.17;

function init() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  master = AC.createGain(); master.gain.value = muted ? 0 : 1; master.connect(AC.destination);
  musicGain = AC.createGain(); musicGain.gain.value = 0.05; musicGain.connect(master);
  sfxGain = AC.createGain(); sfxGain.gain.value = 0.16; sfxGain.connect(master);
}

function tone(freq, start, dur, type = "square", dest = sfxGain, vol = 1) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(dest); o.start(start); o.stop(start + dur + 0.02);
}

function schedule() {
  while (nextAt < AC.currentTime + 0.12) {
    const m = MEL[step % MEL.length], b = BAS[step % BAS.length];
    if (m) tone(nf(m), nextAt, TEMPO * 0.9, "square", musicGain, 0.8);
    if (step % 2 === 0) tone(nf(b), nextAt, TEMPO * 1.6, "triangle", musicGain, 1);
    nextAt += TEMPO; step++;
  }
}

export const sound = {
  unlock: init,
  isMuted: () => muted,
  setMuted(m) {
    muted = m;
    try { localStorage.setItem("riwp-muted", m ? "1" : "0"); } catch {}
    if (master) master.gain.value = m ? 0 : 1;
  },
  musicStart() { init(); if (!AC || timer) return; nextAt = AC.currentTime + 0.05; step = 0; timer = setInterval(schedule, 40); },
  musicStop() { if (timer) { clearInterval(timer); timer = null; } },
  sfx(kind) {
    if (!AC) return;
    const t = AC.currentTime + 0.01;
    if (kind === "ok") { [72, 76, 79, 84].forEach((n, i) => tone(nf(n), t + i * 0.08, 0.22)); tone(nf(96), t + 0.32, 0.35, "triangle"); }
    else if (kind === "bad") { tone(nf(58), t, 0.18, "sawtooth"); tone(nf(53), t + 0.17, 0.38, "sawtooth"); }
    else if (kind === "tap") tone(nf(84), t, 0.06, "square", sfxGain, 0.5);
    else if (kind === "end") [67, 72, 76, 79, 76, 79, 84].forEach((n, i) => tone(nf(n), t + i * 0.11, 0.26));
  },
};
