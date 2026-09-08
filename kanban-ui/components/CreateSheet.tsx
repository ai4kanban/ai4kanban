"use client";

// Create task holds ONE discussion (#496) — the one the press opened, or the one a rail row
// picked back up — and keeps its draft across modes.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiChevronDown,
  FiCopy,
  FiCheck,
  FiFileText,
  FiMaximize2,
  FiMessageSquare,
  FiMinimize2,
  FiPlus,
  FiX,
  FiZap,
} from "react-icons/fi";
import { createRuntimePicksAction, noteDiscussAnswerAction } from "@/app/actions";
import { useBodySlot } from "@/lib/body-slot";
import { useCopy } from "@/i18n/use-copy";
import { useDraft } from "@/lib/draft";
import { useOverRail } from "@/lib/over-rail";
import { useSwipeBack } from "@/lib/swipe-back";
import { PLAN_INSET, PLAN_READ, usePlanPanel, type PlanPanel } from "@/lib/plan-panel";
import { useChatRail, type ChatRail } from "@/lib/chat-rail";
import { useCreatePictures, type CreatePictures } from "@/lib/picture-box";
import type { DiscussionTarget, RunPick } from "@/lib/types";
import { Button } from "./button";
import { Transcript, Pasted, Pick } from "./Chat";
import { HAIRLINE } from "./chrome";
import { MessageBox } from "./composer";
import { ConfirmationPopover } from "./confirm-popover";
import { AgentMark } from "./Configuration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Copied, useCopyText } from "./copy";
import { Markdown } from "./Markdown";

/** How wide the conversation reads, whatever the window is. Standing the plan beside it
 *  narrows the room the column is centred in, so the transcript and the box below it move
 *  together and the screen keeps one centre line. */
const COLUMN_MAX = "max-w-[600px]";
/** The card's own padding — the paper the plan's words stand on inside it. */
const PLAN_PAD = 28;
const COLUMN = `w-full ${COLUMN_MAX}`;

/** What the conversation keeps off the sheet's edges, so a narrow window never runs the
 *  words into the frame. The transcript's own scroller already holds half of it
 *  (components/Chat.tsx), so its wrapper adds the other half and the two land on one edge. */
const GUTTER = "px-5";
const GUTTER_HALF = "px-2.5";

/** What sending does. `discuss` talks it through first (#427); `card` writes one and refines
 *  it; `build` writes one and builds it straight away, refining nothing (#470). */
export type CreateMode = "discuss" | "card" | "build";

interface Props {
  /** The version the board is showing (#104), which a card written here ships in. */
  release: string | null;
  /** Which board this is — what this discussion's conversation is read against. */
  projectRoot: string;
  /** The discussion this screen is holding (#496): a fresh one on every Create task press,
   *  or the one a rail row picked back up. Null on a board whose rules are older than the
   *  list, which still holds its one conversation. */
  discussion: DiscussionTarget | null;
  onClose: () => void;
  /** Start the run, and say whether it started. Never called in Discuss — that mode sends to
   *  the conversation. A refusal — uncommitted changes, another build already working in this
   *  checkout, a workspace out of reach — leaves the sheet up with the sentence still in the
   *  box, so it can be sent again once the reason is fixed.
   *
   *  `pictures` is what was pasted into the box (#517): the folder they were written to and
   *  their names in the order they went in. The run takes that folder as its own. */
  onSend: (
    description: string,
    mode: CreateMode,
    pictures: { box: string; shots: string[] },
    /** The runtime picked for this one run (#518), or undefined for the agent's own. */
    runtime?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Start planning: close and start the run that writes the plan's cards. */
  onPlan: () => void;
  /** Build now off the plan (#481): close and start the run that writes one card from it and
   *  builds it. The guard has already been answered. */
  onBuildPlan: () => void;
}

// Discuss is one DISCUSSION's conversation (#427, #496), never the window's rail: the rail
// holds the board's own or a card's, and this screen is neither. So the sheet opens its own
// on whichever discussion it was given, and a reply to another one goes on arriving behind
// it — the server owns every reply, so nothing is cut off by the screen it is not on.
export function CreateSheet(props: Props) {
  const rail = useChatRail({ projectRoot: props.projectRoot, cardId: props.discussion });
  return <Sheet {...props} rail={rail} />;
}

function Sheet({
  release,
  discussion,
  onClose,
  onSend,
  onPlan,
  onBuildPlan,
  rail,
}: Props & { rail: ChatRail }) {
  const c = useCopy().board.create.sheet;
  const startFailed = useCopy().board.create.startFailed;
  const close = useCopy().shared.close;
  const plan = usePlanPanel(discussion);
  // The same draft key the dialog used, so text typed and not sent is kept the way it
  // always was — and a draft written before this screen existed is still here. One box for
  // every mode: switching what sending does never takes away what has been typed.
  const [text, setText, clearDraft] = useDraft("create");
  const [headlineStopped, setHeadlineStopped] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Discuss is what a vague idea wants, so it is what the screen opens on. Build now never
  // is: a build nothing plans or reviews is the deliberate one.
  const [mode, setMode] = useState<CreateMode>("discuss");
  // Whether the Build now guard is open. Esc answers it before it answers the screen.
  const [guard, setGuard] = useState(false);
  // What the two run modes would spawn on (#518), read once when the sheet opens: Add task's
  // own agent's runtime and Build now's, and the list either can be pointed at instead. Null
  // while it is still coming, and on rules with no picker behind them.
  const [picks, setPicks] = useState<{ card: RunPick; build: RunPick } | null>(null);
  // The runtime this send goes on, or null for the mode's own agent's. It is this sheet's
  // and this mode's: switching mode clears it, and the sheet is unmounted when it closes, so
  // the next one opens back on the agent's own.
  const [runtime, setRuntime] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void createRuntimePicksAction()
      .then((read) => live && setPicks(read))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  // What this mode's send would go on, and the row picked out of it — null while the read is
  // still coming, and null again the moment the mode's own runtime is the answer.
  const runPick = mode === "build" ? (picks?.build ?? null) : (picks?.card ?? null);
  const pickedRow = runtime ? (runPick?.runtimes.find((r) => r.id === runtime) ?? null) : null;
  // The pictures Add task and Build now were pasted into (#517). One box across both modes,
  // so switching what sending does never loses what was pasted; Discuss keeps its own with
  // the conversation. What may go in it is the picked runtime's answer when there is one
  // (#518) — the CLI that row runs is the one the run hands them to.
  const pictures = useCreatePictures(mode, pickedRow);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendRef = useRef<HTMLSpanElement>(null);
  // The window's body, when there is one — the sheet fills that rather than the viewport.
  const body = useBodySlot();
  useEffect(() => setMounted(true), []);

  // While the sheet is up it is the layer Esc answers, and the rail is not (#267). The
  // guard takes it back off the sheet while it is open, so Esc dismisses the guard first —
  // and an enlarged plan is a layer of its own the same way, put down before the screen is.
  useOverRail();
  const full = plan.full;
  const toggleFull = plan.toggleFull;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || guard) return;
      if (full) toggleFull();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, guard, full, toggleFull]);

  // The swipe back leaves the same two layers in the same order (#526): the enlarged plan
  // first, then the screen. What has been typed is kept either way — the box's draft
  // outlives the screen (useDraft) and the conversation is on disk — and nothing is sent.
  useSwipeBack(true, () => (full ? toggleFull() : onClose()));

  const read = rail.read;
  // Send again and an edited message go the way the box's own words do: as discussion.
  const say = rail.say;
  const sayInDiscussion = useCallback(
    (words: string, images?: string[]) => say(words, { discuss: true, images }),
    [say],
  );
  // Nothing on this board can hold a conversation at all — no agent that can, or rules older
  // than Discuss. It is not offered then, and never opened on: a mode nothing can answer is
  // worse than no mode.
  const canDiscuss = plan.supported && read?.canChat !== false;
  // "Cannot" is only an answer once BOTH reads have landed. Either one arriving alone says
  // nothing yet, and demoting the screen on it would put every board on Add task for the
  // beat the other read takes — and leave it there.
  const settled = !!read && !!plan.read;
  useEffect(() => {
    if (settled && !canDiscuss) setMode((was) => (was === "discuss" ? "card" : was));
  }, [settled, canDiscuss]);
  const discussing = mode === "discuss" && canDiscuss;
  // Discuss is lit before either read has landed, so until they have, sending would quietly
  // start an Add task run under it. The box waits out that beat instead.
  const waiting = mode === "discuss" && !settled;

  if (!mounted) return null;

  const messages = read?.chat?.messages ?? [];
  // A discussion with something in it is drawn as a conversation; one with nothing said is
  // still the empty screen the headline sits on.
  const talking = discussing && (messages.length > 0 || rail.live !== null || rail.stopped !== null);
  // Where the card goes: beside the conversation where the sheet has room for both, over it
  // where it has not — and enlarged, over it at any width, taking the sheet.
  const beside = plan.open && plan.beside && !plan.full;
  const over = plan.open && !beside;
  // A discussion message is what is typed OR what was pasted (#441) — pictures on their own
  // are a message. A run still needs a sentence: the pictures are the conversation's.
  const pasted = discussing ? rail.pasted.length : 0;

  const send = async (picked: CreateMode) => {
    const words = text.trim();
    if (sending || waiting) return;
    if (!words && !(picked === "discuss" && pasted > 0)) return;
    setGuard(false);
    setError(null);
    if (picked === "discuss") {
      if (!discussing) return;
      clearDraft();
      // The rail's own send, so the pictures waiting in the box go with these words and a
      // refusal puts them back — only the draft is this screen's own.
      void rail.send({ text: words, discuss: true });
      plan.refresh();
      return;
    }
    if (pictures.refused) return;
    setSending(true);
    // The box is the run's from here, so the sheet closing behind a started run leaves its
    // pictures where the run can read them.
    pictures.handOver();
    const res = await onSend(
      words,
      picked,
      { box: pictures.box, shots: pictures.pasted },
      runtime ?? undefined,
    );
    setSending(false);
    // Only a run that actually started takes the sentence with it. A refusal keeps the
    // sheet and the words exactly as they were — pictures included — and says why under
    // the box.
    if (res.ok) {
      clearDraft();
      pictures.sent();
    } else {
      pictures.takeBack();
      setError(res.error ?? startFailed);
    }
  };

  // Send in Build now opens the guard rather than starting anything. Switching to another
  // mode closes it: the guard belongs to the mode, not to the press.
  const pressSend = () => {
    if (waiting) return;
    if (!text.trim() && pasted === 0) return;
    // The mode picked cannot see what is in the box; the box says so and nothing starts.
    if (mode !== "discuss" && pictures.refused) return;
    if (mode === "build") setGuard(true);
    else void send(mode);
  };

  const pick = (picked: CreateMode) => {
    setMode(picked);
    setGuard(false);
    setError(null);
    // Each mode opens on its own agent's runtime (#518), so the pick does not follow the
    // switch: what the planner runs is not an answer about what the builder runs.
    setRuntime(null);
  };

  const composer = (
    <Composer
      mode={mode}
      onPick={pick}
      canDiscuss={canDiscuss}
      discussBlocked={read?.canChat === false ? read.blocked : undefined}
      waiting={waiting}
      sending={sending}
      rail={discussing ? rail : null}
      pictures={pictures}
      pick={discussing ? null : runPick}
      runtime={runtime}
      onRuntime={setRuntime}
      release={release}
      text={text}
      onText={(value) => {
        setHeadlineStopped(true);
        setText(value);
        // The hand has moved on, so the last paste stops explaining itself — the rail's own
        // box does this from the keystroke too (lib/chat-rail.ts).
        rail.clearPasteNote();
        pictures.clearNote();
      }}
      talking={talking}
      onSend={pressSend}
      sendRef={sendRef}
      guarding={guard}
      onGuardDismiss={() => setGuard(false)}
      onGuardConfirm={() => void send("build")}
      error={error}
    />
  );

  return createPortal(
    // No `data-a4k-overlay` here, unlike a dialog: nothing of the window's chrome is
    // covered, so the traffic lights, the drag strip and the rail all still answer.
    <div
      ref={plan.measure}
      className={`${body ? "absolute" : "fixed"} inset-0 z-20 flex flex-col bg-nb-paper`}
    >
      {/* The app's own press-down button, not quiet text. It arrives mid-discussion on a
          screen that is otherwise all conversation, and a chip a shade off paper is one
          nobody finds: the plan the agent has just written is the thing to read next. */}
      <div className="flex shrink-0 items-center justify-end gap-2 p-2">
        {/* Whether the card is up, which is the screen's own business. Its size is not —
            that is the card's, and lives on the card (PlanCard). Lit while it is up, the way
            a mode chip is: this is a toggle, and a toggle has to say which way it is. */}
        {plan.shown && (
          <Button
            variant="ghost"
            size="xs"
            onClick={plan.toggle}
            aria-pressed={plan.open}
            style={
              plan.open
                ? {
                    background: "var(--color-nb-accent-soft)",
                    color: "var(--color-nb-accent-deep)",
                    borderColor: "var(--color-nb-accent-deep)",
                  }
                : undefined
            }
          >
            <FiFileText size={13} aria-hidden />
            {c.plan.label}
          </Button>
        )}
        <button
          onClick={onClose}
          aria-label={close}
          className="grid size-7 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90 active:bg-nb-ink/10 max-md:size-11"
        >
          <FiX className="h-[18px] w-[18px] max-md:h-5 max-md:w-5" />
        </button>
      </div>

      {talking ? (
        <div className="relative min-h-0 flex-1">
          {/* Beside the card the conversation gives up the room the card stands in — the
              transcript and the box both, so the two keep the one centre line they had
              before it arrived. Over it they keep the whole sheet and the card lies on top. */}
          <div
            className="flex h-full min-h-0 flex-col"
            style={beside ? { paddingRight: plan.space } : undefined}
          >
            <div className={`relative flex min-h-0 flex-1 justify-center ${GUTTER_HALF}`}>
              <div className={`flex min-h-0 flex-col ${COLUMN}`}>
                <Transcript
                  messages={messages}
                  changes={read?.chat?.modelChanges}
                  live={rail.live}
                  liveSince={read?.liveSince ?? null}
                  stopped={rail.stopped}
                  canSend={!!read && !read.blocked && !rail.answering}
                  onResend={sayInDiscussion}
                  // The same conversation the rail draws, so a message pasted into on one
                  // screen reads the same on the other (#441).
                  imageSrc={rail.imageSrc}
                  empty={null}
                  after={
                    <Handoff
                      plan={plan}
                      rail={rail}
                      discussion={discussion}
                      onPlan={onPlan}
                      onBuild={onBuildPlan}
                    />
                  }
                />
              </div>
              {/* Over the exchange, the card stops at the box — enlarged too: this screen is
                  a conversation being answered, and a card that took the box away would make
                  you put the plan down to say anything. */}
              {over && <PlanCard plan={plan} />}
            </div>
            <div className={`flex shrink-0 justify-center pb-6 pt-7 ${GUTTER}`}>
              <div className={COLUMN}>{composer}</div>
            </div>
          </div>
          {/* Beside it, the card runs the height of the screen and its foot sits on the
              box's own — one baseline across the bottom of the sheet. */}
          {beside && <PlanCard plan={plan} tall />}
        </div>
      ) : (
        // Centred, then lifted by the foot padding: optically centred sits a little above
        // the middle, and the box is what the eye should land on.
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-10 max-md:pb-14">
          <div className={`flex flex-col items-center ${COLUMN}`}>
            <CreateHeadline
              key={c.headlines[0]}
              phrases={c.headlines}
              paused={headlineStopped || text.length > 0}
            />
            <p className="mt-2 text-balance text-center text-[13.5px] text-nb-ink-soft max-md:text-[12.5px]">
              {c.slogan}
            </p>
            <div className="mt-6 w-full max-md:mt-5">{composer}</div>
          </div>
        </div>
      )}
    </div>,
    body ?? document.body,
  );
}

function CreateHeadline({ phrases, paused }: { phrases: readonly string[]; paused: boolean }) {
  const [frame, setFrame] = useState({ index: 0, length: phrases[0].length, deleting: false });
  const [reducedMotion, setReducedMotion] = useState(true);
  const phrase = phrases[frame.index];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const complete = frame.length === phrase.length && !frame.deleting;
    const timer = window.setTimeout(() => {
      if (complete) setFrame({ ...frame, deleting: true });
      else if (frame.deleting && frame.length === 0) {
        setFrame({ index: (frame.index + 1) % phrases.length, length: 0, deleting: false });
      } else {
        setFrame({ ...frame, length: frame.length + (frame.deleting ? -1 : 1) });
      }
    }, complete ? 3200 : frame.deleting ? 35 : 85);
    return () => window.clearTimeout(timer);
  }, [frame, paused, reducedMotion, phrase, phrases.length]);

  return (
    <h1 className="grid w-full text-center text-[27px] font-[800] leading-[1.2] tracking-[-0.025em] max-md:text-[21px]">
      <span className="sr-only">{phrases[0]}</span>
      {/* Reserve the tallest phrase at every viewport width. */}
      {phrases.map((text) => (
        <span key={text} aria-hidden className="invisible col-start-1 row-start-1 px-2">{text}</span>
      ))}
      <span aria-hidden className="col-start-1 row-start-1 self-center px-2">
        {paused || reducedMotion ? phrase : phrase.slice(0, frame.length)}
        {!paused && !reducedMotion && (
          <span className="ml-0.5 inline-block h-[0.9em] w-[2px] animate-[nbCaret_1s_step-end_infinite] bg-nb-ink align-[-0.05em] motion-reduce:animate-none" />
        )}
      </span>
    </h1>
  );
}

/** The box, and the row under it that says what sending does. One box in every mode — what
 *  changes is the mode that is lit, what the corner button does with the words, and the one
 *  line of hint. */
function Composer({
  mode,
  onPick,
  canDiscuss,
  discussBlocked,
  waiting,
  sending,
  rail,
  pictures,
  pick,
  runtime,
  onRuntime,
  release,
  text,
  onText,
  talking,
  onSend,
  sendRef,
  guarding,
  onGuardDismiss,
  onGuardConfirm,
  error,
}: {
  mode: CreateMode;
  onPick(mode: CreateMode): void;
  canDiscuss: boolean;
  /** Why Discuss cannot answer, in the board's own words — the chat rail's sentence. */
  discussBlocked?: string;
  /** Discuss is lit but what it does is not known yet — the reads are still landing. */
  waiting: boolean;
  /** A create or a build is starting; the corner button stays down until it says whether. */
  sending: boolean;
  /** The conversation, while Discuss is the mode and can answer. Null in the other modes. */
  rail: ChatRail | null;
  /** The pictures Add task and Build now were pasted into (#517) — the other two modes'
   *  own box, which Discuss never reaches. */
  pictures: CreatePictures;
  /** What this run mode would spawn on and what it could spawn instead (#518). Null in
   *  Discuss, whose own picker is the conversation's, and while the read is still coming. */
  pick: RunPick | null;
  /** The runtime picked for this send, or null for the mode's own agent's. */
  runtime: string | null;
  onRuntime(runtime: string | null): void;
  release: string | null;
  text: string;
  onText(value: string): void;
  talking: boolean;
  onSend(): void;
  sendRef: React.RefObject<HTMLSpanElement | null>;
  guarding: boolean;
  onGuardDismiss(): void;
  onGuardConfirm(): void;
  /** A start that was refused, in the board's words. */
  error: string | null;
}) {
  const c = useCopy().board.create.sheet;
  const chat = useCopy().chat;
  const read = rail?.read ?? null;
  const answering = rail?.answering === true;
  // The reply coming is this server's, so the corner button can end it. A reply a terminal
  // is writing is followed just the same and ended in that terminal.
  const ours = rail?.live != null;
  const trouble = rail ? (rail.error ?? read?.failed ?? read?.blocked) : undefined;
  const chatPick = read?.pick ?? null;
  // The pictures pasted in and not yet sent (#441) — only Discuss has any.
  const pasted = rail?.pasted.length ?? 0;

  return (
    <>
      {trouble && (
        <p
          className="mb-1.5 rounded-[8px] px-2.5 py-2 text-[12px] leading-snug"
          style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
        >
          {trouble}
        </p>
      )}
      <MessageBox
        value={text}
        onChange={onText}
        onSend={onSend}
        // Pictures on their own are a message in Discuss (#441); a run still wants words
        // (#517), and a run that cannot see what is in the box does not start at all.
        canSend={
          (!!text.trim() || pasted > 0) && !answering && !waiting && !sending && !pictures.refused
        }
        autoFocus
        // Discuss is this screen's chat, so its box takes a pasted picture the way the
        // rail's does. Add task and Build now take one into a box of their own (#517), which
        // becomes the folder the run they start reads it from.
        onPasteImages={
          rail
            ? (files) => void rail.paste(files)
            : pictures.offered
              ? (files) => void pictures.paste(files)
              : undefined
        }
        // Dropping one in is the same path, so it is on wherever the paste is (#511).
        drop={
          rail
            ? { onFiles: (files) => void rail.dropFiles(files), hint: chat.dropRelease }
            : pictures.offered
              ? { onFiles: (files) => void pictures.dropFiles(files), hint: chat.dropRelease }
              : undefined
        }
        head={<Pasted box={rail ? rail.pictures : pictures} />}
        placeholder={talking ? c.answer : c.placeholder}
        label={talking ? c.answer : c.placeholder}
        sendLabel={c.send}
        sendRef={sendRef}
        stop={ours ? { label: chat.stop, onStop: () => void rail?.stop() } : undefined}
        // The guard hangs off Send — this app's one way to ask "are you sure?". It leads
        // with the card the run writes (#470), then lists what the mode still skips.
        guard={
          <ConfirmationPopover
            open={guarding}
            anchorRef={sendRef}
            align="right"
            title={c.guard.title}
            description={
              <span className="flex flex-col gap-1">
                {/* What it does, in a line of its own — the two below are what it skips. */}
                <span>{c.guard.writes}</span>
                {c.guard.skips.map((line) => (
                  <span key={line} className="flex items-start gap-1.5">
                    <FiX className="mt-[3px] shrink-0 text-[11px] text-nb-peach-ink" aria-hidden />
                    <span>{line}</span>
                  </span>
                ))}
              </span>
            }
            cancelLabel={c.guard.cancel}
            confirmLabel={c.guard.confirm}
            // Confirming closes the guard and leaves the box's own Send disabled
            // while the run starts, so there is nothing here to sit busy.
            busy={false}
            onDismiss={onGuardDismiss}
            onConfirm={onGuardConfirm}
          />
        }
        // The foot row, read left to right as two answers to two different questions: what
        // sending does, and — in Discuss — who answers it. So they sit at opposite ends,
        // the modes at the box's own left margin and the agent hard against Send, rather
        // than running together into one line of controls with a hole after it.
        foot={
          <>
            {/* One segmented control with one answer, on a track of its own: three bare
                labels beside a filled one read as a pill and two stray links. */}
            <span
              role="radiogroup"
              aria-label={c.modes}
              className="flex shrink-0 items-center gap-[3px] rounded-[9px] p-[3px]"
              style={{ background: TRACK }}
            >
              <Mode
                on={mode === "discuss"}
                icon={<FiMessageSquare className="text-[12px]" aria-hidden />}
                label={c.discuss}
                disabled={!canDiscuss}
                title={canDiscuss ? undefined : discussBlocked}
                onPick={() => onPick("discuss")}
              />
              <Mode
                on={mode === "card"}
                icon={<FiPlus className="text-[12px]" aria-hidden />}
                label={c.addTask}
                onPick={() => onPick("card")}
              />
              <Mode
                on={mode === "build"}
                icon={<FiZap className="text-[12px]" aria-hidden />}
                label={c.buildNow}
                onPick={() => onPick("build")}
              />
            </span>
            {/* Opposite the modes, hard against Send: what the run will go on. In Discuss it
                is the conversation's own agent (components/Chat.tsx); in the two run modes
                it is the runtime this send spawns (#518). Never both — one slot, one answer
                to "what answers this". */}
            {rail && chatPick ? (
              <span className="ml-auto flex min-w-0 items-center gap-1.5">
                <Pick rail={rail} pick={chatPick} answering={answering} />
              </span>
            ) : (
              pick && (
                <span className="ml-auto flex min-w-0 items-center gap-1.5">
                  <RuntimePick pick={pick} runtime={runtime} onPick={onRuntime} />
                </span>
              )
            )}
          </>
        }
        hint={
          // The keys on the left and, opposite them, what this mode leaves behind: that the
          // conversation is still answering, and the release the card it writes ships in —
          // Build now writes one too (#470), with the one warning that survives beside it. A
          // board on no release says nothing there rather than saying so.
          <span className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start max-md:gap-0.5">
            <span className="truncate">{rail ? c.keysDiscuss : c.keys}</span>
            {rail ? (
              answering && <span className="shrink-0">{chat.sendingWaits}</span>
            ) : (
              <span className="shrink-0">
                {release && c.shipsIn(release)}
                {release && mode === "build" && <span className="opacity-45"> · </span>}
                {mode === "build" && <span className="text-nb-peach-ink">{c.builds}</span>}
              </span>
            )}
          </span>
        }
      />
      {/* A start that was refused, said where the press was rather than behind the
          sheet. The sentence is still in the box above it. */}
      {error && (
        <p className="nb-panel-sm mt-2.5 bg-nb-peach-soft p-2.5 text-[12px] leading-relaxed text-nb-peach-ink">
          {error}
        </p>
      )}
    </>
  );
}

/** What the mode row sits on. A step of ink rather than the wash fill: the wash is a shade
 *  off paper, and a track you have to look for does not group the three chips on it. */
const TRACK = "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)";

// One chip in the mode row. The picked one is filled and the rest are quiet text: the row
// has to read as one control with one answer, not as a line of buttons. A mode nothing on
// this board can answer is shown down, and says why.
function Mode({
  on,
  icon,
  label,
  disabled,
  title,
  onPick,
}: {
  on: boolean;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  title?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={onPick}
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 text-[12px] font-[700] leading-none transition-colors ${
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
      } ${
        on
          ? "bg-nb-accent-soft text-nb-accent-deep"
          : "text-nb-ink-soft hover:text-nb-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** What this run will spawn on (#518), on the box's own bottom row: one runtime, as its
 *  CLI's mark and a caret — the same control Discuss draws for the conversation, in the same
 *  place, so the foot row always answers "what runs this" in one spot.
 *
 *  It is the run's alone. Nothing in Configuration → Agents moves, and the pick is forgotten
 *  the moment the sheet closes — every sheet opens back on the flow's own agent's runtime.
 *
 *  Everything offered comes from the board: every runtime it holds, in its own order, each
 *  carrying the model it runs. A row whose CLI is not installed is marked and still offered
 *  — nothing is probed, and the run's own refusal is what says a binary is missing. */
function RuntimePick({
  pick,
  runtime,
  onPick,
}: {
  pick: RunPick;
  /** The row picked for this send, or null for the agent's own. */
  runtime: string | null;
  onPick(runtime: string | null): void;
}) {
  const c = useCopy().board.create.sheet.runtime;
  const [open, setOpen] = useState(false);
  const on = runtime ?? pick.runtime;
  const running = pick.runtimes.find((r) => r.id === on);
  const label = running?.name ?? on;

  return (
    <span className="flex h-[28px] min-w-0 items-center overflow-hidden rounded-[8px]">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={c.hint(label)}
            aria-label={c.label}
            className="inline-flex h-full shrink-0 cursor-pointer items-center gap-1.5 pl-2 pr-1.5 hover:brightness-[0.97]"
            style={{ background: RUNTIME_FILL }}
          >
            <AgentMark src={running?.icon ?? ""} size={16} name={label} />
            <span className="max-w-[128px] truncate text-[12px] text-nb-ink">{label}</span>
            <FiChevronDown size={12} className="text-nb-ink-soft" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-[230px]">
          {pick.runtimes.map((row) => (
            <DropdownMenuItem
              key={row.id}
              className="gap-2"
              // The agent's own row is picked by following the agent again rather than by
              // pinning the same id, so the send carries a runtime only when one was chosen.
              onSelect={() => onPick(row.id === pick.runtime ? null : row.id)}
            >
              <AgentMark src={row.icon} size={15} />
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="shrink-0 truncate text-[10.5px] font-[400] text-nb-ink-soft">
                {!row.installed ? c.notInstalled : row.id === pick.runtime ? c.agentsOwn : row.model}
              </span>
              <span className="w-[13px] shrink-0">
                {row.id === on && <FiCheck size={12} className="text-nb-accent" aria-hidden />}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <p className="px-2.5 py-1 text-[10.5px] leading-[1.4] text-nb-ink-soft">{c.cost}</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/** The one control's fill, a shade off the box's paper — the same wash the conversation's
 *  own picker stands on (components/Chat.tsx). */
const RUNTIME_FILL = "var(--color-nb-accent-wash)";

/** The handoff (#427, #481), under the agent's own last message: the three answers whenever
 *  there is a plan and the reply is in, and while the run one of them started is going, the
 *  one line that says so.
 *
 *  Nothing has to offer them. A plan on screen and a finished turn is the whole condition —
 *  the agent never announces the handoff, so it can never forget to. They go while a reply is
 *  being written, because the plan under them is the one being rewritten.
 *
 *  No banner and no card of its own — these are the ways of acting on the plan beside them.
 *  The box below is never taken away.
 *
 *  Three answers, three weights. Start planning is the one to press: the filled button. Build
 *  now acts too, so it carries the accent in its frame and its ink but no fill — one thing
 *  cannot have two equally loud buttons. Not yet is the plain paper ghost; it does nothing. */
function Handoff({
  plan,
  rail,
  discussion,
  onPlan,
  onBuild,
}: {
  plan: PlanPanel;
  rail: ChatRail;
  /** Which discussion the answer is written into (#496). */
  discussion: string | null;
  onPlan(): void;
  onBuild(): void;
}) {
  const c = useCopy().board.create.sheet.plan;
  // Which "are you sure?" Build now opened, if any — the same one Send hangs off in the
  // sheet's own Build now (#470), anchored to the answer that was pressed.
  const [guard, setGuard] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const read = plan.read;
  if (!read?.plan) return null;
  if (read.run?.running) {
    return <Working label={read.run.answer === "build" ? c.building : c.planning} />;
  }
  // A file that has been written at least once — a plan named a second ago has nothing in it
  // to act on. And not under a reply being written, nor under a message nobody has answered
  // yet: the answers stand under the agent's own last word.
  if (!plan.shown) return null;
  if (rail.answering || rail.live !== null) return null;
  if (rail.read?.chat?.messages.at(-1)?.role !== "agent") return null;
  // A run that wrote no card leaves the plan to be answered again, and says so.
  const failed = !!read.run && !read.run.running;
  const hint = failed ? (read.run?.answer === "build" ? c.buildAgain : c.tryAgain) : c.startHint;
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-2.5 pt-3">
      <Button
        size="xs"
        onClick={() => {
          // Pressing it is saying it: the answer goes into the transcript with no turn
          // behind it, because the board is what acts on it.
          void noteDiscussAnswerAction(c.start, discussion);
          onPlan();
        }}
      >
        {c.start}
      </Button>
      {/* The panel hangs off this, so it lives inside — the way the Send guard's does. */}
      <span ref={anchor} className="relative flex">
        <Button
          size="xs"
          variant="ghost"
          className="font-[700]"
          aria-expanded={guard}
          style={{
            borderColor: "var(--color-nb-accent-deep)",
            color: "var(--color-nb-accent-deep)",
          }}
          onClick={() => setGuard((was) => !was)}
        >
          {c.build}
        </Button>
        <BuildGuard
          open={guard}
          anchorRef={anchor}
          onDismiss={() => setGuard(false)}
          onConfirm={() => {
            setGuard(false);
            void noteDiscussAnswerAction(c.build, discussion);
            onBuild();
          }}
        />
      </span>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => {
          rail.say(c.notYet, { discuss: true });
          plan.refresh();
        }}
      >
        {c.notYet}
      </Button>
      <span className="text-[11.5px] text-nb-ink-soft">{hint}</span>
    </div>
  );
}

/** The run one answer started, in the line the three answers stood on. The dot is what finds
 *  it: this line sits against the reply's own small grey text, and accent moving is what says
 *  "working" everywhere else in the app. */
function Working({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1.5 px-2.5 pt-2 text-[12px] text-nb-ink-soft">
      <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-nb-accent" />
      {label}
    </p>
  );
}

/** The guard Build now opens, wherever it is pressed — the sheet's own words (#470), because
 *  this is the sheet's own Build now: one behavior, one guard. The plan those words are about
 *  is on screen beside it. */
function BuildGuard({
  open,
  anchorRef,
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  onDismiss(): void;
  onConfirm(): void;
}) {
  const c = useCopy().board.create.sheet.guard;
  return (
    <ConfirmationPopover
      open={open}
      anchorRef={anchorRef}
      align="left"
      title={c.title}
      description={
        <span className="flex flex-col gap-1">
          <span>{c.writes}</span>
          {c.skips.map((line) => (
            <span key={line} className="flex items-start gap-1.5">
              <FiX className="mt-[3px] shrink-0 text-[11px] text-nb-peach-ink" aria-hidden />
              <span>{line}</span>
            </span>
          ))}
        </span>
      }
      cancelLabel={c.cancel}
      confirmLabel={c.confirm}
      busy={false}
      onDismiss={onDismiss}
      onConfirm={onConfirm}
    />
  );
}

/** The plan, as a card on the sheet's paper: the file the discussion is writing, in markdown
 *  on the board's own cream.
 *
 *  A card, not a panel: inset on the paper with a surface of its own, rather than run to the
 *  sheet's edges the way the window draws a rail — because the plan is not a second place
 *  beside the conversation, it is what this conversation has made. No outer border: the cream
 *  off the paper is edge enough, and a ruled box around a document is a frame nobody asked
 *  for. No close of its own either: the pill in the top row is what puts it away.
 *
 *  Two sizes. Standing BESIDE the conversation it is a column on the right; ENLARGED it steps
 *  into the middle of the screen as a page, at the width a plan reads at and no wider — the
 *  frame is the measure, because a border with a column of words floating inside it is a tray,
 *  not a page. Centred there it covers the conversation whole, so nothing is left half-read.
 *  On a sheet with no room to stand beside, the card lies over the exchange at the
 *  conversation's own column.
 *
 *  What the card says about itself sits at its foot — the path, and whether the file is
 *  moving. Its SIZE is not that: it floats in the top corner, under the pointer only.
 *
 *  A rewrite never blanks it, greys it or spins: the foot says the file is moving, and every
 *  word above is the last thing written. */
function PlanCard({ plan, tall = false }: { plan: PlanPanel; tall?: boolean }) {
  const c = useCopy().board.create.sheet.plan;
  const read = plan.read;
  const full = plan.full;
  const { box, more } = usePlanScroll(plan.text, full, tall);
  return (
    <section
      aria-label={c.label}
      className={`group absolute top-0 z-10 mx-auto flex flex-col overflow-hidden rounded-[14px] bg-nb-cream ${
        tall ? "bottom-6" : "bottom-0"
      } ${!tall && !full ? COLUMN_MAX : ""}`}
      style={
        tall
          ? { right: PLAN_INSET, width: plan.width }
          : full
            ? {
                left: 0,
                right: 0,
                width: PLAN_READ + PLAN_PAD * 2,
                maxWidth: `calc(100% - ${PLAN_INSET * 2}px)`,
              }
            : { left: PLAN_INSET, right: PLAN_INSET }
      }
    >
      {/* The card's size, in the card's own corner, and only under the pointer: a document
          reading a plan should be a document until you reach for it. Only where the two sizes
          differ — on a sheet too narrow to stand the card beside the conversation it is at its
          column already, and an Enlarge that changes nothing is a button that lies. Faded
          rather than unmounted, so it is still there to tab to. */}
      {plan.beside && (
        <button
          type="button"
          onClick={plan.toggleFull}
          title={full ? c.shrink : c.enlarge}
          aria-label={full ? c.shrink : c.enlarge}
          className="absolute right-3 top-3 z-10 grid size-9 cursor-pointer place-items-center rounded-[9px] bg-nb-cream/90 text-nb-ink-soft opacity-0 backdrop-blur-[2px] transition-[opacity,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink focus-visible:opacity-100 group-hover:opacity-100"
          style={{ border: `1px solid ${HAIRLINE}` }}
        >
          {full ? <FiMinimize2 size={17} aria-hidden /> : <FiMaximize2 size={17} aria-hidden />}
        </button>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={box}
          onScroll={more.check}
          className="h-full overflow-y-auto"
          style={{ padding: PLAN_PAD }}
        >
          <Markdown body={plan.text} />
        </div>
        {/* Only while the plan runs past the card's foot, so the last line fades rather than
            being sliced — and the real last line is never left under a veil. */}
        {more.on && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
            style={{ background: "linear-gradient(rgba(247,247,244,0), var(--color-nb-cream))" }}
          />
        )}
      </div>
      {/* The foot, and all the card says about itself. No head: the pill in the top row
          already names it, and the plan's own title is the next line down. */}
      <div className="shrink-0" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center gap-2 py-2" style={{ paddingInline: PLAN_PAD }}>
          {/* The only way out of the app: the path, copied. The board never opens a plan. */}
          {read?.plan && <PlanPath path={read.plan.path} />}
          {plan.writing && (
            <span className="flex shrink-0 items-center gap-1.5">
              <span aria-hidden className="size-[7px] rounded-full bg-nb-accent" />
              <span className="text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-accent-deep">
                {c.rewriting}
              </span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/** Whether the plan runs past the foot of the card — what the fade is drawn for. Re-measured
 *  on scroll and whenever the words or the card's size change, so a plan that fits shows no
 *  veil over its own last line. */
function usePlanScroll(text: string, full: boolean, tall: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const check = useCallback(() => {
    const el = box.current;
    if (el) setOn(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
  }, []);
  useEffect(check, [check, text, full, tall]);
  return { box, more: { on, check } };
}

/** The file's path, copyable. Truncated from the LEFT — the folder is the same for every
 *  plan and the file's own name is what tells them apart. */
function PlanPath({ path }: { path: string }) {
  const c = useCopy().board.create.sheet.plan;
  const { copied, copy } = useCopyText();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <span
        title={path}
        className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-nb-ink-soft"
        style={{ direction: "rtl", textAlign: "left" }}
      >
        {path}
      </span>
      <button
        type="button"
        onClick={() => copy(path)}
        title={c.copyPath}
        aria-label={c.copyPath}
        className="grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink"
      >
        {copied ? <FiCheck size={12} aria-hidden /> : <FiCopy size={12} aria-hidden />}
      </button>
      <Copied on={copied} />
    </div>
  );
}
