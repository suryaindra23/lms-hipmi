"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export default function CopyValueButton({ value, label = "Salin" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-900/15 bg-white px-3 text-xs font-extrabold text-slate-700 transition hover:border-orange-400 hover:text-orange-700"
      aria-label={`${label}: ${value}`}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? "Tersalin" : label}
    </button>
  );
}
