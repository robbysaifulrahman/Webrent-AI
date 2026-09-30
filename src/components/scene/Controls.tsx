"use client";

import { OrbitControls } from "@react-three/drei";
import { ROOM } from "@/lib/office";

/**
 * Kontrol kamera orbit dengan batas gerak supaya pemain tetap di dalam kantor.
 */
export function Controls() {
  const maxRadius = Math.max(ROOM.width, ROOM.depth) * 1.15;

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.7}
      minDistance={7}
      maxDistance={maxRadius}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2.25}
      target={[0, 1.1, 0]}
    />
  );
}
