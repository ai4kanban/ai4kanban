"use client";

// The corner office that cheers a milestone (#1331): a finished release, a closed group, or
// the day's first finished task. One at a time, each once per browser, and gone on its own.
//
// Nothing here asks for attention — no bell, no unread, no focus. The art and its stylesheet
// load only when there is something to cheer for.

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useCopy } from "@/i18n/use-copy";
import { useActions } from "@/lib/screen";
import type { Cheer, SessionView } from "@/lib/types";
import { sessionsPanel, useOnTabFocus } from "./sessions";

const SEEN = "kanban-ui.cheered:";
const KEPT = 40;
const IDLE_MS = 6000;
const FADE_MS = 400;
// A landing's record is written a beat after its delivery ends, so each ending is read twice.
const SETTLE_MS = 2000;
const WIDE = "(min-width: 768px)";

function readSeen(key: string): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) ? saved.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(key: string, keys: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(keys.slice(-KEPT)));
  } catch {
    // storage unavailable — it may cheer again after a reload
  }
}

const preload = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(src));
    image.src = src;
  });

type Scene = ComponentType<{ now: Date }>;

export function BoardCheer({ boardId, sessions }: { boardId: string; sessions: SessionView[] }) {
  const actions = useActions();
  const read = actions?.readCheers;
  const [shown, setShown] = useState<{ cheer: Cheer; Scene: Scene; now: Date } | null>(null);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (!read || busy.current || !window.matchMedia(WIDE).matches) return;
    busy.current = true;
    try {
      const seen = readSeen(SEEN + boardId);
      // Biggest first, as the board hands them over.
      const fresh = (await read()).filter((c) => !seen.includes(c.key));
      if (!fresh.length) return;
      writeSeen(SEEN + boardId, [...seen, ...fresh.map((c) => c.key)]);
      const now = new Date();
      const scene = await import("./cheer/OfficeScene");
      await Promise.all(scene.cheerArt(now).map(preload));
      setShown({ cheer: fresh[0], Scene: scene.OfficeScene, now });
    } catch {
      // art that will not load is a cheer skipped, never an error on the board
    } finally {
      busy.current = false;
    }
  }, [read, boardId]);

  useEffect(() => void check(), [check]);
  useOnTabFocus(check);

  // A run or a delivery that was going and no longer is.
  const going = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set<string>();
    for (const s of sessions) {
      if (s.status === "running") now.add(s.sessionId);
      if (s.delivery?.status === "active") now.add(s.delivery.id);
    }
    const ended = [...going.current].some((id) => !now.has(id));
    going.current = now;
    if (!ended) return;
    void check();
    const again = setTimeout(check, SETTLE_MS);
    return () => clearTimeout(again);
  }, [sessions, check]);

  const done = useCallback(() => {
    setShown(null);
    void check();
  }, [check]);

  if (!shown) return null;
  return <Corner key={shown.cheer.key} {...shown} onDone={done} />;
}

function Corner({ cheer, Scene, now, onDone }: { cheer: Cheer; Scene: Scene; now: Date; onDone: () => void }) {
  const t = useCopy();
  const c = t.board.cheer;
  const [fading, setFading] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hold = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFading(false);
  }, []);
  const count = useCallback(() => {
    hold();
    timers.current = [
      setTimeout(() => setFading(true), IDLE_MS),
      setTimeout(onDone, IDLE_MS + FADE_MS),
    ];
  }, [hold, onDone]);
  useEffect(() => {
    count();
    return hold;
  }, [count, hold]);

  const named = `#${cheer.id} ${cheer.title ?? ""}`;
  const [reason, detail] =
    cheer.kind === "release"
      ? [c.release(cheer.release ?? ""), c.releaseCount(cheer.count ?? 0)]
      : cheer.kind === "group"
        ? [c.group(cheer.count ?? 0), named]
        : [c.first, named];

  return (
    <button
      type="button"
      aria-label={t.runs.panel.open}
      data-fading={fading || undefined}
      onMouseEnter={hold}
      onMouseLeave={count}
      onFocus={hold}
      onBlur={count}
      onClick={(e) => {
        hold();
        growRunsFrom(e.currentTarget.getBoundingClientRect());
        onDone();
      }}
      className="cheer-corner nb-panel-sm absolute bottom-4 right-4 z-30 flex w-[280px] cursor-pointer flex-col overflow-hidden p-0 text-left max-md:hidden"
    >
      <Scene now={now} />
      <span className="flex h-[30px] items-center gap-1.5 px-2.5 text-[11.5px] leading-none">
        <span className="shrink-0 font-[700]">{reason}</span>
        <span className="min-w-0 truncate text-nb-ink-soft">{detail}</span>
      </span>
    </button>
  );
}

/** Open the Runs office, grown out of the corner the press came from. */
function growRunsFrom(from: DOMRect) {
  sessionsPanel.open();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let tries = 10;
  const grow = () => {
    const office = document.querySelector<HTMLElement>("[data-runs-office]");
    if (!office) {
      if (tries-- > 0) requestAnimationFrame(grow);
      return;
    }
    const to = office.getBoundingClientRect();
    office.animate(
      [
        {
          transformOrigin: "0 0",
          transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
        },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  };
  requestAnimationFrame(grow);
}
