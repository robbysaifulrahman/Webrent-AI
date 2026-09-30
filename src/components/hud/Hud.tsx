"use client";

import { AuthControls } from "./AuthControls";
import { ChatPanel } from "./ChatPanel";
import { Minimap } from "./Minimap";
import { OfficePanel } from "./OfficePanel";
import { TopBar } from "./TopBar";
import { useNpcStore } from "@/hooks/useNpcStore";
import { useOfficeStore } from "@/hooks/useOfficeStore";

const SYNC_LABEL: Record<string, { text: string; color: string }> = {
  idle: { text: "lokal", color: "bg-slate-500" },
  syncing: { text: "menyinkron…", color: "bg-amber-400" },
  saved: { text: "tersinkron", color: "bg-emerald-400" },
  error: { text: "offline", color: "bg-rose-500" },
};

/**
 * Overlay HUD 2D di atas kanvas 3D. Kontainer dibuat non-interaktif;
 * setiap panel mengaktifkan pointer-events sendiri.
 */
export function Hud() {
  const isPanelOpen = useNpcStore((s) => s.isPanelOpen);
  const activeNpcId = useNpcStore((s) => s.activeNpcId);
  const isOfficePanelOpen = useNpcStore((s) => s.isOfficePanelOpen);
  const setOfficePanelOpen = useNpcStore((s) => s.setOfficePanelOpen);
  const toggleOfficePanel = () =>
    setOfficePanelOpen(!useNpcStore.getState().isOfficePanelOpen);
  const syncStatus = useOfficeStore((s) => s.syncStatus);
  const sync = SYNC_LABEL[syncStatus] ?? SYNC_LABEL.idle;
  const pendingCount =
    useOfficeStore((s) => s.decisions.filter((d) => d.status === "PENDING").length) +
    useOfficeStore((s) => s.incidents.filter((i) => i.status !== "RESOLVED").length);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <TopBar />
        <div className="flex flex-col items-end gap-2">
          <Minimap />
          <AuthControls />
          <button
            type="button"
            onClick={toggleOfficePanel}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[10px] font-medium text-slate-300 backdrop-blur transition hover:bg-white/10"
          >
            Panel Operasional
            {pendingCount > 0 && (
              <span className="rounded-full bg-rose-500/80 px-1.5 text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="pointer-events-none hidden rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[10px] leading-relaxed text-slate-400 backdrop-blur md:block">
          <p className="mb-1 flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${sync.color}`} />
            <span className="text-slate-300">State: {sync.text}</span>
          </p>
          <p>
            <span className="text-slate-200">Klik karakter</span> untuk ngobrol ·{" "}
            <span className="text-slate-200">Drag</span> untuk memutar kamera ·{" "}
            <span className="text-slate-200">Scroll</span> untuk zoom
          </p>
        </div>
        <div className="flex max-w-full flex-col items-end gap-2 sm:flex-row sm:items-end sm:gap-3">
          {isOfficePanelOpen && <OfficePanel />}
          {isPanelOpen && activeNpcId && <ChatPanel />}
        </div>
      </div>
    </div>
  );
}
