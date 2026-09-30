"use client";

import { useEffect, useRef, useState } from "react";
import {
  createRealtimeClient,
  type RealtimeClient,
  type RealtimeEventFrame,
  type RealtimeStatus,
} from "@/lib/realtime";

/**
 * Koneksi realtime kantor (Phase E): event bus via SSE/WS.
 * UI hanya merender status & event — tidak menciptakan state palsu
 * (Section 65). Sinkronisasi snapshot tetap lewat useServerSync.
 */
export function useRealtimeOffice(): {
  status: RealtimeStatus;
  lastEvent: RealtimeEventFrame | null;
  serverTime: string | null;
} {
  const [status, setStatus] = useState<RealtimeStatus>("DISCONNECTED");
  const [lastEvent, setLastEvent] = useState<RealtimeEventFrame | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_REALTIME_URL?.trim() || "/api/v1/events/stream";
    clientRef.current = createRealtimeClient({
      url,
      onStatus: setStatus,
      onEvent: setLastEvent,
      onServerTime: (iso) => setServerTime(iso),
    });
    return () => {
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, []);

  return { status, lastEvent, serverTime };
}
