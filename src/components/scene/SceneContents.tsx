"use client";

import { NPCS } from "@/data/npcs";
import { Character } from "./Character";
import { Controls } from "./Controls";
import { Lights } from "./Lights";
import { Office } from "./Office";

/**
 * Isi scene 3D: kantor, pencahayaan, kontrol kamera, dan seluruh NPC.
 */
export function SceneContents() {
  return (
    <>
      <color attach="background" args={["#0f172a"]} />
      <fog attach="fog" args={["#0f172a", 42, 74]} />

      <Lights />
      <Office />

      {NPCS.map((npc) => (
        <Character key={npc.id} npcId={npc.id} />
      ))}

      <Controls />
    </>
  );
}
