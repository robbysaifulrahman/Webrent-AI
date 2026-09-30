"use client";

import { useCallback, useRef } from "react";
import { getNpc } from "@/data/npcs";
import { useNpcStore } from "@/hooks/useNpcStore";

export function useChat() {
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (npcId: string, rawInput: string) => {
    const text = rawInput.trim();
    if (!text) return;

    const store = useNpcStore.getState();
    if (store.isStreaming) return;

    store.appendUserMessage(npcId, text);
    store.setStreaming(true);

    const history = (useNpcStore.getState().messages[npcId] ?? [])
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    let full = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcId, messages: history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Permintaan gagal (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        full += chunk;
        useNpcStore.getState().appendAssistantChunk(npcId, chunk);
      }

      const npc = getNpc(npcId);
      const fallback =
        full.trim() ||
        (npc
          ? `${npc.name} terdiam sejenak. Coba tanyakan hal lain, ya.`
          : "Tidak ada respons.");
      useNpcStore.getState().finalizeAssistant(npcId, fallback);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // dibatalkan pengguna
      } else {
        const message = err instanceof Error ? err.message : "Kesalahan tak dikenal.";
        useNpcStore
          .getState()
          .finalizeAssistant(npcId, `Maaf, terjadi kendala: ${message}`);
      }
    } finally {
      abortRef.current = null;
      useNpcStore.getState().setStreaming(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    useNpcStore.getState().setStreaming(false);
  }, []);

  return { send, stop };
}
