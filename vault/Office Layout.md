---
type: reference
title: Office Layout — Denah 34×28
updated: 2026-09-30
tags: [webrent, layout, kantor, 3d]
---

# Office Layout — Denah 34×28

> Sumber tunggal koordinat: `src/lib/office.ts` (3D, minimap, pathfinding
> membaca dari sana). Spec eksekusi: `docs/office/layout-34x28.md`.
> Ruang kantor 34×28 m = 952 m², 13 agent, pintu utama selatan (x −1.5..1.5).

## Tata letak terkini

- **Kolom barat** = 4 private room 6×6: CEO (z −14..−8), Support (−8..−2),
  Security (1..7), PM (7..13) — masing-masing tertutup 4 sisi, tepat 1 pintu
  berupa celah dinding 1,6 m.
- **Pintu PM** di dinding utara (z=7, x −14.2..−12.6) = dinding bersama
  Security (satu dinding bercelah — pola sama dengan pasangan CEO/Support).
- **Baris utara terbuka**: Operations (−6), Finance (1.2), Analytics (8.5)
  di z −10.2, menghadap utara.
- **Pita tengah**: Engineering (9, −2.2) & DevOps (9, 2.2) **berdampingan
  mengapit koridor** (x=9 sejajar), kursi sisi timur.
- **Dinding timur**: Sales (16, −12.8, pojok timur laut) + Marketing
  (16, −10.2) **berdampingan** — sejajar baris analytics (z −10.2).
- **Tengah selatan**: UX (−8, −4) & DOC (4, 8) mengapit sumbu pintu steril
  (x −3..3, z 8..14 = NOL furnitur).
- **Ruang Meeting 7×7** (tenggara): meja konferensi + layar, pintu barat.
- Koridor tengah barat–timur (z −1..1) polos — karpet runner dihapus.
- Pot tanaman tersisa: 3 ruang privat (CEO/Security/PM), Support, koridor
  barat, barat-utara, dan tengah-selatan — pot pojok timur laut & pot tengah
  dihapus.

## Riwayat perbaikan (review visual)

1. Karpet koridor tengah + pot (0,0) dihapus — sumber z-fighting/garis hitam.
2. Dinding dobel z=7 dihapus (dulu memblokir pintu PM + z-fighting).
3. Selatan PM ditutup (partisi z=13) — sebelumnya ruang PM bolong.
4. Lemari Support pindah ke dinding selatan (−13, −2.6) — dulu memblokir
   pintu CEO.
5. Pot pojok timur laut (15.5, −12) dihapus → digantikan meja Sales;
   Marketing pindah berdampingan; zona Sales meluas ke 12,−14,17,−1.
6. Engineering & DevOps dipasangkan mengapit koridor (x=9).
7. Regresi: `office-layout.test.ts` mengunci enklosur ruangan + coverage
   partisi per garis.

[[WebRent Office]] · [[Integration API]]
