// Copied from legacy kanban-ui/components/BoardCard.tsx: the number, one status mark, the
// blocked and question marks, todo progress, the title, priority and stale days. An unread dot
// before the number, and the avatars of whoever left unread comments at the foot. A task with
// no card yet, or one still being written, shows its title and status alone.

import { FiClock, FiHelpCircle } from "react-icons/fi";
import { Avatar } from "@review/components/chat";
import type { Task } from "../api";
import { useAlerts } from "../alerts";
import { T, workflowName } from "../i18n";
import { creating, numberOf, statusOf } from "../lib/card";
import { cn } from "@review/lib/utils";
import { Link } from "../router";
import { useStore } from "../store";
import { BlockedChip, pillLabel, PriorityChip, StatusPill, TodoProgress, WorkflowTag } from "./chips";

export function BoardCard({ task, staleDays }: { task: Task; staleDays?: number }) {
  const store = useStore();
  const unread = useAlerts().of(task.id);
  const who = unread?.commenters ?? [];
  const info = task.creating ? undefined : store.cardOf(task);
  const status = statusOf(task) ?? "failed";
  const userQs = info?.questions.filter((q) => q.user).length ?? 0;
  const box = cn("nb-panel-sm flex flex-col p-3 text-left text-nb-ink no-underline", store.isNew(task) && "nb-new");
  const face = (
    <>
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
          {unread && <span role="img" aria-label={T.unread} className="nb-tip size-[6px] shrink-0 rounded-full bg-nb-accent" data-tip={T.unread} />}
          {numberOf(task.key)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {!!info?.blockedBy.length && <BlockedChip by={info.blockedBy.join(", ")} />}
          <StatusPill status={status} label={pillLabel(task)} />
          {!!info?.questions.length && (
            <span className="nb-tip inline-flex shrink-0" data-tip={T.questionsTip(info.questions.length)} style={{ color: userQs ? "var(--color-nb-accent)" : "var(--color-nb-ink-soft)" }}>
              <FiHelpCircle aria-hidden style={{ width: 13, height: 13 }} />
            </span>
          )}
          {info?.todos && <TodoProgress done={info.todos.done} total={info.todos.total} />}
        </span>
      </div>
      <p className="mb-2.5 break-words text-[13px] font-[700] leading-snug tracking-[-0.01em]">{task.title}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {info?.priority ? <PriorityChip value={info.priority} /> : <WorkflowTag id={task.workflow.id} name={workflowName(task.workflow)} />}
        {!!staleDays && !!info?.modules.length && <span className="text-[10px] font-[700] uppercase tracking-[0.04em] text-nb-ink-soft">· {info.modules[0]}</span>}
        {!!who.length && (
          <span className="nb-tip ml-auto flex shrink-0 items-center" data-tip={T.commentTip(who.join(T.sep))} aria-label={T.commentTip(who.join(T.sep))}>
            {who.slice(0, 3).map((w, i) => (
              <span key={w} className={cn("rounded-full ring-2 ring-nb-paper", i && "-ml-1.5")}>
                <Avatar who={w} size={18} />
              </span>
            ))}
            {who.length > 3 && <span className="ml-1 text-[11px] font-[700] tabular-nums text-nb-ink-soft">+{who.length - 3}</span>}
          </span>
        )}
        {!!staleDays && (
          <span className="nb-tip ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-[800] tabular-nums text-nb-peach-ink" data-tip={T.staleTip(staleDays)}>
            <FiClock aria-hidden style={{ width: 11, height: 11 }} />
            {T.staleDays(staleDays)}
          </span>
        )}
      </div>
    </>
  );
  // Its card is still being written (#98): on the board, but not open yet.
  if (creating(task)) return <div className={box}>{face}</div>;
  return (
    <Link href={`/tasks/${encodeURIComponent(task.key)}`} className={cn(box, "nb-press cursor-pointer")}>
      {face}
    </Link>
  );
}
