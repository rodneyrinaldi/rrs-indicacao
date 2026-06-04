"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  value: string;
  className?: string;
};

export function CopyLinkButton({ value, className }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        "rounded-md border border-border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      }
    >
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
