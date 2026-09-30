"use client";

import type { AuthStatus, DepartmentId } from "@/types";

const DEFAULT_STATUS: AuthStatus = {
  authEnabled: false,
  authenticated: true,
  role: "founder",
};

export async function getRoles(): Promise<DepartmentId[]> {
  try {
    const res = await fetch("/api/auth/roles", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { roles?: DepartmentId[] };
    return data.roles ?? [];
  } catch {
    return [];
  }
}

export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch("/api/auth", { cache: "no-store" });
    if (!res.ok) return DEFAULT_STATUS;
    return (await res.json()) as AuthStatus;
  } catch {
    return DEFAULT_STATUS;
  }
}

export type LoginResult =
  | { ok: true }
  | {
      ok: false;
      reason: "wrong" | "limited" | "error";
      retryAfter?: number;
      remaining?: number;
    };

export async function login(passcode: string): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? 0) || 0;
      return { ok: false, reason: "limited", retryAfter };
    }
    if (res.status === 401) {
      const remaining = Number(res.headers.get("X-RateLimit-Remaining") ?? NaN);
      return {
        ok: false,
        reason: "wrong",
        remaining: Number.isNaN(remaining) ? undefined : remaining,
      };
    }
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth", { method: "DELETE" });
  } catch {
    // abaikan
  }
}
