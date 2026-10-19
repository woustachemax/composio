"use client";

import Image from "next/image";
import { useState } from "react";

export function AppLogo({ src, name, size = 24, className = "" }: { src: string | null; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = `inline-flex shrink-0 items-center justify-center overflow-hidden border border-line bg-white ${className}`;
  if (!src || failed) {
    return (
      <span className={box} style={{ width: size, height: size }} aria-hidden>
        <span className="font-mono text-ink/70" style={{ fontSize: Math.max(9, Math.round(size * 0.42)) }}>
          {name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?"}
        </span>
      </span>
    );
  }
  const pad = Math.max(2, Math.round(size * 0.16));
  return (
    <span className={box} style={{ width: size, height: size, padding: pad }}>
      <Image src={src} alt="" width={size - pad * 2} height={size - pad * 2} unoptimized className="h-full w-full object-contain" onError={() => setFailed(true)} />
    </span>
  );
}
