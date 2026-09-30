import { getDbConfig } from "./db";
import { getKvConfig } from "./kv";

/**
 * Mode kantor — Phase H (LIVE vs DEMO, Section 51/65).
 *
 * LIVE hanya bila: (1) OFFICE_MODE=LIVE diminta, DAN (2) backend bersama
 * benar-benar aktif (KV atau Postgres). Tanpa backend bersama, sistem
 * jujur tampil DEMO — tidak pernah memalsukan integrasi sukses.
 */
export interface OfficeModeInfo {
  mode: "LIVE" | "DEMO";
  requested: "LIVE" | "DEMO";
  sharedBackend: boolean;
  reason: string;
}

export function getOfficeMode(): OfficeModeInfo {
  const requested =
    process.env.OFFICE_MODE?.trim().toUpperCase() === "LIVE" ? "LIVE" : "DEMO";
  const sharedBackend = Boolean(getKvConfig()) || Boolean(getDbConfig());

  if (requested === "LIVE" && !sharedBackend) {
    return {
      mode: "DEMO",
      requested,
      sharedBackend,
      reason:
        "OFFICE_MODE=LIVE menunggu backend bersama (KV/Postgres) — tampil DEMO agar tidak fake.",
    };
  }
  return {
    mode: requested,
    requested,
    sharedBackend,
    reason:
      requested === "LIVE"
        ? "Backend bersama aktif."
        : "Mode DEMO (simulasi lokal).",
  };
}
