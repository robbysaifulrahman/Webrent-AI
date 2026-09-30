import type { OfficeSnapshot } from "@/lib/officeData";
import type { Decision, Incident, Task } from "@/types";

export type MergeStrategy = "server-wins" | "merge";

export interface MergeResult {
  /** Snapshot gabungan yang layak dikirim ulang ke server. */
  snapshot: OfficeSnapshot;
  /** Jumlah item lokal yang berhasil di-rebase di atas snapshot server. */
  rebased: number;
  /** Jumlah konflik yang dimenangkan server (perubahan lokal dibuang). */
  conflicts: number;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface MergeCollectionResult<T> {
  items: T[];
  rebased: number;
  conflicts: number;
}

/**
 * Three-way merge generik untuk koleksi ber-`id`.
 * - baseline: state terakhir yang disepakati dengan server
 * - mine: state lokal saat ini
 * - server: state server terbaru
 *
 * Aturan per item:
 * - lokal == baseline  → pakai versi server (tidak ada perubahan lokal)
 * - lokal != baseline, server == baseline → pakai versi lokal (rebase)
 * - keduanya berubah & identik → pakai versi lokal
 * - keduanya berubah & berbeda → server menang (konflik)
 */
function mergeCollection<T extends { id: string }>(
  baseline: T[] | null,
  mine: T[],
  server: T[],
): MergeCollectionResult<T> {
  const baseMap = baseline ? byId(baseline) : null;
  const mineMap = byId(mine);
  const serverMap = byId(server);

  const items: T[] = [];
  let rebased = 0;
  let conflicts = 0;

  for (const serverItem of server) {
    const mid = serverItem.id;
    const mineItem = mineMap.get(mid);
    const baseItem = baseMap?.get(mid);

    if (!mineItem) {
      // Dihapus lokal; bila server tidak berubah dari baseline, hormati hapus.
      if (baseItem && same(baseItem, serverItem)) continue;
      items.push(serverItem);
      if (baseItem && !same(baseItem, serverItem)) conflicts += 1;
      continue;
    }

    if (baseItem && same(mineItem, baseItem)) {
      items.push(serverItem);
      continue;
    }

    if (!baseItem || same(serverItem, baseItem)) {
      items.push(mineItem);
      rebased += 1;
      continue;
    }

    if (same(mineItem, serverItem)) {
      items.push(mineItem);
      continue;
    }

    // Keduanya berubah berbeda → server menang.
    items.push(serverItem);
    conflicts += 1;
  }

  // Item lokal yang belum ada di server (mis. task baru milik sendiri).
  for (const mineItem of mine) {
    if (serverMap.has(mineItem.id)) continue;
    const baseItem = baseMap?.get(mineItem.id);
    if (baseItem && same(baseItem, mineItem)) continue;
    items.push(mineItem);
    rebased += 1;
  }

  return { items, rebased, conflicts };
}

function auditUnion(
  baselineIds: Set<string>,
  mine: OfficeSnapshot["audit"],
  server: OfficeSnapshot["audit"],
): OfficeSnapshot["audit"] {
  const serverIds = new Set(server.map((a) => a.id));
  const extra = mine.filter((a) => !serverIds.has(a.id) && !baselineIds.has(a.id));
  return [...extra, ...server].slice(0, 200);
}

/**
 * Merebase perubahan lokal (`mine`) di atas snapshot server terbaru
 * dengan bantuan `baseline` (versi server terakhir yang diketahui klien).
 */
export function mergeSnapshots(
  baseline: OfficeSnapshot | null,
  mine: OfficeSnapshot,
  server: OfficeSnapshot,
): MergeResult {
  const tasks = mergeCollection<Task>(baseline?.tasks ?? null, mine.tasks, server.tasks);
  const incidents = mergeCollection<Incident>(
    baseline?.incidents ?? null,
    mine.incidents,
    server.incidents,
  );
  const decisions = mergeCollection<Decision>(
    baseline?.decisions ?? null,
    mine.decisions,
    server.decisions,
  );

  const baselineIds = new Set((baseline?.audit ?? []).map((a) => a.id));
  const audit = auditUnion(baselineIds, mine.audit, server.audit);

  const seq = (a?: number, b?: number, c?: number) =>
    Math.max(a ?? 0, b ?? 0, c ?? 0);

  return {
    snapshot: {
      tasks: tasks.items,
      incidents: incidents.items,
      decisions: decisions.items,
      audit,
      taskSeq: seq(baseline?.taskSeq, mine.taskSeq, server.taskSeq),
      incidentSeq: seq(baseline?.incidentSeq, mine.incidentSeq, server.incidentSeq),
      decisionSeq: seq(baseline?.decisionSeq, mine.decisionSeq, server.decisionSeq),
      version: server.version,
    },
    rebased: tasks.rebased + incidents.rebased + decisions.rebased,
    conflicts: tasks.conflicts + incidents.conflicts + decisions.conflicts,
  };
}
