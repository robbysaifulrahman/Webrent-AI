/**
 * Realtime client — Phase E (Enable WebSocket).
 *
 * State machine koneksi mengikuti Section 15:
 *   DISCONNECTED → SYNCING → CONNECTED
 *   CONNECTED → RECONNECTING → SYNCING → CONNECTED
 *   any → DISCONNECTED
 *
 * Transport:
 * - SSE (default): EventSource ke /api/v1/events/stream — Vercel-safe.
 * - native WS: bila NEXT_PUBLIC_WS_URL (wss://...) diisi — untuk VPS
 *   (wss://api.webrent.id/ws/office) nanti di Phase H/migrasi.
 */

export type RealtimeStatus =
  | "DISCONNECTED"
  | "RECONNECTING"
  | "SYNCING"
  | "CONNECTED"
  | "READY";

export type RealtimeAction = "connect" | "open" | "event" | "error" | "close";

/** Transisi status murni — mudah diuji, dipakai klien SSE & WS. */
export function realtimeTransition(
  current: RealtimeStatus,
  action: RealtimeAction,
): RealtimeStatus {
  switch (action) {
    case "connect":
      return current === "CONNECTED" || current === "SYNCING"
        ? "SYNCING"
        : "RECONNECTING";
    case "open":
      return "SYNCING";
    case "event":
      // Event pertama setelah open → sync selesai; READY dipakai sebagai
      // alias liveness setelah sync (sinkron dengan Section 15).
      return current === "SYNCING" ? "CONNECTED" : "READY";
    case "error":
      return current === "DISCONNECTED" ? "DISCONNECTED" : "RECONNECTING";
    case "close":
      return "DISCONNECTED";
  }
}

export interface RealtimeEventFrame {
  id: string;
  type: string;
  data: unknown;
}

export interface RealtimeClientOptions {
  url: string;
  onStatus: (status: RealtimeStatus) => void;
  onEvent: (frame: RealtimeEventFrame) => void;
  onServerTime?: (iso: string, epoch: number) => void;
}

export interface RealtimeClient {
  close(): void;
}

/** Buat EventSource (SSE) dengan state machine Section 15. */
export function createSseClient(options: RealtimeClientOptions): RealtimeClient {
  const source = new EventSource(options.url);
  let status: RealtimeStatus = "DISCONNECTED";

  const set = (next: RealtimeStatus) => {
    if (next === status) return;
    status = next;
    options.onStatus(next);
  };

  source.addEventListener("open", () => set(realtimeTransition(status, "open")));
  source.addEventListener("error", () => set(realtimeTransition(status, "error")));

  source.addEventListener("ready", (ev) => {
    try {
      const payload = JSON.parse((ev as MessageEvent<string>).data) as {
        server_time: string;
        server_epoch: number;
      };
      options.onServerTime?.(payload.server_time, payload.server_epoch);
    } catch {
      // Frame tidak valid — lewati, jangan gagalkan koneksi.
    }
    set(realtimeTransition(status, "open"));
  });

  source.addEventListener("heartbeat", (ev) => {
    try {
      const payload = JSON.parse((ev as MessageEvent<string>).data) as {
        server_time: string;
        server_epoch: number;
      };
      options.onServerTime?.(payload.server_time, payload.server_epoch);
    } catch {
      // Lewati heartbeat rusak.
    }
  });

  source.addEventListener("office-event", (ev) => {
    try {
      const payload = JSON.parse((ev as MessageEvent<string>).data) as {
        id: string;
        type: string;
        data: unknown;
      };
      options.onEvent({ id: payload.id, type: payload.type, data: payload.data });
      set(realtimeTransition(status, "event"));
    } catch {
      // Lewati frame rusak.
    }
  });

  return {
    close() {
      source.close();
      set(realtimeTransition(status, "close"));
    },
  };
}

/** Native WebSocket — slot untuk wss://api.webrent.id/ws/office (VPS). */
export function createWsClient(options: RealtimeClientOptions): RealtimeClient {
  const socket = new WebSocket(options.url);
  let status: RealtimeStatus = "DISCONNECTED";

  const set = (next: RealtimeStatus) => {
    if (next === status) return;
    status = next;
    options.onStatus(next);
  };

  socket.addEventListener("open", () => set(realtimeTransition(status, "open")));
  socket.addEventListener("message", (ev) => {
    try {
      const payload = JSON.parse(String(ev.data)) as RealtimeEventFrame & {
        server_time?: string;
        server_epoch?: number;
      };
      if (payload.server_time && payload.server_epoch) {
        options.onServerTime?.(payload.server_time, payload.server_epoch);
        return;
      }
      if (payload.id && payload.type) {
        options.onEvent({ id: payload.id, type: payload.type, data: payload.data });
        set(realtimeTransition(status, "event"));
      }
    } catch {
      // Lewati frame rusak.
    }
  });
  socket.addEventListener("error", () => set(realtimeTransition(status, "error")));
  socket.addEventListener("close", () => set(realtimeTransition(status, "close")));

  return {
    close() {
      socket.close();
      set(realtimeTransition(status, "close"));
    },
  };
}

/** Pilih transport: WS bila NEXT_PUBLIC_WS_URL diisi, selain itu SSE. */
export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (wsUrl) return createWsClient({ ...options, url: wsUrl });
  return createSseClient(options);
}
