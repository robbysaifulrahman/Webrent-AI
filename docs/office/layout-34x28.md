# Denah Office 34×28 — Spec Eksekusi (SUDAH dieksekusi)

Status: EKSEKUSI SELESAI. Kode 34×28; verifikasi lint/test/build + `src/lib/office-layout.test.ts` lolos.
Catatan: `OfficeProcedural.tsx` & `Minimap.tsx` tetap perlu penyesuaian kecil
(furnitur/tag hardcoded lama berada di zona steril) — penyimpangan dari daftar "tanpa edit" di bawah.

## Perbaikan pasca-eksekusi (review visual)
- **Karpet koridor tengah + tanaman di (0,0) dihapus** — sumber z-fighting/
  clipping (garis hitam di persimpangan koridor). `CORRIDOR` & `COLORS.rug`
  ikut dihapus (tak dipakai lagi).
- **Dinding dobel z=7 diperbaiki**: dinding selatan Security yang penuh
  `[-17,7,-11,7]` dihapus — bertepatan dengan dinding utara PM dan
  memblokir pintu PM (x -14.2..-12.6). Pola sekarang = dinding bersama
  bercelah, sama seperti pasangan CEO/Support di z=-8.
- **Selatan PM ditutup**: partisi `[-17,13,-11,13]` ditambahkan (ruang PM
  sebelumnya terbuka di sisi selatan).
- **Lemari ruang Support dipindah**: `(-13,-7.3)` → `(-13,-2.6)` — sebelumnya
  berdiri tepat di depan mulut pintu CEO (celah x -14.2..-12.6 di z=-8).
  Obstacle + verifikasi waypoint Support ikut diperbarui (aman: jarak
  terdekat ±1,28 > radius 1,0).
- Regresi: `office-layout.test.ts` kini mengunci coverage partisi per garis
  (enklosur 4 sisi + tepat satu celah pintu per ruang privat).
- **Pojok timur laut dirapikan**: pot tanaman `(15.5,-12)` dihapus; meja
  Sales pindah ke pojok `(16,-12.8)` menghadap barat; zona Sales meluas ke
  `12,-14,17,-1` (marker lantai + minimap ikut otomatis); waypoint Sales
  bertambah area pojok `[13.4,-9.5]`, `[14.2,-11.8]` (bebas obstacle,
  spawn aman). Kursi/obstacle/furniture data mengikuti.
- **Kolom timur dirapikan (sekat SAL+MKT, relokasi ENG/DEV)**: ruang
  tersekat Sales & Marketing dibangun di pojok timur laut
  (x 12..17, z −14..−6; dinding barat bercelah pintu z −10,8…−9,2,
  dinding selatan z=−6) — meja SAL `(16,-12)` & MKT `(16,-8)` menghadap
  barat. Engineering & DevOps pindah ke eks-zona MKT (x 12..17, z 1..7;
  zona ENG z 1..4, DEV z 4..7) dengan meja `(16,2.5)` & `(16,5.5)`.
  Waypoint + obstacle + kursi ikut dipindah; marka rak Support di minimap
  diperbaiki (`(-13,-7.3)` → `(-13,-2.6)`). Pita tengah x 5..12 kini
  area terbuka.

## Keputusan terkunci
- Outer: **34 × 28** (x -17..17, z -14..14) = 952 m². Dari 28×22 (616 m²).
- Tetap Vercel. VPS 2C/2GB standby staging saja.
- Minimap + 3D tetap baca `src/lib/office.ts` (tidak ada sumber kedua).

## Private room 6×6 = 36 m² (kolom barat, x -17..-11)
| Room | x1,z1,x2,z2 | Pintu (celah 1.6 m) |
|---|---|---|
| CEO | -17,-14,-11,-8 | selatan, x -14.2..-12.6 z -8 |
| SUPPORT | -17,-8,-11,-2 | timur, z -5..-3.4 + dinding koridor z -1 |
| SECURITY | -17,1,-11,7 | timur, z 3.4..5.0 + dinding koridor z 1 |
| PM | -17,7,-11,13 | utara, x -14.2..-12.6 z 7 |
| Koridor | z -1..1, lebar 2 m, barat–timur penuh | — |
| Meeting | 10,7,17,14 (7×7, ikut lega) | barat, z 10..11.6 |

## Tengah = UX & DOC, pintu steril
- Entrance: x -1.5..1.5 (3 m), z 14.
- Zona steril: **x -3..3, z 8..14 = NOL furnitur / obstacle / plants / waypoint**.
- Yang dihapus dari sumbu: desk (-6,9.5), meeting pods (-7.6,-4.7,4.5,7.5),
  plants (-2.2,10.2),(2.2,10.2), pod (0,4.5 r2.6).
- Relokasi: UX x -10..-2 z 3..8 → desk (-8,5),(-4,5);
  DOC x 2..10 z 3..8 → desk (4,5),(8,5).
- Utara/timur lain (COO/FIN/DAT/ENG/DEV/SAL/MKT) scale proporsional,
  tidak ubah konsep.

## File yang akan diubah saat eksekusi
1. `src/lib/office.ts` → ROOM, ENTRANCE, ZONES, PARTITIONS, OBSTACLES,
   OFFICE_FURNITURE/CHAIRS/PLANTS. WALL_SEGMENTS otomatis dari ROOM.
2. `src/data/npcs.ts` → waypoints CEO/Support/Security/PM/UX/DOC baru,
   sisanya scale. Update komentar 28×22 → 34×28.
3. `OfficeCanvas.tsx + Controls.tsx` → camera max 32→40.
4. Tanpa edit: `Minimap.tsx` (auto-scale), `OfficeProcedural.tsx`, `useWander.ts`.

## Verifikasi saat eksekusi
- `npm run lint`, `npm run test`, `npm run build`.
- Dev 2 menit: 13 agent tidak stuck (`overlapsObstacle` false di waypoint baru).
- Minimap: lorong selatan x -3..3 kosong, BOUNDS ±(15.8,12.8).
