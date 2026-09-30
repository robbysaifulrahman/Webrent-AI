"use client";

import { useMemo, useState } from "react";
import { DEPARTMENTS } from "@/data/departments";
import { NPCS } from "@/data/npcs";
import { useNpcStore } from "@/hooks/useNpcStore";
import { useRealtimeOffice } from "@/hooks/useRealtimeOffice";
import type { RealtimeStatus } from "@/lib/realtime";

const STATE_LABEL: Record<string, string> = {
  idle: "istirahat",
  wander: "berkeliling",
  chatting: "siap ngobrol",
};

const REALTIME_BADGE: Record<RealtimeStatus, { label: string; className: string }> = {
  CONNECTED: {
    label: "realtime: live",
    className: "bg-emerald-500/20 text-emerald-300",
  },
  READY: {
    label: "realtime: live",
    className: "bg-emerald-500/20 text-emerald-300",
  },
  SYNCING: {
    label: "realtime: syncing",
    className: "bg-sky-500/20 text-sky-300",
  },
  RECONNECTING: {
    label: "realtime: reconnecting",
    className: "bg-amber-500/20 text-amber-300",
  },
  DISCONNECTED: {
    label: "realtime: offline",
    className: "bg-rose-500/20 text-rose-300",
  },
};

export function TopBar() {
  const activeNpcId = useNpcStore((s) => s.activeNpcId);
  const npcs = useNpcStore((s) => s.npcs);
  const setActiveNpc = useNpcStore((s) => s.setActiveNpc);
  const [query, setQuery] = useState("");
  const { status: realtimeStatus } = useRealtimeOffice();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NPCS;
    return NPCS.filter(
      (npc) =>
        npc.name.toLowerCase().includes(q) ||
        npc.role.toLowerCase().includes(q) ||
        npc.code.toLowerCase().includes(q) ||
        DEPARTMENTS[npc.department].toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="pointer-events-auto flex max-h-[42dvh] w-[min(280px,calc(100vw-24px))] flex-col rounded-2xl border border-white/10 bg-slate-950/70 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">WebRent Office</h1>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          13 agents · online
        </span>
      </div>

      {/* Section 37: indikator integrasi realtime — jangan sembunyikan kegagalan. */}
      <div className="mb-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${REALTIME_BADGE[realtimeStatus].className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {REALTIME_BADGE[realtimeStatus].label}
        </span>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari agent / departemen…"
        className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {filtered.map((npc) => {
          const runtime = npcs[npc.id];
          const isActive = activeNpcId === npc.id;
          return (
            <li key={npc.id}>
              <button
                type="button"
                onClick={() => setActiveNpc(npc.id)}
                className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition ${
                  isActive
                    ? "border-white/25 bg-white/10"
                    : "border-transparent hover:bg-white/5"
                }`}
              >
                <span
                  className="flex h-6 w-9 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                  style={{ background: npc.color }}
                >
                  {npc.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white">
                    {npc.name}
                  </span>
                  <span className="block truncate text-[10px] text-slate-400">
                    {DEPARTMENTS[npc.department]} ·{" "}
                    {STATE_LABEL[runtime?.state ?? "idle"]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-2 py-3 text-center text-[11px] text-slate-500">
            Tidak ada agent yang cocok.
          </li>
        )}
      </ul>

      <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-snug text-slate-500">
        Klik karakter 3D atau pilih dari daftar untuk mulai mengobrol.
      </p>
    </div>
  );
}
