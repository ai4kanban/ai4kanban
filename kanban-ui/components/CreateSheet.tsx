"use client";

// The screen Create task opens (#426) — a sheet over the board, in the shape a fresh agent
// chat opens in: a centred headline, a one-line slogan, the message box under them, and a
// row saying what sending does.
//
// It replaces the BOARD, not the window: it is drawn on the body's own paper, so the top row
// and the rail stay where they are and the reader keeps their place. It is an action, not a
// place — Esc or the ✕ hands the board back, rather than becoming a tab the header would
// have to carry at every width.
//
// Three modes share the one box. **Discuss** (#427) is the board's own conversation
// (`akb chat`, lib/chat-rail.ts) — the same transcript, agent and model as the chat rail on
// the board, so a reply typed here and one typed there are one exchange. It is the BOARD's
// conversation on a card's page too: Create task is a new task, not this card. It is what
// the screen opens on: a vague idea does not survive one textarea. **Add task** starts today's create run and
// leaves. **Build now** (#428) sends the sentence straight to a build with no card at all —
// it skips every step the board exists for, so it names them in a guard off Send and starts
// nothing until that is confirmed.
//
// What Discuss adds beside the conversation is the plan the agent is writing
// (`docs/kanban/plans/<id>-<slug>.md`, lib/plan-panel.ts): a panel down the right, dragged
// wider or narrower, covering the conversation on a window too narrow for both. Once the
// outcome is settled the agent offers to start planning, and pressing it closes the screen
// and starts the run that writes the cards.
//
// The box is the chat rail's own (components/composer.tsx), so Enter sends and Shift-Enter
// starts a line here exactly as it does there. What the rail keeps is the rail's: the walk
// back through what it has sent, its Stop, and the Esc that ends a reply — here Esc closes
// the sheet and leaves the discussion, and any reply still being written, where they are.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCopy, FiCheck, FiFileText, FiMessageSquare, FiPlus, FiX, FiZap } from "react-icons/fi";
import { noteDiscussAnswerAction } from "@/app/actions";
import { useBodySlot } from "@/lib/body-slot";
import { useCopy } from "@/i18n/use-copy";
import { useDraft } from "@/lib/draft";
import { useOverRail } from "@/lib/over-rail";
import { PLAN_MAX, PLAN_MIN, PLAN_W, usePlanPanel, type PlanPanel } from "@/lib/plan-panel";
import { useChatRail, type ChatRail } from "@/lib/chat-rail";
import { Button } from "./button";
import { Transcript, Pick, useChatRailHere } from "./Chat";
import { HAIRLINE } from "./chrome";
import { MessageBox } from "./composer";
import { ConfirmationPopover } from "./confirm-popover";
import { Copied, useCopyText } from "./copy";
import { Markdown } from "./Markdown";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";

/** How wide the conversation reads, whatever the window is. The plan takes the room to the
 *  right of it, so widening the panel moves the column rather than squeezing it. */
const COLUMN = "w-full max-w-[600px]";

/** The library's panels are `overflow: auto`; both of these scroll inside themselves. */
const PANE_CLIP = { overflow: "hidden" } as const;

/** What sending does. `discuss` talks it through first (#427); `card` writes one and refines
 *  it; `build` writes none (#428). */
export type CreateMode = "discuss" | "card" | "build";

interface Props {
  /** The version the board is showing (#104), which a card written here ships in. */
  release: string | null;
  /** Which board this is — what the board's conversation is read against when the window
   *  is not already holding it. */
  projectRoot: string;
  onClose: () => void;
  /** Start the run, and say whether it started. Never called in Discuss — that mode sends to
   *  the conversation. A refusal — uncommitted changes, another build already working in this
   *  checkout, a workspace out of reach — leaves the sheet up with the sentence still in the
   *  box, so it can be sent again once the reason is fixed. */
  onSend: (description: string, mode: CreateMode) => Promise<{ ok: boolean; error?: string }>;
  /** Start planning: close and start the run that writes the plan's cards. */
  onPlan: () => void;
}

// Discuss is the BOARD's conversation, whatever page Create task was pressed on (#427). On
// the board the window is already holding that one, so the sheet takes it — reading here is
// then what clears the top row's mark. A card page's rail holds that CARD's conversation
// instead, which is not what this screen is for, so there the sheet reads the board's own
// for as long as it is up.
export function CreateSheet(props: Props) {
  const here = useChatRailHere();
  if (here && here.cardId === null) return <Sheet {...props} rail={here} />;
  return <SheetOnBoardChat {...props} />;
}

function SheetOnBoardChat(props: Props) {
  const rail = useChatRail({ projectRoot: props.projectRoot, cardId: null });
  return <Sheet {...props} rail={rail} />;
}

function Sheet({
  release,
  onClose,
  onSend,
  onPlan,
  rail,
}: Props & { rail: ChatRail }) {
  const c = useCopy().board.create.sheet;
  const startFailed = useCopy().board.create.startFailed;
  const close = useCopy().shared.close;
  const plan = usePlanPanel();
  // The same draft key the dialog used, so text typed and not sent is kept the way it
  // always was — and a draft written before this screen existed is still here. One box for
  // every mode: switching what sending does never takes away what has been typed.
  const [text, setText, clearDraft] = useDraft("create");
  const [mounted, setMounted] = useState(false);
  // Discuss is what a vague idea wants, so it is what the screen opens on. Build now never
  // is: a build with no card is the deliberate one.
  const [mode, setMode] = useState<CreateMode>("discuss");
  const [guarding, setGuarding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendRef = useRef<HTMLSpanElement>(null);
  // The window's body, when there is one — the sheet fills that rather than the viewport.
  const body = useBodySlot();
  useEffect(() => setMounted(true), []);

  // While the sheet is up it is the layer Esc answers, and the rail is not (#267). The
  // guard takes it back off the sheet while it is open, so Esc dismisses the guard first.
  useOverRail();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guarding) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, guarding]);

  const read = rail.read;
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

  // This conversation is on screen here, so a reply read here must not leave the top row's
  // Chat button marked (#427).
  const markRead = rail.markRead;
  const at = read?.chat?.updatedAt;
  useEffect(() => {
    if (discussing && at !== undefined) markRead();
  }, [discussing, at, markRead]);

  if (!mounted) return null;

  const messages = read?.chat?.messages ?? [];
  // A discussion with something in it is drawn as a conversation; one with nothing said is
  // still the empty screen the headline sits on.
  const talking = discussing && (messages.length > 0 || rail.live !== null || rail.stopped !== null);

  const send = async (picked: CreateMode) => {
    const words = text.trim();
    if (!words || sending || waiting) return;
    setGuarding(false);
    setError(null);
    if (picked === "discuss") {
      if (!discussing) return;
      clearDraft();
      rail.say(words, true);
      plan.refresh();
      return;
    }
    setSending(true);
    const res = await onSend(words, picked);
    setSending(false);
    // Only a run that actually started takes the sentence with it. A refusal keeps the
    // sheet and the words exactly as they were, and says why under the box.
    if (res.ok) clearDraft();
    else setError(res.error ?? startFailed);
  };

  // Send in Build now opens the guard rather than starting anything. Switching to another
  // mode closes it: the guard belongs to the mode, not to the press.
  const pressSend = () => {
    if (!text.trim() || waiting) return;
    if (mode === "build") setGuarding(true);
    else void send(mode);
  };

  const pick = (picked: CreateMode) => {
    setMode(picked);
    setGuarding(false);
    setError(null);
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
      release={release}
      text={text}
      onText={setText}
      onSend={pressSend}
      sendRef={sendRef}
      guarding={guarding}
      onGuardDismiss={() => setGuarding(false)}
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
      <div className="flex shrink-0 items-center justify-end gap-1.5 p-2">
        {/* Narrow only. There the plan is a cover, so one pill puts it up and takes it away
            again — the job the top row's Chat button does for the rail. */}
        {plan.shown && plan.overlay && (
          <button
            type="button"
            onClick={plan.toggleCover}
            aria-pressed={plan.covering}
            className="inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-[700]"
            style={
              plan.covering
                ? { background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }
                : { color: "var(--color-nb-ink-soft)" }
            }
          >
            <FiFileText size={13} aria-hidden />
            {c.plan.label}
          </button>
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
        <div className="min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" onLayoutChanged={plan.onLayoutChanged}>
            <ResizablePanel id="discuss" style={PANE_CLIP}>
              <div className="flex h-full min-h-0 flex-col">
                {/* The cover lies over the exchange and stops at the box: this screen is a
                    conversation being answered, and reading the plan is what you do in order
                    to reply. */}
                <div className="relative flex min-h-0 flex-1 justify-center">
                  <div className={`flex min-h-0 flex-col ${COLUMN}`}>
                    <Transcript
                      messages={messages}
                      changes={read?.chat?.modelChanges}
                      live={rail.live}
                      liveSince={read?.liveSince ?? null}
                      stopped={rail.stopped}
                      canSend={!!read && !read.blocked && !rail.answering}
                      onResend={rail.say}
                      onReword={rail.reword}
                      empty={null}
                      after={<Handoff plan={plan} rail={rail} onPlan={onPlan} />}
                      fromFoot
                    />
                  </div>
                  {plan.covering && (
                    <div
                      className="absolute inset-y-0 right-0 w-[min(440px,100%)] bg-nb-cream"
                      style={{ borderLeft: "1.5px solid var(--color-nb-ink)" }}
                    >
                      <PlanPane plan={plan} fade />
                    </div>
                  )}
                </div>
                {/* The box keeps its place and its full width under the cover: this screen
                    is a conversation being answered, and a cover that took the box away
                    would make you put the plan down to say anything. */}
                <div className="flex shrink-0 justify-center px-5 pb-6 pt-3">
                  <div className={COLUMN}>{composer}</div>
                </div>
              </div>
            </ResizablePanel>
            {plan.shown && !plan.overlay && (
              <>
                <ResizableHandle aria-label={c.plan.resize} onDoubleClick={plan.onDoubleClick} />
                <ResizablePanel
                  id="plan"
                  panelRef={plan.panel}
                  defaultSize={PLAN_W}
                  minSize={PLAN_MIN}
                  maxSize={PLAN_MAX}
                  groupResizeBehavior="preserve-pixel-size"
                  style={PANE_CLIP}
                >
                  <PlanPane plan={plan} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      ) : (
        // Centred, then lifted by the foot padding: optically centred sits a little above
        // the middle, and the box is what the eye should land on.
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-10 max-md:pb-14">
          <div className={`flex flex-col items-center ${COLUMN}`}>
            <h1 className="text-center text-[27px] font-[800] leading-[1.2] tracking-[-0.025em] max-md:text-[21px]">
              {c.headline}
            </h1>
            <p className="mt-2 text-center text-[13.5px] text-nb-ink-soft max-md:text-[12.5px]">
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
  release,
  text,
  onText,
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
  release: string | null;
  text: string;
  onText(value: string): void;
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
  const pick = read?.pick ?? null;

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
        canSend={!!text.trim() && !answering && !waiting && !sending}
        autoFocus
        placeholder={rail ? c.answer : c.placeholder}
        label={rail ? c.answer : c.placeholder}
        sendLabel={c.send}
        sendRef={sendRef}
        stop={ours ? { label: chat.stop, onStop: () => void rail?.stop() } : undefined}
        // The guard hangs off Send — this app's one way to ask "are you sure?". It
        // lists what Build now skips rather than arguing for it.
        guard={
          <ConfirmationPopover
            open={guarding}
            anchorRef={sendRef}
            align="right"
            title={c.guard.title}
            description={
              <span className="flex flex-col gap-1">
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
            {rail && pick && (
              <span className="ml-auto flex min-w-0 items-center gap-1.5">
                <Pick rail={rail} pick={pick} answering={answering} />
              </span>
            )}
          </>
        }
        hint={
          // The keys on the left and, opposite them, what this mode leaves behind: that the
          // conversation is still answering, the release a new card ships in, or — in Build
          // now — that there is no card at all. A board on no release says nothing there
          // rather than saying so.
          <span className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start max-md:gap-0.5">
            <span className="truncate">{rail ? c.keysDiscuss : c.keys}</span>
            {rail ? (
              answering && <span className="shrink-0">{chat.sendingWaits}</span>
            ) : mode === "build" ? (
              <span className="shrink-0 text-nb-peach-ink">{c.builds}</span>
            ) : (
              release && <span className="shrink-0">{c.shipsIn(release)}</span>
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
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 text-[12px] font-[700] uppercase leading-none tracking-[0.02em] transition-colors ${
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

/** The handoff (#427), under the agent's own last message: the two answers while the ask
 *  stands, and while the run is writing the cards, the one line that says so.
 *
 *  No banner and no card of its own — the ask is a paragraph the agent wrote, and these are
 *  the ways of answering it. The box below is never taken away. */
function Handoff({ plan, rail, onPlan }: { plan: PlanPanel; rail: ChatRail; onPlan(): void }) {
  const c = useCopy().board.create.sheet.plan;
  const read = plan.read;
  if (!read?.plan) return null;
  if (read.run?.running) {
    return (
      <p className="px-2.5 pt-2 text-[12px] text-nb-ink-soft">{c.planning}</p>
    );
  }
  // The ask the agent made, or the offer again after a run that never wrote its cards.
  const failed = !!read.run && !read.run.running;
  if (!read.ask && !failed) return null;
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-2.5 pt-3">
      <Button
        size="xs"
        onClick={() => {
          // Pressing it is saying it: the answer goes into the transcript with no turn
          // behind it, because the board is what acts on it.
          void noteDiscussAnswerAction(c.start);
          onPlan();
        }}
      >
        {c.start}
      </Button>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => {
          rail.say(c.notYet, true);
          plan.refresh();
        }}
      >
        {c.notYet}
      </Button>
      <span className="text-[11.5px] text-nb-ink-soft">{failed ? c.tryAgain : c.startHint}</span>
    </div>
  );
}

/** The plan, down the right of the sheet: the file the discussion is writing, as markdown on
 *  the board's own cream.
 *
 *  A rewrite never blanks it, greys it or spins — the caption says the file is moving, and
 *  every word under it is the last thing written. */
function PlanPane({ plan, fade = false }: { plan: PlanPanel; fade?: boolean }) {
  const c = useCopy().board.create.sheet.plan;
  const read = plan.read;
  const lines = plan.text.trim() ? plan.text.trimEnd().split("\n").length : 0;
  return (
    <section aria-label={c.label} className="flex h-full flex-col bg-nb-cream">
      <div className="shrink-0 px-5 pb-3 pt-5">
        <div className="flex items-center">
          <span className="text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft">
            {c.label}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {plan.writing ? (
              <>
                <span aria-hidden className="size-[7px] rounded-full bg-nb-accent" />
                <span className="text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-accent-deep">
                  {c.rewriting}
                </span>
              </>
            ) : (
              <span className="text-[11.5px] text-nb-ink-soft">{c.lines(lines)}</span>
            )}
          </span>
        </div>
        {/* The only way out of the app: the path, copied. The board never opens a plan. */}
        {read?.plan && <PlanPath path={read.plan.path} />}
      </div>
      <div className="h-px shrink-0" style={{ background: HAIRLINE }} />
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto px-5 py-5">
          <Markdown body={plan.text} />
        </div>
        {/* The plan runs past the cover's foot, so the last line fades rather than being
            sliced — the file is longer than the room, not damaged. */}
        {fade && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
            style={{ background: "linear-gradient(rgba(247,247,244,0), var(--color-nb-cream))" }}
          />
        )}
      </div>
    </section>
  );
}

/** The file's path, copyable. Truncated from the LEFT — the folder is the same for every
 *  plan and the file's own name is what tells them apart. */
function PlanPath({ path }: { path: string }) {
  const c = useCopy().board.create.sheet.plan;
  const { copied, copy } = useCopyText();
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
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
