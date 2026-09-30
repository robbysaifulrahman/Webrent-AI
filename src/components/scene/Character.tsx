"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { NPC_MAP } from "@/data/npcs";
import { useNpcStore } from "@/hooks/useNpcStore";
import { useWander } from "@/hooks/useWander";
import { CharacterModel } from "./CharacterModel";
import { SpeechBubble } from "./SpeechBubble";

/**
 * Karakter NPC 3D: menggabungkan model, AI wander, seleksi klik,
 * indikator fokus, dan balon percakapan.
 */
export function Character({ npcId }: { npcId: string }) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const npc = NPC_MAP[npcId];

  const runtime = useNpcStore((s) => s.npcs[npcId]);
  const activeNpcId = useNpcStore((s) => s.activeNpcId);
  const bubble = useNpcStore((s) => s.bubbles[npcId]);
  const setActiveNpc = useNpcStore((s) => s.setActiveNpc);

  useWander(npcId, group);

  if (!npc || !runtime) return null;

  const isActive = activeNpcId === npcId;

  return (
    <group
      ref={group}
      position={[runtime.position[0], 0, runtime.position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        setActiveNpc(npcId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <CharacterModel npc={npc} state={runtime.state} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.52, 0.62, 24]} />
        <meshBasicMaterial
          color={npc.accent}
          transparent
          opacity={isActive ? 0.95 : hovered ? 0.75 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {(isActive || hovered) && (
        <SpeechBubble text={bubble ?? ""} color={npc.color} accent={npc.accent} />
      )}
    </group>
  );
}
