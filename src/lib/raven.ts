import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Raven Integration Adapter — Phase F (Section 8/9/28).
 *
 * Raven = security service eksternal. Ia TIDAK boleh menyentuh database
 * WebRent langsung; komunikasi via Integration API ter-autentikasi:
 * - Autentikasi: HMAC-SHA256 atas `${timestamp}.${rawBody}` dengan
 *   RAVEN_SERVICE_SECRET + window ±5 menit (anti replay, Section 28).
 * - Tanpa env → integrasi DISABLED; endpoint menolak jujur (503).
 * Kredensial hanya dari env — tidak pernah di repo.
 */

export interface RavenConfig {
  serviceId: string;
  serviceSecret: string;
  /** URL API Raven untuk outbound command (opsional). */
  apiUrl: string | null;
}

export function getRavenConfig(): RavenConfig | null {
  const serviceSecret = process.env.RAVEN_SERVICE_SECRET?.trim() ?? "";
  if (!serviceSecret) return null;
  return {
    serviceId: process.env.RAVEN_SERVICE_ID?.trim() || "raven-security",
    serviceSecret,
    apiUrl: process.env.RAVEN_API_URL?.trim().replace(/\/$/, "") || null,
  };
}

export function signRavenPayload(
  rawBody: string,
  timestamp: string,
  serviceSecret: string,
): string {
  return createHmac("sha256", serviceSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export interface RavenAuthResult {
  ok: boolean;
  code: "RAVEN_DISABLED" | "RAVEN_UNAUTHORIZED" | "RAVEN_STALE" | "OK";
}

/** Verifikasi request service-to-service (HMAC + anti-replay). */
export function verifyRavenRequest(
  rawBody: string,
  headers: Headers,
  config: RavenConfig | null,
  toleranceMs = 5 * 60_000,
): RavenAuthResult {
  if (!config) return { ok: false, code: "RAVEN_DISABLED" };

  const timestamp = headers.get("x-webhook-timestamp")?.trim() ?? "";
  const signature = headers.get("x-webhook-signature")?.trim() ?? "";
  const ts = Number(timestamp);
  if (!timestamp || !signature) return { ok: false, code: "RAVEN_UNAUTHORIZED" };
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > toleranceMs) {
    return { ok: false, code: "RAVEN_STALE" };
  }

  const expected = signRavenPayload(rawBody, timestamp, config.serviceSecret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, code: "RAVEN_UNAUTHORIZED" };
  }
  return { ok: true, code: "OK" };
}

/** Outbound: kirim perintah/event ke Raven API (opsional, tak pernah throw). */
export async function sendToRaven(
  path: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const config = getRavenConfig();
  if (!config?.apiUrl) {
    return { ok: false, status: null, error: "RAVEN_API_URL_NOT_CONFIGURED" };
  }
  try {
    const timestamp = String(Date.now());
    const rawBody = JSON.stringify(payload);
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Id": config.serviceId,
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Signature": signRavenPayload(
          rawBody,
          timestamp,
          config.serviceSecret,
        ),
      },
      body: rawBody,
      cache: "no-store",
    });
    return { ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
