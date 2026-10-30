// Skema tabel. Semua tabel memakai awalan "riwp_" supaya aman berbagi database
// dengan aplikasi lain (misalnya aplikasi RPA). Waktu disimpan sebagai teks ISO (UTC).
export function schemaSql(kind) {
  const pg = kind === "postgres";
  const autoId = pg ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const stmts = [
    `CREATE TABLE IF NOT EXISTS riwp_admins (
      id ${autoId},
      username TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS riwp_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES riwp_admins(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS riwp_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS riwp_cases (
      id ${autoId},
      urutan INTEGER NOT NULL DEFAULT 0,
      aktif INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT '',
      person TEXT NOT NULL,
      story TEXT NOT NULL,
      desk_json TEXT NOT NULL DEFAULT '[]',
      opt_a TEXT NOT NULL,
      opt_b TEXT NOT NULL,
      opt_c TEXT NOT NULL,
      answer TEXT NOT NULL,
      basis TEXT NOT NULL DEFAULT '',
      competency TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS riwp_plays (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      nipp TEXT NOT NULL,
      nama TEXT NOT NULL,
      unit TEXT NOT NULL,
      case_ids TEXT NOT NULL,
      total INTEGER NOT NULL,
      score INTEGER,
      started_at TEXT NOT NULL,
      finished_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS riwp_plays_nipp ON riwp_plays(nipp)`,
    `CREATE INDEX IF NOT EXISTS riwp_plays_started ON riwp_plays(started_at)`,
    `CREATE TABLE IF NOT EXISTS riwp_answers (
      play_id TEXT NOT NULL REFERENCES riwp_plays(id) ON DELETE CASCADE,
      case_id INTEGER NOT NULL,
      case_no INTEGER NOT NULL,
      case_title TEXT NOT NULL,
      choice TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answered_at TEXT NOT NULL,
      PRIMARY KEY (play_id, case_id)
    )`,
  ];
  if (pg) {
    // Supabase: dengan RLS aktif tanpa policy, tabel tidak bisa dibaca lewat API publik (anon key).
    // Hanya server aplikasi ini (pemilik tabel) yang bisa membaca dan menulis.
    for (const t of ["riwp_admins", "riwp_sessions", "riwp_settings", "riwp_cases", "riwp_plays", "riwp_answers"]) {
      stmts.push(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    }
  }
  return stmts;
}
