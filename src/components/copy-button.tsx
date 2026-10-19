"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy", className = "btn btn-sm btn-line" }: { value?: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value ?? window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={className}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
