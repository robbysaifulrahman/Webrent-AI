import { describe, expect, it } from "vitest";
import { applyScopedUpdate } from "@/lib/authz";
import type { OfficeSnapshot } from "@/lib/officeData";
import type { Decision, Incident, Task } from "@/types";

function task(id: string, department: Task["department"], title = id): Task {
  return {
    id,
    title,
    status: "TODO",
    priority: "P2",
    department,
    owner: `${department}-agent`,
    dependencies: [],
    approvalRequired: false,
    risk: "LOW",
    deliverables: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

function incident(id: string): Incident {
  return {
    id,
    title: id,
    severity: "HIGH",
    asset: "webrent.my.id",
    status: "OPEN",
    detectedAt: 1,
    actions: [],
  };
}

function decision(id: string, status: Decision["status"] = "PENDING"): Decision {
  return {
    id,
    title: id,
    status,
    requestedBy: "finance-agent",
    risk: "HIGH",
    createdAt: 1,
  };
}

function snap(partial: Partial<OfficeSnapshot> = {}): OfficeSnapshot {
  return {
    tasks: [],
    incidents: [],
    decisions: [],
    audit: [],
    taskSeq: 1,
    incidentSeq: 1,
    decisionSeq: 1,
    version: 3,
    ...partial,
  };
}

describe("applyScopedUpdate", () => {
  it("founder mendapat penggantian penuh", () => {
    const current = snap({ tasks: [task("T1", "product")] });
    const incoming = snap({ tasks: [task("T1", "finance", "diubah")] });

    const result = applyScopedUpdate(current, incoming, "founder");
    expect(result.snapshot.tasks[0].title).toBe("diubah");
    expect(result.snapshot.version).toBe(4);
  });

  it("departemen hanya boleh mengubah task miliknya", () => {
    const current = snap({
      tasks: [task("T1", "finance", "Harga"), task("T2", "security", "Patch")],
    });
    const incoming = snap({
      tasks: [
        task("T1", "security", "HIJACK"),
        task("T2", "security", "Patch v2"),
      ],
    });

    const result = applyScopedUpdate(current, incoming, "security");
    const byId = Object.fromEntries(result.snapshot.tasks.map((t) => [t.id, t]));

    expect(byId["T1"].title).toBe("Harga");
    expect(byId["T1"].department).toBe("finance");
    expect(byId["T2"].title).toBe("Patch v2");
    expect(result.rejected.some((r) => r.startsWith("task.forbidden"))).toBe(true);
  });

  it("security boleh menambah insiden", () => {
    const current = snap();
    const incoming = snap({ incidents: [incident("INC-1")] });

    const result = applyScopedUpdate(current, incoming, "security");
    expect(result.snapshot.incidents).toHaveLength(1);
    expect(result.applied.some((a) => a.startsWith("incidents"))).toBe(true);
  });

  it("finance tidak boleh menambah insiden", () => {
    const current = snap();
    const incoming = snap({ incidents: [incident("INC-1")] });

    const result = applyScopedUpdate(current, incoming, "finance");
    expect(result.snapshot.incidents).toHaveLength(0);
    expect(result.rejected).toContain("incidents:forbidden");
  });

  it("keputusan tidak dapat diubah departemen (founder-only)", () => {
    const current = snap({ decisions: [decision("D1")] });
    const incoming = snap({ decisions: [decision("D1", "APPROVED")] });

    const result = applyScopedUpdate(current, incoming, "finance");
    expect(result.snapshot.decisions[0].status).toBe("PENDING");
    expect(result.rejected).toContain("decisions:founder-only");
  });

  it("menerima audit baru hanya dari aktor sendiri", () => {
    const current = snap();
    const incoming = snap({
      audit: [
        { id: "A1", at: 1, actor: "security", action: "task.status" },
        { id: "A2", at: 2, actor: "finance", action: "task.status" },
      ],
    });

    const result = applyScopedUpdate(current, incoming, "security");
    const ids = result.snapshot.audit.map((a) => a.id);
    expect(ids).toContain("A1");
    expect(ids).not.toContain("A2");
  });

  it("menaikkan versi dari versi server", () => {
    const current = snap({ version: 7 });
    const incoming = snap({ version: 7 });
    const result = applyScopedUpdate(current, incoming, "product");
    expect(result.snapshot.version).toBe(8);
  });
});
