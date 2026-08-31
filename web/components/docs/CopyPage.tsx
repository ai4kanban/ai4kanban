"use client";

import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";

// Copies a documentation page's Markdown source — not the rendered HTML — so a
// reader can paste the page into their own agent or notes. It is the same
// affordance the code blocks carry (`ProseCode.tsx`) applied to the whole page,
// and it draws the same block: the wash, the ink outline, muted type that comes
// up to ink on hover.
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
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-border bg-code px-2.5 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-elev hover:text-ink"
    >
      {copied ? (
        <>
          <FiCheck size={13} className="text-growth" aria-hidden="true" />
          <span className="text-growth">Copied</span>
        </>
      ) : (
        <>
          <FiCopy size={13} aria-hidden="true" />
          <span>Copy page</span>
        </>
      )}
    </button>
  );
}
