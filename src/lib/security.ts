/** Utilitas keamanan request (IP klien, pengecekan same-origin/CSRF). */

/**
 * Mengambil alamat IP klien dari header proxy yang umum.
 * Mengembalikan null bila tidak dapat ditentukan.
 */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

export function getOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Memeriksa apakah request berasal dari origin yang sama (proteksi CSRF
 * untuk request yang mengubah state).
 *
 * Bila tidak ada header Origin/Referer sama sekali, request dianggap berasal
 * dari klien non-browser (curl/CLI) dan diizinkan — cookie sesi hanya dikirim
 * otomatis oleh browser, sehingga skenario CSRF selalu menyertakan Origin.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = getOrigin(req);
  if (!origin) return true;

  const host = req.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
