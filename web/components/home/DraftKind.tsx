"use client";

import type { CSSProperties, ReactNode } from "react";

// One kind on the pinned drafts stage. A click scrolls to where the stage's own scroll puts
// the highlight on it: `stop` of the way through the pinned run.
export function DraftKind({ stop, style, children }: { stop: number; style: CSSProperties; children: ReactNode }) {
  const jump = () => {
    const stage = document.getElementById("drafts-stage");
    const pin = stage?.firstElementChild;
    const run = stage?.lastElementChild;
    if (!(pin instanceof HTMLElement) || !(run instanceof HTMLElement)) return;
    const top = stage!.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(pin).top);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + run.offsetHeight * stop, behavior: still ? "instant" : "smooth" });
  };
  return (
    <li className="relative" style={style}>
      <button
        type="button"
        onClick={jump}
        className="flex h-full w-full cursor-pointer flex-col justify-center rounded-xl px-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep"
      >
        {children}
      </button>
    </li>
  );
}
