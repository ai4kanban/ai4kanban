// 恢复 a removed task (#94): the button and its confirm, on the archive's rows and the task page.

import { useEffect, useRef, useState } from "react";
import { FiRotateCcw } from "react-icons/fi";
import { Button } from "@review/components/button";
import { QUIET } from "@review/components/chrome";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T } from "../i18n";

/** Why a restore from the archive failed, for the task page it opens to say. */
const failures = new Map<string, string>();
export const takeRestoreFailure = (task: string) => {
  const why = failures.get(task) ?? null;
  failures.delete(task);
  return why;
};

/** Restores `task`; the line to show when it could not. */
export async function restore(task: api.Task, onDone: (t: api.Task) => void): Promise<string | null> {
  try {
    onDone(await api.restoreTask(task.id));
    return null;
  } catch (e) {
    const code = e instanceof api.ApiError ? e.code : "";
    return T.restoreTask.failed(code === "conflict" ? T.restoreTask.notRemoved : code === "offline" ? T.errors.offline : T.errors.generic);
  }
}

/** Keeps a failure for the task page the archive opens next. */
export const handOver = (task: string, why: string | null) => (why ? failures.set(task, why) : failures.delete(task));

export function RestoreButton({ task, busy, onRestore }: { task: api.Task; busy?: boolean; onRestore: () => void }) {
  const c = T.restoreTask;
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
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(QUIET, open && "bg-nb-wash")}
      >
        <FiRotateCcw className="text-[13px]" aria-hidden />
        {c.label}
      </button>
      {open && (
        <div role="dialog" className="nb-panel nb-pop origin-top-right absolute right-0 top-[calc(100%+6px)] z-20 w-[300px] max-w-[calc(100vw-24px)] bg-nb-paper p-3 text-left">
          <p className="text-[13px] font-[700] text-nb-ink">{c.ask}</p>
          <p className="mt-1.5 text-[12px] font-[400] leading-snug text-nb-ink-soft">{c.hint[task.restores_to ?? "stopped"]}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>
              {T.cancel}
            </Button>
            <Button
              size="xs"
              onClick={() => {
                setOpen(false);
                onRestore();
              }}
            >
              {c.label}
            </Button>
          </div>
        </div>
      )}
    </span>
  );
}
