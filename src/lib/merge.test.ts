import { describe, expect, it } from "vitest";
import { mergeSnapshots } from "@/lib/merge";
import type { OfficeSnapshot } from "@/lib/officeData";
import type { Decision, Task } from "@/types";

function task(id: string, title: string, updatedAt = 1): Task {
  return {
    id,
    title,
    status: "TODO",
    priority: "P2",
    department: "product",
    owner: "pm-agent",
    dependencies: [],
    approvalRequired: false,
    risk: "LOW",
    deliverables: [],
    createdAt: 1,
    updatedAt,
  };
}

function decision(id: string, status: Decision["status"]): Decision {
  return {
    id,
    title: id,
    status,
    requestedBy: "finance-agent",
    risk: "HIGH",
    createdAt: 1,
  };
}

function snap(
  tasks: Task[],
  version: number,
  decisions: Decision[] = [],
): OfficeSnapshot {
  return {
    tasks,
    incidents: [],
    decisions,
    audit: [],
    taskSeq: 10,
    incidentSeq: 1,
    decisionSeq: 1,
    version,
  };
}

describe("mergeSnapshots", () => {
  it("memakai server untuk item yang tidak diubah lokal", () => {
    const baseline = snap([task("T1", "A")], 5);
    const server = snap([task("T1", "A-server", 9)], 6);
    const mine = snap([task("T1", "A")], 5);

    const result = mergeSnapshots(baseline, mine, server);
    expect(result.snapshot.tasks[0].title).toBe("A-server");
    expect(result.conflicts).toBe(0);
  });

  it("merebase perubahan lokal ketika server tidak berubah", () => {
    const baseline = snap([task("T1", "A"), task("T2", "B")], 5);
    const server = snap([task("T1", "A-server", 9), task("T2", "B")], 6);
    const mine = snap([task("T1", "A"), task("T2", "B-local", 3)], 5);

    const result = mergeSnapshots(baseline, mine, server);
    const byId = Object.fromEntries(result.snapshot.tasks.map((t) => [t.id, t]));
    expect(byId["T1"].title).toBe("A-server");
    expect(byId["T2"].title).toBe("B-local");
    expect(result.rebased).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(result.snapshot.version).toBe(6);
  });

  it("server menang saat keduanya mengubah item yang sama", () => {
    const baseline = snap([task("T2", "B")], 5);
    const server = snap([task("T2", "B-server", 10)], 7);
    const mine = snap([task("T2", "B-local", 3)], 5);

    const result = mergeSnapshots(baseline, mine, server);
    expect(result.snapshot.tasks[0].title).toBe("B-server");
    expect(result.conflicts).toBe(1);
  });

  it("mempertahankan item lokal yang baru", () => {
    const baseline = snap([task("T1", "A")], 5);
    const server = snap([task("T1", "A")], 6);
    const mine = snap([task("T1", "A"), task("T3", "Baru")], 5);

    const result = mergeSnapshots(baseline, mine, server);
    const ids = result.snapshot.tasks.map((t) => t.id);
    expect(ids).toContain("T3");
    expect(result.rebased).toBe(1);
  });

  it("menghormati penghapusan lokal bila server tidak berubah", () => {
    const baseline = snap([task("T1", "A"), task("T2", "B")], 5);
    const server = snap([task("T1", "A"), task("T2", "B")], 6);
    const mine = snap([task("T1", "A")], 5);

    const result = mergeSnapshots(baseline, mine, server);
    expect(result.snapshot.tasks.map((t) => t.id)).toEqual(["T1"]);
  });

  it("menggabungkan audit dari lokal dan server", () => {
    const baseline = snap([task("T1", "A")], 5);
    baseline.audit = [{ id: "A0", at: 1, actor: "founder", action: "init" }];
    const server = snap([task("T1", "A")], 6);
    server.audit = [{ id: "A1", at: 2, actor: "founder", action: "server" }];
    const mine = snap([task("T1", "A")], 5);
    mine.audit = [
      { id: "A2", at: 3, actor: "founder", action: "local" },
      { id: "A1", at: 2, actor: "founder", action: "server" },
    ];

    const result = mergeSnapshots(baseline, mine, server);
    const ids = result.snapshot.audit.map((a) => a.id);
    expect(ids).toContain("A1");
    expect(ids).toContain("A2");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("menggabungkan keputusan: server dipercaya untuk konflik", () => {
    const baseline = snap([], 5, [decision("D1", "PENDING")]);
    const server = snap([], 6, [decision("D1", "APPROVED")]);
    const mine = snap([], 5, [decision("D1", "REJECTED")]);

    const result = mergeSnapshots(baseline, mine, server);
    expect(result.snapshot.decisions[0].status).toBe("APPROVED");
    expect(result.conflicts).toBe(1);
  });
});
