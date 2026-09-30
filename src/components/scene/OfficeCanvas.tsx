"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { SceneContents } from "./SceneContents";

/**
 * Kanvas utama react-three-fiber. Loop render kontinu karena karakter
 * dan animasi bergerak setiap frame.
 */
export default function OfficeCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [14, 14, 20.5], fov: 45, near: 0.1, far: 180 }}
      onPointerMissed={() => {
        // klik di area kosong tidak menutup panel otomatis
      }}
    >
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
    </Canvas>
  );
}
