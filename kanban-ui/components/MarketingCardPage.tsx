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
// The editor edits the FILE — `content/<id>-<slug>/<tab>.md`, byte for byte, which is what
// lets an agent and a person write the same draft. Saving is on idle with no button, and
// what is unsaved is written back to its own tab's file before the strip moves or the page
// goes.
//
// The strip is `channels:` and nothing else (#478): "Repurpose to…" adds a channel, writes
// its first draft and lands on its tab in one press, and a tab's cross takes that channel
// back off. No hidden-tab state either way — a closed channel leaves its draft file behind,
// so reopening it is indistinguishable from choosing it for the first time.
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
  FiSend,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import type { OverTypeInstance } from "overtype";
import { useCopy } from "@/i18n/use-copy";
import { useActions, type DraftPassage, type RepurposeAsk } from "@/lib/screen";
import type { Card, CardDrafts, CardScreen, DraftComment, SessionView } from "@/lib/types";
import {
  ActionDialog,
  DialogButtons,
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
import { runningCardIds, useAgentSessions, useOnTabFocus, type StartedSession } from "./sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/** The draft every channel is repurposed from. The board's own file name, not copy. */
const SOURCE = "source";

const NOTHING: CardDrafts = { dir: "", drafts: [] };

/** How long typing has to stop before the draft is written back. Long enough that a pause
 *  mid-sentence is not a save, short enough that walking away leaves the file written. */
const SAVE_AFTER_MS = 800;

/** The rule under the title row — the quietest line the app parts panes with. */
const PART = { borderBottom: `1px solid ${HAIRLINE}` } as const;

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
  // Which run is in flight matters to the comment list alone: every run locks the editor,
  // but only a polish is working through a batch — and only the one on the tab being read
  // is working through the batch on screen (#458).
  const polishingDraft = sessions.find(
    (r) => r.status === "running" && r.cardId === card.id && r.action === "polish",
  )?.draft;

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

  const chrome: CardChrome = { screen, running, onBoardChanged, onError: setError };
  const Shell = shell ?? Bare;
  const Strip = strips;

  return (
    <OpenIdsProvider ids={openIds}>
      <Shell {...chrome}>
        {/* One screen, never scrolled as a whole: the editor is what scrolls, so the title
            and the strip stay where they were put. */}
        <div className="flex h-full min-h-0 flex-col bg-nb-paper">
          {Strip && <Strip {...chrome} at="head" />}
          <Draft
            card={card}
            boardHref={boardHref}
            busy={running.has(card.id)}
            polishingDraft={polishingDraft}
            reload={runsSettled}
            error={error}
            onError={setError}
            onKick={kick}
            onDraft={() => void runAgent({ action: "implement", id: card.id }, "implement")}
            onArchive={() => setDialog({ kind: "archive", card })}
            onReject={() => setDialog({ kind: "reject", card })}
          />
        </div>
      </Shell>

      {dialog && <ActionDialog dialog={dialog} onClose={() => setDialog(null)} onRun={runAgent} />}
    </OpenIdsProvider>
  );
}

// ---- the page itself -------------------------------------------------------

function Draft({
  card,
  boardHref,
  busy,
  polishingDraft,
  reload,
  error,
  onError,
  onKick,
  onDraft,
  onArchive,
  onReject,
}: {
  card: Card;
  boardHref: string;
  /** A run on this card is live — the editor is not the user's while one is. */
  busy: boolean;
  /** The draft a polish is running over, when one is (#458) — the batch on screen only when
   *  it is the tab being read. */
  polishingDraft?: string;
  /** Bumped whenever a run on this card finishes, which is when the draft is re-read. */
  reload: number;
  error: string | null;
  onError: (why: string | null) => void;
  onKick: () => void;
  onDraft: () => void;
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
  const locked = busy || answering;

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

  /** Write what is pending, if anything. Answers whether the file now holds it. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const held = pending.current;
    const run = actionsRef.current;
    if (!held || !run) return true;
    setSaving(true);
    const res = await run.saveDraft(card.id, held.tab, held.text);
    setSaving(false);
    if (res.error) {
      onError(res.error);
      return false;
    }
    // Only what was written is let go: a keystroke that landed during the save is still
    // unsaved, and the next idle writes it.
    if (pending.current === held) {
      pending.current = null;
      setDirty(false);
    }
    setRead(res);
    return true;
  }, [card.id, onError]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Leaving the page is the last chance to write what is typed. Nothing can be awaited in a
  // cleanup, so this is a best effort — the idle save is what usually got there first.
  useEffect(() => () => void flushRef.current(), []);

  // ---- the editor ----------------------------------------------------------

  const host = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<OverTypeInstance | null>(null);
  // Read inside OverType's own onChange, which is installed once and never sees a later
  // render's values.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  // True while the page is putting the file's own words into the editor. OverType answers a
  // `setValue` with an `onChange`, and taking that for typing would mark a freshly read
  // draft unsaved and then hold every later re-read off.
  const adopting = useRef(false);

  const typed = useCallback((value: string) => {
    if (adopting.current) return;
    pending.current = { tab: tabRef.current, text: value };
    setDirty(true);
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), SAVE_AFTER_MS);
  }, []);
  const typedRef = useRef(typed);
  typedRef.current = typed;

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
        onChange: (value) => typedRef.current(value),
        onRender: () => repaintRef.current(),
      })[0]!;
      setEditor(made);
    })();
    return () => {
      killed = true;
      made?.destroy();
      setEditor(null);
    };
  }, []);

  // Read-only while an agent is writing this card, and on a page handed no actions — where
  // a save could never land anyway.
  useEffect(() => {
    if (editor) editor.textarea.readOnly = locked || !actions;
  }, [editor, locked, actions]);

  // Take up what was read, unless the editor is holding words this would throw away. The tab
  // changing always takes it up: the strip only moves once the last tab's words are on disk,
  // so there is never anything of the old draft to carry into the new one.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!editor) return;
    const disk = read.drafts.find((d) => d.name === tab)?.text ?? "";
    if (shown.current === tab && pending.current) return;
    shown.current = tab;
    pending.current = null;
    setDirty(false);
    if (editor.getValue() !== disk) {
      adopting.current = true;
      editor.setValue(disk);
      adopting.current = false;
    }
    setText(disk);
  }, [read, tab, editor]);

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

  /** Move the strip, once what is typed is on disk. A write that refused keeps the tab it
   *  belongs to on screen: the words are still in the editor, and only there. */
  const goTab = async (next: string) => {
    if (next === tab) return;
    if (!(await flush())) return;
    onError(null);
    setAsking(null);
    setTab(next);
  };

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
    // save landing after one would put the words back over what the agent wrote.
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
  const pickChannel = async (name: string) => {
    // The strip is about to move, so this tab's words go to disk first — the same rule
    // clicking a tab follows.
    if (!(await flush())) return;
    if (!isWritten(name)) return setAsking([name]);
    setAsking(null);
    setMoving(true);
    await add([name]);
    setMoving(false);
  };

  /** Close a channel tab: the channel comes off the card, and `content/…/<name>.md` stays
   *  where it is. Reopening it from the picker is what brings that draft back. */
  const closeChannel = async (name: string) => {
    if (!actions) return;
    if (!(await flush())) return;
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
  };

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
  const submitComments = async () => {
    if (!actions || !comments.length) return;
    // What is typed goes to disk first: the run is about to write this same file, and a
    // save landing after it would put the words back over what the polish wrote.
    if (!(await flush())) return;
    setMoving(true);
    const res = await actions.polishDraft(card.id, tab);
    setMoving(false);
    if (!res.ok) return onError(res.error ?? c.comment.failed);
    onError(null);
    onKick();
  };

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
          <h1 className="min-w-0 truncate text-[19px] font-[800] tracking-[-0.02em]">{card.title}</h1>
          {/* Where this topic has got to: how far it is published, or — while an agent is
              inside it — that it is being rewritten. Never both. */}
          {locked ? (
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-[700]"
              style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
            >
              <span className={PULSE_DOT} aria-hidden />
              {c.rewriting}
            </span>
          ) : published > 0 ? (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-[700]"
              style={{ background: "var(--color-nb-mint-soft)", color: "var(--color-nb-mint-ink)" }}
            >
              <FiCheck className="text-[11px]" aria-hidden />
              {c.publishedCount(published, channels.length)}
            </span>
          ) : null}
          <span className="relative ml-auto flex shrink-0 items-center">
            <PageMenu
              onArchive={actions ? onArchive : undefined}
              onReject={actions ? onReject : undefined}
              disabled={locked || moving}
            />
          </span>
        </div>

        {/* The strip: `source`, one tab per chosen channel — each with the cross that takes
            it back off — the picker that chooses one more, and this tab's own actions at the
            right end. */}
        <div className="flex items-end gap-1 px-3">
          <Tab label={SOURCE} mono on={tab === SOURCE} onClick={() => void goTab(SOURCE)} />
          {channels.map((ch) => (
            <Tab
              key={ch.name}
              label={channelLabel(ch.name)}
              on={tab === ch.name}
              onClick={() => void goTab(ch.name)}
              mark={<ChannelMark name={ch.name} status={ch.status} size={13} />}
              dot={<ChannelDot status={ch.status} size={6} />}
              closeLabel={c.closeChannel(channelLabel(ch.name))}
              closeDisabled={locked || moving}
              onClose={canSetChannels ? () => void closeChannel(ch.name) : undefined}
            />
          ))}
          {canRepurposeTo && (
            <span className="mb-[3px]">
              <RepurposeTo
                names={unchosen}
                written={unchosen.filter(isWritten)}
                disabled={locked || moving}
                onPick={(n) => void pickChannel(n)}
              />
            </span>
          )}
          {/* The source tab's one AI move: repurpose into every chosen channel at once. It
              needs a source to read and a channel to write, so it is drawn only where both
              are there, and it names those channels — the picker beside it says "Repurpose
              to…" as well. */}
          {tab === SOURCE && written && channels.length > 0 && actions && (
            <span className="mb-[2px] ml-auto shrink-0">
              <Button
                size="xs"
                disabled={locked || moving}
                onClick={() => setAsking(channels.map((ch) => ch.name))}
              >
                <FiRepeat className="text-[12px]" aria-hidden />
                {c.repurpose.action(channels.map((ch) => channelLabel(ch.name)).join(c.repurpose.separator))}
              </Button>
            </span>
          )}
          {/* The open channel's own two: writing it again over what is there, and recording
              where it went up. Both need a draft to work on. */}
          {channel && written && (
            <span className="mb-[2px] ml-auto flex shrink-0 items-center gap-2">
              {actions && (
                <Button variant="ghost" size="xs" disabled={locked || moving} onClick={() => setAsking([channel.name])}>
                  <FiRepeat className="text-[12px]" aria-hidden />
                  {c.rewrite}
                </Button>
              )}
              <Button size="xs" disabled={!actions || moving} onClick={() => setPublishing(true)}>
                <FiSend className="text-[12px]" aria-hidden />
                {c.publish}
              </Button>
            </span>
          )}
        </div>
      </div>

      {/* A refusal the page itself was given — a publish, a rewrite, a channel the board
          would not add. None of them is a conversation, so each is said here. */}
      {error && (
        <div className="shrink-0 bg-nb-peach-soft px-4 py-2 text-[12.5px] text-nb-peach-ink" style={PART}>
          {error}
        </div>
      )}

      {/* Rules older than the drafts moves can neither read a draft nor write one, so the
          page says why rather than drawing an empty editor — which would read as a topic
          nobody has written for yet. */}
      {read.error ? (
        <div className="px-4 py-4 text-[12.5px] text-nb-ink-soft">{read.error}</div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* OverType mounts INTO this element, so nothing React draws may live inside it. */}
          <div ref={host} className={`h-full ${locked ? "opacity-70" : ""}`} />

          {/* An agent is writing this draft. The editor is read-only behind this line; what
              the agent is doing, and anything that goes wrong, is in the rail. */}
          {locked && (
            <div
              className="pointer-events-none absolute left-8 right-8 top-[10px] h-[3px] overflow-hidden rounded-full"
              style={{ background: "var(--color-nb-accent-soft)" }}
            >
              <div
                className="h-full w-[38%] rounded-full animate-[nbPulse_1.4s_ease-in-out_infinite]"
                style={{ background: "var(--color-nb-accent)" }}
              />
            </div>
          )}

          {/* Nothing written for this tab yet: the one thing to do with it, in the middle of
              the page. It goes the moment there are words — typing straight into the editor
              is always the other way. */}
          {loaded && editor && !written && !locked && actions && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 pb-16">
              <Button
                className="pointer-events-auto"
                disabled={moving}
                onClick={channel ? () => setAsking([channel.name]) : onDraft}
              >
                {channel ? c.rewriteFromSource : c.draft}
              </Button>
              <span className="text-[12.5px] text-nb-ink-soft">{c.orJustWrite}</span>
            </div>
          )}

          {/* Which file this is, and whether it is on disk. */}
          <span className="pointer-events-none absolute bottom-3 right-5 font-mono text-[11px] text-nb-ink-soft/75">
            {path} · {saving ? t.shared.saving : dirty ? c.unsaved : c.saved}
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
          onEdit={(commentId, words) => void editComment(commentId, words)}
          onDrop={(commentId) => void dropComment(commentId)}
          onSubmit={() => void submitComments()}
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

/** One tab: the channel's mark, its name, how far it has got, and the cross that takes it
 *  back off the card. `source` carries none of the four — it is what every channel is
 *  written from, not a destination, and nothing is left if it goes. */
function Tab({
  label,
  on,
  mono = false,
  mark,
  dot,
  onClick,
  onClose,
  closeLabel,
  closeDisabled,
}: {
  label: string;
  on: boolean;
  mono?: boolean;
  mark?: React.ReactNode;
  dot?: React.ReactNode;
  onClick: () => void;
  /** Unset on a tab that cannot be closed, which draws no cross at all. */
  onClose?: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
}) {
  return (
    <span
      className={`relative flex h-[30px] items-center rounded-t-[8px] transition-colors${
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
        aria-pressed={on}
        onClick={onClick}
        className={`flex h-full cursor-pointer items-center gap-1.5 pl-2.5 text-[12px] font-[700]${
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

/** "Repurpose to…" at the right of the strip (#478): the channels this topic has not chosen.
 *  It stands where the `+` used to and says what the press does, because adding a channel
 *  and writing its first draft are one move now — there is no empty tab in between.
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
  onPick: (name: string) => void;
}) {
  const c = useCopy().card.marketing;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-[24px] cursor-pointer items-center gap-1.5 rounded-[8px] bg-nb-accent-soft px-2 text-[12px] font-[700] text-nb-accent-deep transition-colors enabled:hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiRepeat className="text-[12px]" aria-hidden />
          {c.repurposeTo}
          <FiChevronDown className="text-[12px]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[212px]">
        {names.map((name) => (
          <DropdownMenuItem key={name} className="gap-2" onSelect={() => onPick(name)}>
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

/** The `…` beside the title: the two ways this card leaves the board. Rewriting a channel
 *  lives in the strip beside Publish — the strip is the discoverable door, and two of them
 *  onto one run is one too many. */
function PageMenu({
  onArchive,
  onReject,
  disabled,
}: {
  onArchive?: () => void;
  onReject?: () => void;
  disabled: boolean;
}) {
  const t = useCopy();
  const c = t.card.marketing;
  if (!onArchive && !onReject) return null;
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={title}
      className="nb-panel-sm absolute right-3 top-[9px] z-20 w-[min(356px,calc(100%-24px))] bg-nb-paper p-3.5"
    >
      <p className="text-[13px] font-[700] leading-[1.45] text-nb-ink">{title}</p>
      {fresh.length > 0 && (
        <p className="mt-1 text-[12px] leading-[1.6] text-nb-ink-soft">{c.willWrite(names(fresh), fresh.length)}</p>
      )}
      <textarea
        autoFocus
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
