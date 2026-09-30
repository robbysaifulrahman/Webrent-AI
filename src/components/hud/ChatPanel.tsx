"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEPARTMENTS } from "@/data/departments";
import { NPC_MAP } from "@/data/npcs";
import { useNpcStore } from "@/hooks/useNpcStore";
import { useChat } from "@/hooks/useChat";
import {
  canRunCommand,
  commandName,
  commandOwner,
  getObsidianExport,
  isCommand,
  runCommand,
} from "@/lib/commands";
import { useOfficeStore } from "@/hooks/useOfficeStore";
import { AuthControls } from "./AuthControls";

/**
 * Panel obrolan HUD: riwayat pesan, indikator streaming, dan input pengguna.
 */
export function ChatPanel() {
  const activeNpcId = useNpcStore((s) => s.activeNpcId);
  const messages = useNpcStore((s) =>
    activeNpcId ? s.messages[activeNpcId] : undefined,
  );
  const isStreaming = useNpcStore((s) => s.isStreaming);
  const setPanelOpen = useNpcStore((s) => s.setPanelOpen);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { send, stop } = useChat();

  const npc = activeNpcId ? NPC_MAP[activeNpcId] : undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!npc) return null;

  const submitValue = (raw: string) => {
    const value = raw.trim();
    if (!value || isStreaming) return;

    if (isCommand(value, npc)) {
      const target = commandOwner(value);
      const owner = target ?? npc;

      const role = useOfficeStore.getState().role;
      const check = canRunCommand(value, role);
      if (!check.allowed) {
        useNpcStore
          .getState()
          .appendCommandResult(
            owner.id,
            value,
            `## Akses Ditolak\n\n${check.reason}\n\n` +
              `Role saat ini: **${role}**. Masuk dengan passcode yang sesuai bila perlu.`,
          );
        setInput("");
        return;
      }

      if (commandName(value) === "/export") {
        const period = value.trim().split(/\s+/)[1] ?? "daily";
        const file = getObsidianExport(period);
        const blob = new Blob([file.markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      if (target) useNpcStore.getState().setActiveNpc(target.id);
      const result = runCommand(value);
      useNpcStore.getState().appendCommandResult(owner.id, value, result.output);
    } else {
      void send(npc.id, value);
    }
    setInput("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitValue(input);
  };

  const QUICK_COMMANDS = [
    "/briefing",
    "/status",
    "/tasks",
    "/agents",
    "/incidents",
    "/export",
  ];

  return (
    <div className="pointer-events-auto flex h-[min(440px,52dvh)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-md">
      <header className="flex items-center gap-2.5 border-b border-white/10 px-3.5 py-2.5">
        <span
          className="h-8 w-8 shrink-0 rounded-full"
          style={{ background: npc.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{npc.name}</p>
          <p className="truncate text-[11px] text-slate-400">
            {npc.role} · {DEPARTMENTS[npc.department]}
          </p>
        </div>
        <div className="shrink-0 scale-90">
          <AuthControls />
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Tutup panel"
        >
          ✕
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={
                m.kind === "command"
                  ? `max-w-full overflow-x-auto whitespace-pre-wrap rounded-xl px-3 py-2 font-mono text-[11px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-slate-800 text-sky-300"
                        : "border border-white/10 bg-slate-900/80 text-slate-200"
                    }`
                  : `max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-sky-600 text-white"
                        : "rounded-bl-sm bg-white/10 text-slate-100"
                    }`
              }
            >
              {m.content || (!m.id.endsWith("-stream") ? m.content : "…")}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex items-center gap-1.5 pl-1 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            {npc.name.split(" ")[0]} sedang mengetik…
          </div>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-white/10 px-3 pt-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            type="button"
            onClick={() => submitValue(cmd)}
            disabled={isStreaming}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
          >
            {cmd}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-white/10 px-3 py-2.5"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={1}
          placeholder={`Pesan atau perintah, mis. /briefing · ${npc.name.split(" ")[0]}`}
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-rose-500"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kirim
          </button>
        )}
      </form>
    </div>
  );
}
