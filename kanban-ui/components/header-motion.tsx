"use client";

// The top row's small motion (#1947). Styles live in app/globals.css under the same names.

import { useEffect, useRef, useState } from "react";

/** A lit button's count. Always mounted so it can grow in and out; while fading out it
 *  keeps the last number rather than flashing 0. */
export function HeaderCount({ n, cap = false }: { n: number; cap?: boolean }) {
  const [last, setLast] = useState(n);
  if (n > 0 && n !== last) setLast(n);
  const shown = n > 0 ? n : last;
  return (
    <span aria-hidden className="nb-count-n" data-on={n > 0 || undefined}>
      <span className="text-[11.5px] font-[800] leading-none">{cap && shown > 99 ? "99+" : shown}</span>
    </span>
  );
}

/** The row's controls. A tip waits a beat before showing; once one is up, sweeping to the
 *  next control shows its tip at once. */
export function HeaderTips(props: React.ComponentProps<"div">) {
  const [warm, setWarm] = useState(false);
  const over = useRef<Element | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const cool = () => {
    over.current = null;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setWarm(false), 300);
  };
  return (
    <div
      {...props}
      data-tip-delay=""
      data-tip-warm={warm || undefined}
      onPointerOver={(e) => {
        if (e.pointerType !== "mouse") return;
        const tip = (e.target as Element).closest(".nb-tip");
        if (tip === over.current) return;
        if (!tip) return cool();
        over.current = tip;
        clearTimeout(timer.current);
        if (!warm) timer.current = setTimeout(() => setWarm(true), 400);
      }}
      onPointerLeave={cool}
    />
  );
}
