"use client";

import { useEffect, useRef } from "react";
import { useOfficeStore, snapshotOf } from "@/hooks/useOfficeStore";
import { getAuthStatus } from "@/lib/authApi";
import { mergeSnapshots, type MergeStrategy } from "@/lib/merge";
import type { OfficeSnapshot } from "@/lib/officeData";

function parseSnapshot(input: unknown): OfficeSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const c = input as Partial<OfficeSnapshot>;
  if (!Array.isArray(c.tasks) || !Array.isArray(c.incidents) || !Array.isArray(c.decisions)) {
    return null;
  }
  return {
    tasks: c.tasks,
    incidents: c.incidents,
    decisions: c.decisions,
    audit: Array.isArray(c.audit) ? c.audit : [],
    taskSeq: Number(c.taskSeq) || 1,
    incidentSeq: Number(c.incidentSeq) || 1,
    decisionSeq: Number(c.decisionSeq) || 1,
    version: Number(c.version) || 1,
  };
}

/**
 * Menyelaraskan state kantor dengan server:
 * 1. Rehidrasi localStorage (offline-first).
 * 2. GET /api/state, bila ada state server gunakan sebagai sumber utama.
 *    Bila server kosong (seed), unggah state lokal.
 * 3. Perubahan berikutnya di-*push* (debounce + saat tab kembali fokus).
 */
export function useServerSync() {
  const ready = useRef(false);
  const applyingRef = useRef(false);

  const applyFromServer = (snap: OfficeSnapshot | null) => {
    if (!snap) return;
    applyingRef.current = true;
    try {
      useOfficeStore.getState().applySnapshot(snap, "server");
    } finally {
      applyingRef.current = false;
    }
  };

  /** Menerapkan snapshot gabungan tanpa memicu push balik. */
  const applyMerged = (snap: OfficeSnapshot) => {
    applyingRef.current = true;
    try {
      useOfficeStore.getState().applySnapshot(snap, "local");
    } finally {
      applyingRef.current = false;
    }
  };

  const strategy = (): MergeStrategy => {
    const value = process.env.NEXT_PUBLIC_SYNC_STRATEGY ?? "merge";
    return value === "server-wins" ? "server-wins" : "merge";
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const putSnapshot = (snap: OfficeSnapshot) =>
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snap),
      });

    const push = async () => {
      const store = useOfficeStore.getState();
      if (store.isReadOnly()) {
        store.setSyncStatus("idle");
        return;
      }
      store.setSyncStatus("syncing");

      const tryPush = async (snap: OfficeSnapshot): Promise<boolean> => {
        const res = await putSnapshot(snap);
        if (res.status === 401) {
          window.dispatchEvent(new Event("webrent:unauthorized"));
          throw new Error("unauthorized");
        }

        const raw = (await res.json().catch(() => null)) as
          | (OfficeSnapshot & {
              rejected?: string[];
              conflict?: boolean;
              snapshot?: OfficeSnapshot;
            })
          | null;

        if (res.status === 409 && raw?.snapshot) {
          const serverSnap = parseSnapshot(raw.snapshot);
          if (!serverSnap) return true;

          if (strategy() === "merge") {
            const baseline = useOfficeStore.getState().syncMeta.baseline;
            const merged = mergeSnapshots(baseline, snap, serverSnap);
            applyMerged(merged.snapshot);
            return false; // coba kirim ulang hasil rebase
          }

          applyFromServer(serverSnap);
          return true;
        }

        if (!res.ok) throw new Error(`status ${res.status}`);

        // Sinkronkan snapshot yang benar-benar tersimpan (penting untuk role
        // ter-scoped yang payload-nya mungkin ditolak sebagian).
        if (raw?.snapshot) applyFromServer(parseSnapshot(raw.snapshot));
        else if (store.syncMeta.pending) store.setBaseline(store.syncMeta.pending);
        useOfficeStore.getState().markSynced();
        return true;
      };

      try {
        let attempt = 0;
        for (;;) {
          const pending = useOfficeStore.getState().syncMeta.pending ?? snapshotOf(store);
          const done = await tryPush(pending);
          if (done) break;
          attempt += 1;
          if (attempt >= 3) {
            useOfficeStore.getState().setSyncStatus("error");
            break;
          }
        }
      } catch {
        if (!cancelled) useOfficeStore.getState().setSyncStatus("error");
      }
    };

    const schedulePush = () => {
      if (!ready.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void push(), 800);
    };

    const boot = async () => {
      await useOfficeStore.persist.rehydrate();
      if (cancelled) return;

      try {
        const auth = await getAuthStatus();
        useOfficeStore.getState().setAuth({
          authEnabled: auth.authEnabled,
          authenticated: auth.authenticated,
          role: auth.role,
        });

        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as OfficeSnapshot & { driver?: string };
        const snapshot = parseSnapshot(data);
        if (snapshot && snapshot.tasks.length > 0) {
          applyingRef.current = true;
          try {
            useOfficeStore.getState().applySnapshot(snapshot, "server");
          } finally {
            applyingRef.current = false;
          }
        } else if (!useOfficeStore.getState().isReadOnly()) {
          await push();
          useOfficeStore.getState().markSynced();
        }
      } catch {
        useOfficeStore.getState().setSyncStatus("error");
      } finally {
        if (!cancelled) {
          ready.current = true;
          useOfficeStore.getState().setHydrated(true);
        }
      }
    };

    void boot();

    const unsubscribe = useOfficeStore.subscribe((state, prev) => {
      if (!ready.current || applyingRef.current) return;
      const changed =
        state.tasks !== prev.tasks ||
        state.incidents !== prev.incidents ||
        state.decisions !== prev.decisions;
      if (changed) {
        useOfficeStore.getState().setPending(snapshotOf(state));
        schedulePush();
      }
    });

    const onFocus = () => {
      if (ready.current) void push();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const authEnabled = useOfficeStore((s) => s.authEnabled);
  const authenticated = useOfficeStore((s) => s.authenticated);
  const authReady = useOfficeStore((s) => s.hydrated);

  useEffect(() => {
    if (!ready.current) return;
    if (!authReady) return;
    if (authEnabled && !authenticated) return;
    void fetch("/api/state", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const snapshot = parseSnapshot(data);
        if (snapshot && snapshot.tasks.length > 0) applyFromServer(snapshot);
      })
      .catch(() => undefined);
  }, [authEnabled, authenticated, authReady]);
}
