import { recentEvents } from "@/lib/eventBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/stream — realtime channel (Phase E).
 *
 * Transport: Server-Sent Events — satu-satunya pola streaming yang
 * bekerja di Vercel serverless (tidak ada koneksi WS persisten).
 * Di VPS (Phase H / migrasi), native WS wss://api.webrent.id/ws/office
 * menggantikan endpoint ini dengan kontrak frame yang sama.
 *
 * Frame:
 * - event "ready"     → handshake + server_time (Section 17, clock server).
 * - event "office-event" → event bus (Section 13) satu per satu.
 * - event "heartbeat" → keep-alive + server_time berkala.
 * Klien reconnect otomatis (EventSource) dan resync via GET /api/v1/events.
 */
export async function GET(req: Request) {
  const tickMs = Number(process.env.EVENT_STREAM_TICK_MS) || 2000;
  const heartbeatMs = Number(process.env.EVENT_STREAM_HEARTBEAT_MS) || 15000;
  const encoder = new TextEncoder();

  // Cursor klien: id event yang sudah dikirim (dedup antar poll).
  const sentQueue: string[] = [];
  const sentSet = new Set<string>();

  let timer: ReturnType<typeof setInterval> | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const close = (controller: ReadableStreamDefaultController) => {
    if (closed) return;
    closed = true;
    if (timer) clearInterval(timer);
    if (beat) clearInterval(beat);
    try {
      controller.close();
    } catch {
      // Sudah ditutup — abaikan.
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close(controller);
        }
      };

      const heartbeat = () => {
        send(": keep-alive\n\n");
        send(
          `event: heartbeat\ndata: ${JSON.stringify({
            server_time: new Date().toISOString(),
            server_epoch: Date.now(),
            timezone: "Asia/Jakarta",
          })}\n\n`,
        );
      };

      const poll = async () => {
        if (closed) return;
        try {
          const events = await recentEvents({ limit: 100 });
          const fresh = events.filter((e) => !sentSet.has(e.id));
          for (const event of fresh) {
            send(`id: ${event.id}\nevent: office-event\ndata: ${JSON.stringify(event)}\n\n`);
            sentSet.add(event.id);
            sentQueue.push(event.id);
            if (sentQueue.length > 1000) {
              const oldest = sentQueue.shift();
              if (oldest) sentSet.delete(oldest);
            }
          }
        } catch (err) {
          console.warn("[events/stream] poll gagal:", err);
        }
      };

      req.signal.addEventListener("abort", () => close(controller));

      // Handshake: klien langsung tahu jam server.
      send(
        `retry: 3000\n\nevent: ready\ndata: ${JSON.stringify({
          server_time: new Date().toISOString(),
          server_epoch: Date.now(),
          timezone: "Asia/Jakarta",
        })}\n\n`,
      );

      void poll();
      timer = setInterval(() => void poll(), tickMs);
      beat = setInterval(heartbeat, heartbeatMs);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
      if (beat) clearInterval(beat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
