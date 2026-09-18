"use client";

// Create task holds ONE discussion (#496) — the one the press opened, or the one a rail row
// picked back up. Sending always discusses (#840); the plan's answers are what start a run.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown, FiCopy, FiFileText, FiMaximize2, FiMinimize2, FiX } from "react-icons/fi";
import { workflowsAction } from "@/app/actions";
import { useBodySlot } from "@/lib/body-slot";
import { useCopy } from "@/i18n/use-copy";
import { adoptSharedCreateDraft, createDraftKey, useDraft } from "@/lib/draft";
import { useOverRail } from "@/lib/over-rail";
import { useSwipeBack } from "@/lib/swipe-back";
import { PLAN_INSET, PLAN_READ, usePlanPanel, type PlanPanel } from "@/lib/plan-panel";
import { useChatRail, type ChatRail } from "@/lib/chat-rail";
import { useCreatePictures, type CreatePictures } from "@/lib/picture-box";
import type { DiscussionTarget, WorkflowView } from "@/lib/types";
import type { PlanAnswer } from "@/lib/format/agent/types";
import type { StartFailure } from "@/lib/start-failure";
import { Button } from "./button";
import { Transcript, Pasted, Pick } from "./Chat";
import { HAIRLINE } from "./chrome";
import { MessageBox } from "./composer";
import { ConfirmationPopover } from "./confirm-popover";
import { configDialog } from "./Configuration";
import { Copied, useCopyText } from "./copy";
import { DiscussFeedbackBlock, ShareRow, useDiscussFeedback, type DiscussFeedback } from "./Feedback";
import { Markdown } from "./Markdown";
import { useWorkflowName } from "./Workflows";

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

interface Props {
  /** Which board this is — what this discussion's conversation is read against. */
  projectRoot: string;
  /** The discussion this screen is holding (#496): a fresh one on every Create task press,
   *  or the one a rail row picked back up. Null on a board whose rules are older than the
   *  list, which still holds its one conversation. */
  discussion: DiscussionTarget | null;
  onClose: () => void;
  /** Start planning: start the run that writes the plan's cards. The screen stays up until
   *  it is going (#706). `workflow` is the one picked beside it, or undefined for the default. */
  onPlan: (workflow?: string) => void;
  /** Build now off the plan (#481): start the run that writes one card from it and builds it.
   *  The guard has already been answered. */
  onBuildPlan: (workflow?: string) => void;
  /** The answer whose run is being asked for right now (#706), or null. All three answers go
   *  down while one is out, and so does the box's Send: the run archives this discussion the
   *  moment it starts, and a message sent into it after that is one nobody answers. */
  starting: PlanAnswer | null;
  /** Why the last start on THIS discussion never came up (#706) — said under the answers, in
   *  the app's own language, with the paths the board named under it. */
  failure: StartFailure | null;
}

// Discuss is one DISCUSSION's conversation (#427, #496), never the window's rail: the rail
// holds the board's own or a card's, and this screen is neither. So the sheet opens its own
// on whichever discussion it was given, and a reply to another one goes on arriving behind
// it — the server owns every reply, so nothing is cut off by the screen it is not on.
export function CreateSheet(props: Props) {
  const rail = useChatRail({ projectRoot: props.projectRoot, cardId: props.discussion });
  // The card this discussion is linked to (#628). Held beside the rail rather than inside
  // the composer — and seeded from the rail's own read,
  // because the link lives beside the transcript and comes back with it (#679).
  const partner = useDiscussFeedback(props.discussion, rail.read?.chat?.linkedCard ?? null);
  // Sharing is the only thing that ever asks for a card, so turning it off takes the card
  // with it (#659) — the board drops it beside the transcript, and the screen lets go of it
  // here, in the one place that holds both.
  const shared = useMemo<ChatRail>(
    () => ({
      ...rail,
      share: {
        ...rail.share,
        flip: (next) => {
          if (!next) partner.forget();
          rail.share.flip(next);
        },
      },
    }),
    [rail, partner],
  );
  return <Sheet {...props} rail={shared} partner={partner} />;
}

function Sheet({
  discussion,
  onClose,
  onPlan,
  onBuildPlan,
  starting,
  failure,
  rail,
  partner,
}: Props & { rail: ChatRail; partner: DiscussFeedback }) {
  const c = useCopy().board.create.sheet;
  const close = useCopy().shared.close;
  const plan = usePlanPanel(discussion);
  // Each discussion keeps its own unsent words (#888).
  useState(() => adoptSharedCreateDraft(discussion));
  const [text, setText, clearDraft] = useDraft(createDraftKey(discussion));
  const [headlineStopped, setHeadlineStopped] = useState(false);
  const [mounted, setMounted] = useState(false);
  // The pictures this screen was pasted into (#517, #530), judged by the conversation's agent.
  const chatImages = rail.read
    ? { agent: rail.read.agent, seesImages: rail.read.seesImages, imagesAble: rail.read.imagesAble }
    : null;
  const pictures = useCreatePictures(chatImages, discussion ?? "");
  // The workflow the plan's card runs through (#715): a hand pick holds only for this
  // discussion and plan; otherwise the agent's pick (#847), else the board's default.
  const [flows, setFlows] = useState<WorkflowView[] | null>(null);
  const pickFor = `${discussion ?? ""}\n${plan.read?.plan?.path ?? ""}`;
  const [picked, setPicked] = useState<{ for: string; id: string } | null>(null);
  const usable = (id?: string) => flows?.find((f) => f.id === id && f.problems.length === 0)?.id;
  const workflow =
    (picked?.for === pickFor ? picked.id : undefined) ??
    usable(plan.read?.plan?.workflow) ??
    flows?.find((f) => f.isDefault)?.id ??
    "";
  useEffect(() => {
    void workflowsAction().then((res) => setFlows(res.workflows));
  }, []);
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

  if (!mounted) return null;

  const messages = read?.chat?.messages ?? [];
  // A discussion with something in it is drawn as a conversation; one with nothing said is
  // still the empty screen the headline sits on.
  const talking = discussing && (messages.length > 0 || rail.live !== null || rail.stopped !== null);
  // Where the plan goes. With room for both it stands BESIDE the conversation, and enlarging
  // it lays it OVER instead. With no room for both the conversation is served first (#669):
  // the plan is a COLLAPSED row pinned over the box, and opening it out lays it over the
  // exchange — never over the answers or the box, which is what the row was in the way of.
  const beside = plan.open && plan.beside && !plan.full;
  const collapsed = plan.open && !plan.beside && !plan.full;
  const over = plan.open && !beside && !collapsed;
  // Sharing promises that ending submits, and a submission is filed under a card — so with
  // the switch on and nothing linked, none of the three ends is allowed to happen (#659).
  // Two of them are here. Nothing is said about it: the card search is open under the box,
  // which is both the reason and the way out of it.
  const endHeld = rail.share.offered && rail.share.on && partner.offered && !partner.linked;
  // The answers sit under the agent's own last word where the conversation has the
  // screen to itself, and under the plan's row where it does not — beside the box either
  // way, so a plan opened out never takes them away.
  const handoff = (
    <Handoff
      plan={plan}
      rail={rail}
      held={endHeld}
      starting={starting}
      failure={failure}
      flows={flows}
      workflow={workflow}
      onWorkflow={(id) => setPicked({ for: pickFor, id })}
      onPlan={() => onPlan(workflow || undefined)}
      onBuild={() => onBuildPlan(workflow || undefined)}
    />
  );
  // A discussion message is what is typed OR what was pasted (#441).
  const pasted = pictures.pasted.length;

  const send = async () => {
    const words = text.trim();
    if (sending || !discussing || pictures.refused) return;
    if (!words && pasted === 0) return;
    setSending(true);
    // The screen's own box goes with the words (#530): the send moves its pictures beside the
    // conversation, and only a message that left empties it. A refusal leaves the sheet
    // exactly as it was, with the rail's own sentence above the box.
    const shots = pictures.pasted;
    // The box is the send's from here, so a sheet closed while it is in flight does not empty
    // the folder the message is being taken from.
    pictures.handOver();
    const went = await rail.say(words, {
      discuss: true,
      images: shots,
      box: shots.length ? pictures.box : undefined,
      // The card this discussion is about (#628), which hands the turn to the `feedback`
      // agent. Sharing is the switch under the box, and the rail carries that itself.
      feedback: partner.sending,
    });
    setSending(false);
    if (!went) {
      pictures.takeBack();
      return;
    }
    clearDraft();
    pictures.sent();
    plan.refresh();
  };

  const composer = (
    <Composer
      discussing={discussing}
      // A plan answer starting counts as a send in flight (#706): the run archives this
      // discussion the moment it is up, so a message typed behind it has nowhere to land.
      sending={sending || starting !== null}
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
      talking={talking}
      onSend={() => void send()}
      partner={rail.share.on ? partner : null}
    />
  );

  return createPortal(
    // No `data-a4k-overlay` here, unlike a dialog: nothing of the window's chrome is
    // covered, so the traffic lights, the drag strip and the rail all still answer.
    <div
      ref={plan.measure}
      className={`${body ? "absolute" : "fixed"} inset-0 z-20 flex flex-col bg-nb-paper`}
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
                  after={plan.beside ? handoff : null}
                />
              </div>
              {/* Over the exchange, the card stops at the box — enlarged too: this screen is
                  a conversation being answered, and a card that took the box away would make
                  you put the plan down to say anything. */}
              {over && <PlanCard plan={plan} />}
            </div>
            {/* Too narrow to stand beside: the plan and its answers are pinned between the
                conversation and the box, both at their own fixed height, so the transcript
                keeps every pixel left over and still scrolls to the last reply. */}
            {!plan.beside && plan.open && (
              <div className={`flex shrink-0 justify-center pt-3 ${GUTTER}`}>
                <div className={COLUMN}>
                  {collapsed && <PlanRow plan={plan} />}
                  {handoff}
                </div>
              </div>
            )}
            <div
              className={`flex shrink-0 justify-center pb-6 ${
                !plan.beside && plan.open ? "pt-5" : "pt-7"
              } ${GUTTER}`}
            >
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
  partner,
}: {
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
  /** The partner submission block (#628), while sharing is on. */
  partner: DiscussFeedback | null;
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
        head={<Pasted box={pictures} />}
        placeholder={talking ? c.answer : c.placeholder}
        label={talking ? c.answer : c.placeholder}
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
        // Opposite it, on the same line: whether ending this discussion shares it with the
        // AI4Kanban team (#679).
        aside={<ShareRow share={rail.share} />}
      />
      {/* The card this complaint is about (#628), and what came of sharing it. */}
      {partner && <DiscussFeedbackBlock feedback={partner} />}
    </>
  );
}

/** The handoff (#427, #481), under the agent's own last message: the two answers whenever
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
 *  Start planning is the one to press: the filled button. Build now carries the accent in its
 *  frame and ink but no fill. The workflow is a setting, so it sits quietly at the row's end
 *  (#847). */
function Handoff({
  plan,
  rail,
  held,
  starting,
  failure,
  flows,
  workflow,
  onWorkflow,
  onPlan,
  onBuild,
}: {
  plan: PlanPanel;
  rail: ChatRail;
  /** This discussion shares when it ends and has no card to share under (#659), so the two
   *  answers that end it are down: Build now's "are you sure?" never opens, and no run
   *  starts. */
  held: boolean;
  /** The answer whose run is being asked for (#706): its own label says so, and both go
   *  down — a second press would be a second run. */
  starting: PlanAnswer | null;
  /** Why the last one never came up (#706), said in the row's own space below. */
  failure: StartFailure | null;
  /** The board's workflows, or null before they are read or on rules without them. */
  flows: WorkflowView[] | null;
  workflow: string;
  onWorkflow(id: string): void;
  onPlan(): void;
  onBuild(): void;
}) {
  const c = useCopy().board.create.sheet.plan;
  // Whether Build now's "are you sure?" is open, anchored to the answer that was pressed.
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
  const again = read.run?.answer === "build" ? c.buildAgain : c.tryAgain;
  const down = held || starting !== null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 px-2.5 pt-3">
        <Button size="xs" disabled={down} title={c.planHint} onClick={onPlan}>
          {starting === "plan" ? c.starting : c.start}
        </Button>
        {/* The panel hangs off this, so it lives inside. */}
        <span ref={anchor} className="relative flex">
          <Button
            size="xs"
            variant="ghost"
            className="font-[700]"
            aria-expanded={guard}
            disabled={down}
            title={c.buildHint}
            style={{
              borderColor: "var(--color-nb-accent-deep)",
              color: "var(--color-nb-accent-deep)",
            }}
            onClick={() => setGuard((was) => !was)}
          >
            {starting === "build" ? c.starting : c.build}
          </Button>
          <BuildGuard
            open={guard}
            anchorRef={anchor}
            onDismiss={() => setGuard(false)}
            onConfirm={() => {
              setGuard(false);
              onBuild();
            }}
          />
        </span>
        {failed && !starting && !failure && <span className="text-[11.5px] text-nb-ink-soft">{again}</span>}
        {flows && flows.length > 1 && (
          <WorkflowPick flows={flows} picked={workflow} disabled={down} onPick={onWorkflow} />
        )}
      </div>
      {/* Answered where it was pressed (#706): the row's own space below, never a bubble over
          the reply the answers stand under. The two above are live again, so pressing the
          same one is the retry — the plan, the transcript and the box are as they were. */}
      {failure && (
        <div className="px-2.5 pt-2.5">
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
      )}
    </div>
  );
}

/** Which workflow the plan's card runs through (#715): shown only when the board has more
 *  than one. Styled as the box's runtime picker (#847); it opens upward. */
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
  const nameOf = useWorkflowName();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const mine = flows.find((f) => f.id === picked) ?? flows.find((f) => f.isDefault) ?? flows[0]!;
  return (
    <span ref={box} className="relative ml-auto flex min-w-0">
      <button
        type="button"
        title={c.label}
        aria-label={c.label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((was) => !was)}
        className="flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] pl-2 pr-1.5 text-[12px] text-nb-ink hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: "var(--color-nb-accent-wash)" }}
      >
        <span className="max-w-[160px] truncate">{nameOf(mine)}</span>
        <FiChevronDown size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-1.5 w-[254px] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-1.5 shadow-[3px_3px_0_var(--color-nb-ink)]">
          {flows.map((f) => {
            // A workflow that cannot start would only write a card that stops on its first run.
            const off = f.problems.length > 0;
            return (
              <button
                key={f.id}
                type="button"
                aria-disabled={off || undefined}
                title={off ? w.notReadyHint : undefined}
                onClick={() => {
                  if (off) return;
                  onPick(f.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-[7px] px-3 py-2.5 text-left text-[12px] font-[700] ${
                  off ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                } ${f.id === mine.id ? "bg-nb-accent-soft" : ""}`}
              >
                <span className="min-w-0 truncate">{nameOf(f)}</span>
                {off && <span className="shrink-0 text-[10.5px] font-[700] text-nb-ink-soft">{w.notReady}</span>}
                {f.id === mine.id && <FiCheck className="shrink-0 text-[13px]" aria-hidden />}
              </button>
            );
          })}
          <div className="mt-1 border-t border-nb-ink/10 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                configDialog.open("agents");
              }}
              className="flex w-full cursor-pointer items-center justify-between rounded-[7px] px-3 py-2 text-left text-[12px] font-[600]"
            >
              {c.manage}
              <FiChevronDown className="-rotate-90 text-[12px]" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </span>
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

/** The guard Build now opens under the plan (#470, #840) — the one place a build starts from
 *  this screen. */
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
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] bg-nb-cream px-3.5 py-3 text-left transition-[background-color] duration-100 hover:brightness-[0.98]"
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
function PlanCard({ plan, tall = false }: { plan: PlanPanel; tall?: boolean }) {
  const c = useCopy().board.create.sheet.plan;
  const read = plan.read;
  const full = plan.full;
  // Enlarged is a PAGE in the middle of the sheet, and only where the card had a column of
  // its own to come back to. Opened out of the collapsed row there is no such column: the
  // plan takes the conversation's own, which is the width it was already reading at.
  const page = full && plan.beside;
  const { box, more } = usePlanScroll(plan.text, full, tall);
  return (
    <section
      aria-label={c.label}
      className={`group absolute top-0 z-10 mx-auto flex flex-col overflow-hidden rounded-[14px] bg-nb-cream ${
        tall ? "bottom-6" : "bottom-0"
      } ${!tall && !page ? COLUMN_MAX : ""}`}
      style={
        tall
          ? { right: PLAN_INSET, width: plan.width }
          : page
            ? {
                left: 0,
                right: 0,
                width: PLAN_READ + PLAN_PAD * 2,
                maxWidth: `calc(100% - ${PLAN_INSET * 2}px)`,
              }
            : { left: PLAN_INSET, right: PLAN_INSET }
      }
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
        {full ? <FiMinimize2 size={17} aria-hidden /> : <FiMaximize2 size={17} aria-hidden />}
      </button>
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
