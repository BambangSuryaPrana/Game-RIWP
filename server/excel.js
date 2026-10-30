// Ekspor rekap ke Excel (4 sheet) dengan SheetJS.
import XLSX from "xlsx";
import { loadPlays, playersFromPlays, buildSummary } from "./stats.js";

const wib = (iso) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3);
  return d.toISOString().slice(0, 16).replace("T", " ");
};

function sheet(rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (widths) ws["!cols"] = widths.map((w) => ({ wch: w }));
  if (rows.length) ws["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

export async function buildWorkbook(db, filters, passScore) {
  const plays = await loadPlays(db, filters);
  const players = playersFromPlays(plays, passScore);
  const summary = await buildSummary(db, filters, passScore);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheet(players.map((p, i) => ({
    No: i + 1, NIPP: p.nipp, Nama: p.nama, "Unit Kerja": p.unit,
    "Jumlah Main": p.attempts, "Selesai": p.finished,
    "Skor Terbaik": p.best == null ? "" : `${p.best}/${p.bestTotal}`, "Nilai Terbaik (%)": p.bestPercent ?? "",
    "Skor Terakhir": p.last == null ? "" : `${p.last}/${p.lastTotal}`, "Nilai Terakhir (%)": p.lastPercent ?? "",
    Status: p.bestPercent == null ? "Belum selesai" : p.passed ? "Lulus" : "Belum lulus",
    "Pertama Akses (WIB)": wib(p.firstAt), "Terakhir Akses (WIB)": wib(p.lastAt),
  })), [5, 14, 26, 24, 11, 9, 12, 16, 13, 17, 14, 19, 19]), "Rekap Peserta");

  XLSX.utils.book_append_sheet(wb, sheet(plays.map((p, i) => ({
    No: i + 1, NIPP: p.nipp, Nama: p.nama, "Unit Kerja": p.unit,
    "Mulai (WIB)": wib(p.startedAt), "Selesai (WIB)": wib(p.finishedAt),
    Benar: p.score ?? "", "Jumlah Soal": p.total, "Nilai (%)": p.percent ?? "",
    Status: p.finishedAt ? "Selesai" : "Belum selesai", "ID Permainan": p.id,
  })), [5, 14, 26, 24, 17, 17, 7, 11, 9, 14, 38]), "Semua Permainan");

  const ids = plays.map((p) => p.id);
  const byId = new Map(plays.map((p) => [p.id, p]));
  const answers = [];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    answers.push(...(await db.all(
      `SELECT * FROM riwp_answers WHERE play_id IN (${chunk.map(() => "?").join(",")}) ORDER BY answered_at, case_no`,
      chunk
    )));
  }
  XLSX.utils.book_append_sheet(wb, sheet(answers.map((a) => {
    const p = byId.get(a.play_id);
    return {
      NIPP: p.nipp, Nama: p.nama, "Unit Kerja": p.unit, "No Soal": Number(a.case_no), "Judul Kasus": a.case_title,
      Jawaban: a.choice, "Kunci": a.correct_answer, Hasil: Number(a.is_correct) === 1 ? "Benar" : "Salah",
      "Waktu (WIB)": wib(a.answered_at), "ID Permainan": a.play_id,
    };
  }), [14, 26, 24, 8, 36, 9, 7, 8, 17, 38]), "Detail Jawaban");

  XLSX.utils.book_append_sheet(wb, sheet(summary.perCase.map((c) => ({
    "No Soal": c.no, "Judul Kasus": c.title, Dijawab: c.answered, Benar: c.correct, "Ketepatan (%)": c.percent,
    "Pilih A": c.choices.A, "Pilih B": c.choices.B, "Pilih C": c.choices.C,
  })), [8, 38, 9, 7, 13, 8, 8, 8]), "Analisis Soal");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
