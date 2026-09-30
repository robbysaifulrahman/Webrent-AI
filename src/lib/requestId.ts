/**
 * ID request unik untuk traceability antar layanan.
 * Stateless: berasal dari header `x-request-id` (bila ada) atau
 * dibuat baru via crypto.randomUUID — tanpa dependensi infrastruktur.
 */
export function newRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

/** Ambil ID request dari request: pakai yang dikirim client atau buat baru. */
export function getRequestId(req: Request): string {
  const incoming = req.headers.get("x-request-id")?.trim();
  // Batasi panjang & charset agar aman dipakai sebagai nilai header/log.
  if (incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming)) return incoming;
  return newRequestId();
}
