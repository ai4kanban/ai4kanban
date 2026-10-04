"use client";

// The welcome tour, opened again from Settings (#1500). Cloud's board has no Configuration
// dialog, so the tour is drawn here rather than asked of the board.

import { useState } from "react";
import { Button } from "@/components/button";
import { WelcomeTour } from "@/components/WelcomeTour";
import { useCopy } from "@/i18n/use-copy";

export function TourRow() {
  const c = useCopy().tour;
  const [open, setOpen] = useState(false);
  return (
    <div className="nb-panel-sm flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px] font-[700] text-nb-ink">{c.dialog}</span>
        <span className="text-[13px] font-[600] text-nb-ink-soft">{c.replay.note}</span>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        {c.replay.button}
      </Button>
      {open && <WelcomeTour onClose={() => setOpen(false)} />}
    </div>
  );
}
