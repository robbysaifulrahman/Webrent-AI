"use client";

import dynamic from "next/dynamic";
import { AuthProvider } from "@/components/AuthProvider";
import { Hud } from "@/components/hud/Hud";

const OfficeCanvas = dynamic(() => import("@/components/scene/OfficeCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
        <p className="text-xs text-slate-400">Menyiapkan kantor virtual…</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-slate-950">
      <AuthProvider />
      <OfficeCanvas />
      <Hud />
    </main>
  );
}
