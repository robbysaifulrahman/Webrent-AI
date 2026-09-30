"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEPARTMENTS } from "@/data/departments";
import { getAuthStatus, getRoles, login, logout } from "@/lib/authApi";
import { useOfficeStore } from "@/hooks/useOfficeStore";
import type { DepartmentId, Role } from "@/types";

const ROLE_LABEL: Record<string, string> = {
  founder: "Founder",
  guest: "Guest",
  ...Object.fromEntries(
    Object.entries(DEPARTMENTS).map(([id, label]) => [id, `${label} Lead`]),
  ),
};

function roleLabel(role: Role): string {
  return ROLE_LABEL[role] ?? role;
}

export function AuthControls() {
  const authEnabled = useOfficeStore((s) => s.authEnabled);
  const authenticated = useOfficeStore((s) => s.authenticated);
  const role = useOfficeStore((s) => s.role);
  const hydrated = useOfficeStore((s) => s.hydrated);
  const setAuth = useOfficeStore((s) => s.setAuth);

  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<DepartmentId[]>([]);

  useEffect(() => {
    if (open) void getRoles().then(setRoles);
  }, [open]);

  const refresh = async () => {
    const status = await getAuthStatus();
    setAuth({
      authEnabled: status.authEnabled,
      authenticated: status.authenticated,
      role: status.role,
    });
  };

  if (!hydrated) return null;

  if (!authEnabled) {
    return (
      <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[10px] text-slate-400 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Mode lokal · auth nonaktif
      </span>
    );
  }

  if (authenticated && role !== "guest") {
    return (
      <button
        type="button"
        onClick={async () => {
          await logout();
          await refresh();
        }}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-medium text-emerald-300 backdrop-blur transition hover:bg-emerald-500/25"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {roleLabel(role)} · keluar
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-1 text-[10px] font-medium text-amber-300 backdrop-blur transition hover:bg-amber-500/25"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Masuk (Founder / Departemen)
      </button>

      {open && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <form
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const result = await login(passcode);
              setBusy(false);
              if (result.ok) {
                await refresh();
                setPasscode("");
                setOpen(false);
              } else if (result.reason === "limited") {
                const wait = result.retryAfter
                  ? ` Tunggu ±${Math.ceil(result.retryAfter / 60)} menit atau restart dev server.`
                  : "";
                setError(`Terlalu banyak percobaan login.${wait}`);
              } else if (result.reason === "wrong") {
                const left =
                  result.remaining !== undefined && result.remaining > 0
                    ? ` (sisa ${result.remaining}x percobaan)`
                    : " (kesempatan habis — tunggu sebentar atau restart server)";
                setError(`Passcode salah. Coba lagi.${left}`);
              } else {
                setError("Login gagal (server tidak merespons). Coba lagi.");
              }
            }}
            className="w-[min(340px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
          >
            <h2 className="text-sm font-semibold text-white">Akses Terbatas</h2>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Masukkan passcode. Sistem mengenali role dari passcode yang cocok
              (Founder dapat mengakses semua; departemen hanya perintahnya).
            </p>

            {roles.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-[10px] text-slate-500">
                {roles.map((d) => (
                  <li key={d}>· {DEPARTMENTS[d]} Lead terdaftar</li>
                ))}
              </ul>
            )}

            <input
              type="password"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError("");
                  setPasscode("");
                }}
                className="rounded-xl px-3 py-2 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busy || !passcode.trim()}
                className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500 disabled:opacity-40"
              >
                {busy ? "Memeriksa…" : "Masuk"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
