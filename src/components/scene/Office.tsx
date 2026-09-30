"use client";

import { Suspense, useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { OfficeErrorBoundary } from "./OfficeErrorBoundary";
import { OfficeProcedural } from "./OfficeProcedural";

const OFFICE_URL = "/models/office.glb";

function OfficeModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/**
 * Memuat model kantor hasil export Blender (.glb) via useGLTF.
 *
 * File .glb bersifat opsional (dibuat manual via Blender), jadi keberadaannya
 * dicek dulu dengan HEAD request. useGLTF hanya dipanggil bila file terbukti
 * ada — error boundary tidak bisa diandalkan untuk error suspense async,
 * sehingga pengecekan eksplisit ini mencegah crash 404.
 */
export function Office() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(OFFICE_URL, { method: "HEAD" }).then(
      (res) => {
        if (!cancelled) setAvailable(res.ok);
      },
      () => {
        if (!cancelled) setAvailable(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (available !== true) {
    // Belum dicek / file tidak ada / cek gagal → kantor prosedural (aman).
    return <OfficeProcedural />;
  }

  return (
    <OfficeErrorBoundary fallback={<OfficeProcedural />}>
      <Suspense fallback={<OfficeProcedural />}>
        <OfficeModel url={OFFICE_URL} />
      </Suspense>
    </OfficeErrorBoundary>
  );
}

export { OfficeProcedural };
