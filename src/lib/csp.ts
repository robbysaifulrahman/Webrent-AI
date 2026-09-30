/**
 * Membangun header Content-Security-Policy dengan nonce per-request.
 *
 * Nonce digunakan oleh Next.js untuk inline script yang diinjeksi ke <head>.
 * Bila disertakan, hanya script dengan atribut nonce yang cocok yang
 * dieksekusi — mencegah XSS melalui injeksi skrip.
 *
 * Kompatibel dengan Edge Runtime (memakai Web Crypto API, bukan node:crypto).
 */

/**
 * Menghasilkan nonce 16-byte menggunakan Web Crypto API (tersedia di Edge
 * dan Node.js 18+). Hasilnya dikonversi ke base64url.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Konversi ke base64url secara manual (tanpa Buffer agar aman di Edge).
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Menyusun nilai header CSP dari nonce.
 *
 * strict-dynamic dipakai bersama nonce agar Next.js chunks
 * (yang di-load secara dinamis) tetap berjalan tanpa perlu mendaftar
 * semua URL secara eksplisit.
 */
export function buildCspValue(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // React DevTools membutuhkan eval di dev mode.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": [
      "'self'",
      // Tailwind injeksi style inline.
      "'unsafe-inline'",
    ],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      // Webpack HMR di dev mode.
      ...(isDev ? ["ws:", "wss:"] : []),
    ],
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([key, vals]) =>
      vals.length === 0 ? key : `${key} ${vals.join(" ")}`,
    )
    .join("; ");
}

/** Nama cookie yang digunakan untuk meneruskan nonce ke Server Component. */
export const NONCE_COOKIE = "__nonce";

/**
 * Nama request header yang membawa nonce dari middleware ke Server Component.
 * Header ini cara yang benar (cookies() membaca request, bukan respons).
 */
export const NONCE_HEADER = "x-nonce";
