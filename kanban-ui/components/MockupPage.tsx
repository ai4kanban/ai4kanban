"use client";

// One mockup, on its own, at full size (#239). The card page is where mockups are compared
// with each other, scaled down side by side; this is where one of them is read.
//
// It is drawn in the same window as everything else — header, rail, the card it belongs to
// highlighted in it — so it is a view of that card rather than a screen you fall into. The
// way back is a row in the rail and the link above the mockup, and both are ordinary
// navigation: `router.back()` was neither, since a pasted address has nothing behind it.
//
// The mockup keeps the empty sandbox the card page's frame has — nothing runs, nothing
// loads, nothing in the picture is clickable. It is not scaled here, so a panel narrower
// than the desktop screen it was drawn on scrolls.
//
// A `.txt` mockup opens here too (#256), in the same monospaced block the card page shows
// it in and at the size a drawing is read at. It never re-wraps either.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useCopy } from "@/i18n/use-copy";
import type { MockupView } from "@/lib/mockup-tag";
import type { AgentInfo, MemoryModule } from "@/lib/types";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";
import { Window } from "./Window";

/** The desktop screen every mockup is drawn on. Shown here at that size, not scaled. */
const W = 1280;
const H = 800;

/** The card a mockup belongs to — `.mockups/<card id>/` is where it is filed. */
export type MockupCard = { id: number; title: string };

export function MockupPage({
  view,
  card,
  openIds,
  agent,
  projectRoot,
  goalWritten,
  memoryModules,
  desktop,
}: {
  view: MockupView;
  /** The card that pointed at this file, when it is still on the board. */
  card: MockupCard | null;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
}) {
  const c = useCopy().card.mockup;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(!!view.error);
  const refresh = useCallback(() => router.refresh(), [router]);

  // The same two triggers the memory page catches up on: a run finishing, and the window
  // being focused again. A run can rewrite the mockup file while this page sits open.
  const noRunsOfOurOwn = useCallback(() => {}, []);
  const { sessions } = useAgentSessions(noRunsOfOurOwn);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);
  useOnTabFocus(refresh);

  return (
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentId={card?.id ?? null}
        currentTitle={card?.title ?? ""}
        memoryModules={memoryModules}
        goalWritten={goalWritten}
        running={runningCardIds(sessions)}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            onError={setError}
            goalWritten={goalWritten}
            desktop={desktop}
          />
        }
      >
        <div className="flex h-full flex-col overflow-hidden">
          <RunningNotice desktop={desktop} />

          {error && (
            <div
              className="nb-panel-sm mx-6 mt-4 p-3 text-[13px]"
              style={{ background: "var(--color-nb-peach-soft)" }}
            >
              {error}
            </div>
          )}

          {/* The way back, first thing on the page and named — a mockup is read on the way
              through a card, and the card is where you were going. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-4">
            {card && (
              <Link
                href={`/${card.id}`}
                className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-[700] text-nb-ink-soft hover:text-nb-accent-deep"
              >
                <FiArrowLeft aria-hidden className="shrink-0 text-[14px]" />
                <span className="shrink-0">{c.back(card.id)}</span>
                <span className="truncate font-[500]">{card.title}</span>
              </Link>
            )}
            <span className="min-w-0 truncate font-mono text-[12px] text-nb-ink-soft">
              {view.src}
            </span>
            {view.code && (
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                disabled={!!view.error}
                className="ml-auto shrink-0 cursor-pointer text-[11px] font-[800] uppercase tracking-[0.06em] text-nb-ink-soft hover:text-nb-accent-deep disabled:cursor-default disabled:opacity-40"
              >
                {showCode ? c.screen : c.code}
              </button>
            )}
          </div>

          {view.error && (
            <p
              className="nb-outline mx-6 mb-3 px-3 py-2.5 font-mono text-[12.5px] leading-[18px] text-nb-ink-soft"
              style={{ background: "var(--color-nb-peach-soft)" }}
            >
              {view.error}
            </p>
          )}

          {/* Full size, so the panel is what scrolls — both ways, since the screen is wider
              than the body on most windows. */}
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
            {view.text !== undefined ? (
              <pre className="w-max whitespace-pre bg-nb-wash p-4 font-mono text-[13px] leading-[19px]">
                {view.text}
              </pre>
            ) : showCode ? (
              <pre className="w-max whitespace-pre bg-nb-wash p-3 font-mono text-[12px] leading-[18px]">
                {view.code}
              </pre>
            ) : (
              view.doc && (
                <iframe
                  sandbox=""
                  srcDoc={view.doc}
                  title={view.src}
                  style={{ width: W, height: H, border: 0, display: "block" }}
                />
              )
            )}
          </div>
        </div>
      </Window>
    </OpenIdsProvider>
  );
}
