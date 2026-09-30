"use client";

import { Html } from "@react-three/drei";

/**
 * Balon percakapan yang menempel di atas karakter (DOM melalui drei Html).
 */
export function SpeechBubble({
  text,
  color,
  accent,
}: {
  text: string;
  color: string;
  accent: string;
}) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const preview = trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;

  return (
    <Html position={[0, 2.5, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
      <div
        className="pointer-events-none max-w-[210px] rounded-2xl px-3 py-2 text-[11px] leading-snug shadow-xl"
        style={{
          background: "#ffffff",
          color: "#1c1c22",
          border: `2px solid ${color}`,
        }}
      >
        <span
          className="block text-[9px] font-bold uppercase tracking-wide"
          style={{ color: accent }}
        >
          AI
        </span>
        {preview}
      </div>
    </Html>
  );
}
