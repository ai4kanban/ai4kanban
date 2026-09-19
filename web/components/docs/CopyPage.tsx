"use client";

import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";

// Copies a documentation page's Markdown source — not the rendered HTML — so a
// reader can paste the page into their own agent or notes. A text button in the
// page's meta line, so it never competes with the title.
export function CopyPage({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(markdown);
    } catch {
      // No clipboard (insecure context, or permission denied) — say nothing.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Page copied" : "Copy page as Markdown"}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded text-xs text-muted transition-colors duration-150 hover:text-ink"
    >
      {copied ? (
        <>
          <FiCheck size={12} className="text-growth" aria-hidden="true" />
          <span className="text-growth">Copied</span>
        </>
      ) : (
        <>
          <FiCopy size={12} aria-hidden="true" />
          <span>Copy page</span>
        </>
      )}
    </button>
  );
}
