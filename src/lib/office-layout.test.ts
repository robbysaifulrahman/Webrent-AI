import { describe, it, expect } from "vitest";
import {
  OBSTACLES, OFFICE_FURNITURE, OFFICE_PLANTS, OFFICE_CHAIRS,
  ZONES, BOUNDS, ENTRANCE, ROOM, PARTITIONS, overlapsObstacle,
} from "@/lib/office";
import { NPCS } from "@/data/npcs";

describe("denah 34x28", () => {
  it("ROOM 34x28 dan BOUNDS ±(15.8, 12.8)", () => {
    expect(ROOM.width).toBe(34);
    expect(ROOM.depth).toBe(28);
    expect(BOUNDS.minX).toBe(-15.8);
    expect(BOUNDS.maxX).toBe(15.8);
    expect(BOUNDS.minZ).toBe(-12.8);
    expect(BOUNDS.maxZ).toBe(12.8);
    expect(ENTRANCE.x1).toBe(-1.5);
    expect(ENTRANCE.x2).toBe(1.5);
  });

  it("zona steril x -3..3, z 8..14: NOL furnitur/obstacle/plants/chairs", () => {
    const inSterile = (x: number, z: number, r = 0) =>
      x + r > -3 && x - r < 3 && z + r > 8 && z - r < 14;
    for (const o of OBSTACLES) expect(inSterile(o.x, o.z, o.radius), `obstacle ${o.x},${o.z}`).toBe(false);
    for (const f of OFFICE_FURNITURE) expect(inSterile(f.x, f.z), `furniture ${f.x},${f.z}`).toBe(false);
    for (const [x, z] of OFFICE_PLANTS) expect(inSterile(x, z), `plant ${x},${z}`).toBe(false);
    for (const c of OFFICE_CHAIRS) expect(inSterile(c.x, c.z), `chair ${c.x},${c.z}`).toBe(false);
  });

  it("13 agent: semua waypoint & spawn bebas obstacle, dalam zona & bounds", () => {
    expect(NPCS).toHaveLength(13);
    for (const npc of NPCS) {
      const zone = ZONES[npc.department];
      expect(zone, npc.id).toBeDefined();
      // spawn = waypoints[0] + 1.4*(cos, sin) sesuai seedNpcs
      const index = NPCS.indexOf(npc);
      const angle = (index / NPCS.length) * Math.PI * 2;
      const spawn: [number, number] = [
        npc.waypoints[0][0] + Math.cos(angle) * 1.4,
        npc.waypoints[0][1] + Math.sin(angle) * 1.4,
      ];
      for (const [x, z] of [...npc.waypoints, spawn]) {
        expect(overlapsObstacle(x, z), `${npc.id} wp/spawn ${x},${z} menabrak obstacle`).toBe(false);
        expect(x, `${npc.id} x ${x} di luar bounds`).toBeGreaterThanOrEqual(BOUNDS.minX - 0.5);
        expect(x, `${npc.id} x ${x} di luar bounds`).toBeLessThanOrEqual(BOUNDS.maxX + 0.5);
        expect(z, `${npc.id} z ${z} di luar bounds`).toBeGreaterThanOrEqual(BOUNDS.minZ - 0.5);
        expect(z, `${npc.id} z ${z} di luar bounds`).toBeLessThanOrEqual(BOUNDS.maxZ + 0.5);
        // dalam zona departemen (toleransi dinding luar 1.2)
        expect(x).toBeGreaterThanOrEqual(zone.x1 - 0.1);
        expect(x).toBeLessThanOrEqual(zone.x2 + 0.1);
        expect(z).toBeGreaterThanOrEqual(zone.z1 - 0.1);
        expect(z).toBeLessThanOrEqual(zone.z2 + 0.1);
      }
    }
  });

  it("ruang privat 6x6 di kolom barat + meeting 7x7 di tenggara", () => {
    expect(ZONES.executive).toMatchObject({ x1: -17, z1: -14, x2: -11, z2: -8 });
    expect(ZONES.support).toMatchObject({ x1: -17, z1: -8, x2: -11, z2: -2 });
    expect(ZONES.security).toMatchObject({ x1: -17, z1: 1, x2: -11, z2: 7 });
    expect(ZONES.product).toMatchObject({ x1: -17, z1: 7, x2: -11, z2: 13 });
    expect(ZONES.ux).toMatchObject({ x1: -10, z1: 3, x2: -2, z2: 8 });
    expect(ZONES.documentation).toMatchObject({ x1: 2, z1: 3, x2: 10, z2: 8 });
    // Kolom timur: ruang tersekat SAL+MKT + area ENG/DEV di eks-zona MKT.
    expect(ZONES.sales).toMatchObject({ x1: 12, z1: -14, x2: 17, z2: -10 });
    expect(ZONES.marketing).toMatchObject({ x1: 12, z1: -10, x2: 17, z2: -6 });
    expect(ZONES.engineering).toMatchObject({ x1: 12, z1: 1, x2: 17, z2: 4 });
    expect(ZONES.devops).toMatchObject({ x1: 12, z1: 4, x2: 17, z2: 7 });
  });

  it("partisi: tiap sisi ruang privat tertutup sesuai pintunya (regresi dinding dobel/bolong)", () => {
    type Seg = [number, number, number, number];

    /** Kumpulkan interval dinding di satu garis (z=line utk dinding sepanjang-x). */
    const onLine = (axis: "x" | "z", line: number): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (const [x1, z1, x2, z2] of PARTITIONS as Seg[]) {
        if (axis === "x" && z1 === line && z2 === line) {
          out.push([Math.min(x1, x2), Math.max(x1, x2)]);
        } else if (axis === "z" && x1 === line && x2 === line) {
          out.push([Math.min(z1, z2), Math.max(z1, z2)]);
        }
      }
      return out.sort((a, b) => a[0] - b[0]);
    };

    // Kolom timur ruang-ruang barat (x=-11): CEO penuh, Support bercelah
    // pintu z -5..-3.4, Security bercelah pintu z 3.4..5, PM penuh.
    // TANPA dinding selatan Security penuh di z=7 (dahulu dobel dgn utara
    // PM → blokir pintu PM).
    expect(onLine("z", -11)).toEqual([
      [-14, -8], [-8, -5], [-3.4, -2], [1, 3.4], [5, 7], [7, 13],
    ]);
    // CEO: selatan bercelah pintu x -14.2..-12.6.
    expect(onLine("x", -8)).toEqual([[-17, -14.2], [-12.6, -11]]);
    // Support: selatan penuh.
    expect(onLine("x", -2)).toEqual([[-17, -11]]);
    // Security: utara penuh.
    expect(onLine("x", 1)).toEqual([[-17, -11]]);
    // PM: utara bercelah pintu x -14.2..-12.6 (dinding bersama Security),
    // selatan penuh. Di z=7 juga ada dinding utara Meeting (10..17).
    expect(onLine("x", 7)).toEqual([[-17, -14.2], [-12.6, -11], [10, 17]]);
    expect(onLine("x", 13)).toEqual([[-17, -11]]);
    // Meeting: barat bercelah pintu z 10..11.6.
    expect(onLine("z", 10)).toEqual([[7, 10], [11.6, 14]]);
    // Ruang SAL+MKT tersekat: barat bercelah pintu z -10.8..-9.2, selatan penuh.
    expect(onLine("z", 12)).toEqual([[-14, -10.8], [-9.2, -6]]);
    expect(onLine("x", -6)).toEqual([[12, 17]]);
  });
});
