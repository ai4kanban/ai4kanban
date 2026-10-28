// A group root's subtasks section, after legacy kanban-ui/components/CardPage.tsx (#333, #357): the
// build order drawn at its head and the rows folded beneath it. With no map to draw — the phone, or
// no blocker inside the group — the rows are all there is.

import { useEffect, useMemo, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import type { Task } from "../api";
import { T } from "../i18n";
import { buildSubtaskMap } from "../lib/subtask-map";
import { boardFiles, subtasksOf, type Subtask } from "../lib/subtasks";
import { useNarrow } from "../lib/narrow";
import { Link } from "../router";
import { useStore } from "../store";
import { TodoProgress } from "./chips";
import { PULSE_DOT, SubtaskMap } from "./SubtaskMap";

const HAIR =
  "h-px flex-1 bg-[color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_40%,transparent)]";

export function Subtasks({ task }: { task: Task }) {
  const store = useStore();
  const phone = useNarrow();
  const id = Number(/(\d+)$/.exec(task.key)?.[1]);
  const [subtasks, setSubtasks] = useState<Subtask[] | null>(null);
  const [tip, setTip] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setSubtasks(null);
    setOpen(false);
    const load = () => void boardFiles(task.project).then((files) => live && setSubtasks(subtasksOf(files, id)), () => {});
    load();
    // A card changed in the project may be one of the group's.
    const off = store.onEvent((e) => {
      if (e.type === "task.updated" && (e.data as { project?: string }).project === task.project) load();
    });
    return () => {
      live = false;
      off();
    };
  }, [task.project, id]);

  const keyOf = (n: number) => task.key.replace(/\d+$/, String(n));
  const running = useMemo(() => {
    const keys = new Map((store.tasks ?? []).map((t) => [t.key, t]));
    return new Set((subtasks ?? []).map((s) => s.id).filter((n) => keys.get(keyOf(n))?.status === "running"));
  }, [store.tasks, subtasks]);

  if (!subtasks?.length) return null;
  const href = (n: number) => `/tasks/${encodeURIComponent(keyOf(n))}`;
  const mapDrawn = !phone && !!buildSubtaskMap(subtasks);
  const c = T.subtasks;

  return (
    <div className="nb-section bg-nb-sheet p-3.5">
      <div className="nb-tag mb-2 w-full">
        {c.heading}
        {tip && <span className="min-w-0 truncate text-[11.5px] font-[600] normal-case tracking-normal text-nb-ink-soft">{tip}</span>}
      </div>
      {mapDrawn && (
        <>
          <SubtaskMap subtasks={subtasks} running={running} href={href} onHover={setTip} />
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="group flex w-full cursor-pointer items-center gap-2.5 py-1.5 text-[12px] font-[700] text-nb-ink-soft transition-colors hover:text-nb-ink"
          >
            <span className={HAIR} aria-hidden />
            <span className="flex items-center gap-1">
              <FiChevronRight size={13} aria-hidden className={`shrink-0 transition-transform duration-150 ease-out ${open ? "rotate-90" : ""}`} />
              {c.list(subtasks.length)}
            </span>
            <span className={HAIR} aria-hidden />
          </button>
        </>
      )}
      {(!mapDrawn || open) && (
        <ul className={`mt-1.5 flex flex-col ${phone ? "gap-0.5" : "gap-1.5"} ${mapDrawn ? "a4k-reveal" : ""}`}>
          {subtasks.map((s) => {
            const number = (
              <span className="shrink-0 text-[12px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
                #{s.id}
              </span>
            );
            const live = running.has(s.id) && (
              <>
                <span className={PULSE_DOT} aria-hidden />
                <span className="sr-only">{c.running}</span>
              </>
            );
            const progress = s.todos.total > 0 && <TodoProgress done={s.todos.done} total={s.todos.total} width={36} />;
            const arrow = <FiChevronRight className="shrink-0 text-[14px] text-nb-ink-soft" aria-hidden />;
            const row = "nb-press flex items-center rounded-[10px] border-[1.5px] border-transparent px-2.5 text-nb-ink no-underline hover:border-nb-ink hover:bg-nb-paper";
            return (
              <li key={s.id}>
                {phone ? (
                  <Link href={href(s.id)} className={`${row} min-h-[56px] gap-3 py-2.5`}>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-[14px] font-[700] leading-snug">{s.title}</span>
                      <span className="flex items-center gap-2.5">
                        {number}
                        {live}
                        {progress}
                      </span>
                    </span>
                    {arrow}
                  </Link>
                ) : (
                  <Link href={href(s.id)} className={`${row} gap-2.5 py-2`}>
                    {number}
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-[700] leading-snug">{s.title}</span>
                    {live}
                    {progress}
                    {arrow}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
