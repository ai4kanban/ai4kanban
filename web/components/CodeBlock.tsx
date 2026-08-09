"use client";

import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";

// The button's four labels come in as props: this is a client component, so it
// can't reach the copy module the way a server component does.
export type CodeBlockLabels = {
  copy: string;
  copied: string;
  copyAria: string;
  copiedAria: string;
};

export function CodeBlock({
  children,
  labels,
}: {
  children: string;
  labels: CodeBlockLabels;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(children);
      } else {
        // fallback for non-secure contexts (e.g. plain http)
        const ta = document.createElement("textarea");
        ta.value = children;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error("Copy failed", err);
    } finally {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="group relative my-4">
      {/* The wash and the hard ink shadow, and no outline — the panel's default
          block. The copy button on top keeps its border, because a button is
          the one thing that still draws one. */}
      <pre className="overflow-x-auto rounded-xl bg-code p-5 pr-14 shadow-[4px_4px_0_0_var(--color-ink)]">
        <code className="font-mono text-sm leading-7 text-ink">{children}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? labels.copiedAria : labels.copyAria}
        // The outline stays ink; hover lifts the fill off the wash it sits on.
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border-2 border-border bg-code px-2.5 py-1.5 text-xs font-medium text-muted opacity-0 transition-all duration-150 hover:bg-elev hover:text-ink focus-visible:opacity-100 focus-visible:outline-none active:scale-95 group-hover:opacity-100 cursor-pointer"
      >
        {copied ? (
          <>
            <CheckIcon />
            <span className="text-growth">
              {labels.copied}
            </span>
          </>
        ) : (
          <>
            <CopyIcon />
            <span>{labels.copy}</span>
          </>
        )}
      </button>
    </div>
  );
}

function CopyIcon() {
  return <FiCopy size={13} aria-hidden="true" />;
}

function CheckIcon() {
  return (
    <FiCheck
      size={13}
      className="text-growth"
      aria-hidden="true"
    />
  );
}
