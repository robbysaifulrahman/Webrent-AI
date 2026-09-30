"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { NpcDefinition, NpcState } from "@/types";

const SKIN = "#e8b98f";
const HAIR = "#3a2b22";

function Eye({ x }: { x: number }) {
  return (
    <mesh position={[x, 1.74, 0.16]}>
      <boxGeometry args={[0.05, 0.06, 0.02]} />
      <meshStandardMaterial color="#1c1c22" />
    </mesh>
  );
}

/**
 * Karakter low-poly 3D yang dibangun dari primitif (alternatif model GLB).
 * Animasi berjalan/idle dilakukan secara prosedural.
 */
export function CharacterModel({
  npc,
  state,
}: {
  npc: NpcDefinition;
  state: NpcState;
}) {
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const phase = useRef(0);

  useFrame((_, delta) => {
    const active = state === "wander";
    phase.current += delta * (active ? 9.5 : 2.4);
    const swing = active ? 0.72 : 0.07;
    const s = Math.sin(phase.current);

    if (leftLeg.current) leftLeg.current.rotation.x = s * swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -s * swing;
    if (leftArm.current) leftArm.current.rotation.x = -s * swing * 0.85;
    if (rightArm.current) rightArm.current.rotation.x = s * swing * 0.85;
    if (torso.current) {
      torso.current.position.y = active
        ? Math.abs(Math.sin(phase.current)) * 0.045
        : Math.sin(phase.current) * 0.02;
      torso.current.rotation.z = s * (active ? 0.04 : 0.01);
    }
  });

  return (
    <group>
      <group ref={leftLeg} position={[-0.14, 0.9, 0]}>
        <mesh castShadow position={[0, -0.45, 0]}>
          <boxGeometry args={[0.17, 0.9, 0.19]} />
          <meshStandardMaterial color="#2b3440" flatShading />
        </mesh>
        <mesh castShadow position={[0, -0.86, 0.04]}>
          <boxGeometry args={[0.19, 0.1, 0.28]} />
          <meshStandardMaterial color="#1b2027" flatShading />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.14, 0.9, 0]}>
        <mesh castShadow position={[0, -0.45, 0]}>
          <boxGeometry args={[0.17, 0.9, 0.19]} />
          <meshStandardMaterial color="#2b3440" flatShading />
        </mesh>
        <mesh castShadow position={[0, -0.86, 0.04]}>
          <boxGeometry args={[0.19, 0.1, 0.28]} />
          <meshStandardMaterial color="#1b2027" flatShading />
        </mesh>
      </group>

      <group ref={torso} position={[0, 0, 0]}>
        <mesh castShadow position={[0, 1.02, 0]}>
          <boxGeometry args={[0.44, 0.22, 0.26]} />
          <meshStandardMaterial color="#2b3440" flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.32, 0]}>
          <boxGeometry args={[0.52, 0.46, 0.3]} />
          <meshStandardMaterial color={npc.color} flatShading />
        </mesh>
        <mesh position={[0, 1.32, 0.16]}>
          <boxGeometry args={[0.16, 0.34, 0.02]} />
          <meshStandardMaterial color={npc.accent} flatShading />
        </mesh>

        <group ref={leftArm} position={[-0.33, 1.5, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <boxGeometry args={[0.15, 0.6, 0.17]} />
            <meshStandardMaterial color={npc.color} flatShading />
          </mesh>
          <mesh castShadow position={[0, -0.63, 0]}>
            <boxGeometry args={[0.16, 0.14, 0.18]} />
            <meshStandardMaterial color={SKIN} flatShading />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.33, 1.5, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <boxGeometry args={[0.15, 0.6, 0.17]} />
            <meshStandardMaterial color={npc.color} flatShading />
          </mesh>
          <mesh castShadow position={[0, -0.63, 0]}>
            <boxGeometry args={[0.16, 0.14, 0.18]} />
            <meshStandardMaterial color={SKIN} flatShading />
          </mesh>
        </group>

        <mesh position={[0, 1.62, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 8]} />
          <meshStandardMaterial color={SKIN} flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.82, 0]}>
          <boxGeometry args={[0.34, 0.34, 0.32]} />
          <meshStandardMaterial color={SKIN} flatShading />
        </mesh>
        <mesh position={[0, 1.99, 0]}>
          <boxGeometry args={[0.36, 0.12, 0.34]} />
          <meshStandardMaterial color={HAIR} flatShading />
        </mesh>
        <mesh position={[0, 1.82, -0.16]}>
          <boxGeometry args={[0.34, 0.34, 0.04]} />
          <meshStandardMaterial color={HAIR} flatShading />
        </mesh>
        <Eye x={-0.08} />
        <Eye x={0.08} />
        <mesh position={[0, 1.75, 0.17]}>
          <boxGeometry args={[0.05, 0.08, 0.03]} />
          <meshStandardMaterial color="#d9a882" flatShading />
        </mesh>
      </group>
    </group>
  );
}
