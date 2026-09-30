import { configuredRoles } from "@/lib/auth";
import { DEPT_ROLES } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mengembalikan daftar departemen yang punya passcode terkonfigurasi. */
export async function GET() {
  const configured = configuredRoles();
  const roles = DEPT_ROLES.filter((role) => configured.includes(role));
  return Response.json(
    { roles },
    { headers: { "Cache-Control": "no-store" } },
  );
}
