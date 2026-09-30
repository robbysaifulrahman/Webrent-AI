import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import { clearEventBus, publishEvent } from "@/lib/eventBus";

const decoder = new TextDecoder();

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("test timeout")), ms),
    ),
  ]);
}

beforeEach(() => {
  clearEventBus();
  process.env.EVENT_STREAM_TICK_MS = "50";
});

afterEach(() => {
  delete process.env.EVENT_STREAM_TICK_MS;
});

describe("GET /api/v1/events/stream (SSE, Phase E)", () => {
  it("handshake ready + server_time, lalu event bus ter-stream", async () => {
    const controller = new AbortController();
    const res = GET(
      new Request("http://x/api/v1/events/stream", { signal: controller.signal }),
    );
    const response = await withTimeout(res as Promise<Response>);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const reader = response.body!.getReader()!;
    try {
      // Frame 1: retry + ready (handshake).
      const first = await withTimeout(reader.read());
      const handshake = decoder.decode(first.value);
      expect(handshake).toContain("retry: 3000");
      expect(handshake).toContain("event: ready");
      expect(handshake).toContain("server_time");

      // Publish event → muncul sebagai frame office-event dalam ±1 tick.
      await publishEvent({
        type: "SECURITY_ALERT",
        data: { severity: "HIGH" },
        requestId: "req_stream-test",
      });
      let received = "";
      for (let i = 0; i < 20; i++) {
        const chunk = await withTimeout(reader.read());
        if (chunk.done) break;
        received += decoder.decode(chunk.value);
        if (received.includes("office-event")) break;
      }
      expect(received).toContain("event: office-event");
      expect(received).toContain("SECURITY_ALERT");
      expect(received).toContain("req_stream-test");
    } finally {
      controller.abort();
    }

    // Setelah abort, stream berakhir rapi.
    const done = await withTimeout(reader.read());
    expect(done.done).toBe(true);
  });
});
