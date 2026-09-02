"use client";

import { useRef, useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import type { ComponentPropsWithoutRef } from "react";
import type { CodeBlockLabels } from "../CodeBlock";

// The copy button on a fenced code block in a post.
//
// `CodeBlock.tsx` is the site's other one and takes its code as a string, which
// is what a component can do when it types its own snippet. A post's block
// arrives as compiled markup, so the text is read back off the DOM node instead
// — the rendered <pre> is the only place it exists as a string.
//
// The block itself — the band, the radius, the hard ink shadow — is drawn by
// `.blog-prose pre` in `app/blog-prose.css`. This file owns the button only.
export function ProseCode({
  labels,
  ...props
}: ComponentPropsWithoutRef<"pre"> & { labels: CodeBlockLabels }) {
  const pre = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(pre.current?.textContent ?? "");
    } catch {
      // No clipboard (insecure context, or permission denied) — say nothing.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative">
      <pre ref={pre} {...props} />
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? labels.copiedAria : labels.copyAria}
        // A quiet chip on the block, not a control on the page: no outline, and
        // the paper fill is what lifts it off the wash.
        className="absolute right-2.5 top-2.5 flex cursor-pointer items-center gap-1.5 rounded-md bg-elev px-2 py-1 text-xs font-medium text-muted opacity-0 transition-all duration-150 hover:text-ink focus-visible:opacity-100 focus-visible:outline-none active:scale-95 group-hover:opacity-100"
      >
        {copied ? (
          <>
            <FiCheck size={13} className="text-growth" aria-hidden="true" />
            <span className="text-growth">{labels.copied}</span>
          </>
        ) : (
          <>
            <FiCopy size={13} aria-hidden="true" />
            <span>{labels.copy}</span>
          </>
        )}
      </button>
    </div>
  );
}
