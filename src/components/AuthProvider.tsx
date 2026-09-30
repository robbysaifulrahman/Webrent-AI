"use client";

import { useEffect } from "react";
import { logout, getAuthStatus } from "@/lib/authApi";
import { useOfficeStore } from "@/hooks/useOfficeStore";
import { useServerSync } from "@/hooks/useServerSync";
import type { AuthStatus } from "@/types";

/**
 * Menyambungkan layanan auth ke store kantor:
 * - memuat status saat boot
 * - logout saat server membalas 401
 */
export function AuthProvider() {
  useServerSync();

  useEffect(() => {
    void getAuthStatus().then((status: AuthStatus) => {
      useOfficeStore.getState().setAuth({
        authEnabled: status.authEnabled,
        authenticated: status.authenticated,
        role: status.role,
      });
    });

    const onUnauthorized = () => {
      void logout().then(async () => {
        const status = await getAuthStatus();
        useOfficeStore.getState().setAuth({
          authEnabled: status.authEnabled,
          authenticated: status.authenticated,
          role: status.role,
        });
      });
    };

    window.addEventListener("webrent:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("webrent:unauthorized", onUnauthorized);
  }, []);

  return null;
}
