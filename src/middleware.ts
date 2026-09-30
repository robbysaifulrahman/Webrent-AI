import { NextResponse, type NextRequest } from "next/server";
import { buildCspValue, generateNonce, NONCE_COOKIE, NONCE_HEADER } from "@/lib/csp";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Middleware Next.js — berjalan di Edge Runtime untuk setiap request HTML.
 *
 * Tugas:
 * 1. Membuat nonce baru per-request.
 * 2. Menyisipkan header Content-Security-Policy dengan nonce tersebut
 *    (di request DAN response — pola resmi Next.js).
 * 3. Meneruskan nonce via request header `x-nonce` untuk keperluan
 *    debugging/audit, plus cookie `__nonce` sebagai cadangan.
 */
export function middleware(req: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCspValue(nonce, isDev);

  // Teruskan CSP (dengan nonce) ke Server Component via request header —
  // cara resmi Next.js agar framework menyuntikkan nonce ke <script>-nya
  // sendiri (wajib untuk strict-dynamic di produksi).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", csp);

  // Cookie cadangan — hanya untuk observasi/debugging, bukan sumber utama.
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "strict",
    secure: !isDev,
    path: "/",
    // Tidak perlu Max-Age panjang; nonce berlaku hanya untuk satu halaman.
    maxAge: 30,
  });

  return response;
}

export const config = {
  /**
   * Terapkan hanya pada halaman HTML, bukan aset statis atau API route.
   * Pattern ini mengikuti rekomendasi Next.js untuk middleware CSP.
   */
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|css|js)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
