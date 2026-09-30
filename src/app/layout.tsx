import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kantor AI Virtual · webrent.my.id",
  description:
    "Kantor virtual 3D dengan karakter AI yang bisa diajak mengobrol. Dibangun dengan Next.js, React Three Fiber, dan drei.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Catatan CSP: nonce TIDAK diletakkan di <body> — atribut nonce hanya
  // berlaku untuk elemen <script>/<style>, dan nilai per-request di atribut
  // body memicu hydration mismatch. Nonce untuk script Next.js disuntikkan
  // otomatis dari header CSP request (lihat middleware.ts).
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
