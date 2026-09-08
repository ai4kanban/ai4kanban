"use client";

// ---- a marketing card's own page (#434) -------------------------------------
//
// A marketing card IS its draft, so the page is the editor: a title row, a tab strip over
// `source` and each chosen channel, an OverType instance filling everything under them, and
// — once there is one — the comments left on that draft along the foot (#458). Nothing else
// — no Implement / Edit / Resolve, no questions panel, no Priority / ROI / Release, no run
// log. Whatever is left to say to the agent is said in the chat rail the window already
// draws, which is why this page draws no box of its own.
//
// A comment is SAVED on its passage, not sent: a read-through that finds six things is one
// polish over the file rather than six rewrites of it, each unaware of the other five. The
// comments live beside the board (`docs/kanban/.comments/<id>.json`) and never inside the
// draft, and the board clears the batch when the polish it went to ends.
//
// It is a page of its own rather than a branch of `CardPage`, so the two boards' pages are
// free to be different shapes; the cost is that the top row, the rail wiring and the run
// watching are now written twice.
//
// The editor edits the FILE — `content/<id>/<tab>.md`, byte for byte, which is what
// lets an agent and a person write the same draft. Saving is on idle with no button, and
// what is unsaved is written back to its own tab's file before the strip moves or the page
// goes.
//
// The strip is `channels:` and nothing else (#478): "Repurpose to…" adds a channel, writes
// its first draft and lands on its tab in one press, and a tab's cross takes that channel
// back off. No hidden-tab state either way — a closed channel leaves its draft file behind,
// so reopening it is indistinguishable from choosing it for the first time. A channel page
// is therefore always the result of a repurpose, and never offers to draft itself (#479).
//
// EVERY state the page can be in reports itself where the work is (#479): which run is
// writing which draft, which run stopped and how to pick it up (`marketing-runs.tsx`),
// whether what is typed reached the file (`marketing-save.tsx`), and why a move that had to
// save first did not happen. Nothing about this page is read in a log.
//
// Two halves, because the rail is drawn by the window this page is put INSIDE: the outer
// half is everything the frame needs (the runs, the error line, the two dialogs that take
// the card off the board), and the inner half is the page itself, which reads that rail.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArchive,
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiGlobe,
  FiMoreHorizontal,
  FiRepeat,
  FiTrash2,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import type { OverTypeInstance } from "overtype";
import { useCopy } from "@/i18n/use-copy";
import { takeNewTopic } from "@/lib/new-topic";
import { useActions, type DraftPassage, type RepurposeAsk } from "@/lib/screen";
import { UNTITLED } from "@/lib/types";
import type { Card, CardDrafts, CardScreen, DraftComment, SessionView } from "@/lib/types";
import {
  ActionDialog,
  DialogButtons,
  SessionLog,
  type AgentReq,
  type DialogState,
} from "./agent-shared";
import { useBoardHref } from "./board-links";
import { Button } from "./button";
import type { CardChrome, CardShell, CardStrips } from "./CardPage";
import { CHANNEL_NAMES, ChannelDot, ChannelMark, channelLabel, REPURPOSE_LANGUAGES } from "./channels";
import { useChatRailHere } from "./Chat";
import { HAIRLINE, PULSE_DOT } from "./chrome";
import { Dialog } from "./Dialog";
import { DraftComments, LeaveComment, useCommentMarks } from "./DraftComments";
import { OpenIdsProvider } from "./open-ids";
import { SolutionProvider } from "./solution";
import {
  draftLabel,
  draftOf,
  RunPill,
  runWords,
  SOURCE,
  StoppedRuns,
  stoppedRows,
} from "./marketing-runs";
import { SaveMark, SaveRefused, type SaveState } from "./marketing-save";
import {
  latestSessionForCard,
  runningCardIds,
  useAgentSessions,
  useOnTabFocus,
  useSessionLog,
  type StartedSession,
} from "./sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const NOTHING: CardDrafts = { dir: "", drafts: [] };

/** How long typing has to stop before the draft is written back. Long enough that a pause
 *  mid-sentence is not a save, short enough that walking away leaves the file written. */
const SAVE_AFTER_MS = 800;

/** How long "Saved" stands before it goes. It is a receipt, not a state to live with — the
 *  two states that DO wait for an answer stay until they get one. */
const SAVED_FOR_MS = 2000;

/** How wide `SaveRefused` is, so the strip can keep one from hanging off its right end. */
const POP_W = 320;

/** The rule under the title row — the quietest line the app parts panes with. */
const PART = { borderBottom: `1px solid ${HAIRLINE}` } as const;

/** What the editor is, for the tab that names it. */
const PANEL_ID = "marketing-draft";
const tabId = (name: string) => `marketing-tab-${name}`;

/** No frame at all: the page draws itself and nothing around it. */
const Bare: CardShell = ({ children }) => <>{children}</>;

// ---- the page, and the frame around it -------------------------------------

export function MarketingCardPage({
  screen,
  shell,
  strips,
}: {
  screen: CardScreen;
  shell?: CardShell;
  strips?: CardStrips;
}) {
  const c = useCopy().card.marketing;
  const router = useRouter();
  const boardHref = useBoardHref();
  const { card, openIds } = screen;
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  // Archive and Reject take the card off the board, so those go back to it; every other run
  // re-reads the card where it stands.
  const onFinish = useCallback(
    (session: SessionView, started: StartedSession) => {
      if (started.removes && session.ok) router.push(boardHref);
      else router.refresh();
    },
    [router, boardHref],
  );
  const { sessions, start, kick } = useAgentSessions(onFinish);
  const running = runningCardIds(sessions);
  // This card's runs, whole: which one is writing which draft is what the page says while
  // they run, and which one stopped short is what it says afterwards (#479).
  const runs = sessions.filter((r) => r.cardId === card.id);

  // A run on this card just ended — a Draft or a Rewrite wrote its file, and this is how it
  // reaches the editor with nothing to poll.
  const [runsSettled, setRunsSettled] = useState(0);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) {
      router.refresh();
      setRunsSettled((n) => n + 1);
    }
  }, [sessions, router]);

  const runAgent = useCallback(
    async (req: AgentReq, label: string) => {
      setDialog(null);
      const removes = req.action === "reject" || req.action === "archive";
      const res = await start(req, label, removes);
      setError(res.ok ? null : res.error || c.startFailed);
    },
    [start, c],
  );

  // A chat wrote the board while it was answering (#243) — quite possibly this very card,
  // since the card's own conversation is the one in the rail.
  const onBoardChanged = useCallback(
    ({ cardGone }: { cardGone: boolean }) => {
      if (cardGone) router.push(boardHref);
      else {
        router.refresh();
        kick();
      }
    },
    [router, boardHref, kick],
  );

  // Discarding a topic (#507) is a board write, not a run: nothing has to read the card to
  // take it off, so there is no session to watch and the page leaves the moment it lands.
  const [discarding, setDiscarding] = useState(false);
  const [dropping, setDropping] = useState(false);
  const actions = useActions();
  const discard = useCallback(async () => {
    if (!actions || dropping) return;
    setDropping(true);
    const res = await actions.discardTopic(card.id);
    setDropping(false);
    if (!res.ok) {
      setDiscarding(false);
      setError(res.error || c.discard.failed);
      return;
    }
    router.push(boardHref);
  }, [actions, dropping, card.id, router, boardHref, c]);

  const chrome: CardChrome = { screen, running, onBoardChanged, onError: setError };
  const Shell = shell ?? Bare;
  const Strip = strips;

  return (
    <OpenIdsProvider ids={openIds}>
      {/* What this board's work IS (#411), the way the board screen and the engineering card
          page provide it — the frame around this page draws the top row and the rail, and
          without this they would both read `product` and offer a topic the planning entry
          (#507). */}
      <SolutionProvider value={screen.solution}>
      <Shell {...chrome}>
        {/* One screen, never scrolled as a whole: the editor is what scrolls, so the title
            and the strip stay where they were put. */}
        <div className="flex h-full min-h-0 flex-col bg-nb-paper">
          {Strip && <Strip {...chrome} at="head" />}
          <Draft
            card={card}
            boardHref={boardHref}
            runs={runs}
            reload={runsSettled}
            error={error}
            onError={setError}
            onKick={kick}
            onDraft={() => void runAgent({ action: "implement", id: card.id }, "implement")}
            onDiscard={() => setDiscarding(true)}
            onArchive={() => setDialog({ kind: "archive", card })}
            onReject={() => setDialog({ kind: "reject", card })}
          />
        </div>
      </Shell>
      </SolutionProvider>

      {discarding && (
        <DiscardDialog busy={dropping} onClose={() => setDiscarding(false)} onConfirm={() => void discard()} />
      )}
      {dialog && <ActionDialog dialog={dialog} onClose={() => setDialog(null)} onRun={runAgent} />}
    </OpenIdsProvider>
  );
}

// ---- the page itself -------------------------------------------------------

function Draft({
  card,
  boardHref,
  runs,
  reload,
  error,
  onError,
  onKick,
  onDraft,
  onDiscard,
  onArchive,
  onReject,
}: {
  card: Card;
  boardHref: string;
  /** Every run this card has, newest last. The live ones lock the editor and name the draft
   *  each is writing; the ones that stopped short are said above it. */
  runs: SessionView[];
  /** Bumped whenever a run on this card finishes, which is when the draft is re-read. */
  reload: number;
  error: string | null;
  onError: (why: string | null) => void;
  onKick: () => void;
  onDraft: () => void;
  onDiscard: () => void;
  onArchive: () => void;
  onReject: () => void;
}) {
  const t = useCopy();
  const c = t.card.marketing;
  const actions = useActions();
  const router = useRouter();
  const rail = useChatRailHere();
  const channels = card.channels;

  const [tab, setTab] = useState<string>(SOURCE);
  const [read, setRead] = useState<CardDrafts>(NOTHING);
  const [loaded, setLoaded] = useState(false);
  // What the editor is showing this second, mirrored out of the instance: while it holds
  // words the file has not got yet, it is what says whether this tab is written.
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [moving, setMoving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Which channels the repurpose panel is open for — every chosen one from the source tab,
  // one from a channel's own Rewrite. Null is closed.
  const [asking, setAsking] = useState<string[] | null>(null);
  // This tab's comments (#458). Seeded from the read below and answered by each write, so
  // the list moves with the click and the next read reconciles it.
  const [comments, setComments] = useState<DraftComment[]>([]);

  // The card's own conversation is answering — an agent is writing this draft through the
  // rail. It locks the editor exactly as a run does, and the draft is re-read when it ends.
  const answering = !!rail?.answering;
  const [saidSettled, setSaidSettled] = useState(0);
  const wasAnswering = useRef(false);
  useEffect(() => {
    if (wasAnswering.current && !answering) setSaidSettled((n) => n + 1);
    wasAnswering.current = answering;
  }, [answering]);
  const live = runs.filter((r) => r.status === "running");
  const busy = live.length > 0;
  const locked = busy || answering;
  const polishingDraft = live.find((r) => r.action === "polish")?.draft;

  // ---- the run log ---------------------------------------------------------
  //
  // The same window the engineering card page draws, over the same poll: what the agent is
  // doing this second, and — once it is over — what it did, how long it took and what it
  // cost. The run it tails is the one writing the draft on screen; a repurpose starts one
  // run per channel, so the tab is what says which of them this page is about. With none
  // live it holds the card's newest run, so the last rewrite can be read back.
  const writingRun = live.find((r) => draftOf(r) === tab);
  const logRun = writingRun ?? latestSessionForCard(runs, card.id);
  const log = useSessionLog(logRun?.sessionId ?? null);
  const [showLog, setShowLog] = useState(false);
  // A run STARTING on this draft opens it — the id, not the run, so a poll that finds the
  // same run still going does not reopen a window the user has since folded. Nothing else
  // opens it: the editor is what this page is for.
  const writingId = writingRun?.sessionId;
  useEffect(() => {
    if (writingId) setShowLog(true);
  }, [writingId]);

  // ---- reading the drafts --------------------------------------------------

  const load = useCallback(async () => {
    if (!actions) return;
    setRead(await actions.readDrafts(card.id));
    setLoaded(true);
  }, [actions, card.id]);

  useEffect(() => {
    void load();
  }, [load, reload, saidSettled]);
  useOnTabFocus(() => void load());

  // ---- saving --------------------------------------------------------------
  //
  // What has been typed and not yet written, WITH the tab it belongs to: the timer and the
  // flush both run after the strip may have moved, and a draft must never land in another
  // tab's file.
  const pending = useRef<{ tab: string; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // A save that refused, and the tab whose words are still only in the editor. It is the
  // page's own state rather than the shared error line: another move succeeding does not
  // put the words on disk, so it must not clear the report either (#479).
  const [saveFailed, setSaveFailed] = useState<{ tab: string; why: string } | null>(null);
  // A rewrite landed under words the editor is still holding. Both versions stand until the
  // user says which wins — the page saves nothing by itself while this is open.
  const [conflict, setConflict] = useState<{ tab: string; disk: string } | null>(null);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  // When the last save landed, so the receipt can go on its own.
  const [savedAt, setSavedAt] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const done = setTimeout(() => setSavedAt(0), SAVED_FOR_MS);
    return () => clearTimeout(done);
  }, [savedAt]);
  // What the file said when the editor last took it up — what a re-read is compared against
  // to know whether it CHANGED rather than merely arrived again.
  const base = useRef("");

  /** Write what is pending, if anything. Answers whether the file now holds it. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const held = pending.current;
    const run = actionsRef.current;
    if (!held || !run) return true;
    // A rewrite is waiting to be answered on this draft: saving now would answer it, and
    // the agent's version would be gone.
    if (conflictRef.current) return false;
    setSaving(true);
    const res = await run.saveDraft(card.id, held.tab, held.text);
    setSaving(false);
    if (res.error) {
      setSaveFailed({ tab: held.tab, why: res.error });
      return false;
    }
    setSaveFailed(null);
    base.current = held.text;
    setSavedAt(Date.now());
    // Only what was written is let go: a keystroke that landed during the save is still
    // unsaved, and the next idle writes it.
    if (pending.current === held) {
      pending.current = null;
      setDirty(false);
    }
    setRead(res);
    return true;
  }, [card.id]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Leaving the page is the last chance to write what is typed. Nothing can be awaited in a
  // cleanup, so this is a best effort — the idle save is what usually got there first.
  useEffect(() => () => void flushRef.current(), []);

  // ---- the editor ----------------------------------------------------------

  const host = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<OverTypeInstance | null>(null);
  // Bumped whenever the caret may have moved without the browser saying so — the save chip
  // is drawn on the caret's own line.
  const [caretMoved, setCaretMoved] = useState(0);
  // Read inside OverType's own onChange, which is installed once and never sees a later
  // render's values.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  // True while the page is putting the file's own words into the editor. OverType answers a
  // `setValue` with an `onChange`, and taking that for typing would mark a freshly read
  // draft unsaved and then hold every later re-read off.
  const adopting = useRef(false);

  // True between `compositionstart` and `compositionend`. An IME's half-typed candidate is
  // in the textarea like any other text, so it would otherwise be saved as the draft.
  const composing = useRef(false);
  // A draft an agent is writing takes nothing typed at all — read inside OverType's own
  // onChange, which never sees a later render's values.
  const lockedRef = useRef(false);
  lockedRef.current = locked;

  const typed = useCallback((value: string) => {
    if (adopting.current || composing.current || lockedRef.current) return;
    pending.current = { tab: tabRef.current, text: value };
    setDirty(true);
    setText(value);
    setCaretMoved((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    // Nothing saves itself while a rewrite is waiting to be answered.
    if (!conflictRef.current) timer.current = setTimeout(() => void flushRef.current(), SAVE_AFTER_MS);
  }, []);
  const typedRef = useRef(typed);
  typedRef.current = typed;
  // What the page last saw in the editor — every value `typed` took, and every file read into
  // it. A composition that was abandoned ends on this, and is not a change to save.
  const textRef = useRef(text);
  textRef.current = text;

  // The comment marks. OverType replaces its preview's HTML on every render, so they are
  // drawn again from here — through a ref, since the instance below is built once and its
  // options never see a later render's values.
  const repaint = useCommentMarks(editor, comments);
  const repaintRef = useRef(repaint);
  repaintRef.current = repaint;

  useEffect(() => {
    let killed = false;
    let made: OverTypeInstance | null = null;
    void (async () => {
      // Client-only, and a whole editor of it: loaded when a marketing card is opened
      // rather than with every board screen.
      const mod = await import("overtype");
      const OverType = mod.OverType ?? mod.default;
      if (killed || !host.current) return;
      made = new OverType(host.current, {
        autoResize: false,
        fontSize: "13.5px",
        lineHeight: 1.85,
        padding: "24px 32px",
        // Off, on three counts: it writes a numbered list the draft file may not carry, it
        // renumbers by assigning `textarea.value` — which throws the undo stack away mid-draft
        // — and it writes through a read-only lock. The cost is that Enter no longer opens the
        // next list item.
        smartLists: false,
        onChange: (value) => typedRef.current(value),
        onRender: () => repaintRef.current(),
      })[0]!;
      // The draft's own selection in the same ember the comment box paints its passage with,
      // so handing the focus to the box does not change what the passage looks like. Written
      // inline, because that is where OverType writes its own theme.
      made.container.style.setProperty("--selection", "var(--color-nb-accent-soft)");
      setEditor(made);
    })();
    return () => {
      killed = true;
      made?.destroy();
      setEditor(null);
    };
  }, []);

  // ---- letting an IME through ----------------------------------------------
  //
  // OverType handles no composition of its own: its `keydown` runs on every key an IME takes,
  // so Tab and the mod-key shortcuts fire at candidates rather than at the draft. Its
  // listeners are delegated on `document`, so one on the textarea itself runs first and can
  // stop the key from ever reaching them.
  //
  // The `input` events are let through on purpose — the textarea's own glyphs are transparent,
  // so a preview that stopped re-rendering would leave the candidate being typed invisible.
  // What is held back is the SAVE: `typed` ignores everything mid-composition, and the
  // candidate lands once, here, when it is committed.
  useEffect(() => {
    if (!editor) return;
    const box = editor.textarea;
    const hold = (e: KeyboardEvent) => {
      if (composing.current || e.isComposing) e.stopPropagation();
    };
    const start = () => {
      composing.current = true;
    };
    const end = () => {
      composing.current = false;
      if (box.value !== textRef.current) typedRef.current(box.value);
    };
    box.addEventListener("keydown", hold);
    box.addEventListener("compositionstart", start);
    box.addEventListener("compositionend", end);
    return () => {
      box.removeEventListener("keydown", hold);
      box.removeEventListener("compositionstart", start);
      box.removeEventListener("compositionend", end);
      composing.current = false;
    };
  }, [editor]);

  // Read-only while an agent is writing this card, and on a page handed no actions — where
  // a save could never land anyway.
  useEffect(() => {
    if (editor) editor.textarea.readOnly = locked || !actions;
  }, [editor, locked, actions]);

  /** Put the file's own words into the editor, dropping whatever it was holding. */
  const adopt = useCallback(
    (disk: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      base.current = disk;
      setDirty(false);
      setConflict(null);
      setSaveFailed(null);
      if (editor && editor.getValue() !== disk) {
        adopting.current = true;
        editor.setValue(disk);
        adopting.current = false;
      }
      setText(disk);
      setCaretMoved((n) => n + 1);
    },
    [editor],
  );

  // Take up what was read, unless the editor is holding words this would throw away. The tab
  // changing always takes it up: the strip only moves once the last tab's words are on disk,
  // so there is never anything of the old draft to carry into the new one.
  //
  // A re-read that finds the file CHANGED under held words is the one case neither answer
  // fits, so the page picks neither: the idle save stops and both versions are offered.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!editor) return;
    const disk = read.drafts.find((d) => d.name === tab)?.text ?? "";
    if (shown.current === tab && pending.current) {
      if (disk === base.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setConflict((held) => (held && held.tab === tab && held.disk === disk ? held : { tab, disk }));
      return;
    }
    // The receipt belongs to the tab it was earned on; the file's own words are what the
    // new one opens with.
    if (shown.current !== tab) setSavedAt(0);
    shown.current = tab;
    adopt(disk);
  }, [read, tab, editor, adopt]);

  // One press lands in the editor (#507). New topic wrote this card and came straight here,
  // so the caret goes into the Source pane rather than waiting for somebody to click into it.
  // Only that visit — every other way into a topic is a reader opening one they already have,
  // and taking their focus would be taking it from wherever they were.
  useEffect(() => {
    if (!editor || !loaded || !actions) return;
    if (!takeNewTopic(card.id)) return;
    editor.textarea.focus();
  }, [editor, loaded, actions, card.id]);

  // The batch belongs to the draft on screen: the strip moving is a different set of
  // comments, and a run that ended has already had its own cleared by the board.
  useEffect(() => {
    setComments(read.drafts.find((d) => d.name === tab)?.comments ?? []);
  }, [read, tab]);

  // ---- the strip -----------------------------------------------------------

  // A channel just chosen is on screen before the card has been re-read, so the fallback
  // below must not bounce off it.
  const [added, setAdded] = useState("");
  useEffect(() => {
    if (added && channels.some((ch) => ch.name === added)) setAdded("");
  }, [channels, added]);

  // A tab that has gone — a channel taken off the card while the page sat open — falls back
  // to the source rather than leaving the strip pointing at nothing.
  useEffect(() => {
    if (tab !== SOURCE && tab !== added && !channels.some((ch) => ch.name === tab)) setTab(SOURCE);
  }, [channels, tab, added]);

  /** Whether that draft has anything on disk. What the panel warns about, what says whether
   *  a run replaces one — the same question `akb channel` asks before it starts — and what
   *  tells a channel the picker can simply reopen from one it has to write. */
  const isWritten = (name: string) => (read.drafts.find((d) => d.name === name)?.text ?? "").trim() !== "";

  const channel = channels.find((ch) => ch.name === tab);
  const draft = read.drafts.find((d) => d.name === tab);
  // The file this tab writes, named before it exists: the first save is what makes it.
  const path = draft?.path ?? (read.dir ? `${read.dir}/${tab}.md` : "");
  // Whether this tab has anything written. The editor's own words only once they are the
  // unsaved ones: the file is what it holds otherwise, and reading the editor there would
  // draw the empty tab's action over a written draft for the frame between the tab moving
  // — or the editor arriving — and the file reaching it.
  const written = (dirty ? text : (draft?.text ?? "")).trim() !== "";
  const unchosen = CHANNEL_NAMES.filter((name) => !channels.some((ch) => ch.name === name));
  // Both moves the strip makes are `update --channels`, so both need the rules that carry
  // it. "Repurpose to…" needs a source on top of that: a repurpose refuses without one.
  const canSetChannels = !!actions && !!read.canSetChannels;
  const sourceWritten = tab === SOURCE ? written : isWritten(SOURCE);
  const canRepurposeTo = canSetChannels && sourceWritten && unchosen.length > 0;
  // And the comment box and its list only where the rules carry those moves (#458). A board
  // running older rules keeps its editor, its tabs and its repurpose, and simply offers
  // nothing to comment with.
  const canComment = !!actions && !!read.canComment;
  const published = channels.filter((ch) => ch.status === "published").length;
  const names = [SOURCE, ...channels.map((ch) => ch.name)];

  // ---- what is being written, and what stopped (#479) ----------------------

  /** Whether a run over this channel is REwriting it: a repurpose and a rewrite are the same
   *  command, and only the draft under it tells the two apart. Neither the file nor the
   *  channel's status moves mid-run, so this reads the same for the whole of one. */
  const rewriting = (name: string | undefined): boolean =>
    !!name && (isWritten(name) || (channels.find((ch) => ch.name === name)?.status ?? "") !== "");

  // One pill per live run, except that a repurpose — one run per channel, all at once — is
  // one pill saying how many. The rail's own answer is in no session list and belongs to no
  // draft, so it is named apart and sends the reader back to the rail.
  const pills: { key: string; words: string }[] =
    live.length > 1 && live.every((r) => r.action === "channel")
      ? [{ key: "several", words: c.run.several(live.length) }]
      : live.map((r) => ({ key: r.sessionId, words: runWords(r, rewriting(draftOf(r)), c.run) }));

  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const stopped = stoppedRows(runs, card.id, names, dismissed, t.runs.log);
  const dismiss = (runIds: string[]) => setDismissed((held) => new Set([...held, ...runIds]));

  // ---- a move that has to write first --------------------------------------
  //
  // Which control was pressed, and how far from the strip's left edge it stands — the tabs
  // scroll, so the answer is drawn beside the strip rather than inside it, where the scroll
  // box would cut it off.
  const [refused, setRefused] = useState<{ at: string; kind: "failed" | "changed"; x: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  /** Do `move`, once what is typed is on disk. A write that refused says why under the
   *  control that was pressed, rather than leaving the press looking dead. */
  const afterSave = async (at: string, from: HTMLElement | null, move: () => void | Promise<void>) => {
    setRefused(null);
    const row = strip.current;
    const x =
      row && from
        ? Math.max(0, Math.min(from.getBoundingClientRect().left - row.getBoundingClientRect().left, row.clientWidth - POP_W))
        : 0;
    if (!(await flush())) return setRefused({ at, x, kind: conflictRef.current ? "changed" : "failed" });
    await move();
  };

  /** Keep what was typed: the file the agent wrote is what the next save replaces. */
  const keepMine = () => {
    base.current = conflict?.disk ?? base.current;
    setConflict(null);
    setRefused(null);
    if (pending.current) timer.current = setTimeout(() => void flushRef.current(), SAVE_AFTER_MS);
  };
  /** Take what the agent wrote: the words the editor was holding go with it. */
  const takeFile = () => {
    setRefused(null);
    adopt(conflict?.disk ?? "");
  };
  const retrySave = () => {
    setRefused(null);
    void flush();
  };

  /** The answers to whichever refusal is standing, under the control that was pressed. */
  const refusal = (at: string, align: "left" | "right" = "left", side: "up" | "down" = "down") =>
    refused?.at === at ? (
      <SaveRefused
        kind={refused.kind}
        draft={draftLabel((refused.kind === "changed" ? conflict?.tab : saveFailed?.tab) ?? tab)}
        align={align}
        side={side}
        onCancel={() => setRefused(null)}
        onRetry={retrySave}
        onKeepMine={keepMine}
        onTakeFile={takeFile}
      />
    ) : null;

  /** Move the strip, once what is typed is on disk. A write that refused keeps the tab it
   *  belongs to on screen: the words are still in the editor, and only there. */
  const goTab = (next: string, from: HTMLElement | null) => {
    if (next === tab) return;
    return afterSave(`tab:${next}`, from, () => {
      onError(null);
      setAsking(null);
      setTab(next);
    });
  };

  // Arrow keys, Home and End move the strip and select as they go; the strip holds one tab
  // stop, so the cross a pointer clicks is reached with Delete instead.
  const tabs = useRef(new Map<string, HTMLButtonElement>());
  const onStripKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const at = names.indexOf(tab);
    if ((e.key === "Delete" || e.key === "Backspace") && tab !== SOURCE && canSetChannels && !locked && !moving) {
      e.preventDefault();
      return void closeChannel(tab, tabs.current.get(tab) ?? e.currentTarget);
    }
    const next =
      e.key === "ArrowRight"
        ? names[(at + 1) % names.length]
        : e.key === "ArrowLeft"
          ? names[(at - 1 + names.length) % names.length]
          : e.key === "Home"
            ? names[0]
            : e.key === "End"
              ? names[names.length - 1]
              : undefined;
    if (!next) return;
    e.preventDefault();
    void goTab(next, tabs.current.get(next) ?? null);
  };

  // The selected tab is the one tab stop, and it is kept in view — the strip scrolls, so a
  // tab reached by arrow key can be off the end of it.
  useEffect(() => {
    const el = tabs.current.get(tab);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (strip.current?.contains(document.activeElement)) el.focus();
  }, [tab]);

  // Which ends of the strip are cut, so the fade is drawn where there is more to see.
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measureEdges = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const left = box.scrollLeft > 1;
    const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1;
    setEdges((held) => (held.left === left && held.right === right ? held : { left, right }));
  }, []);
  useEffect(() => {
    measureEdges();
    // The chat rail opening narrows the strip without the window resizing, so the box is
    // watched rather than the window.
    const box = scroller.current;
    if (!box) return;
    const watch = new ResizeObserver(measureEdges);
    watch.observe(box);
    return () => watch.disconnect();
  }, [measureEdges, channels, tab]);

  // ---- the moves the page makes itself -------------------------------------

  /** Put channels on the card and land the strip on the first of them — `channels:` is the
   *  only record of which tabs there are, so this is the whole of opening one. Every channel
   *  already there keeps its status and the URL it went up at. Answers whether it landed;
   *  the caller has flushed and owns `moving`. */
  const add = async (names: string[]): Promise<boolean> => {
    if (!actions || !names.length) return false;
    const res = await actions.setChannels(card.id, [...channels.map((ch) => ch.name), ...names]);
    if (!res.ok) {
      onError(res.error ?? c.addChannelFailed);
      return false;
    }
    onError(null);
    setAdded(names[0]!);
    setTab(names[0]!);
    router.refresh();
    return true;
  };

  /**
   * Repurpose, once the panel has been confirmed — `akb channel <name> <id>` per channel,
   * with every check that command makes, all started together (#457).
   *
   * The panel is the ask, so a draft already on disk is started with `again` rather than
   * refused: it was named as one this will replace before anything ran. A refusal that
   * still comes back — the file appeared since the pane last read the folder — is said on
   * the error line, without the sentence telling a terminal which flag to add.
   *
   * A channel picked from "Repurpose to…" is not on the card yet, and `akb channel` refuses
   * one the card has not chosen — so it is added, and the strip lands on it, before the run
   * starts (#478). A refusal after that leaves the tab open on its own empty state.
   */
  const repurpose = async (targets: string[], ask: RepurposeAsk) => {
    if (!actions || !targets.length) return;
    // What is typed goes to disk first: a run is about to write these same files, and a
    // save landing after one would put the words back over what the agent wrote. A refusal
    // here is already reported on the caret's line, which is where it was typed.
    if (!(await flush())) return;
    setMoving(true);
    const fresh = targets.filter((name) => !channels.some((ch) => ch.name === name));
    if (fresh.length && !(await add(fresh))) return setMoving(false);
    const results = await Promise.all(
      targets.map((name) => actions.repurpose(card.id, name, isWritten(name), ask)),
    );
    setMoving(false);
    const failed = targets.filter((_, i) => !results[i]!.ok);
    if (results.some((res) => res.ok)) onKick();
    // Only what failed is left to try again: a second press must not start a second run
    // over a draft the first press is already writing.
    setAsking(failed.length ? failed : null);
    const why = results.find((res) => !res.ok);
    onError(why ? withoutFlag(why.error) || c.repurpose.failed : null);
  };

  const publish = async (url: string) => {
    if (!actions || !channel) return;
    setMoving(true);
    const res = await actions.setChannelStatus(card.id, channel.name, "published", url);
    setMoving(false);
    // A refusal leaves the dialog open on the URL that was typed: the link is the one thing
    // here nobody wants to find again.
    if (!res.ok) return onError(res.error ?? c.publishFailed);
    setPublishing(false);
    onError(null);
    router.refresh();
  };

  /** "Repurpose to…": one channel this topic has not chosen. One whose draft is already on
   *  disk is only opened back up — the file is untouched and nothing runs — and one with
   *  nothing written goes through the same ask a Rewrite opens. */
  const pickChannel = (name: string, from: HTMLElement | null) =>
    // The strip is about to move, so this tab's words go to disk first — the same rule
    // clicking a tab follows.
    afterSave("pick", from, async () => {
      if (!isWritten(name)) return setAsking([name]);
      setAsking(null);
      setMoving(true);
      await add([name]);
      setMoving(false);
    });

  /** Close a channel tab: the channel comes off the card, and `content/…/<name>.md` stays
   *  where it is. Reopening it from the picker is what brings that draft back. */
  const closeChannel = (name: string, from: HTMLElement | null) =>
    afterSave(`close:${name}`, from, async () => {
      if (!actions) return;
      setMoving(true);
      const res = await actions.setChannels(
        card.id,
        channels.filter((ch) => ch.name !== name).map((ch) => ch.name),
      );
      setMoving(false);
      if (!res.ok) return onError(res.error ?? c.closeChannelFailed);
      onError(null);
      setAdded((a) => (a === name ? "" : a));
      // The ask names channels, so one taken off the card leaves it: confirming what is left
      // must not put the closed channel back.
      setAsking((a) => {
        const left = (a ?? []).filter((n) => n !== name);
        return left.length ? left : null;
      });
      if (tab === name) setTab(SOURCE);
      router.refresh();
    });

  // ---- the comments on this draft (#458) -----------------------------------
  //
  // Each write answers with the batch as it now reads, so the list moves with the click.
  // Nothing here touches the draft: a comment is beside the file, never inside it.

  const leaveComment = async (passage: DraftPassage) => {
    if (!actions) return;
    const res = await actions.commentOnDraft(card.id, tab, passage);
    if (res.error) return onError(res.error);
    onError(null);
    setComments(res.comments);
  };

  const editComment = async (commentId: string, words: string) => {
    if (!actions) return;
    const res = await actions.editDraftComment(card.id, tab, commentId, words);
    if (res.error) return onError(res.error);
    onError(null);
    setComments(res.comments);
  };

  const dropComment = async (commentId: string) => {
    if (!actions) return;
    const res = await actions.dropDraftComment(card.id, tab, commentId);
    if (res.error) return onError(res.error);
    onError(null);
    setComments(res.comments);
  };

  /** Submit the batch: one polish over this draft, with every comment on it. The board
   *  clears them when the run ends `done`, so nothing is cleared here — a polish that
   *  failed leaves the batch to submit again. */
  const submitComments = (from: HTMLElement | null) =>
    // What is typed goes to disk first: the run is about to write this same file, and a
    // save landing after it would put the words back over what the polish wrote.
    afterSave("submit", from, async () => {
      if (!actions || !comments.length) return;
      setMoving(true);
      const res = await actions.polishDraft(card.id, tab);
      setMoving(false);
      if (!res.ok) return onError(res.error ?? c.comment.failed);
      onError(null);
      onKick();
    });

  // ---- what the editor says about its file ---------------------------------

  const saveState: SaveState = !actions
    ? "none"
    : conflict?.tab === tab
      ? "changed"
      : saving
        ? "saving"
        : saveFailed?.tab === tab
          ? "failed"
          : dirty
            ? "unsaved"
            : savedAt
              ? "saved"
              : "none";

  // A tab with nothing to show says which of the four things it is. A channel is never
  // offered a first draft: it is what a repurpose wrote, and an unfinished one is picked
  // back up from the notice above rather than started again from here.
  //
  // A run over this tab says so over the draft as well as under an empty one — a rewrite
  // names what it is doing to the words behind it, which are the ones being replaced.
  const writingHere = !!writingRun;
  const empty: React.ReactNode = writingHere ? (
    written ? (
      <Empty title={c.empty.rewriting} hint={c.empty.rewritingHint} pulse />
    ) : (
      <Empty title={c.empty.writing} hint={c.empty.writingHint} pulse />
    )
  ) : !actions ? (
    <Empty title={c.empty.readOnly} hint={c.empty.readOnlyHint} />
  ) : locked ? null : tab === SOURCE ? (
    // Source's own offer, at the foot rather than the middle (#507): the invitation to type
    // is the placeholder up at the caret, and this is the other way — an agent drafting it —
    // kept out of its way.
    <Button variant="ghost" className="pointer-events-auto" disabled={moving} onClick={onDraft}>
      {c.draft}
    </Button>
  ) : stopped.some((row) => row.draft === tab) ? (
    <Empty title={c.empty.stopped} hint={c.empty.stoppedHint} />
  ) : null;

  // A blank source is a topic somebody just opened, so it says what to put in it. The offer
  // at the foot moves out of its way; on a channel there is no invitation at all, because a
  // channel draft is what a repurpose writes and the pane says so over the whole of it.
  const inviting = tab === SOURCE && !writingHere && !locked && !!actions;

  // What the empty draft invites, in the library's own shim rather than a layer of our own:
  // it is already at the caret, in the editor's metrics, and two placeholders on one blank
  // page read as a bug.
  useEffect(() => {
    if (editor?.placeholderEl) editor.placeholderEl.textContent = inviting ? c.sourcePlaceholder : "";
  }, [editor, inviting, c]);

  return (
    <>
      <div className="shrink-0 bg-nb-wash" style={PART}>
        <div className="flex items-center gap-2.5 px-4 pb-2 pt-3">
          <Link
            href={boardHref}
            aria-label={c.back}
            className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-[8px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]"
          >
            <FiArrowLeft className="text-[17px]" aria-hidden />
          </Link>
          <span className="shrink-0 text-[19px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
            #{card.id}
          </span>
          <TopicTitle card={card} disabled={!actions || locked || moving} onError={onError} />
          {/* What is being written, one pill per run — and where nothing is, how far this
              topic is published. */}
          {pills.map((pill) => (
            <RunPill key={pill.key} words={pill.words} />
          ))}
          {answering && (
            <RunPill
              words={c.run.rail}
              title={c.run.toRail}
              onClick={rail && !rail.open ? () => rail.toggle() : undefined}
            />
          )}
          {!locked && published > 0 && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-[700]"
              style={{ background: "var(--color-nb-mint-soft)", color: "var(--color-nb-mint-ink)" }}
            >
              <FiCheck className="text-[11px]" aria-hidden />
              {c.publishedCount(published, channels.length)}
            </span>
          )}
          <span className="relative ml-auto flex shrink-0 items-center">
            <PageMenu
              onDiscard={actions ? onDiscard : undefined}
              onArchive={actions ? onArchive : undefined}
              onReject={actions ? onReject : undefined}
              disabled={locked || moving}
            />
          </span>
        </div>

        {/* The strip: `source`, one tab per chosen channel — each with the cross that takes
            it back off — and the picker that chooses one more, all in a row that scrolls
            rather than squeezing. This tab's own actions are pinned outside it, so they are
            where they were whatever the strip is holding. */}
        <div ref={strip} className="relative flex items-end gap-2 px-3">
          <div className="relative min-w-0 flex-1">
            <div
              ref={scroller}
              onScroll={measureEdges}
              className="nb-scroll-x flex items-end gap-1 overflow-x-auto pb-px"
            >
              <div
                role="tablist"
                aria-label={c.tabs}
                onKeyDown={onStripKey}
                className="flex shrink-0 items-end gap-1"
              >
                <Tab
                  label={SOURCE}
                  name={SOURCE}
                  mono
                  on={tab === SOURCE}
                  hold={tabs.current}
                  onClick={(e) => void goTab(SOURCE, e.currentTarget)}
                />
                {channels.map((ch) => (
                  <Tab
                    key={ch.name}
                    name={ch.name}
                    label={channelLabel(ch.name)}
                    on={tab === ch.name}
                    hold={tabs.current}
                    onClick={(e) => void goTab(ch.name, e.currentTarget)}
                    mark={<ChannelMark name={ch.name} status={ch.status} size={13} />}
                    dot={<ChannelDot status={ch.status} size={6} />}
                    closeLabel={c.closeChannel(channelLabel(ch.name))}
                    closeDisabled={locked || moving}
                    onClose={
                      canSetChannels ? (e) => void closeChannel(ch.name, e.currentTarget) : undefined
                    }
                  />
                ))}
              </div>
              {canRepurposeTo && (
                <span className="mb-[3px] ml-1 shrink-0">
                  <RepurposeTo
                    names={unchosen}
                    written={unchosen.filter(isWritten)}
                    disabled={locked || moving}
                    onPick={(name, from) => void pickChannel(name, from)}
                  />
                </span>
              )}
            </div>
            {/* Where the strip is cut, so the scroll is something to see rather than to find. */}
            {edges.left && <Fade side="left" />}
            {edges.right && <Fade side="right" />}
          </div>
          {/* The source tab's one AI move: repurpose into every chosen channel at once. It
              needs a source to read and a channel to write, so it is drawn only where both
              are there, and it names those channels — the picker beside it says "Repurpose
              to…" as well. */}
          {tab === SOURCE && written && channels.length > 0 && actions && (
            <span className="mb-[2px] shrink-0">
              <Button
                size="xs"
                disabled={locked || moving}
                onClick={(e) =>
                  void afterSave("repurpose", e.currentTarget, () =>
                    setAsking(channels.map((ch) => ch.name)),
                  )
                }
              >
                <FiRepeat className="text-[12px]" aria-hidden />
                {c.repurpose.action(channels.map((ch) => channelLabel(ch.name)).join(c.repurpose.separator))}
              </Button>
            </span>
          )}
          {/* The open channel's own two: writing it again over what is there, and recording
              where it went up. Rewrite is how an unfinished channel is written at all, so it
              stands whether or not there is a draft yet; marking it published needs one. */}
          {channel && (
            <span className="mb-[2px] flex shrink-0 items-center gap-2">
              {actions && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={locked || moving}
                  onClick={(e) =>
                    void afterSave("rewrite", e.currentTarget, () => setAsking([channel.name]))
                  }
                >
                  <FiRepeat className="text-[12px]" aria-hidden />
                  {c.rewrite}
                </Button>
              )}
              {written && (
                <Button size="xs" disabled={!actions || locked || moving} onClick={() => setPublishing(true)}>
                  <FiCheck className="text-[12px]" aria-hidden />
                  {c.publish}
                </Button>
              )}
            </span>
          )}
          {/* Why a press that had to write first did nothing, hung off the strip rather than
              inside its scroll box, which would cut it off. */}
          {refused && refused.at !== "submit" && (
            <div className="absolute top-full z-30" style={{ left: refused.x }}>
              {refusal(refused.at)}
            </div>
          )}
        </div>
      </div>

      {/* A run that ended without finishing, per draft: what stopped, why, and one press to
          pick it back up. */}
      <StoppedRuns
        rows={stopped}
        onDismiss={dismiss}
        onResumed={(runId) => {
          dismiss([runId]);
          onKick();
        }}
      />

      {/* A refusal the page itself was given — a publish, a rewrite, a channel the board
          would not add. None of them is a conversation, so each is said here. */}
      {error && (
        <div className="shrink-0 bg-nb-peach-soft px-4 py-2 text-[12.5px] text-nb-peach-ink" style={PART}>
          {error}
        </div>
      )}

      {/* What the agent is doing, in its own window — the board's one run log, on the page's
          own ground. It folds to its title bar, which still carries the outcome, the time and
          the cost, so a folded one is a receipt rather than nothing. Resume is not offered
          here: the notice above already words a run that stopped and runs it again. */}
      {logRun && (
        <div className="shrink-0 bg-nb-wash px-3 py-2" style={PART}>
          <SessionLog
            session={log ?? logRun}
            collapsed={!showLog}
            onToggle={() => setShowLog((v) => !v)}
            cap="max-h-[32vh]"
          />
        </div>
      )}

      {/* Rules older than the drafts moves can neither read a draft nor write one, so the
          page says why rather than drawing an empty editor — which would read as a topic
          nobody has written for yet. */}
      {read.error ? (
        <div className="px-4 py-4 text-[12.5px] text-nb-ink-soft">{read.error}</div>
      ) : (
        <div
          role="tabpanel"
          id={PANEL_ID}
          aria-labelledby={tabId(tab)}
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          {/* OverType mounts INTO this element, so nothing React draws may live inside it.
              A draft an agent is rewriting recedes far enough that the state drawn over it is
              the only thing to read — the old words are what the run is replacing. */}
          <div
            ref={host}
            className={`h-full transition-opacity duration-300 ${writingHere ? "opacity-[0.18]" : locked ? "opacity-70" : ""}`}
          />

          {/* What this tab is instead of a draft: being written, not written, or not this
              machine's to write. A rewrite says it here too — over the draft it is replacing,
              so a rewrite and a first write look the same. */}
          {loaded && editor && (writingHere || !written) && empty && (
            <div
              className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center gap-2.5 ${inviting ? "justify-end pb-10" : "justify-center pb-16"}`}
            >
              {/* Over a draft there are words behind this, and a line of them through the
                  middle of it reads as a smudge. A plate of the page's own paper is what
                  separates the two; an empty tab has nothing to be separated from. */}
              {writingHere && written ? (
                <div className="rounded-[12px] bg-nb-paper/92 px-5 py-3.5 shadow-[0_1px_12px_color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]">
                  {empty}
                </div>
              ) : (
                empty
              )}
            </div>
          )}

          {/* Whether what is on screen reached the file, on the caret's own line. */}
          {editor && (
            <SaveMark
              editor={editor}
              host={host}
              state={saveState}
              tick={caretMoved}
              onRetry={retrySave}
              onKeepMine={keepMine}
              onTakeFile={takeFile}
            />
          )}

          {/* Which file this is, and — before the first save creates it — that there is none.
              `z-20`, because OverType gives its textarea `z-index: 1` and anything drawn over
              the draft without a layer of its own is painted underneath it. */}
          <span className="pointer-events-none absolute bottom-3 right-5 z-20 font-mono text-[11px] text-nb-ink-soft/75">
            {path}
            {loaded && !draft && ` · ${c.save.noFile}`}
          </span>

          {/* The one thing a selection does: leave a comment on it. It is drawn only where
              the board's rules carry the move behind it. */}
          {editor && !locked && canComment && (
            <LeaveComment editor={editor} onLeave={(passage) => void leaveComment(passage)} />
          )}

          {asking && (
            <RepurposePanel
              channels={asking}
              written={asking.filter(isWritten)}
              busy={moving}
              onClose={() => setAsking(null)}
              onStart={(ask) => void repurpose(asking, ask)}
            />
          )}
        </div>
      )}

      {/* What has been said about this draft and not yet answered. Drawn only where there is
          something in it — an empty band under every draft would be a standing reminder of a
          feature rather than a place things are. */}
      {canComment && (
        <DraftComments
          comments={comments}
          polishing={polishingDraft === tab}
          disabled={locked || moving}
          refusal={refusal("submit", "right", "up")}
          onEdit={(commentId, words) => void editComment(commentId, words)}
          onDrop={(commentId) => void dropComment(commentId)}
          onSubmit={(from) => void submitComments(from)}
        />
      )}

      {publishing && channel && (
        <PublishDialog
          channel={channel.name}
          url={channel.url}
          busy={moving}
          onClose={() => setPublishing(false)}
          onConfirm={(url) => void publish(url)}
        />
      )}
    </>
  );
}

/** The refusal without the line telling a terminal which flag to add. */
const withoutFlag = (why: string | undefined): string => (why ?? "").split("Add `--again`")[0]!.trim();

// ---- the pieces ------------------------------------------------------------

/** The strip is cut at this end and there is more of it that way. */
function Fade({ side }: { side: "left" | "right" }) {
  const to = side === "left" ? "90deg" : "270deg";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 w-[22px] ${side === "left" ? "left-0" : "right-0"}`}
      style={{ background: `linear-gradient(${to}, var(--color-nb-wash), transparent)` }}
    />
  );
}

/** What a tab with nothing in it is: being written, not written, or not this machine's to
 *  write. A channel is never offered a first draft — that is what Repurpose is for. */
function Empty({ title, hint, pulse = false }: { title: string; hint: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <span
        className="flex items-center gap-2 text-[13px] font-[700]"
        style={pulse ? { color: "var(--color-nb-accent-deep)" } : { color: "var(--color-nb-ink-soft)" }}
      >
        {pulse && <span className={PULSE_DOT} aria-hidden />}
        {title}
      </span>
      <span className="text-[12.5px] text-nb-ink-soft">{hint}</span>
    </div>
  );
}

/** One tab: the channel's mark, its name, how far it has got, and the cross that takes it
 *  back off the card. `source` carries none of the four — it is what every channel is
 *  written from, not a destination, and nothing is left if it goes.
 *
 *  The strip is one tablist and holds one tab stop, so the cross is not in the tab order:
 *  Delete on the selected tab is what reaches it from the keyboard. */
function Tab({
  name,
  label,
  on,
  hold,
  mono = false,
  mark,
  dot,
  onClick,
  onClose,
  closeLabel,
  closeDisabled,
}: {
  name: string;
  label: string;
  on: boolean;
  /** Where the strip keeps its buttons, so it can focus one and scroll it into view. */
  hold: Map<string, HTMLButtonElement>;
  mono?: boolean;
  mark?: React.ReactNode;
  dot?: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Unset on a tab that cannot be closed, which draws no cross at all. */
  onClose?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  closeLabel?: string;
  closeDisabled?: boolean;
}) {
  return (
    <span
      className={`relative flex h-[30px] shrink-0 items-center rounded-t-[8px] transition-colors${
        on ? " bg-nb-paper" : " hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)]"
      }${onClose ? " pr-1" : ""}`}
    >
      {on && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-[8px]"
          style={{ background: "var(--color-nb-accent)" }}
        />
      )}
      <button
        type="button"
        role="tab"
        id={tabId(name)}
        aria-selected={on}
        aria-controls={PANEL_ID}
        tabIndex={on ? 0 : -1}
        ref={(el) => {
          if (el) hold.set(name, el);
          else hold.delete(name);
        }}
        onClick={onClick}
        className={`flex h-full cursor-pointer items-center gap-1.5 whitespace-nowrap pl-2.5 text-[12px] font-[700]${
          onClose ? " pr-1" : " pr-2.5"
        }${on ? "" : " text-nb-ink-soft"}`}
      >
        {mark}
        <span className={mono ? "font-mono text-[11.5px]" : undefined}>{label}</span>
        {dot}
      </button>
      {onClose && (
        <button
          type="button"
          tabIndex={-1}
          title={closeLabel}
          aria-label={closeLabel}
          disabled={closeDisabled}
          onClick={onClose}
          className={`grid size-[17px] shrink-0 cursor-pointer place-items-center rounded-[5px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-40${
            on ? "" : " opacity-60"
          }`}
        >
          <FiX className="text-[11px]" aria-hidden />
        </button>
      )}
    </span>
  );
}

/** "Repurpose to…" at the end of the strip (#478): the channels this topic has not chosen.
 *  It stands where the `+` used to and says what the press does, because adding a channel
 *  and writing its first draft are one move now — there is no empty tab in between, and a
 *  channel page never offers to draft itself.
 *
 *  A channel whose draft is still on disk from before it was closed is marked as such:
 *  choosing it opens its tab back up and starts nothing. */
function RepurposeTo({
  names,
  written,
  disabled,
  onPick,
}: {
  names: string[];
  written: string[];
  disabled: boolean;
  onPick: (name: string, from: HTMLElement | null) => void;
}) {
  const c = useCopy().card.marketing;
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          className="flex h-[24px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-nb-accent-soft px-2 text-[12px] font-[700] text-nb-accent-deep transition-colors enabled:hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiRepeat className="text-[12px]" aria-hidden />
          {c.repurposeTo}
          <FiChevronDown className="text-[12px]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[212px]">
        {names.map((name) => (
          <DropdownMenuItem key={name} className="gap-2" onSelect={() => onPick(name, trigger.current)}>
            <ChannelMark name={name} status="" size={14} dim={false} />
            {channelLabel(name)}
            {written.includes(name) && (
              <span className="ml-auto text-[11px] font-[600] text-nb-ink-soft">{c.hasDraft}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The topic's title, editable in place (#507).
 *
 * A topic opens `Untitled`, which is the absence of a title rather than one somebody chose:
 * it is drawn in placeholder style, and focusing the box clears it so the first keystroke
 * replaces it rather than landing beside it. Emptying the box writes `Untitled` back — the
 * board refuses an empty title, and a save that failed because the user deleted a word is
 * not something to explain.
 *
 * Nothing about this moves a file: a topic's card is `todo/<id>.md` and its drafts are
 * `content/<id>/`, so the title lives in frontmatter alone and every keystroke of it is
 * reversible.
 *
 * Saved on blur, not per keystroke: the title is one short line typed in one go, and a save
 * per character would be a card write per character.
 */
function TopicTitle({
  card,
  disabled,
  onError,
}: {
  card: Card;
  disabled: boolean;
  onError: (why: string | null) => void;
}) {
  const c = useCopy().card.marketing;
  const actions = useActions();
  const router = useRouter();
  const [value, setValue] = useState(card.title);
  const [editing, setEditing] = useState(false);
  // The card re-read under the box — a run renamed it, or another window did. What is being
  // typed wins while it is being typed; anything else takes the card's own word for it.
  const held = useRef(card.title);
  useEffect(() => {
    if (editing || held.current === card.title) return;
    held.current = card.title;
    setValue(card.title);
  }, [card.title, editing]);

  const save = async (typed: string) => {
    const title = typed.trim() || UNTITLED;
    setValue(title);
    held.current = title;
    if (!actions || title === card.title) return;
    const res = await actions.patchCard(card.id, { title }, card.revision);
    if (!res.ok) {
      setValue(card.title);
      held.current = card.title;
      onError(res.error || c.titleFailed);
      return;
    }
    onError(null);
    router.refresh();
  };

  const untitled = value === UNTITLED;
  return (
    <input
      className={`min-w-0 flex-1 truncate bg-transparent text-[19px] font-[800] tracking-[-0.02em] outline-none placeholder:font-[800] placeholder:text-nb-ink-soft/55 ${untitled && !editing ? "text-nb-ink-soft/55" : "text-nb-ink"}`}
      value={value}
      disabled={disabled}
      aria-label={c.title}
      placeholder={c.titlePlaceholder}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => {
        setEditing(true);
        if (value === UNTITLED) setValue("");
      }}
      onBlur={(e) => {
        setEditing(false);
        void save(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValue(held.current);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** The `…` beside the title: the ways this card leaves the board. Rewriting a channel
 *  lives in the strip beside Publish — the strip is the discoverable door, and two of them
 *  onto one run is one too many.
 *
 *  Discard (#507) is the one for a topic that should never have been opened, so it leads: it
 *  is the answer to a blank page, and nothing else on the board removes one. Archive and
 *  Reject are what a topic that was worked on leaves by, and both start a run. */
function PageMenu({
  onDiscard,
  onArchive,
  onReject,
  disabled,
}: {
  onDiscard?: () => void;
  onArchive?: () => void;
  onReject?: () => void;
  disabled: boolean;
}) {
  const t = useCopy();
  const c = t.card.marketing;
  if (!onDiscard && !onArchive && !onReject) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={c.more}
          aria-label={c.more}
          className="grid size-7 cursor-pointer place-items-center rounded-[8px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]"
        >
          <FiMoreHorizontal className="text-[17px]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[192px]">
        {onDiscard && (
          <DropdownMenuItem className="gap-2" disabled={disabled} onSelect={onDiscard}>
            <FiTrash2 className="text-[13px]" aria-hidden />
            {c.discard.action}
          </DropdownMenuItem>
        )}
        {onArchive && (
          <DropdownMenuItem className="gap-2" disabled={disabled} onSelect={onArchive}>
            <FiArchive className="text-[13px]" aria-hidden />
            {t.card.toolbar.archive}
          </DropdownMenuItem>
        )}
        {onReject && (
          <DropdownMenuItem
            className="gap-2"
            disabled={disabled}
            style={{ color: "var(--color-nb-accent-deep)" }}
            onSelect={onReject}
          >
            <FiXCircle className="text-[13px]" aria-hidden />
            {t.card.toolbar.reject}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The repurpose panel (#457) — the source tab's one AI move, and what a single channel's
 * Rewrite opens too.
 *
 * It IS the ask: nothing has started while it is open, so it says what is about to happen
 * before it happens — which channels get a draft for the first time, and which written ones
 * are replaced, whose edits are the only copy of them there is. Pressing Repurpose is the
 * answer, and it starts one run per channel, side by side.
 *
 * The note and the language belong to this one repurpose. Both start unset: the note is
 * carried into every run this action starts and remembered nowhere, and an unset language
 * leaves each channel writing in its own.
 *
 * It holds Tab while it is open and gives the focus back to whatever opened it, so the
 * keyboard does not walk out of a panel that is still asking something (#479).
 */
function RepurposePanel({
  channels,
  written,
  busy,
  onClose,
  onStart,
}: {
  channels: string[];
  /** Which of them already have a draft — the ones this replaces. */
  written: string[];
  busy: boolean;
  onClose: () => void;
  onStart: (ask: RepurposeAsk) => void;
}) {
  const t = useCopy();
  const c = t.card.marketing.repurpose;
  const [note, setNote] = useState("");
  const [language, setLanguage] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const note_ = useRef<HTMLTextAreaElement>(null);
  // Read while this renders, not in an effect: the focus has moved by the time one runs.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  const fresh = channels.filter((name) => !written.includes(name));
  const names = (list: string[]) => list.map(channelLabel).join(c.separator);
  const start = () => onStart({ note: note.trim() || undefined, language: language || undefined });
  // One channel names itself, and says whether this is its first draft or its next one —
  // the picker opens this panel too, on a channel nothing has been written for yet (#478).
  const title =
    channels.length > 1
      ? c.titleAll
      : written.length
        ? c.titleOne(channelLabel(channels[0]!))
        : c.titleNew(channelLabel(channels[0]!));

  // The note takes the focus, and keeps trying for a few frames: the picker's own menu
  // restores focus to its trigger as it closes, which happens after this has mounted.
  useEffect(() => {
    let left = 24;
    let frame = 0;
    const take = () => {
      if (note_.current && !panel.current?.contains(document.activeElement)) note_.current.focus();
      if (--left > 0) frame = requestAnimationFrame(take);
    };
    frame = requestAnimationFrame(take);
    return () => cancelAnimationFrame(frame);
  }, []);

  // The control that opened it gets the focus back — Escape, Cancel and a finished
  // repurpose all leave the same way.
  useEffect(() => () => opener?.focus?.(), [opener]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const box = panel.current;
      // A dropdown inside the panel portals its menu out, and its keys are its own.
      if (!box || !box.contains(document.activeElement)) return;
      const stops = box.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) return;
      // Tab is the panel's own: it is asking something, and walking out of it leaves the
      // question behind with no way back to it.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={title}
      className="nb-panel-sm absolute right-3 top-[9px] z-20 w-[min(356px,calc(100%-24px))] bg-nb-paper p-3.5"
    >
      <p className="text-[13px] font-[700] leading-[1.45] text-nb-ink">{title}</p>
      {fresh.length > 0 && (
        <p className="mt-1 text-[12px] leading-[1.6] text-nb-ink-soft">{c.willWrite(names(fresh), fresh.length)}</p>
      )}
      <textarea
        ref={note_}
        rows={2}
        value={note}
        placeholder={c.notePlaceholder}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2.5 w-full resize-none rounded-[8px] bg-nb-wash px-2.5 py-2 text-[12.5px] leading-[1.6] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
      />
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[12px] font-[700] text-nb-ink">{c.language}</span>
        <span className="ml-auto">
          <LanguagePick value={language} onPick={setLanguage} />
        </span>
      </div>
      {written.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-[8px] bg-nb-peach-soft px-2.5 py-2 text-[11.5px] leading-[1.55] text-nb-peach-ink">
          <FiAlertCircle className="mt-[2px] shrink-0 text-[13px]" aria-hidden />
          {c.willReplace(names(written), written.length)}
        </p>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="xs" disabled={busy} onClick={onClose}>
          {t.shared.cancel}
        </Button>
        <Button size="xs" disabled={busy} onClick={start}>
          {busy ? c.starting : c.start}
        </Button>
      </div>
    </div>
  );
}

/** Which language this one repurpose is written in. The empty value is the channel's own,
 *  and is what the panel opens on. */
function LanguagePick({ value, onPick }: { value: string; onPick: (value: string) => void }) {
  const c = useCopy().card.marketing.repurpose;
  const label = REPURPOSE_LANGUAGES.find((l) => l.value === value)?.label ?? c.followChannel;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-[26px] cursor-pointer items-center gap-1 rounded-[8px] border border-nb-ink/20 bg-nb-wash pl-2 pr-1.5 text-[12px] font-[600] text-nb-ink"
        >
          <FiGlobe className="text-[12px] text-nb-ink-soft" aria-hidden />
          {label}
          <FiChevronDown className="text-[12px] text-nb-ink-soft" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[168px]">
        <DropdownMenuItem onSelect={() => onPick("")}>{c.followChannel}</DropdownMenuItem>
        {REPURPOSE_LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.value} onSelect={() => onPick(l.value)}>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Discarding a topic (#507) — the one confirm on this page that starts no run. It asks
 *  because the card is gone for good, and it says what stays: the drafts under `content/`
 *  outlive the topic exactly as they do an archive. */
function DiscardDialog({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const c = useCopy().card.marketing.discard;
  return (
    <Dialog title={c.title} onClose={onClose}>
      <p className="text-[13px] leading-relaxed text-nb-ink-soft">{c.blurb}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-nb-ink-soft">{c.keepsDrafts}</p>
      <DialogButtons onClose={onClose} onConfirm={onConfirm} confirmLabel={c.confirm} disabled={busy} />
    </Dialog>
  );
}

/** The URL a published piece went up at. Publish refuses without one, so every published
 *  channel has something for `memory/published.md` to key on. */
function PublishDialog({
  channel,
  url,
  busy,
  onClose,
  onConfirm,
}: {
  channel: string;
  url: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
}) {
  const c = useCopy().card.marketing;
  const [value, setValue] = useState(url);
  return (
    <Dialog title={c.publishTitle(channelLabel(channel))} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">{c.publishIntro}</p>
      <input
        className="w-full rounded-[10px] border border-nb-ink/25 bg-nb-paper px-3 py-2.5 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
        value={value}
        autoFocus
        placeholder={c.publishUrlPlaceholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim() && !busy) onConfirm(value.trim());
        }}
      />
      <DialogButtons
        onClose={onClose}
        onConfirm={() => onConfirm(value.trim())}
        confirmLabel={c.publishConfirm}
        disabled={busy || !value.trim()}
      />
    </Dialog>
  );
}
