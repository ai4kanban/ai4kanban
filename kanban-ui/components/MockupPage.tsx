"use client";

// One mockup, on its own, at full size (#239). Nothing else is on the page: the card page
// is where a mockup is compared with the others, and this is where it is read.
//
// It keeps the same sandbox the card page's frame has — nothing runs, nothing loads —
// and it is not scaled, so the page itself scrolls when the window is narrower than the
// desktop screen the mockup was drawn on.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import type { MockupView } from "@/lib/mockup-tag";

const W = 1280;
const H = 800;

export function MockupPage({ view }: { view: MockupView }) {
  const router = useRouter();
  const [showCode, setShowCode] = useState(!!view.error);

  return (
    <div className="min-h-screen bg-nb-cream">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-[700] text-nb-ink-soft hover:text-nb-accent-deep"
        >
          <FiArrowLeft aria-hidden className="text-[14px]" />
          Back
        </button>
        <span className="min-w-0 truncate font-mono text-[12px] text-nb-ink-soft">{view.src}</span>
        {view.code && (
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            disabled={!!view.error}
            className="ml-auto shrink-0 cursor-pointer text-[11px] font-[800] uppercase tracking-[0.06em] text-nb-ink-soft hover:text-nb-accent-deep disabled:cursor-default disabled:opacity-40"
          >
            {showCode ? "Screen" : "Code"}
          </button>
        )}
      </div>

      {view.error && (
        <p
          className="nb-outline mx-4 mb-3 px-3 py-2.5 font-mono text-[12.5px] leading-[18px] text-nb-ink-soft"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {view.error}
        </p>
      )}

      {showCode ? (
        <pre className="mx-4 mb-4 overflow-auto whitespace-pre bg-nb-paper p-3 font-mono text-[12px] leading-[18px]">
          {view.code}
        </pre>
      ) : (
        view.doc && (
          <iframe
            sandbox=""
            srcDoc={view.doc}
            title={view.src}
            style={{ width: W, minHeight: H, height: "calc(100vh - 44px)", border: 0 }}
          />
        )
      )}
    </div>
  );
}
