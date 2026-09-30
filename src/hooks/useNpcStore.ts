"use client";

import { create } from "zustand";
import { NPCS } from "@/data/npcs";
import type { ChatMessage, NpcRuntime, NpcState, Vec2 } from "@/types";

type NpcRuntimeMap = Record<string, NpcRuntime>;

interface NpcStore {
  npcs: NpcRuntimeMap;
  activeNpcId: string | null;
  isStreaming: boolean;
  isPanelOpen: boolean;
  isOfficePanelOpen: boolean;
  messages: Record<string, ChatMessage[]>;
  bubbles: Record<string, string>;

  setActiveNpc: (id: string | null) => void;
  setPanelOpen: (open: boolean) => void;
  setOfficePanelOpen: (open: boolean) => void;
  setNpcState: (id: string, state: NpcState) => void;
  setNpcPosition: (id: string, position: Vec2) => void;
  appendUserMessage: (id: string, content: string) => void;
  appendCommandResult: (id: string, command: string, output: string) => void;
  appendAssistantChunk: (id: string, chunk: string) => void;
  finalizeAssistant: (id: string, content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setBubble: (id: string, text: string) => void;
  reset: () => void;
}

function seedNpcs(): NpcRuntimeMap {
  return Object.fromEntries(
    NPCS.map((npc, index) => {
      const angle = (index / NPCS.length) * Math.PI * 2;
      const base = npc.waypoints[0] ?? [0, 0];
      const spawn: Vec2 = [
        base[0] + Math.cos(angle) * 1.4,
        base[1] + Math.sin(angle) * 1.4,
      ];
      return [
        npc.id,
        {
          state: index % 2 === 0 ? "wander" : "idle",
          position: spawn,
          facing: Math.random() * Math.PI * 2,
        },
      ];
    }),
  );
}

function seedMessages(): Record<string, ChatMessage[]> {
  return Object.fromEntries(
    NPCS.map((npc) => [
      npc.id,
      [
        {
          id: `${npc.id}-greeting`,
          role: "assistant" as const,
          content: npc.greeting,
        },
      ],
    ]),
  );
}

export const useNpcStore = create<NpcStore>()((set) => ({
  npcs: seedNpcs(),
  activeNpcId: null,
  isStreaming: false,
  isPanelOpen: false,
  isOfficePanelOpen: false,
  messages: seedMessages(),
  bubbles: {},

  setActiveNpc: (id) =>
    set((state) => {
      if (id === null) return { activeNpcId: null };
      const npc = state.npcs[id];
      return {
        activeNpcId: id,
        isPanelOpen: true,
        npcs: {
          ...state.npcs,
          [id]: {
            ...npc,
            state: npc.state === "chatting" ? npc.state : "chatting",
          },
        },
      };
    }),

  setPanelOpen: (open) =>
    set((state) => {
      const activeId = state.activeNpcId;
      if (!open && activeId && state.npcs[activeId]?.state === "chatting") {
        return {
          isPanelOpen: false,
          npcs: {
            ...state.npcs,
            [activeId]: { ...state.npcs[activeId], state: "wander" },
          },
        };
      }
      return { isPanelOpen: open };
    }),

  setOfficePanelOpen: (open) => set({ isOfficePanelOpen: open }),

  setNpcState: (id, npcState) =>
    set((state) => ({
      npcs: {
        ...state.npcs,
        [id]: { ...state.npcs[id], state: npcState },
      },
    })),

  setNpcPosition: (id, position) =>
    set((state) => {
      const current = state.npcs[id];
      if (!current) return state;
      const dx = position[0] - current.position[0];
      const dz = position[1] - current.position[1];
      const moved = dx * dx + dz * dz > 0.0008;
      const facing = moved ? Math.atan2(dx, dz) : current.facing;
      return {
        npcs: {
          ...state.npcs,
          [id]: { ...current, position, facing },
        },
      };
    }),

  appendUserMessage: (id, content) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [id]: [
          ...(state.messages[id] ?? []),
          { id: `${id}-u-${Date.now()}`, role: "user", content },
        ],
      },
    })),

  appendCommandResult: (id, command, output) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [id]: [
          ...(state.messages[id] ?? []),
          { id: `${id}-cu-${Date.now()}`, role: "user", content: command, kind: "command" },
          {
            id: `${id}-ca-${Date.now()}`,
            role: "assistant",
            content: output,
            kind: "command",
          },
        ],
      },
    })),

  appendAssistantChunk: (id, chunk) =>
    set((state) => {
      const list = state.messages[id] ?? [];
      const last = list[list.length - 1];
      if (last && last.role === "assistant" && last.id.endsWith("-stream")) {
        const updated: ChatMessage = { ...last, content: last.content + chunk };
        return {
          messages: {
            ...state.messages,
            [id]: [...list.slice(0, -1), updated],
          },
          bubbles: { ...state.bubbles, [id]: updated.content },
        };
      }
      const fresh: ChatMessage = {
        id: `${id}-stream`,
        role: "assistant",
        content: chunk,
      };
      return {
        messages: { ...state.messages, [id]: [...list, fresh] },
        bubbles: { ...state.bubbles, [id]: chunk },
      };
    }),

  finalizeAssistant: (id, content) =>
    set((state) => {
      const list = state.messages[id] ?? [];
      const last = list[list.length - 1];
      const finalMessage: ChatMessage = {
        id: `${id}-a-${Date.now()}`,
        role: "assistant",
        content,
      };
      const base =
        last && last.role === "assistant" && last.id.endsWith("-stream")
          ? list.slice(0, -1)
          : list;
      return {
        messages: { ...state.messages, [id]: [...base, finalMessage] },
        bubbles: { ...state.bubbles, [id]: content },
      };
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setBubble: (id, text) =>
    set((state) => ({ bubbles: { ...state.bubbles, [id]: text } })),

  reset: () =>
    set({
      npcs: seedNpcs(),
      activeNpcId: null,
      isStreaming: false,
      isPanelOpen: false,
      isOfficePanelOpen: false,
      messages: seedMessages(),
      bubbles: {},
    }),
}));
