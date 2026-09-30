"use client";

/**
 * Pencahayaan scene kantor: ambient lembut, matahari dengan bayangan,
 * dan fill light dari arah berlawanan.
 */
export function Lights() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight intensity={0.35} groundColor="#b9c0c9" color="#ffffff" />
      <directionalLight
        castShadow
        position={[9, 15, 10]}
        intensity={1.6}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-10, 7, -8]} intensity={0.4} color="#bcd4ff" />
    </>
  );
}
