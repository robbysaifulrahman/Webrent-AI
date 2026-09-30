"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import * as THREE from "three";
import { BOUNDS, ZONES, clampToBounds, overlapsObstacle, type Zone } from "@/lib/office";
import { NPC_MAP } from "@/data/npcs";
import { useNpcStore } from "@/hooks/useNpcStore";
import type { Vec2 } from "@/types";

const FALLBACK_ZONE: Zone = {
  x1: BOUNDS.minX,
  z1: BOUNDS.minZ,
  x2: BOUNDS.maxX,
  z2: BOUNDS.maxZ,
  label: "",
  color: "#ffffff",
};

/**
 * Target dipilih di dalam zona sendiri — NPC tidak pernah menembus
 * partisi ruangan (gerak lurus tanpa collision, zona berbentuk
 * persegi cembung sehingga jalur selalu di dalam ruangan).
 */
function pickTarget(from: Vec2, waypoints: Vec2[], zone: Zone): Vec2 {
  const pad = 0.6;
  for (let attempt = 0; attempt < 24; attempt++) {
    const useWaypoint = waypoints.length > 0 && Math.random() < 0.5;
    let x: number;
    let z: number;

    if (useWaypoint) {
      const wp = waypoints[Math.floor(Math.random() * waypoints.length)];
      x = wp[0];
      z = wp[1];
    } else {
      x = zone.x1 + pad + Math.random() * (zone.x2 - zone.x1 - pad * 2);
      z = zone.z1 + pad + Math.random() * (zone.z2 - zone.z1 - pad * 2);
    }

    if (overlapsObstacle(x, z)) continue;
    const distance = Math.hypot(x - from[0], z - from[1]);
    if (distance < 2 || distance > 9) continue;
    return [x, z];
  }
  const cx = Math.min(zone.x2 - pad, Math.max(zone.x1 + pad, from[0] + 1));
  const cz = Math.min(zone.z2 - pad, Math.max(zone.z1 + pad, from[1] + 1));
  return clampToBounds([cx, cz]);
}

/**
 * Menggerakkan karakter secara mandiri (idle <-> wander) dan
 * menyinkronkan posisi ke store untuk minimap (throttled).
 */
export function useWander(npcId: string, group: RefObject<THREE.Group | null>) {
  const target = useRef<Vec2>([0, 0]);
  const idleTimer = useRef(0);
  const pushTimer = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    const store = useNpcStore.getState();
    const runtime = store.npcs[npcId];
    if (!runtime) return;

    const dt = Math.min(delta, 0.05);
    const npc = NPC_MAP[npcId];
    const waypoints = npc?.waypoints ?? [];
    const zone = (npc && ZONES[npc.department]) || FALLBACK_ZONE;

    if (runtime.state === "chatting") {
      const [px, pz] = runtime.position;
      g.position.x = px;
      g.position.z = pz;
      const toCenter = Math.atan2(0 - px, 0 - pz);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, toCenter, 0.08);
      g.userData.moving = false;
      return;
    }

    if (runtime.state === "idle") {
      idleTimer.current -= dt;
      g.userData.moving = false;
      if (idleTimer.current <= 0) {
        target.current = pickTarget([g.position.x, g.position.z], waypoints, zone);
        store.setNpcState(npcId, "wander");
      }
      return;
    }

    // Jepit target ke zona sendiri bila target lama di luar zona
    // (mis. state dari sesi sebelum batas zona diperketat).
    target.current = [
      Math.min(zone.x2 - 0.6, Math.max(zone.x1 + 0.6, target.current[0])),
      Math.min(zone.z2 - 0.6, Math.max(zone.z1 + 0.6, target.current[1])),
    ];

    const dx = target.current[0] - g.position.x;
    const dz = target.current[1] - g.position.z;
    const distance = Math.hypot(dx, dz);
    const speed = 1.5;

    if (distance < 0.18) {
      idleTimer.current = 1.2 + Math.random() * 3;
      store.setNpcState(npcId, "idle");
      return;
    }

    const step = Math.min(speed * dt, distance);
    g.position.x += (dx / distance) * step;
    g.position.z += (dz / distance) * step;
    g.rotation.y = Math.atan2(dx, dz);
    g.userData.moving = true;

    pushTimer.current += dt;
    if (pushTimer.current >= 0.1) {
      pushTimer.current = 0;
      store.setNpcPosition(npcId, [g.position.x, g.position.z]);
    }
  });
}
