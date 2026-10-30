// Copied from legacy kanban-ui/components/Archive.tsx: the current project's finished and
// cancelled tasks, sorted by when they finished or were created; a row opens the read-only page.
// A row with an unread 已完成 or comment alert carries a dot and a bold title; the rest are grey.
// A removed row can be restored (#94).

import { useEffect, useState } from "react";
import { HAIRLINE } from "@review/components/chrome";
import { cn } from "@review/lib/utils";
import { useAlerts } from "../alerts";
import { REVIEW, T } from "../i18n";
import { numberOf } from "../lib/card";
import type { Task } from "../api";
import { handOver, restore, RestoreButton } from "../components/Restore";
import { Link, navigate, useLocation } from "../router";
import { useStore } from "../store";
import { Window } from "../components/Window";

// A removed row's 恢复 takes the date's place on hover, while its confirm is open, and always on a phone.
const RESTORE_SHOWN = "group-hover:opacity-100 group-focus-within:opacity-100 group-has-[[aria-expanded=true]]:opacity-100 max-md:opacity-100";
const DATE_HIDDEN = "group-hover:invisible group-focus-within:invisible group-has-[[aria-expanded=true]]:invisible max-md:invisible";

export function Archive() {
  const store = useStore();
  const alerts = useAlerts();
  const { query } = useLocation();
  const [sort, setSort] = useState<"done" | "created">("done");
  const [busy, setBusy] = useState<string | null>(null);
  const id = query.get("project") ?? "";
  const project = store.projects.find((p) => p.id === id);
  useEffect(() => {
    document.title = `${T.archive} · WildCrane`;
  }, []);
  // Either way the task page opens: restored, or saying why not.
  const back = async (t: Task) => {
    setBusy(t.id);
    handOver(t.id, await restore(t, store.patchTask));
    setBusy(null);
    navigate(`/tasks/${encodeURIComponent(t.key)}`);
  };
  const rows = (store.tasks ?? [])
    .filter((t) => (t.status === "done" || t.status === "cancelled") && (!project || t.project === project.id))
    .sort((a, b) => (sort === "done" ? b.updated_at.localeCompare(a.updated_at) : b.created_at.localeCompare(a.created_at)));
  return (
    <Window project={project}>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[840px] flex-col px-6 py-6 max-md:px-4">
          <div className="mb-4 flex items-center gap-4">
            <h1 className="text-[20px] font-[800] tracking-[-0.02em]">{T.archive}</h1>
            <span className="text-[12px] text-nb-ink-soft">{T.archiveCount(rows.length)}</span>
            <span className="ml-auto flex items-center gap-4 text-[12.5px]" role="tablist">
              {(["done", "created"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={sort === k} onClick={() => setSort(k)} className={`flex cursor-pointer flex-col items-center gap-1 ${sort === k ? "font-[700]" : "text-nb-ink-soft"}`}>
                  {k === "done" ? T.sortDone : T.sortCreated}
                  <span className={`h-[2px] w-full rounded-full ${sort === k ? "bg-nb-ink" : ""}`} aria-hidden />
                </button>
              ))}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="text-[13px] text-nb-ink-soft">{T.archiveEmpty}</p>
          ) : (
            <div key={sort} className="nb-section a4k-reveal flex flex-col bg-nb-sheet">
              {rows.map((t, k) => {
                const unread = !!alerts.of(t.id)?.alerts.some((a) => a.kind === "done" || a.kind === "comment");
                const removed = t.status === "cancelled";
                return (
                <div key={t.id} className="group relative has-[[aria-expanded=true]]:z-10" style={k ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}>
                  <Link href={`/tasks/${encodeURIComponent(t.key)}`} className="flex h-12 items-center gap-3 px-4 text-[13px] text-nb-ink no-underline hover:bg-nb-wash group-has-[[aria-expanded=true]]:bg-nb-wash">
                    <span className="flex w-[56px] shrink-0 items-center gap-1.5 text-[12px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
                      <span role="img" aria-label={unread ? T.unread : undefined} aria-hidden={!unread} className={cn("size-[6px] shrink-0 rounded-full", unread && "bg-nb-accent")} />
                      {numberOf(t.key)}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", unread ? "font-[700]" : "font-[500] text-nb-ink-soft")}>{t.title}</span>
                    {removed && (
                      <span className="nb-chip" style={{ background: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", color: "var(--color-nb-ink-soft)" }}>
                        {T.status.cancelled}
                      </span>
                    )}
                    <span className={cn("w-[72px] shrink-0 text-right text-[12px] text-nb-ink-soft", removed && DATE_HIDDEN)}>
                      {REVIEW.date(sort === "done" ? t.updated_at : t.created_at)}
                    </span>
                  </Link>
                  {removed && (
                    <span className={cn("absolute right-4 top-0 flex h-12 items-center opacity-0", RESTORE_SHOWN)}>
                      <RestoreButton task={t} busy={busy === t.id} onRestore={() => void back(t)} />
                    </span>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
