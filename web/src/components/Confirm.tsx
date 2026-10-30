// A quiet button that asks before it acts: restoring a removed task (#94), discarding a build (#61).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@review/components/button";
import { QUIET } from "@review/components/chrome";
import { cn } from "@review/lib/utils";
import { T } from "../i18n";

export function ConfirmButton({ icon, label, ask, hint, busy, onConfirm }: { icon: ReactNode; label: string; ask: string; hint: string; busy?: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <span ref={box} className="relative flex">
      <button type="button" disabled={busy} onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn(QUIET, open && "bg-nb-wash")}>
        {icon}
        {label}
      </button>
      {open && (
        <div role="dialog" className="nb-panel nb-pop origin-top-right absolute right-0 top-[calc(100%+6px)] z-20 w-[300px] max-w-[calc(100vw-24px)] bg-nb-paper p-3 text-left">
          <p className="text-[13px] font-[700] text-nb-ink">{ask}</p>
          <p className="mt-1.5 text-[12px] font-[400] leading-snug text-nb-ink-soft">{hint}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>
              {T.cancel}
            </Button>
            <Button
              size="xs"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {label}
            </Button>
          </div>
        </div>
      )}
    </span>
  );
}
