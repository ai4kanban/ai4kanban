"use client";

// ---- what the marketing editor says about its runs (#479) -------------------
//
// Every run over this card locks the same editor, so a lock on its own says nothing: a
// repurpose, a rewrite, a polish and the chat rail answering all looked alike. Two
// things are said here instead — which KIND of writing is happening and which DRAFT it is
// writing, and, when one ended without finishing, the same two facts plus a way to pick it
// back up.
//
// A stopped run is read off the record rather than watched for, so a failure from before
// this page was opened is still said. Nothing on the board records a dismissal: it is for
// this visit, and a failure that still stands is said again next time.

import { useState } from "react";
import { FiAlertCircle, FiRepeat, FiX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import type { MarketingCopy } from "@/i18n/card/types";
import { useActions } from "@/lib/screen";
import type { SessionView } from "@/lib/types";
import { stoppedShort } from "./agent-shared";
import { ChannelMark, channelLabel } from "./channels";
import { PULSE_DOT } from "./chrome";

/** The draft every channel is repurposed from. The board's own file name, not copy. */
export const SOURCE = "source";

/** Which draft a run writes, when it writes one. A repurpose names its channel and a polish
 *  names the draft it works over. Archive and Reject write no draft at all. */
export function draftOf(run: SessionView): string | undefined {
  if (run.action === "polish") return run.draft;
  if (run.action === "channel") return run.channel;
  return undefined;
}

/** What one draft is called on this page. */
export const draftLabel = (name: string): string => (name === SOURCE ? SOURCE : channelLabel(name));

/**
 * What the page says a live run is doing. `rewriting` answers whether that channel already
 * had a draft when the run started — a repurpose and a rewrite are the same command, and
 * only the draft under it tells them apart.
 *
 * Archive and Reject lock the same editor and write no draft, so they name no draft either.
 */
export function runWords(run: SessionView, rewriting: boolean, c: MarketingCopy["run"]): string {
  const draft = draftOf(run);
  if (run.action === "polish") return c.polish(draftLabel(draft ?? SOURCE));
  if (run.action === "channel") {
    const label = draft ? channelLabel(draft) : "";
    return rewriting ? c.rewrite(label) : c.fromSource(label);
  }
  return c.other;
}

/** The pill beside the title: one live run in words. The chat rail's own answer claims no
 *  draft, so it sends the reader back to the rail instead of naming one. */
export function RunPill({ words, onClick, title }: { words: string; onClick?: () => void; title?: string }) {
  const skin =
    "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-[700]";
  const paint = { background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" } as const;
  const body = (
    <>
      <span className={PULSE_DOT} aria-hidden />
      {words}
    </>
  );
  if (!onClick) {
    return (
      <span className={skin} style={paint}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" title={title} onClick={onClick} className={`${skin} cursor-pointer`} style={paint}>
      {body}
    </button>
  );
}

// ---- a run that stopped short -----------------------------------------------

/** One draft whose newest run ended without finishing. */
export interface StoppedRow {
  draft: string;
  why: string;
  /** The run itself, which is what a dismissal is remembered by: a draft that stops again
   *  under a NEW run is news again. */
  runId: string;
  /** Whether that run can still be picked up. Where it cannot — it aged out of the kept
   *  window, or the agent changed — the row says what stopped and offers nothing. */
  canResume: boolean;
}

/** Why a run stopped, in one line: whatever it said for itself, else the state it ended in. */
function whyStopped(run: SessionView, c: { interrupted: string; exited: (code: string) => string }): string {
  const said = (run.error || run.note || "").trim().split("\n")[0]!.trim();
  if (said) return said;
  return run.status === "interrupted" ? c.interrupted : c.exited(String(run.code ?? "?"));
}

/**
 * A row per draft whose NEWEST run ended `error` or `interrupted`. A run the user stopped is
 * not an alarm and draws nothing, and a draft written again since has nothing to report —
 * both fall out of taking the newest run per draft and asking only about that one.
 *
 * `drafts` is the tabs the card still has, so closing a channel takes its stopped run off
 * the page with it: a resume there would write a file for a channel nobody chose.
 */
export function stoppedRows(
  sessions: SessionView[],
  cardId: number,
  drafts: string[],
  dismissed: ReadonlySet<string>,
  c: { interrupted: string; exited: (code: string) => string },
): StoppedRow[] {
  const newest = new Map<string, SessionView>();
  for (const run of sessions) {
    if (run.cardId !== cardId) continue;
    const draft = draftOf(run);
    if (!draft || !drafts.includes(draft)) continue;
    const held = newest.get(draft);
    if (!held || run.startedAt > held.startedAt) newest.set(draft, run);
  }
  return drafts.flatMap((draft) => {
    const run = newest.get(draft);
    if (!run || !stoppedShort(run) || dismissed.has(run.sessionId)) return [];
    return [{ draft, why: whyStopped(run, c), runId: run.sessionId, canResume: !!run.canResume }];
  });
}

/**
 * The drafts that were not written, above the editor rather than in a log — this page draws
 * no run log, and the run's whole output is still read in the chat rail.
 *
 * One stopped draft is one line. Several are one line each under a count, because a
 * repurpose is several runs at once and each of them failed its own way.
 */
export function StoppedRuns({
  rows,
  onDismiss,
  onResumed,
}: {
  rows: StoppedRow[];
  /** Take these off the page for this visit — one row, or all of them. */
  onDismiss: (runIds: string[]) => void;
  onResumed: (runId: string) => void;
}) {
  const c = useCopy().card.marketing.stopped;
  if (!rows.length) return null;
  const all = rows.map((row) => row.runId);
  if (rows.length === 1) {
    const row = rows[0]!;
    return (
      <div className={BAND}>
        <FiAlertCircle className="shrink-0 text-[15px]" aria-hidden />
        <span className="min-w-0 flex-1 text-[12.5px] leading-[1.5]">
          <span className="font-[700]">{c.what(draftLabel(row.draft))}</span>
          <span className="opacity-50"> · </span>
          {row.why}
        </span>
        {row.canResume && <RunAgain sessionId={row.runId} onResumed={onResumed} />}
        <Dismiss onClick={() => onDismiss(all)} />
      </div>
    );
  }
  return (
    <div className={`${BAND} flex-col items-stretch`}>
      <div className="flex items-center gap-2.5">
        <FiAlertCircle className="shrink-0 text-[15px]" aria-hidden />
        <span className="min-w-0 flex-1 text-[12.5px] font-[700]">{c.many(rows.length)}</span>
        <Dismiss onClick={() => onDismiss(all)} />
      </div>
      <div className="mt-1.5 flex flex-col gap-[3px] pl-[25px]">
        {rows.map((row) => (
          <span key={row.draft} className="flex min-h-[22px] items-center gap-2 text-[12px]">
            {row.draft !== SOURCE && <ChannelMark name={row.draft} status="" size={12} dim={false} />}
            <span className="w-[64px] shrink-0 font-[700]">{draftLabel(row.draft)}</span>
            <span className="min-w-0 flex-1 truncate opacity-80">{row.why}</span>
            {row.canResume && <RunAgain sessionId={row.runId} onResumed={onResumed} />}
          </span>
        ))}
      </div>
    </div>
  );
}

const BAND =
  "flex shrink-0 items-center gap-2.5 border-b border-b-[color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)] bg-nb-peach-soft px-4 py-2.5 text-nb-peach-ink";

function Dismiss({ onClick }: { onClick: () => void }) {
  const c = useCopy().card.marketing.stopped;
  return (
    <button
      type="button"
      title={c.dismiss}
      aria-label={c.dismiss}
      onClick={onClick}
      className="grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-[6px] hover:bg-[color-mix(in_srgb,var(--color-nb-peach-ink)_12%,transparent)]"
    >
      <FiX className="text-[13px]" aria-hidden />
    </button>
  );
}

/** Pick the run back up: one more turn into the conversation that died, exactly as Resume
 *  does on a product card. A fresh run would silently drop the note and the language this
 *  repurpose was asked with, which are kept nowhere. */
function RunAgain({ sessionId, onResumed }: { sessionId: string; onResumed: (runId: string) => void }) {
  const t = useCopy();
  const c = t.card.marketing.stopped;
  const actions = useActions();
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  if (!actions) return null;
  const again = async () => {
    if (busy) return;
    setBusy(true);
    setWhy(null);
    const res = await actions.resumeSession(sessionId);
    setBusy(false);
    if (res.ok) onResumed(sessionId);
    else setWhy(res.error || t.runs.resume.failed);
  };
  return (
    <span className="flex shrink-0 items-center gap-2">
      {why && <span className="text-[11px]">{why}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void again()}
        className="flex h-[22px] cursor-pointer items-center gap-1 rounded-[6px] border-[1.2px] border-current bg-nb-paper px-2 text-[11.5px] font-[700] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiRepeat className="text-[11px]" aria-hidden />
        {busy ? t.runs.resume.resuming : c.again}
      </button>
    </span>
  );
}
