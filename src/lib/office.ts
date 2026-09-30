import type { DepartmentId } from "@/types";

export const ROOM = {
  width: 34,
  depth: 28,
  wallHeight: 3.6,
  wallThickness: 0.25,
} as const;

export const FLOOR_Y = 0;

/** Batas gerak NPC (sedikit di dalam dinding). */
export const BOUNDS = {
  minX: -ROOM.width / 2 + 1.2,
  maxX: ROOM.width / 2 - 1.2,
  minZ: -ROOM.depth / 2 + 1.2,
  maxZ: ROOM.depth / 2 - 1.2,
} as const;

export interface Obstacle {
  x: number;
  z: number;
  /** Radius aman di sekitar furnitur. */
  radius: number;
}

export interface Zone {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  label: string;
  color: string;
}

/**
 * 13 zona departemen — setiap agent punya area ruang sendiri.
 * Koordinat: x1,z1 = sudut kiri-atas (negatif), x2,z2 = sudut kanan-bawah.
 * Kolom barat = 4 private room 6×6. Tengah selatan = UX & DOC.
 * Kolom timur = ruang tersekat SAL+MKT (pojok timur laut) + area terbuka
 * ENG/DEV di eks-zona MKT.
 * Sumbu pintu (x −3…3, z 8…14) steril: tanpa furnitur/obstacle.
 */
export const ZONES: Record<DepartmentId, Zone> = {
  // Kolom barat: private room 6×6
  executive:     { x1: -17, z1: -14, x2: -11, z2: -8, label: "CEO",  color: "#e0483b" },
  support:       { x1: -17, z1: -8,  x2: -11, z2: -2, label: "SUP",  color: "#0d9488" },
  security:      { x1: -17, z1: 1,   x2: -11, z2: 7,  label: "SEC",  color: "#dc2626" },
  product:       { x1: -17, z1: 7,   x2: -11, z2: 13, label: "PM",   color: "#2563eb" },

  // Baris utara terbuka (z = -14 sampai -6)
  operations:    { x1: -11, z1: -14, x2: -4,  z2: -6, label: "COO",  color: "#d97706" },
  finance:       { x1: -4,  z1: -14, x2: 4,   z2: -6, label: "FIN",  color: "#ca8a04" },
  analytics:     { x1: 4,   z1: -14, x2: 11,  z2: -6, label: "DAT",  color: "#4f46e5" },

  // Tengah selatan: UX & DOC (flank sumbu pintu steril)
  ux:            { x1: -10, z1: 3,   x2: -2,  z2: 8,  label: "UX",   color: "#9b59b6" },
  documentation: { x1: 2,   z1: 3,   x2: 10,  z2: 8,  label: "DOC",  color: "#64748b" },

  // Kolom timur: ruang tersekat SAL+MKT (dua setengah ruangan, utara),
  // area terbuka ENG+DEV di eks-zona MKT (tengah), Meeting di selatan.
  sales:         { x1: 12,  z1: -14, x2: 17,  z2: -10, label: "SAL",  color: "#7c3aed" },
  marketing:     { x1: 12,  z1: -10, x2: 17,  z2: -6,  label: "MKT",  color: "#db2777" },
  engineering:   { x1: 12,  z1: 1,   x2: 17,  z2: 4,   label: "ENG",  color: "#2e9e63" },
  devops:        { x1: 12,  z1: 4,   x2: 17,  z2: 7,   label: "DEV",  color: "#0891b2" },
};

/**
 * Partisi dalam (tebal 0,15 m, tinggi 2 m).
 *
 * - CEO (x −17…−11, z −14…−8): pintu selatan (x −14,2…−12,6)
 * - Support (x −17…−11, z −8…−2): pintu timur (z −5…−3,4)
 * - Security (x −17…−11, z 1…7): pintu timur (z 3,4…5)
 * - PM (x −17…−11, z 7…13): pintu utara (x −14,2…−12,6) — dinding bersama
 *   dengan Security di z=7 adalah satu dinding bercelah (pola CEO/Support).
 * - Meeting (x 10…17, z 7…14): pintu barat (z 10…11,6)
 * - Sales & Marketing (x 12…17, z −14…−6): pintu barat (z −10,8…−9,2)
 */
export const PARTITIONS: Array<[number, number, number, number]> = [
  // Ruang CEO: dinding timur penuh + selatan bercelah pintu
  [-11, -14, -11, -8],
  [-17, -8, -14.2, -8],
  [-12.6, -8, -11, -8],
  // Ruang Support: timur bercelah pintu + selatan penuh
  [-11, -8, -11, -5],
  [-11, -3.4, -11, -2],
  [-17, -2, -11, -2],
  // Ruang Security: utara + timur bercelah pintu (selatan = dinding utara PM)
  [-17, 1, -11, 1],
  [-11, 1, -11, 3.4],
  [-11, 5, -11, 7],
  // Ruang PM: utara bercelah pintu (dinding bersama Security) + timur penuh + selatan penuh
  [-17, 7, -14.2, 7],
  [-12.6, 7, -11, 7],
  [-11, 7, -11, 13],
  [-17, 13, -11, 13],
  // Ruang Meeting: utara penuh + barat bercelah pintu
  [10, 7, 17, 7],
  [10, 7, 10, 10],
  [10, 11.6, 10, 14],
  // Ruang Sales & Marketing (tersekat, pojok timur laut):
  // barat bercelah pintu (z -10,8…-9,2) + selatan penuh
  [12, -14, 12, -10.8],
  [12, -9.2, 12, -6],
  [12, -6, 17, -6],
];

/** Zona furnitur yang harus dihindari NPC saat memilih tujuan. */
export const OBSTACLES: Obstacle[] = [
  // Baris meja utara (COO / Finance / Analytics).
  { x: -6,  z: -10.2, radius: 2.0 },
  { x: 1.2, z: -10.2, radius: 2.0 },
  { x: 8.5, z: -10.2, radius: 2.0 },
  // Ruang Support: meja + rak (dinding selatan, bebas pintu CEO) + tanaman.
  { x: -15.4, z: -5,   radius: 1.8 },
  { x: -13,   z: -2.6, radius: 1.0 },
  { x: -16.4, z: -2.8, radius: 1.0 },
  // Ruang tersekat Sales & Marketing: meja di dinding timur, monitor
  // menghadap barat ke kursi.
  { x: 16, z: -12, radius: 1.8 },
  { x: 16, z: -8,  radius: 1.8 },
  // Meja Engineering / DevOps di eks-zona MKT (dinding timur, sejajar).
  { x: 16, z: 2.5, radius: 1.8 },
  { x: 16, z: 5.5, radius: 1.8 },
  // Meja UX & DOC (tengah selatan, flank sumbu steril).
  { x: -8, z: 5, radius: 2.0 },
  { x: -4, z: 5, radius: 2.0 },
  { x: 4,  z: 5, radius: 2.0 },
  { x: 8,  z: 5, radius: 2.0 },
  // Furnitur ruang CEO: meja + rak + tanaman.
  { x: -15.4, z: -11.5, radius: 1.8 },
  { x: -16.2, z: -9.5,  radius: 1.0 },
  { x: -11.8, z: -12.7, radius: 1.0 },
  // Furnitur ruang Security: meja + rak + tanaman.
  { x: -15,   z: 3.5, radius: 2.0 },
  { x: -15.8, z: 6.4, radius: 1.0 },
  { x: -16.3, z: 1.8, radius: 1.0 },
  // Furnitur ruang PM: meja + tanaman.
  { x: -15.4, z: 11.5, radius: 1.8 },
  { x: -16.3, z: 12.3, radius: 1.0 },
  // Meja konferensi ruang meeting.
  { x: 13.5, z: 10.5, radius: 3.0 },
  // Tanaman area terbuka (tak ada di sumbu steril).
  { x: -16.4, z: 0.4,   radius: 1.0 },
  { x: -8.5,  z: -13.1, radius: 1.6 },
  { x: 5.5,   z: 10.3,  radius: 1.6 },
];

/** Pintu utama kantor (celah 3 m di dinding selatan). */
export const ENTRANCE = {
  x1: -1.5,
  x2: 1.5,
  z: ROOM.depth / 2,
} as const;

/** Footprints of the fixed furniture, in the same world coordinates as the 3D office. */
export const OFFICE_FURNITURE = [
  ...[-6, 1.2, 8.5].map((x) => ({ kind: "desk" as const, x, z: -10.2, width: 2.2, depth: 1.1, rotation: 0 })),
  { kind: "desk" as const, x: -15.4, z: -5, width: 2.2, depth: 1.1, rotation: Math.PI / 2 },
  // Meja UX & DOC (sumbu pintu utama steril, tanpa meja).
  ...[-8, -4, 4, 8].map((x) => ({ kind: "desk" as const, x, z: 5, width: 2.2, depth: 1.1, rotation: 0 })),
  // Ruang tersekat SAL+MKT + area ENG/DEV (eks-zona MKT), dinding timur.
  { kind: "desk" as const, x: 16, z: -12, width: 2.2, depth: 1.1, rotation: -Math.PI / 2 },
  { kind: "desk" as const, x: 16, z: -8, width: 2.2, depth: 1.1, rotation: -Math.PI / 2 },
  { kind: "desk" as const, x: 16, z: 2.5, width: 2.2, depth: 1.1, rotation: -Math.PI / 2 },
  { kind: "desk" as const, x: 16, z: 5.5, width: 2.2, depth: 1.1, rotation: -Math.PI / 2 },
  { kind: "desk" as const, x: -15.4, z: -11.5, width: 2.2, depth: 1.1, rotation: Math.PI / 2 },
  { kind: "desk" as const, x: -15, z: 3.5, width: 2.2, depth: 1.1, rotation: 0 },
  { kind: "desk" as const, x: -15.4, z: 11.5, width: 2.2, depth: 1.1, rotation: Math.PI / 2 },
  { kind: "conference" as const, x: 13.5, z: 10.5, width: 4.2, depth: 1.8, rotation: 0 },
] as const;

export const OFFICE_CHAIRS = [
  ...[-6, 1.2, 8.5].map((x) => ({ x, z: -9.3, rotation: Math.PI })),
  { x: -14.5, z: -5, rotation: -Math.PI / 2 },
  ...[-12, -8, 2.5, 5.5].map((z) => ({ x: 15.1, z, rotation: Math.PI / 2 })),
  ...[-8, -4, 4, 8].map((x) => ({ x, z: 5.9, rotation: Math.PI })),
  { x: -14.5, z: -11.5, rotation: -Math.PI / 2 },
  { x: -15, z: 4.4, rotation: Math.PI },
  { x: -14.5, z: 11.5, rotation: -Math.PI / 2 },
] as const;

export const OFFICE_PLANTS = [
  [-16.4, -2.8], [-11.8, -12.7], [-16.3, 1.8], [-16.3, 12.3],
  [-16.4, 0.4],
  [-8.5, -13.1], [6.5, 12.8],
] as const;

/** Segmen dinding untuk digambar di minimap 2D. */
export const WALL_SEGMENTS: Array<[number, number, number, number]> = [
  [-ROOM.width / 2, -ROOM.depth / 2, ROOM.width / 2, -ROOM.depth / 2],
  [-ROOM.width / 2, ROOM.depth / 2, ENTRANCE.x1, ROOM.depth / 2],
  [ENTRANCE.x2, ROOM.depth / 2, ROOM.width / 2, ROOM.depth / 2],
  [-ROOM.width / 2, -ROOM.depth / 2, -ROOM.width / 2, ROOM.depth / 2],
  [ROOM.width / 2, -ROOM.depth / 2, ROOM.width / 2, ROOM.depth / 2],
];

export function clampToBounds([x, z]: [number, number]): [number, number] {
  return [
    Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, x)),
    Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, z)),
  ];
}

export function overlapsObstacle(x: number, z: number): boolean {
  return OBSTACLES.some((o) => {
    const dx = x - o.x;
    const dz = z - o.z;
    return dx * dx + dz * dz < o.radius * o.radius;
  });
}
