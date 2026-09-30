"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Menangkap kegagalan pemuatan GLB (mis. file belum ada) dan
 * menampilkan kantor prosedural sebagai gantinya.
 */
export class OfficeErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(
      "[Office] Gagal memuat office.glb, memakai kantor prosedural.",
      error,
    );
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
