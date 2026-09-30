"use client";

import { useEffect, useRef } from "react";
import { NPCS } from "@/data/npcs";
import {
  ENTRANCE, OFFICE_CHAIRS, OFFICE_FURNITURE, OFFICE_PLANTS,
  PARTITIONS, ROOM, WALL_SEGMENTS, ZONES,
} from "@/lib/office";
import { useNpcStore } from "@/hooks/useNpcStore";

const WIDTH = 300;
const HEIGHT = 240;
const PADDING = 14;

/** Top-down office plan, using the same x/z coordinates as the 3D scene. */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const scale = Math.min((WIDTH - PADDING * 2) / ROOM.width, (HEIGHT - PADDING * 2) / ROOM.depth);
    const toX = (x: number) => WIDTH / 2 + x * scale;
    const toY = (z: number) => HEIGHT / 2 + z * scale;

    const draw = () => {
      const { npcs, activeNpcId } = useNpcStore.getState();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#101827";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Floor and department floor markings.
      ctx.fillStyle = "#d8dbe2";
      ctx.fillRect(toX(-ROOM.width / 2), toY(-ROOM.depth / 2), ROOM.width * scale, ROOM.depth * scale);

      // Lobby rug in the west open area (sumbu pintu utama steril).
      ctx.fillStyle = "#465366";
      ctx.fillRect(toX(-11), toY(8), 7.5 * scale, 4.5 * scale);

      for (const zone of Object.values(ZONES)) {
        const x = toX(zone.x1), y = toY(zone.z1);
        const w = (zone.x2 - zone.x1) * scale, h = (zone.z2 - zone.z1) * scale;
        ctx.fillStyle = `${zone.color}24`;
        ctx.fillRect(x, y, w, h);
        ctx.font = "600 7px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#344154";
        ctx.fillText(zone.label, x + w / 2, y + 2);
      }

      // Fixed furniture footprints, rotated with the corresponding 3D objects.
      for (const item of OFFICE_FURNITURE) {
        const isConference = item.kind === "conference";
        const width = item.width;
        const depth = item.depth;
        ctx.save();
        ctx.translate(toX(item.x), toY(item.z));
        ctx.rotate(-item.rotation);
        ctx.fillStyle = isConference ? "#795331" : "#b07d4b";
        ctx.strokeStyle = "#67472e";
        ctx.lineWidth = 0.7;
        ctx.fillRect(-width * scale / 2, -depth * scale / 2, width * scale, depth * scale);
        ctx.strokeRect(-width * scale / 2, -depth * scale / 2, width * scale, depth * scale);
        if (!isConference) {
          ctx.fillStyle = "#d9edf5";
          ctx.fillRect(width * scale * 0.03, -depth * scale * 0.38, width * scale * 0.38, depth * scale * 0.12);
        }
        ctx.restore();
      }

      // Chair symbols (seat + back), as compact top-down furniture marks.
      ctx.fillStyle = "#303b49";
      for (const chair of OFFICE_CHAIRS) {
        ctx.save();
        ctx.translate(toX(chair.x), toY(chair.z));
        ctx.rotate(-chair.rotation);
        ctx.fillRect(-2.1, -2.1, 4.2, 4.2);
        ctx.fillRect(-2.5, -3.7, 5, 1.3);
        ctx.restore();
      }

      // Plants and bookcases.
      ctx.fillStyle = "#328452";
      for (const [x, z] of OFFICE_PLANTS) {
        ctx.beginPath(); ctx.arc(toX(x), toY(z), 2.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#76543a";
      for (const [x, z] of [[-16.2, -9.5], [-13, -2.6], [-15.8, 6.4], [-11.7, 11.5]]) {
        ctx.save(); ctx.translate(toX(x), toY(z)); ctx.rotate(Math.PI / 2);
        ctx.fillRect(-3.5, -1.2, 7, 2.4); ctx.restore();
      }

      // Walls and internal partitions sit above all floor details.
      ctx.strokeStyle = "#586579";
      ctx.lineWidth = 3;
      ctx.lineCap = "square";
      ctx.beginPath();
      for (const [x1, z1, x2, z2] of WALL_SEGMENTS) {
        ctx.moveTo(toX(x1), toY(z1)); ctx.lineTo(toX(x2), toY(z2));
      }
      ctx.stroke();

      ctx.strokeStyle = "#f6f8fb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [x1, z1, x2, z2] of PARTITIONS) {
        ctx.moveTo(toX(x1), toY(z1)); ctx.lineTo(toX(x2), toY(z2));
      }
      ctx.stroke();

      // Name the four distinctive work areas inside their actual room footprints.
      const roomTag = (label: string, worldX: number, worldZ: number) => {
        const x = toX(worldX), y = toY(worldZ);
        ctx.font = "bold 6px ui-sans-serif, system-ui, sans-serif";
        const width = ctx.measureText(label).width + 5;
        ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        ctx.beginPath(); ctx.roundRect(x - width / 2, y - 4, width, 8, 3); ctx.fill();
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#f1f5f9"; ctx.fillText(label, x, y);
      };
      roomTag("CEO", -14, -11);
      roomTag("SEC", -14, 4);
      roomTag("PM", -14, 10);
      roomTag("SUPPORT", -14, -5);

      // Main entrance gap and clear direction cue.
      ctx.fillStyle = "#101827";
      ctx.fillRect(toX(ENTRANCE.x1), toY(ENTRANCE.z) - 2, (ENTRANCE.x2 - ENTRANCE.x1) * scale, 5);
      ctx.fillStyle = "#087e8b";
      ctx.fillRect(toX(-1.5), toY(ENTRANCE.z) - 1, 0.7 * scale, 4);
      ctx.fillRect(toX(ENTRANCE.x2 - 0.7), toY(ENTRANCE.z) - 1, 0.7 * scale, 4);
      ctx.font = "bold 7px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillStyle = "#087e8b";
      ctx.fillText("MASUK", toX(0), toY(ENTRANCE.z) - 3);

      // Live agents are drawn last so furniture never hides them.
      for (const npc of NPCS) {
        const runtime = npcs[npc.id];
        if (!runtime) continue;
        const x = toX(runtime.position[0]), y = toY(runtime.position[1]);
        const active = activeNpcId === npc.id;
        if (active) {
          ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2);
          ctx.strokeStyle = npc.accent; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = npc.color; ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.8; ctx.stroke();
      }
    };

    draw();
    return useNpcStore.subscribe(draw);
  }, []);

  return (
    <div className="pointer-events-auto hidden w-[min(320px,36vw)] rounded-2xl border border-white/10 bg-slate-950/80 p-2 shadow-2xl backdrop-blur-md md:block">
      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Minimap · denah kantor</p>
      <canvas ref={canvasRef} className="h-auto w-full rounded-xl" style={{ aspectRatio: "5 / 4" }} />
      <p className="mt-1.5 px-1 text-center text-[10px] text-slate-500">{NPCS.length} agent · titik berwarna menunjukkan posisi</p>
    </div>
  );
}
