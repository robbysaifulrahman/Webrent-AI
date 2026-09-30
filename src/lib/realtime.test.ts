import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSseClient,
  realtimeTransition,
  type RealtimeStatus,
} from "./realtime";

describe("realtime state machine (Section 15)", () => {
  const cases: Array<[RealtimeStatus, Parameters<typeof realtimeTransition>[1], RealtimeStatus]> = [
    ["DISCONNECTED", "connect", "RECONNECTING"],
    ["RECONNECTING", "open", "SYNCING"],
    ["SYNCING", "event", "CONNECTED"],
    ["CONNECTED", "event", "READY"],
    ["CONNECTED", "error", "RECONNECTING"],
    ["RECONNECTING", "close", "DISCONNECTED"],
    ["CONNECTED", "close", "DISCONNECTED"],
    ["DISCONNECTED", "error", "DISCONNECTED"],
    ["CONNECTED", "connect", "SYNCING"],
  ];

  it.each(cases)("%s + %s → %s", (current, action, expected) => {
    expect(realtimeTransition(current, action)).toBe(expected);
  });
});

describe("createSseClient", () => {
  class FakeEventSource {
    static last: FakeEventSource | null = null;
    url: string;
    listeners = new Map<string, Array<(ev: unknown) => void>>();

    constructor(url: string) {
      this.url = url;
      FakeEventSource.last = this;
    }

    addEventListener(type: string, fn: (ev: unknown) => void) {
      const list = this.listeners.get(type) ?? [];
      list.push(fn);
      this.listeners.set(type, list);
    }

    emit(type: string, ev: unknown) {
      for (const fn of this.listeners.get(type) ?? []) fn(ev);
    }

    close() {
      // koneksi ditutup — tidak perlu aksi untuk test.
    }
  }

  it("open → SYNCING, event → CONNECTED, payload diteruskan ke onEvent", () => {
    const statuses: RealtimeStatus[] = [];
    const events: Array<{ id: string; type: string; data: unknown }> = [];
    const fake = FakeEventSource;
    vi.stubGlobal("EventSource", fake as unknown as typeof EventSource);
    fake.last = null;

    const client = createSseClient({
      url: "/api/v1/events/stream",
      onStatus: (s) => statuses.push(s),
      onEvent: (e) => events.push(e),
    });

    const src = fake.last;
    expect(src?.url).toBe("/api/v1/events/stream");
    src?.emit("open", {});
    src?.emit("office-event", {
      data: JSON.stringify({ id: "evt_1", type: "TASK_CREATED", data: { n: 1 } }),
    });

    expect(statuses).toEqual(["SYNCING", "CONNECTED"]);
    expect(events).toEqual([
      { id: "evt_1", type: "TASK_CREATED", data: { n: 1 } },
    ]);

    // Frame rusak tidak menggagalkan koneksi.
    src?.emit("office-event", { data: "bukan-json" });
    expect(events).toHaveLength(1);

    client.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
