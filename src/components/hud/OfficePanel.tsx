"use client";

import { DEPARTMENTS } from "@/data/departments";
import { useOfficeStore } from "@/hooks/useOfficeStore";
import { useNpcStore } from "@/hooks/useNpcStore";
import { NPC_MAP } from "@/data/npcs";

export function OfficePanel() {
  const role = useOfficeStore((s) => s.role);
  const decisions = useOfficeStore((s) => s.decisions);
  const incidents = useOfficeStore((s) => s.incidents);
  const tasks = useOfficeStore((s) => s.tasks);
  const setDecisionStatus = useOfficeStore((s) => s.setDecisionStatus);
  const updateTaskStatus = useOfficeStore((s) => s.updateTaskStatus);
  const updateIncidentStatus = useOfficeStore((s) => s.updateIncidentStatus);
  const setOfficePanelOpen = useNpcStore((s) => s.setOfficePanelOpen);

  const canDecide = role === "founder";
  const canContain = role === "founder" || role === "security" || role === "operations";

  const pendingDecisions = decisions.filter((d) => d.status === "PENDING");
  const activeIncidents = incidents.filter((i) => i.status !== "RESOLVED");
  const approvals = tasks.filter(
    (t) => t.approvalRequired && t.status === "APPROVAL_REQUIRED",
  );

  const focusAgent = (department: string) => {
    const npc = Object.values(NPC_MAP).find((n) => n.department === department);
    if (npc) useNpcStore.getState().setActiveNpc(npc.id);
  };

  return (
    <div className="pointer-events-auto flex max-h-[min(380px,46dvh)] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 shadow-2xl backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <h2 className="text-sm font-semibold text-white">Panel Operasional</h2>
        <button
          type="button"
          onClick={() => setOfficePanelOpen(false)}
          className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Tutup panel operasional"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3">
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Pending Approvals ({pendingDecisions.length})
          </h3>
          {pendingDecisions.length === 0 && (
            <p className="text-[11px] text-slate-500">Tidak ada keputusan menunggu.</p>
          )}
          <ul className="space-y-1.5">
            {pendingDecisions.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2"
              >
                <p className="text-[11px] text-slate-200">
                  <span className="font-mono text-[10px] text-slate-400">{d.id}</span>{" "}
                  {d.title}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {d.requestedBy} · risiko {d.risk}
                </p>
                {canDecide && (
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionStatus(d.id, "APPROVED");
                        approvals
                          .filter((t) => t.owner === d.requestedBy)
                          .forEach((t) => updateTaskStatus(t.id, "APPROVED"));
                      }}
                      className="rounded-lg bg-emerald-600/80 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-emerald-500"
                    >
                      Setujui
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisionStatus(d.id, "REJECTED")}
                      className="rounded-lg bg-rose-600/80 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-rose-500"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!canDecide && pendingDecisions.length > 0 && (
            <p className="mt-1 text-[10px] text-amber-400/80">
              Persetujuan hanya untuk Founder.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Insiden Aktif ({activeIncidents.length})
          </h3>
          {activeIncidents.length === 0 && (
            <p className="text-[11px] text-slate-500">Tidak ada insiden aktif.</p>
          )}
          <ul className="space-y-1.5">
            {activeIncidents.map((i) => (
              <li
                key={i.id}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2"
              >
                <p className="text-[11px] text-slate-200">
                  <span className="font-mono text-[10px] text-rose-300">{i.id}</span>{" "}
                  {i.title}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {i.severity} · {i.status} · {i.asset}
                </p>
                {canContain && (
                  <div className="mt-1.5 flex gap-1.5">
                    {i.status === "OPEN" && (
                      <button
                        type="button"
                        onClick={() => {
                          updateIncidentStatus(i.id, "CONTAINED");
                          focusAgent("security");
                        }}
                        className="rounded-lg bg-amber-600/80 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-amber-500"
                      >
                        Kontain
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => updateIncidentStatus(i.id, "RESOLVED")}
                      className="rounded-lg bg-slate-600/80 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-slate-500"
                    >
                      Selesaikan
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!canContain && activeIncidents.length > 0 && (
            <p className="mt-1 text-[10px] text-amber-400/80">
              Aksi insiden untuk Security/Operations/Founder.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Menunggu Persetujuan ({approvals.length})
          </h3>
          {approvals.length === 0 ? (
            <p className="text-[11px] text-slate-500">Tidak ada task berisiko tinggi.</p>
          ) : (
            <ul className="space-y-1">
              {approvals.map((t) => (
                <li key={t.id} className="text-[11px] text-slate-300">
                  <span className="font-mono text-[10px] text-slate-500">{t.id}</span>{" "}
                  {t.title}
                  {t.department !== "unassigned" && (
                    <span className="text-slate-500"> · {DEPARTMENTS[t.department]}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
