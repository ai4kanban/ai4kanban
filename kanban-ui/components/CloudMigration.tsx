"use client";

// The page that takes the board over while its storage moves (#614).
//
// Turning Cloud storage on or off is a MIGRATION, not a setting: the whole board is read
// out of one place and written into the other, and a card written halfway through would be
// written into the side that is being left. So the board stops for it — this page covers
// the window, nothing under it can be pressed, and the board comes back when the move ends.
//
// It is mounted once, beside the Configuration dialog, and driven from a tiny shared store
// the Cloud pane calls into. That is what lets the dialog close the moment the move starts:
// the work is here, not in a pane that would unmount under it.
//
// Four states, in the order they happen:
//
//   • **waiting** — runs are still going. They are listed and the move starts when the last
//     one ends. Backing out here costs nothing, because nothing has been asked of Cloud.
//   • **moving** — the one call is in flight. Going runs through the app bridge (the sign-in
//     lives on the machine, not in the repository); coming back runs through the board
//     server, which is what already holds the workspace.
//   • **done** — what happened, and the one commit the move left in the repository. The
//     board comes back on the press after, so that commit is read rather than stepped over.
//   • **failed** — the service's own sentence, and the board exactly where it was. Going
//     writes the pointer last and coming back reads the whole workspace before it touches
//     the local copy, so a failure on either side leaves nothing half-moved.
//
// The progress is the STAGE, never the transfer's own lines: "cards: 40" is the board
// talking to itself, and a person watching their board move wants to know it is moving.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FiAlertCircle, FiCheck } from "react-icons/fi";
import { cloudStorageAction, leaveWorkspaceAction, listSessionsAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { flowLabel, runFlows } from "@/lib/run-flows";
import type { CloudChange, SessionView } from "@/lib/types";
import { ACCENT_BTN, Alert, QUIET_BTN } from "./settings";
import { Offer } from "./Workspace";

/** Which way the board is moving. The same two words the offered commit is keyed by. */
export type MoveDirection = "go" | "leave";

/** What the Cloud pane asks for. `name` is the new workspace's, going; it is unread coming
 *  back, where the workspace is the one the checkout already points at. */
export interface MoveRequest {
  direction: MoveDirection;
  name: string;
}

/** The app, when this board is in it. Going Cloud is the app's own move: it makes the
 *  workspace and points the checkout at it with the sign-in this MACHINE holds, which no
 *  board server has. */
interface AppBridge {
  cloudGo(request: { dir: string; name?: string; importCards?: boolean }): Promise<
    | { ok: true; workspace: { id: string; name: string }; imported: number; change: CloudChange }
    | { ok: false; error: string }
  >;
}

function bridge(): AppBridge | null {
  if (typeof window === "undefined") return null;
  const app = (window as { ai4kanban?: Partial<AppBridge> }).ai4kanban;
  return app?.cloudGo ? (app as AppBridge) : null;
}

/** Whether this window can move the board at all — the same line the switch is drawn by. */
export const canMoveStorage = (): boolean => !!bridge();

// --- the move, as a store -----------------------------------------------------
// The same shared-store shape the Configuration dialog is opened by: a sibling that is not
// in this tree hands over one request, and this page picks it up. It holds the LIVE move, so
// the dialog can ask whether one is on and get out of the way.

let live: { at: number; request: MoveRequest } | null = null;
let started = 0;
const subs = new Set<() => void>();
const tell = () => {
  for (const fn of subs) fn();
};

export const cloudMigration = {
  /** Start the move. The caller has taken the confirmation already. */
  start(request: MoveRequest) {
    live = { at: ++started, request };
    tell();
  },
  /** Give the board back without moving it — the wait was called off, or the move failed. */
  end() {
    live = null;
    tell();
  },
};

function useLive() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => live,
    () => live,
  );
}

/** Whether the board is moving right now. The Configuration dialog closes on it. */
export const useMigrating = (): boolean => !!useLive();

type Stage =
  | { at: "waiting"; running: SessionView[] }
  | { at: "moving" }
  | { at: "done"; workspace: string; cards: number; change: CloudChange | null }
  | { at: "failed"; error: string };

/** How often the wait re-reads the runs. The board's own panel polls faster while something
 *  is live; this one is only waiting for the list to empty. */
const WAIT_POLL_MS = 2000;

export function CloudMigration() {
  const move = useLive();
  // Keyed on the move, so each one gets a page of its own and its effects run exactly once.
  return move ? <Cover key={move.at} move={move.request} /> : null;
}

/** The cover itself, mounted only while a move is on. */
function Cover({ move }: { move: MoveRequest }) {
  const c = useCopy().configuration.cloud.storage;
  const [stage, setStage] = useState<Stage>({ at: "waiting", running: [] });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Held in a ref so the effect below is installed once: it owns the whole move, and
  // restarting it would run a second one over the first.
  const stageRef = useRef(setStage);
  stageRef.current = setStage;

  const run = useCallback(async () => {
    const storage = await cloudStorageAction();
    if (move.direction === "go") {
      const app = bridge();
      if (!app) return stageRef.current({ at: "failed", error: c.needsApp });
      const done = await app.cloudGo({ dir: storage.root, name: move.name, importCards: true });
      if (!done.ok) return stageRef.current({ at: "failed", error: done.error });
      stageRef.current({
        at: "done",
        workspace: done.workspace.name || move.name,
        cards: done.imported,
        change: pending(done.change),
      });
      return;
    }
    // Coming back reads the workspace whole before it clears the local copy, so a read that
    // fails leaves docs/kanban/ exactly as it was.
    const done = await leaveWorkspaceAction();
    if (!done.ok) return stageRef.current({ at: "failed", error: done.error });
    stageRef.current({ at: "done", workspace: storage.workspace, cards: done.cards, change: done.change });
  }, [c.needsApp, move]);

  // Wait for the runs, then move. One effect, because they are one job: a run that starts
  // between the last poll and the call would be writing into the board being read.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (!alive) return;
      let running: SessionView[] = [];
      try {
        running = (await listSessionsAction()).filter((s) => s.status === "running");
      } catch {
        // The board could not be asked. Waiting on an answer we cannot get would hang the
        // move for good, so it goes ahead: the board is about to be read either way.
        running = [];
      }
      if (!alive) return;
      if (running.length > 0) {
        stageRef.current({ at: "waiting", running });
        timer = setTimeout(tick, WAIT_POLL_MS);
        return;
      }
      stageRef.current({ at: "moving" });
      try {
        await run();
      } catch (e) {
        if (alive) {
          stageRef.current({ at: "failed", error: e instanceof Error ? e.message : String(e) });
        }
      }
    };

    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [run]);

  if (!mounted) return null;

  return createPortal(
    // Opaque, not a scrim: the board is not usable while it moves, and a dimmed board is
    // still a board you would try to click.
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-nb-canvas p-6"
      role="dialog"
      aria-modal
    >
      <div className="w-full max-w-[560px] rounded-[16px] border-[1.5px] border-nb-ink bg-nb-paper p-6 shadow-[3px_3px_0_0_var(--color-nb-ink)]">
        {stage.at === "waiting" ? (
          <Waiting running={stage.running} onStop={cloudMigration.end} />
        ) : stage.at === "moving" ? (
          <Moving direction={move.direction} />
        ) : stage.at === "done" ? (
          <Done direction={move.direction} stage={stage} />
        ) : (
          <Failed direction={move.direction} error={stage.error} onDismiss={cloudMigration.end} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The offer is only made while there is something to commit — the same test the Workspace
 *  pane applies to the change it finds waiting. */
const pending = (change: CloudChange | null): CloudChange | null =>
  change && change.git && !change.clean ? change : null;

function Head({ icon, title, blurb }: { icon: React.ReactNode; title: string; blurb: string }) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-[15px] font-[800] text-nb-ink">{title}</h2>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-nb-ink-soft">{blurb}</p>
    </>
  );
}

/** A pulse rather than a bar: the transfer reports its passes, not a fraction, and a bar
 *  drawn from a guess is a bar that lies. */
function Pulse() {
  return (
    <span
      className="size-2 shrink-0 rounded-full bg-nb-accent animate-[nbPulse_1.1s_ease-in-out_infinite]"
      aria-hidden
    />
  );
}

function Waiting({ running, onStop }: { running: SessionView[]; onStop: () => void }) {
  const c = useCopy().configuration.cloud.storage;
  const t = useCopy();
  return (
    <>
      <Head icon={<Pulse />} title={c.waitTitle} blurb={c.waitBlurb} />
      {/* One line per JOB, the way the runs panel lists them: a refine that is on its
          writing pass is one thing still going, not two. */}
      <ul className="mt-4 rounded-[10px] bg-nb-sheet px-3.5 py-2">
        {runFlows(running).map((flow) => (
          <li
            key={flow.id}
            className="border-b border-nb-ink/10 py-2 text-[12px] font-[700] text-nb-ink last:border-b-0"
          >
            {c.waitRun(
              flowLabel(flow, t.runs),
              flow.cardId === null ? t.shared.none : `#${flow.cardId}`,
            )}
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <button type="button" className={QUIET_BTN} onClick={onStop}>
          {c.stop}
        </button>
      </div>
    </>
  );
}

function Moving({ direction }: { direction: MoveDirection }) {
  const c = useCopy().configuration.cloud.storage;
  return (
    <Head
      icon={<Pulse />}
      title={direction === "go" ? c.movingOn : c.movingOff}
      blurb={c.movingBlurb}
    />
  );
}

/**
 * The move landed.
 *
 * The board is back on the press below, not on a timer: the repository now holds one commit
 * nobody has read, and reopening over it would take the only place it is offered away.
 */
function Done({ direction, stage }: { direction: MoveDirection; stage: Extract<Stage, { at: "done" }> }) {
  const c = useCopy().configuration.cloud.storage;
  const w = useCopy().configuration.workspace;
  const [error, setError] = useState("");
  return (
    <>
      <div className="flex items-center gap-2.5">
        <FiCheck className="shrink-0 text-nb-mint-ink" size={17} aria-hidden />
        <h2 className="text-[15px] font-[800] text-nb-ink">
          {direction === "go" ? c.doneOn(stage.workspace) : w.left(stage.cards)}
        </h2>
      </div>
      {stage.change && (
        <div className="mt-4">
          <Offer change={stage.change} kind={direction} onError={setError} />
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      <div className="mt-5">
        <button type="button" className={ACCENT_BTN} onClick={() => window.location.reload()}>
          {c.back}
        </button>
      </div>
    </>
  );
}

function Failed({
  direction,
  error,
  onDismiss,
}: {
  direction: MoveDirection;
  error: string;
  onDismiss: () => void;
}) {
  const c = useCopy().configuration.cloud.storage;
  return (
    <>
      <div className="flex items-center gap-2.5">
        <FiAlertCircle className="shrink-0 text-nb-peach-ink" size={17} aria-hidden />
        <h2 className="text-[15px] font-[800] text-nb-ink">
          {direction === "go" ? c.failedOn : c.failedOff}
        </h2>
      </div>
      <Alert>{error}</Alert>
      <p className="mt-2.5 text-[12px] leading-relaxed text-nb-ink-soft">{c.failedBlurb}</p>
      <div className="mt-5">
        <button type="button" className={QUIET_BTN} onClick={onDismiss}>
          {c.back}
        </button>
      </div>
    </>
  );
}
