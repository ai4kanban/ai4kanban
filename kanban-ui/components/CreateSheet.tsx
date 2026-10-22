"use client";

// Create task holds ONE discussion (#496) — the one the press opened, or the one a rail row
// picked back up. Sending always discusses (#840); the plan's answers are what start a run.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown, FiCopy, FiFileText, FiMaximize2, FiMinimize2, FiX } from "react-icons/fi";
import { useBodySlot } from "@/lib/body-slot";
import { LESS_MOTION, useLeaving, useMatches } from "@/lib/media";
import { useCopy } from "@/i18n/use-copy";
import { adoptSharedCreateDraft, createDraftKey, useDraft } from "@/lib/draft";
import { useOverRail } from "@/lib/over-rail";
import { useSwipeBack } from "@/lib/swipe-back";
import { PLAN_INSET, PLAN_READ, plansOf, usePlanPanel, type PlanPanel } from "@/lib/plan-panel";
import { useChatRail, type ChatRail } from "@/lib/chat-rail";
import { discussionTriage, heldByButton } from "@/lib/create-open";
import { useCreatePictures, type CreatePictures } from "@/lib/picture-box";
import type { BecameCard, DiscussRead, DiscussionTarget, HandoffRow, WorkflowView } from "@/lib/types";
import type { PlanAnswer } from "@/lib/format/agent/types";
import type { StartFailure } from "@/lib/start-failure";
import type { Starting } from "@/lib/create-open";
import type { PlanPick } from "@/app/actions";
import { BecameLine } from "./became";
import { Button } from "./button";
import { OpenFailed, Skeleton } from "./CardOpening";
import { Transcript, Pasted, Pick, useBoardChanged } from "./Chat";
import { HAIRLINE, PULSE_DOT } from "./chrome";
import { MessageBox } from "./composer";
import { ConfirmationPopover } from "./confirm-popover";
import { configDialog } from "./Configuration";
import { Copied, useCopyText } from "./copy";
import { Markdown } from "./Markdown";
import { blockedStages, useWorkflowName } from "./Workflows";
import { useWorkflows } from "@/lib/window-state";
import { useWorkflowTip } from "./WorkflowTip";
import { Popover, PopoverContent, PopoverOption, PopoverTrigger, POPUP_ROW, POPUP_TRIGGER, stepOptions } from "./ui/popover";
import { cn } from "@/lib/utils";
import { Caret, useTypewriter } from "./typewriter";

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

/** How long the plan card takes to move (#1948). */
const PLAN_MS = 220;
/** The paper between an enlarged card and the answers and box under it. */
const DOCK_GAP = 12;

interface Props {
  /** The sheet is playing its way out (#1948). */
  leaving?: boolean;
  /** Which board this is — what this discussion's conversation is read against. */
  projectRoot: string;
  /** The discussion this screen is holding (#496): a fresh one on every Create task press,
   *  or the one a rail row picked back up. Null on a board whose rules are older than the
   *  list, which still holds its one conversation. */
  discussion: DiscussionTarget | null;
  onClose: () => void;
  onSent: () => void;
  /** Plan tasks or Start now (#481) on some plans (#1442): `all` is a press on every plan
   *  still waiting, and `ends` says no plan is left waiting after it. Start now's guard has
   *  already been answered. The screen stays up until the run is going (#706). */
  onHandoff(answer: PlanAnswer, picks: PlanPick[], all: boolean, ends: boolean): void;
  /** The answer whose run is being asked for right now (#706), or null. Every answer goes
   *  down while one is out, and so does the box's Send. */
  starting: Starting | null;
  /** Why the last start on THIS discussion never came up (#706), by the plan it was pressed
   *  on — "" is the pair under every plan. */
  failures: Record<string, StartFailure>;
  /** Start now could not take this discussion along and went through Plan tasks (#1246). */
  rerouted?: boolean;
  /** The discussion became cards while the sheet was up (#1954): the screen closes. */
  onBecame(cardIds: number[]): void;
}

// Discuss is one DISCUSSION's conversation (#427, #496), never the window's rail: the rail
// holds a card's, and this screen is not one. So the sheet opens its own
// on whichever discussion it was given, and a reply to another one goes on arriving behind
// it — the server owns every reply, so nothing is cut off by the screen it is not on.
export function CreateSheet(props: Props) {
  const onBoardChanged = useBoardChanged();
  const rail = useChatRail({ projectRoot: props.projectRoot, cardId: props.discussion, onBoardChanged });
  return <Sheet {...props} rail={rail} />;
}

function Sheet({
  leaving,
  discussion,
  onClose,
  onSent,
  onHandoff,
  onBecame,
  starting,
  failures,
  rerouted,
  rail,
}: Props & { rail: ChatRail }) {
  const c = useCopy().board.create.sheet;
  const close = useCopy().shared.close;
  const plan = usePlanPanel(discussion);
  // Each discussion keeps its own unsent words (#888).
  useState(() => adoptSharedCreateDraft(discussion));
  const [text, setText, clearDraft] = useDraft(createDraftKey(discussion));
  const [headlineStopped, setHeadlineStopped] = useState(false);
  // A fresh discussion has nothing to read and shows its empty screen at once; any other one
  // is read before anything of it is drawn (#1217). Judged once: the first message sent
  // clears `unspoken`, and that must not turn it into one being opened.
  const [opened, setOpened] = useState(() => discussion !== null && discussion === heldByButton.unspoken);
  const [mounted, setMounted] = useState(false);
  // The pictures this screen was pasted into (#517, #530), judged by the conversation's agent.
  const chatImages = rail.read
    ? { agent: rail.read.agent, seesImages: rail.read.seesImages, imagesAble: rail.read.imagesAble }
    : null;
  const pictures = useCreatePictures(chatImages, discussion ?? "");
  // The workflow each plan's cards run through (#715, #1442): a hand pick holds only for this
  // discussion; otherwise the agent's pick for that plan (#847), else the board's default.
  const flows = useWorkflows()?.workflows ?? null;
  const [picked, setPicked] = useState<Record<string, string>>({});
  const usable = (id?: string) => flows?.find((f) => f.id === id && f.problems.length === 0)?.id;
  const workflowOf = (row: { path: string; workflow?: string }) =>
    picked[row.path] ?? usable(row.workflow) ?? flows?.find((f) => f.isDefault)?.id ?? "";
  const [sending, setSending] = useState(false);
  // The window's body, when there is one — the sheet fills that rather than the viewport.
  const body = useBodySlot();
  useEffect(() => setMounted(true), []);

  // While the sheet is up it is the layer Esc answers, and the rail is not (#267). An enlarged
  // plan is a layer of its own, put down before the screen is.
  useOverRail();
  const full = plan.full;
  const toggleFull = plan.toggleFull;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (full) toggleFull();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, full, toggleFull]);

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
  // Nothing on this board can hold a conversation — no agent that can, or rules older than
  // Discuss. The box stays down then, with the rail's own reason above it.
  const settled = !!read && !!plan.read;
  const discussing = settled && plan.supported && read?.canChat !== false;
  // The rail lists only discussions with a file, so one that reads back empty is gone.
  const gone = discussion !== null && read !== null && read.chat === null;
  const openFailed = !opened && (rail.readFailed || plan.readFailed || gone);
  if (!opened && settled && !openFailed) setOpened(true);
  const opening = !opened;
  // Plan tasks is writing cards in this discussion's own session (#1026), or the discussion
  // has become cards (#1213): nothing more goes in.
  const rows = plan.read ? rowsOf(plan.read) : [];
  const writing = rows.some((r) => r.run?.running && r.run.answer === "plan");
  const became = plan.read?.became ?? [];
  // Only cards written while it is up close it (#1954); a finished discussion reopened stays.
  const [before, setBefore] = useState<number | null>(null);
  if (plan.read && before === null) setBefore(became.length);
  const wrote = before === 0 ? became.map((b) => b.id).join(",") : "";
  useEffect(() => {
    if (wrote) onBecame(wrote.split(",").map(Number));
  }, [wrote, onBecame]);
  // A run just started: read its state now rather than on the next tick.
  const refresh = plan.refresh;
  useEffect(() => {
    if (starting === null) refresh();
  }, [starting, refresh]);

  // Only a hand or a new plan moves anything (#1948): the frames a discussion opens on, or
  // the window is resized in, settle still.
  const wide = plan.beside;
  const less = useMatches(LESS_MOTION);
  const dock = useDock();
  const still = useStill(`${opened}|${wide}|${dock.width}`);
  const moveMs = still || less ? 0 : PLAN_MS;
  const side = useLeaving(plan.open && wide, moveMs);
  const lift = useLeaving(plan.full && !wide, moveMs);

  if (!mounted) return null;

  const messages = read?.chat?.messages ?? [];
  // A discussion with something in it is drawn as a conversation; one with nothing said is
  // still the empty screen the headline sits on.
  const talking =
    discussing && (messages.length > 0 || !!rail.sending || rail.live !== null || rail.stopped !== null);
  // Where the plan goes. With room for both it stands BESIDE the conversation, and enlarging
  // it lays it OVER instead. With no room for both the conversation is served first (#669):
  // the plan is a COLLAPSED row pinned over the box, and opening it out lays it over the
  // exchange — never over the answers or the box, which is what the row was in the way of.
  const beside = plan.open && wide && !plan.full;
  // Enlarged beside, the card stands above the box and the answers wait just over it, so
  // the plan can be answered as it is read; the conversation behind fades out whole.
  const page = plan.full && wide;
  const pageWidth = Math.max(0, Math.min(PLAN_READ + PLAN_PAD * 2, dock.width - PLAN_INSET * 2));
  // The answers sit under the agent's own last word where the conversation has the
  // screen to itself, and under the plan's row where it does not — beside the box either
  // way, so a plan opened out never takes them away.
  const handoff = (
    <Handoff
      plan={plan}
      rail={rail}
      rows={rows}
      starting={starting}
      failures={failures}
      rerouted={rerouted}
      flows={flows}
      workflowOf={workflowOf}
      onWorkflow={(path, id) => setPicked((was) => ({ ...was, [path]: id }))}
      onHandoff={onHandoff}
    />
  );
  // A discussion message is what is typed OR what was pasted (#441).
  const pasted = pictures.pasted.length;

  const send = async () => {
    const words = text.trim();
    if (sending || opening || !discussing || pictures.refused) return;
    if (!words && pasted === 0) return;
    setSending(true);
    // The screen's own box goes with the words (#530): the send moves its pictures beside the
    // conversation, and only a message that left empties it. A refusal leaves the sheet
    // exactly as it was, with the rail's own sentence above the box.
    const shots = pictures.pasted;
    // The box is the send's from here, so a sheet closed while it is in flight does not empty
    // the folder the message is being taken from.
    pictures.handOver();
    // The words leave the box as they appear in the exchange above it (#1950), and come back
    // to it on a refusal.
    const typed = text;
    clearDraft();
    const went = await rail.say(words, {
      discuss: true,
      images: shots,
      box: shots.length ? pictures.box : undefined,
      triage: discussion ? discussionTriage.get(discussion) : undefined,
    });
    setSending(false);
    if (!went) {
      pictures.takeBack();
      setText(typed);
      return;
    }
    if (discussion) discussionTriage.delete(discussion);
    onSent();
    pictures.sent();
    plan.refresh();
  };

  const composer = (
    <Composer
      discussing={discussing}
      // A plan answer starting counts as a send in flight (#706): the run archives this
      // discussion the moment it is up, so a message typed behind it has nowhere to land.
      sending={sending || opening || starting !== null || writing || became.length > 0}
      closed={became.length > 0}
      shut={opening || writing || became.length > 0}
      rail={rail}
      pictures={pictures}
      text={text}
      onText={(value) => {
        setHeadlineStopped(true);
        setText(value);
        // The hand has moved on, so the last paste stops explaining itself — the rail's own
        // box does this from the keystroke too (lib/chat-rail.ts).
        pictures.clearNote();
      }}
      talking={talking || opening}
      onSend={() => void send()}
    />
  );

  return createPortal(
    // No `data-a4k-overlay` here, unlike a dialog: nothing of the window's chrome is
    // covered, so the traffic lights, the drag strip and the rail all still answer.
    <div
      ref={plan.measure}
      data-leaving={leaving || undefined}
      className={cn(
        `${body ? "absolute" : "fixed"} a4k-discuss inset-0 z-20 flex flex-col bg-nb-paper`,
        still && "a4k-still",
      )}
      // A link to a page of the app leaves the sheet for it, even when that page is the one
      // underneath (#888).
      onClickCapture={(e) => {
        const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
        if (link instanceof HTMLAnchorElement && link.origin === location.origin && link.target !== "_blank") {
          onClose();
        }
      }}
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
            className="transition-[transform,box-shadow,background-color,color,border-color]"
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

      <Still.Provider value={still}>
        {talking || opening ? (
          <div ref={dock.area} className="relative min-h-0 flex-1">
            {/* Beside the card the conversation gives up the room the card stands in — the
                transcript and the box both, so the two keep the one centre line they had
                before it arrived. Over it they keep the whole sheet and the card lies on top. */}
            <div className="a4k-glide flex h-full min-h-0 flex-col" style={{ paddingRight: beside ? plan.space : 0 }}>
              <div className={`relative flex min-h-0 flex-1 justify-center ${GUTTER_HALF}`}>
                <div
                  className={`a4k-glide flex min-h-0 flex-col ${COLUMN}`}
                  data-off={plan.full || undefined}
                  inert={plan.full}
                >
                  {opening ? (
                    <div className="min-h-0 flex-1 overflow-y-auto px-2.5">
                      {openFailed ? (
                        <OpenFailed
                          text={c.openFailed}
                          retry={c.retry}
                          onRetry={() => {
                            rail.retry();
                            plan.retry();
                          }}
                        />
                      ) : (
                        <Skeleton label={c.opening} />
                      )}
                    </div>
                  ) : (
                    <Transcript
                      messages={messages}
                      sending={rail.sending}
                      changes={read?.chat?.modelChanges}
                      live={rail.live}
                      liveSince={read?.liveSince ?? null}
                      stopped={rail.stopped}
                      idle={!rail.answering && !(rail.error ?? read?.failed ?? read?.blocked)}
                      canSend={!!read && !read.blocked && !rail.answering}
                      onResend={sayInDiscussion}
                      // The same conversation the rail draws, so a message pasted into on one
                      // screen reads the same on the other (#441).
                      imageSrc={rail.imageSrc}
                      empty={null}
                      after={wide ? handoff : null}
                    />
                  )}
                </div>
                {/* Over the exchange, the card stops at the box: this screen is a
                    conversation being answered, and a card that took the box away would make
                    you put the plan down to say anything. */}
                {lift.drawn && (
                  <PlanCard
                    plan={plan}
                    leaving={lift.leaving}
                    arrive={still ? null : "a4k-plan-over-in"}
                    className={`a4k-plan-over bottom-0 mx-auto ${COLUMN_MAX}`}
                    place={{ left: PLAN_INSET, right: PLAN_INSET }}
                  />
                )}
              </div>
              {/* Too narrow to stand beside: the plan and its answers are pinned between the
                  conversation and the box, both at their own fixed height, so the transcript
                  keeps every pixel left over and still scrolls to the last reply. */}
              {!wide && (plan.open || became.length > 0) && (
                <div className={`flex shrink-0 justify-center pt-3 ${GUTTER}`}>
                  <div className={COLUMN}>
                    {plan.open && (
                      <div className="a4k-fold" data-off={plan.full || undefined} inert={plan.full}>
                        <div className="min-h-0 overflow-hidden">
                          <PlanRow plan={plan} />
                        </div>
                      </div>
                    )}
                    {handoff}
                  </div>
                </div>
              )}
              <div className={`flex shrink-0 justify-center pb-6 ${!wide && plan.open ? "pt-5" : "pt-7"} ${GUTTER}`}>
                <div ref={dock.box} className={`relative ${COLUMN}`}>
                  {wide && (
                    <div
                      ref={dock.dock}
                      className="a4k-dock absolute inset-x-0 bottom-full pb-2"
                      data-off={!page || undefined}
                      inert={!page}
                    >
                      {handoff}
                    </div>
                  )}
                  {composer}
                </div>
              </div>
            </div>
            {/* Beside it, the card runs the height of the screen and its foot sits on the
                box's own — one baseline across the bottom of the sheet. Enlarged, the same
                card steps into the middle as a page, so the move between the two is one. */}
            {side.drawn && (
              <PlanCard
                plan={plan}
                tall
                leaving={side.leaving}
                arrive={still ? null : "a4k-plan-side-in"}
                className="a4k-plan-side"
                place={
                  page
                    ? { right: (dock.width - pageWidth) / 2, width: pageWidth, bottom: dock.foot + DOCK_GAP }
                    : { right: PLAN_INSET, width: plan.width, bottom: 24 }
                }
              />
            )}
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
      </Still.Provider>
    </div>,
    body ?? document.body,
  );
}

/** The sheet is settling: whatever mounts now is already in place, not arriving. */
const Still = createContext(false);

function Arrive({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(className, useArrive())}>{children}</div>;
}

/** The arrival class, decided once at mount: nothing that was there when the sheet settled
 *  plays its way in. */
function useArrive(): string {
  const still = useContext(Still);
  const [cls] = useState(still ? "" : "a4k-arrive");
  return cls;
}

/** True for the two frames after `key` changes, so a layout that changed without a hand on
 *  it is painted in place before any transition is armed. */
function useStill(key: string): boolean {
  const [at, setAt] = useState(key);
  const [still, setStill] = useState(true);
  if (at !== key) {
    setAt(key);
    setStill(true);
  }
  useEffect(() => {
    if (!still) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setStill(false));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [still, at]);
  return still;
}

/** The conversation's room, and how far up from its foot the box and the answers docked over
 *  it reach — where an enlarged card stops. */
function useDock() {
  const els = useRef<Record<"area" | "box" | "dock", HTMLElement | null>>({ area: null, box: null, dock: null });
  const observer = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState({ width: 0, foot: 0 });
  const read = useCallback(() => {
    const { area, box, dock } = els.current;
    if (!area || !box) return;
    const room = area.getBoundingClientRect();
    const width = Math.round(room.width);
    const foot = Math.round(room.bottom - box.getBoundingClientRect().top + (dock?.offsetHeight ?? 0));
    setSize((was) => (was.width === width && was.foot === foot ? was : { width, foot }));
  }, []);
  const [refs] = useState(() => {
    const at = (key: "area" | "box" | "dock") => (el: HTMLElement | null) => {
      const was = els.current[key];
      if (was) observer.current?.unobserve(was);
      els.current[key] = el;
      if (!el) return;
      observer.current ??= new ResizeObserver(() => read());
      observer.current.observe(el);
      read();
    };
    return { area: at("area"), box: at("box"), dock: at("dock") };
  });
  useEffect(() => () => observer.current?.disconnect(), []);
  return { ...refs, ...size };
}

function CreateHeadline({ phrases, paused }: { phrases: readonly string[]; paused: boolean }) {
  const { text, typing } = useTypewriter(phrases, paused);

  return (
    <h1 className="grid w-full text-center text-[27px] font-[800] leading-[1.2] tracking-[-0.025em] max-md:text-[21px]">
      <span className="sr-only">{phrases[0]}</span>
      {/* Reserve the tallest phrase at every viewport width. */}
      {phrases.map((text) => (
        <span key={text} aria-hidden className="invisible col-start-1 row-start-1 px-2">{text}</span>
      ))}
      <span aria-hidden className="col-start-1 row-start-1 self-center px-2">
        {text}
        {typing && <Caret className="h-[0.9em] w-[2px] bg-nb-ink align-[-0.05em]" />}
      </span>
    </h1>
  );
}

/** The box, with the conversation's agent and its share switch under it. */
function Composer({
  discussing,
  sending,
  rail,
  pictures,
  text,
  onText,
  talking,
  onSend,
  closed,
  shut,
}: {
  /** The discussion became cards (#1213); the box says so. */
  closed: boolean;
  /** Plan tasks is writing the cards or has written them: the box takes nothing. */
  shut: boolean;
  /** The conversation can answer — both reads are in and this board can hold one. */
  discussing: boolean;
  /** A message, or a plan answer's run, is on its way; the corner button stays down. */
  sending: boolean;
  rail: ChatRail;
  /** The screen's one box of pictures (#530). */
  pictures: CreatePictures;
  text: string;
  onText(value: string): void;
  talking: boolean;
  onSend(): void;
}) {
  const c = useCopy().board.create.sheet;
  const chat = useCopy().chat;
  const read = rail.read;
  const answering = rail.answering;
  // The reply coming is this server's, so the corner button can end it. A reply a terminal
  // is writing is followed just the same and ended in that terminal.
  const ours = rail.live != null;
  const trouble = rail.error ?? read?.failed ?? read?.blocked;
  const chatPick = read?.pick ?? null;
  const pasted = pictures.pasted.length;

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
        // Pictures on their own are a message (#441); a box the agent cannot see sends nothing.
        canSend={
          (!!text.trim() || pasted > 0) &&
          discussing &&
          !answering &&
          !sending &&
          !pictures.refused
        }
        autoFocus
        // The send moves pasted pictures beside the conversation (#530).
        onPasteImages={pictures.offered ? (files) => void pictures.paste(files) : undefined}
        // Dropping one in is the same path, so it is on wherever the paste is (#511).
        drop={
          pictures.offered
            ? { onFiles: (files) => void pictures.dropFiles(files), hint: chat.dropRelease }
            : undefined
        }
        // On their way they are drawn in the exchange, not here too.
        head={rail.sending ? null : <Pasted box={pictures} />}
        disabled={shut}
        placeholder={closed ? c.plan.closed : talking ? c.answer : c.placeholder}
        label={closed ? c.plan.closed : talking ? c.answer : c.placeholder}
        sendLabel={c.send}
        stop={ours ? { label: chat.stop, onStop: () => void rail.stop() } : undefined}
        // Who answers, hard against Send (components/Chat.tsx).
        foot={
          chatPick ? (
            <span className="ml-auto flex min-w-0 items-center gap-1.5">
              <Pick rail={rail} pick={chatPick} answering={answering} />
            </span>
          ) : undefined
        }
        hint={
          <span className="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start max-md:gap-0.5">
            <span className="truncate">{c.keysDiscuss}</span>
            {answering && <span className="shrink-0">{chat.sendingWaits}</span>}
          </span>
        }
      />
    </>
  );
}

/** The handoff (#427, #481), under the agent's own last message: the answers whenever there is
 *  a plan and the reply is in, and while a run one of them started is going, the line that
 *  says so. The agent never announces it, so it can never forget to.
 *
 *  One plan keeps the one row it always had: Plan tasks filled, Start now in accent ink, the
 *  workflow quietly at the end (#847). Several are one row each (#1442) — title, workflow and
 *  their own two quiet answers — with the filled pair below taking every plan still waiting. */
function Handoff({
  plan,
  rail,
  rows,
  starting,
  failures,
  rerouted,
  flows,
  workflowOf,
  onWorkflow,
  onHandoff,
}: {
  plan: PlanPanel;
  rail: ChatRail;
  rows: HandoffRow[];
  starting: Starting | null;
  failures: Record<string, StartFailure>;
  rerouted?: boolean;
  /** The board's workflows, or null before they are read or on rules without them. */
  flows: WorkflowView[] | null;
  workflowOf(row: HandoffRow): string;
  onWorkflow(path: string, id: string): void;
  onHandoff(answer: PlanAnswer, picks: PlanPick[], all: boolean, ends: boolean): void;
}) {
  const c = useCopy().board.create.sheet.plan;
  const read = plan.read;
  // The cards it became (#1213): one line each.
  if (read?.became?.length) {
    return (
      <div className="flex flex-col">
        <BecameLinks cards={read.became} />
      </div>
    );
  }
  if (!read || !rows.length) return null;
  const waiting = rows.filter((r) => !r.cards?.length && !r.run?.running);
  // Nothing to press under a reply being written, nor under a message nobody has answered
  // yet — the answer a handoff noted is not one — nor on a plan named a second ago with
  // nothing in it to act on.
  const answered = rail.read?.chat?.messages.at(-1)?.role === "agent" || rows.some((r) => r.run || r.cards?.length);
  const idle = plan.shown && !rail.answering && rail.live === null && answered;
  const down = starting !== null || rows.some((r) => r.run?.running && r.run.answer === "plan");
  const pick = (r: HandoffRow): PlanPick => ({ path: r.path, workflow: workflowOf(r) || undefined });
  const startingOn = (r: HandoffRow) =>
    starting && (starting.paths === null ? waiting.includes(r) : starting.paths.includes(r.path)) ? starting.answer : null;
  const one = (answer: PlanAnswer, r: HandoffRow) =>
    onHandoff(answer, [pick(r)], false, waiting.length === 1 && waiting[0] === r);

  if (rows.length === 1) {
    const r = rows[0]!;
    if (r.run?.running) {
      return (
        <>
          {rerouted && r.run.answer === "plan" && <p className="px-2.5 pt-2 text-[12px] text-nb-ink-soft">{c.rerouted}</p>}
          <Working label={r.run.answer === "build" ? c.building : c.planning} />
        </>
      );
    }
    if (!idle || r.cards?.length) return null;
    return (
      <Arrive>
        <div className="flex flex-wrap items-center gap-2.5 px-2.5 pt-3">
          <Answers
            down={down}
            starting={startingOn(r)}
            labels={{ plan: c.start, build: c.build, buildGuard: false }}
            onPlan={() => one("plan", r)}
            onBuild={() => one("build", r)}
          />
          {r.run && !starting && !failures[r.path] && (
            <span className="text-[11.5px] text-nb-ink-soft">{r.run.answer === "build" ? c.buildAgain : c.tryAgain}</span>
          )}
          {flows && flows.length > 1 && (
            <WorkflowPick flows={flows} picked={workflowOf(r)} disabled={down} onPick={(id) => onWorkflow(r.path, id)} />
          )}
        </div>
        <Failure failure={failures[r.path] ?? failures[""]} />
      </Arrive>
    );
  }

  // Rows handed to one run together share one line under them all.
  const together = (r: HandoffRow) => !!r.run?.running && rows.filter((o) => o.run?.sessionId === r.run!.sessionId).length > 1;
  const shared = rows.find(together);
  const sharedCount = shared ? rows.filter((o) => o.run?.sessionId === shared.run!.sessionId).length : 0;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.path} className="px-2.5 pt-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex min-w-[160px] flex-1 items-center gap-2">
              <FiFileText size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
              <span className="truncate text-[12.5px] font-[600]">{r.title || c.label}</span>
            </span>
            {idle && waiting.includes(r) && (
              <span className="ml-auto flex shrink-0 items-center gap-2">
                {flows && flows.length > 1 && (
                  <WorkflowPick flows={flows} picked={workflowOf(r)} disabled={down} onPick={(id) => onWorkflow(r.path, id)} />
                )}
                <span className="flex items-center">
                  <Answers
                    quiet
                    down={down}
                    starting={startingOn(r)}
                    labels={{ plan: c.planOne, build: c.buildOne, buildGuard: false }}
                    onPlan={() => one("plan", r)}
                    onBuild={() => one("build", r)}
                  />
                </span>
              </span>
            )}
          </div>
          {r.cards?.length ? (
            <div className="flex flex-col">
              <BecameLinks cards={r.cards} inset={UNDER_ROW} />
            </div>
          ) : r.run?.running ? (
            !together(r) && <Working inset={UNDER_ROW} label={r.run.answer === "build" ? c.building : c.planning} />
          ) : (
            r.run && !startingOn(r) && !failures[r.path] && (
              <p className={`${UNDER_ROW} text-[11.5px] text-nb-ink-soft`}>{r.run.answer === "build" ? c.buildAgain : c.tryAgain}</p>
            )
          )}
          <Failure inset={UNDER_ROW} failure={failures[r.path]} />
        </div>
      ))}
      {shared && (
        <>
          {rerouted && <p className="px-2.5 pt-2 text-[12px] text-nb-ink-soft">{c.rerouted}</p>}
          <Working label={c.planningMany(sharedCount)} />
        </>
      )}
      {idle && waiting.length > 1 && (
        <Arrive className="flex flex-wrap items-center gap-2.5 px-2.5 pt-3">
          <Answers
            down={down}
            starting={starting?.paths === null ? starting.answer : null}
            labels={{ plan: c.planAll, build: c.buildAll, buildGuard: waiting.length }}
            onPlan={() => onHandoff("plan", waiting.map(pick), true, true)}
            onBuild={() => onHandoff("build", waiting.map(pick), true, true)}
          />
        </Arrive>
      )}
      <Failure failure={failures[""]} />
    </div>
  );
}

// Under a plan's own row, the lines sit under its title rather than on the column's edge.
const UNDER_ROW = "pl-[20px] pt-1";

function BecameLinks({ cards, inset = "px-2.5 pt-2" }: { cards: BecameCard[]; inset?: string }) {
  return cards.map((card) => <BecameLine key={card.id} card={card} className={`text-[12.5px] ${inset}`} />);
}

/** The two answers: Plan tasks filled, Start now in accent ink behind its guard — or, `quiet`,
 *  as small text buttons on a plan's own row (#1442). */
function Answers({
  quiet,
  down,
  starting,
  labels,
  onPlan,
  onBuild,
}: {
  quiet?: boolean;
  down: boolean;
  /** Which of the two is being asked for on these plans (#706). */
  starting: PlanAnswer | null;
  /** `buildGuard` is how many cards Start now writes, when more than one. */
  labels: { plan: string; build: string; buildGuard: number | false };
  onPlan(): void;
  onBuild(): void;
}) {
  const c = useCopy().board.create.sheet.plan;
  // Whether Start now's "are you sure?" is open, anchored to the answer that was pressed.
  const [guard, setGuard] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const text =
    "flex h-7 shrink-0 cursor-pointer items-center rounded-[6px] px-1.5 text-[12px] font-[600] text-nb-accent-deep transition-[background-color] duration-100 hover:bg-nb-ink/5 disabled:cursor-not-allowed disabled:opacity-45";
  const planLabel = starting === "plan" ? c.starting : labels.plan;
  const buildLabel = starting === "build" ? c.starting : labels.build;
  return (
    <>
      {quiet ? (
        <button type="button" className={text} disabled={down} title={c.planHint} onClick={onPlan}>
          {planLabel}
        </button>
      ) : (
        <Button size="xs" disabled={down} title={c.planHint} onClick={onPlan}>
          {planLabel}
        </Button>
      )}
      {/* The panel hangs off this, so it lives inside. */}
      <span ref={anchor} className="relative flex">
        {quiet ? (
          <button type="button" className={text} aria-expanded={guard} disabled={down} title={c.buildHint} onClick={() => setGuard((was) => !was)}>
            {buildLabel}
          </button>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            className="font-[700]"
            aria-expanded={guard}
            disabled={down}
            title={c.buildHint}
            style={{ borderColor: "var(--color-nb-accent-deep)", color: "var(--color-nb-accent-deep)" }}
            onClick={() => setGuard((was) => !was)}
          >
            {buildLabel}
          </Button>
        )}
        <BuildGuard
          open={guard}
          count={labels.buildGuard || 1}
          anchorRef={anchor}
          onDismiss={() => setGuard(false)}
          onConfirm={() => {
            setGuard(false);
            onBuild();
          }}
        />
      </span>
    </>
  );
}

/** Why a start never came up (#706), said where it was pressed. The answers above are live
 *  again, so pressing the same one is the retry. */
function Failure({ failure, inset = "px-2.5 pt-2.5" }: { failure?: StartFailure; inset?: string }) {
  if (!failure) return null;
  return (
    <div className={inset}>
      <div
        role="alert"
        className="break-words rounded-[8px] px-2.5 py-2 text-[12px] leading-snug"
        style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
      >
        <p>{failure.line}</p>
        {failure.paths.map((path) => (
          <p key={path} className="mt-1 font-mono text-[11.5px] opacity-80">
            {path}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The rows a read draws (#1442); rules older than per-plan handoff give every open plan the
 *  discussion's one run. */
function rowsOf(read: DiscussRead): HandoffRow[] {
  if (read.rows) return read.rows;
  return plansOf(read).map((p) => ({ path: p.path, title: p.title, workflow: p.workflow, ...(read.run ? { run: read.run } : {}) }));
}

/** Which workflow the plan's card runs through (#715): shown only when the board has more
 *  than one. Styled as the box's runtime picker (#847); the list is Configuration's (#1244). */
function WorkflowPick({
  flows,
  picked,
  disabled,
  onPick,
}: {
  flows: WorkflowView[];
  picked: string;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  const c = useCopy().board.create.sheet.workflow;
  const w = useCopy().configuration.workflows;
  const noLead = useCopy().card.meta.noLead;
  const nameOf = useWorkflowName();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const rows = useRef(new Map<string, HTMLElement>());
  // A row that opens something else must not have the button take the focus back.
  const leaving = useRef(false);
  const tip = useWorkflowTip(menu);
  const { clear: clearTip } = tip;
  const mine = flows.find((f) => f.id === picked) ?? flows.find((f) => f.isDefault) ?? flows[0]!;
  // Why a row cannot be picked, in the card page's own words (#1278).
  const reasonOf = (id: string) => {
    const flow = flows.find((f) => f.id === id);
    return flow?.problems.length ? noLead(blockedStages(flow).map((s) => w.stages[s])) : undefined;
  };

  const show = useCallback(
    (next: boolean) => {
      clearTip();
      setOpen(next);
    },
    [clearTip],
  );
  useEffect(() => {
    if (disabled) show(false);
  }, [disabled, show]);

  const readFade = () => {
    const el = list.current;
    if (el) setFade({ top: el.scrollTop > 0, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1 });
  };

  // The one in use, centred in view.
  const centre = () => {
    const el = list.current;
    const row = el?.querySelector<HTMLElement>("[aria-selected='true']");
    if (el && row) {
      const box = row.parentElement ?? row;
      el.scrollTop = box.offsetTop - (el.clientHeight - box.offsetHeight) / 2;
    }
    readFade();
    return row;
  };

  return (
    <span className="relative ml-auto flex min-w-0">
      <Popover open={open} onOpenChange={show}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={c.label}
            aria-label={c.label}
            disabled={disabled}
            className={`${POPUP_TRIGGER} flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] pl-2 pr-1.5 text-[12px] text-nb-ink bg-nb-accent-wash`}
          >
            <span className="max-w-[160px] truncate">{nameOf(mine)}</span>
            <FiChevronDown size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
          </button>
        </PopoverTrigger>
        {open && (
          <PopoverContent
            ref={menu}
            align="end"
            aria-label={c.label}
            onKeyDown={stepOptions}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              centre()?.focus({ preventScroll: true });
              // Again once the panel is placed and capped to the room it has.
              requestAnimationFrame(centre);
            }}
            onCloseAutoFocus={(e) => {
              if (leaving.current) e.preventDefault();
              leaving.current = false;
            }}
            onInteractOutside={(e) => {
              if (e.target instanceof Element && e.target.closest("[data-workflow-tip]")) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (!tip.shownId) return;
              e.preventDefault();
              tip.clear();
            }}
            className="a4k-nodrag flex w-[min(254px,calc(100vw-16px))] flex-col overflow-hidden"
          >
            <div className="relative flex min-h-0 flex-col">
              <div
                ref={list}
                role="listbox"
                aria-label={c.label}
                onScroll={() => {
                  tip.clear();
                  readFade();
                }}
                className="min-h-[38px] overflow-y-auto overscroll-contain [scrollbar-width:thin]"
                style={{ maxHeight: MENU_ROW * MENU_ROWS }}
              >
                {flows.map((f) => {
                  // A workflow that cannot start would only write a card that stops on its first run.
                  const off = f.problems.length > 0;
                  const row = () => rows.current.get(f.id) ?? null;
                  const reason = reasonOf(f.id);
                  const props = tip.rowProps(f, row, reason);
                  return (
                    <div
                      key={f.id}
                      ref={(el) => {
                        if (el) rows.current.set(f.id, el);
                        else rows.current.delete(f.id);
                      }}
                      className="flex items-center"
                    >
                      <PopoverOption
                        selected={f.id === mine.id}
                        data-active={tip.shownId === f.id || undefined}
                        aria-disabled={off || undefined}
                        onClick={() => {
                          if (off) return;
                          onPick(f.id);
                          show(false);
                        }}
                        className={cn("text-[12.5px] font-[700]", off && "cursor-not-allowed hover:bg-transparent active:bg-transparent")}
                        style={{ minHeight: MENU_ROW }}
                        {...props}
                      >
                        <span className={`min-w-0 flex-1 break-words ${off ? "opacity-45" : ""}`}>{nameOf(f)}</span>
                        {off && <span className="shrink-0 text-[10.5px] text-nb-ink-soft opacity-45">{w.notReady}</span>}
                      </PopoverOption>
                      {tip.infoButton(f, nameOf(f), row, reason)}
                    </div>
                  );
                })}
              </div>
              {fade.top && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-5"
                  style={{ background: "linear-gradient(var(--color-nb-paper), transparent)" }}
                />
              )}
              {fade.bottom && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-5"
                  style={{ background: "linear-gradient(transparent, var(--color-nb-paper))" }}
                />
              )}
            </div>
            {tip.layer(flows, reasonOf)}
            <div className="mt-1 shrink-0 border-t border-nb-ink/10 pt-1">
              <button
                type="button"
                onClick={() => {
                  leaving.current = true;
                  show(false);
                  configDialog.open("workflows");
                }}
                className={cn(POPUP_ROW, "justify-between py-2 text-[12px]")}
              >
                {c.manage}
                <FiChevronDown className="-rotate-90 text-[12px]" aria-hidden />
              </button>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </span>
  );
}

const MENU_ROW = 38;
const MENU_ROWS = 8;

/** The run one answer started, in the line the three answers stood on. The dot is what finds
 *  it: this line sits against the reply's own small grey text, and accent moving is what says
 *  "working" everywhere else in the app. */
function Working({ label, inset = "px-2.5 pt-2" }: { label: string; inset?: string }) {
  const arrive = useArrive();
  return (
    <p className={cn("flex items-center gap-1.5 text-[12px] text-nb-ink-soft", inset, arrive)}>
      <span aria-hidden className={PULSE_DOT} />
      {label}
    </p>
  );
}

/** The guard Start now opens under the plan (#470, #840) — the one place a build starts from
 *  this screen. */
function BuildGuard({
  open,
  count,
  anchorRef,
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  /** How many cards it writes, one build each (#1442). */
  count: number;
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
      title={count > 1 ? c.titleMany(count) : c.title}
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

/** The plan collapsed to one line (#669), pinned between the conversation and the box on a
 *  sheet with no room to stand it beside.
 *
 *  The conversation comes first there: covering it with the plan takes away both what was
 *  said and the answers to act on it. So the plan keeps a row — its own title, so it is
 *  recognisable without being opened — and pressing the row lays the whole thing back over
 *  the exchange, answers and box still under it.
 *
 *  The title is the plan's own first heading; a plan that states none is drawn under the
 *  plain label, because a first paragraph sliced to one line reads as neither. */
function PlanRow({ plan }: { plan: PlanPanel }) {
  const c = useCopy().board.create.sheet.plan;
  return (
    <button
      type="button"
      onClick={plan.toggleFull}
      title={c.expand}
      aria-label={c.expand}
      className="a4k-press flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] bg-nb-cream px-3.5 py-3 text-left transition-[transform,filter] duration-100 hover:brightness-[0.98] active:scale-[0.98]"
    >
      <FiFileText size={14} className="shrink-0 text-nb-ink-soft" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] font-[700]">
        {plan.title || c.label}
      </span>
      <FiMaximize2 size={15} className="shrink-0 text-nb-ink-soft" aria-hidden />
    </button>
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
function PlanCard({
  plan,
  tall = false,
  leaving,
  arrive,
  className,
  place,
}: {
  plan: PlanPanel;
  tall?: boolean;
  leaving: boolean;
  /** How it plays its way in, read once at mount; null when it is simply there. */
  arrive: string | null;
  className: string;
  place: React.CSSProperties;
}) {
  const c = useCopy().board.create.sheet.plan;
  const full = plan.full;
  const [entry] = useState(arrive);
  const { box, more } = usePlanScroll(plan.text, full, tall);
  const tabs = usePlanTabs(plan);
  return (
    <section
      aria-label={c.label}
      data-leaving={leaving || undefined}
      inert={leaving}
      className={cn(
        "group absolute top-0 z-10 flex flex-col overflow-hidden rounded-[14px] bg-nb-cream",
        className,
        entry,
      )}
      style={place}
    >
      {/* The way back, in the card's own corner. Beside the conversation that is the card's
          SIZE, and only under the pointer: a document reading a plan should be a document
          until you reach for it. Opened out of the collapsed row it is the way back to that
          row, so it stays visible — the only control there is, hidden until hovered, is one
          nobody finds on a screen that is half touch. Faded rather than unmounted, so it is
          still there to tab to. */}
      <button
        type="button"
        onClick={plan.toggleFull}
        title={!plan.beside ? c.collapse : full ? c.shrink : c.enlarge}
        aria-label={!plan.beside ? c.collapse : full ? c.shrink : c.enlarge}
        className={`absolute right-3 top-3 z-10 grid size-9 cursor-pointer place-items-center rounded-[9px] bg-nb-cream/90 text-nb-ink-soft backdrop-blur-[2px] transition-[opacity,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink ${
          plan.beside ? "opacity-0 focus-visible:opacity-100 group-hover:opacity-100" : ""
        }`}
        style={{ border: `1px solid ${HAIRLINE}` }}
      >
        {full ? (
          <FiMinimize2 key="shrink" size={17} className="a4k-pop" aria-hidden />
        ) : (
          <FiMaximize2 key="enlarge" size={17} className="a4k-pop" aria-hidden />
        )}
      </button>
      {/* One tab per plan (#917); the words and the path below are the shown plan's. */}
      {plan.plans.length > 1 && (
        <div
          ref={tabs.list}
          role="tablist"
          className="relative flex shrink-0 items-end gap-5 overflow-x-auto pr-14 pt-2"
          style={{ paddingLeft: PLAN_PAD, borderBottom: `1px solid ${HAIRLINE}` }}
        >
          {plan.plans.map((p) => {
            const on = p.path === plan.plan?.path;
            return (
              <button
                key={p.path}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => tabs.pick(p.path)}
                className={`min-w-0 max-w-[180px] shrink-0 cursor-pointer truncate pb-2 pt-1.5 text-[12.5px] transition-colors duration-[180ms] ${
                  on ? "font-[700] text-nb-ink" : "font-[600] text-nb-ink-soft hover:text-nb-ink"
                }`}
              >
                {p.title || c.label}
              </button>
            );
          })}
          {tabs.line && (
            <span
              aria-hidden
              className="a4k-tab-line absolute bottom-0 left-0 h-[2px] bg-nb-accent"
              style={{ width: tabs.line.width, transform: `translateX(${tabs.line.x}px)` }}
            />
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          key={plan.plan?.path}
          ref={box}
          onScroll={more.check}
          className={cn("h-full overflow-y-auto", tabs.moved && "a4k-swap")}
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
          {plan.plan && <PlanPath path={plan.plan.path} />}
          {plan.writing && (
            <span className="flex shrink-0 items-center gap-1.5">
              <span aria-hidden className={PULSE_DOT} />
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

/** The plan tabs' underline, slid under the picked tab (#1948), and whether a hand has
 *  switched tabs yet — the words only cross-fade on a switch. */
function usePlanTabs(plan: PlanPanel) {
  const list = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{ x: number; width: number } | null>(null);
  const [moved, setMoved] = useState(false);
  const titles = plan.plans.map((p) => p.title).join("\n");
  const on = plan.plan?.path;
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return setLine(null);
    const read = () => {
      const tab = el.querySelector<HTMLElement>("[aria-selected='true']");
      setLine((was) =>
        !tab
          ? null
          : was?.x === tab.offsetLeft && was.width === tab.offsetWidth
            ? was
            : { x: tab.offsetLeft, width: tab.offsetWidth },
      );
    };
    read();
    const observer = new ResizeObserver(read);
    el.querySelectorAll("[role='tab']").forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [on, titles]);
  const pick = (path: string) => {
    if (path !== on) setMoved(true);
    plan.pick(path);
  };
  return { list, line, moved, pick };
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
        className="a4k-press grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/5 hover:text-nb-ink active:scale-90"
      >
        {copied ? <FiCheck size={12} className="a4k-pop" aria-hidden /> : <FiCopy size={12} aria-hidden />}
      </button>
      <Copied on={copied} />
    </div>
  );
}
