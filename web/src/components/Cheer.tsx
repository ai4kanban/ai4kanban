// Copied from legacy kanban-ui/components/Cheer.tsx: the corner office that cheers the day's
// first finished task, once per browser, gone on its own. Pressing it opens that task.

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { Task } from "../api";
import { T } from "../i18n";
import { numberOf } from "../lib/card";
import { navigate } from "../router";

const SEEN = "wildcrane.web.cheered";
const IDLE_MS = 6000;
const FADE_MS = 400;
const WIDE = "(min-width: 768px)";

const preload = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });

type Scene = ComponentType<{ now: Date }>;

export function BoardCheer({ tasks }: { tasks: Task[] }) {
  const [shown, setShown] = useState<{ task: Task; Scene: Scene; now: Date } | null>(null);
  const busy = useRef(false);
  const today = new Date().toDateString();
  const first = tasks.filter((t) => t.status === "done" && new Date(t.updated_at).toDateString() === today).sort((a, b) => a.updated_at.localeCompare(b.updated_at))[0];

  const check = useCallback(async () => {
    if (!first || busy.current || !window.matchMedia(WIDE).matches) return;
    if (localStorage.getItem(SEEN) === today) return;
    busy.current = true;
    try {
      localStorage.setItem(SEEN, today);
      const now = new Date();
      const scene = await import("./cheer/OfficeScene");
      await Promise.all(scene.cheerArt(now).map(preload));
      setShown({ task: first, Scene: scene.OfficeScene, now });
    } catch {
      // art that will not load is a cheer skipped
    } finally {
      busy.current = false;
    }
  }, [first?.id, today]);

  useEffect(() => void check(), [check]);
  if (!shown) return null;
  return <Corner {...shown} onDone={() => setShown(null)} />;
}

function Corner({ task, Scene, now, onDone }: { task: Task; Scene: Scene; now: Date; onDone: () => void }) {
  const [fading, setFading] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hold = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFading(false);
  }, []);
  const count = useCallback(() => {
    hold();
    timers.current = [setTimeout(() => setFading(true), IDLE_MS), setTimeout(onDone, IDLE_MS + FADE_MS)];
  }, [hold, onDone]);
  useEffect(() => {
    count();
    return hold;
  }, [count, hold]);
  return (
    <button
      type="button"
      data-fading={fading || undefined}
      onMouseEnter={hold}
      onMouseLeave={count}
      onFocus={hold}
      onBlur={count}
      onClick={() => {
        hold();
        onDone();
        navigate(`/tasks/${encodeURIComponent(task.key)}`);
      }}
      className="cheer-corner nb-panel-sm absolute bottom-4 right-4 z-30 flex w-[280px] cursor-pointer flex-col overflow-hidden p-0 text-left max-md:hidden"
    >
      <Scene now={now} />
      <span className="flex h-[30px] items-center gap-1.5 px-2.5 text-[11.5px] leading-none">
        <span className="shrink-0 font-[700]">{T.cheer.first}</span>
        <span className="min-w-0 truncate text-nb-ink-soft">
          {numberOf(task.key)} {task.title}
        </span>
      </span>
    </button>
  );
}
