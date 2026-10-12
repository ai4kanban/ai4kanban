"use client";

import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import type { CodeBlockLabels } from "@/components/CodeBlock";

// One press copies `text`; the label says so for two seconds.
export function CopyButton({ text, labels, className }: { text: string; labels: CodeBlockLabels; className: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  }

  const Icon = copied ? FiCheck : FiCopy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? labels.copiedAria : labels.copyAria}
      className={`inline-flex cursor-pointer items-center gap-1.5 font-sans active:scale-95 ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {copied ? labels.copied : labels.copy}
    </button>
  );
}
