export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, headers } = {}) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.", 0);
  }
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  let data = null;
  if (isJson) { try { data = await res.json(); } catch {} }
  // Tidak ada balasan JSON = server aplikasi (Express) tidak berjalan di alamat ini,
  // biasanya karena yang ter-deploy hanya tampilan (static site) tanpa backend.
  if (!isJson) {
    throw new ApiError(
      "Server aplikasi tidak ditemukan. Tampilan sudah online, tapi backend-nya belum berjalan. " +
      "Admin: deploy sebagai Web Service (Render) atau proyek Vercel dengan DATABASE_URL, sesuai README.",
      res.status || 404
    );
  }
  if (!res.ok) throw new ApiError(data?.error || `Terjadi kesalahan (${res.status}).`, res.status);
  return data;
}

export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  sget(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  sset(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export function fmtWib(iso, withTime = true) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }) + (withTime ? " WIB" : "");
}
