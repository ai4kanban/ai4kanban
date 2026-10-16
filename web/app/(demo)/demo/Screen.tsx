"use client";

// /demo: the desktop app walked through one fixed script — an idea, the plan it becomes, one
// of its cards revised and built. The screens are kanban-ui's own, fed this file's board;
// only the ringed control moves the script on, and nothing else answers a click.
import { ArchivedCardView } from "ai4kanban-ui/components/Archive";
import { Board } from "ai4kanban-ui/components/Board";
import { CardPage } from "ai4kanban-ui/components/CardPage";
import { ChatPane } from "ai4kanban-ui/components/Chat";
import { CreateSheet } from "ai4kanban-ui/components/CreateSheet";
import { useCopy } from "ai4kanban-ui/i18n/use-copy";
import type { ChatRail } from "ai4kanban-ui/lib/chat-rail";
import { heldByButton } from "ai4kanban-ui/lib/create-open";
import { ScreenActionsProvider, ScreenControlsProvider, ScreenMachineProvider, type ScreenActions } from "ai4kanban-ui/lib/screen";
import type { AgentInfo, ChatMessage, DiscussionTarget, SessionView } from "ai4kanban-ui/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import {
  ARCHIVED_39,
  BOARD_AFTER,
  BOARD_BEFORE,
  BUILDING,
  CHAT_REPLY,
  CHAT_SENT,
  DIFF_39,
  DISCUSSING_PAGE,
  GROUP_PAGE,
  IDEA,
  MOCKUPS,
  OPEN_AFTER_LANDING,
  OPENER,
  PLANNING,
  PROJECT_ROOT,
  REVISED_PAGE,
  REVISION,
  RUNS,
  SUBTASK_PAGE,
} from "./data";
import { Progress, ReplayButton, Ring, type Spot } from "./guide";
import { AGENT, chatRead, pending } from "./server";
import { Window, type RailChat } from "./shell";

const STEPS = 8;
/** How long an agent's work takes on screen, and how long the words take to type. */
const WORK_MS = 3000;
const TYPE_MS = 1500;

const DISCUSSION: DiscussionTarget = "discussion-demo";

const CHATS: RailChat[] = [
  { name: "Record a 60-second product video", cardId: 58, answering: true },
  { name: "Pricing for the 2.0 Pro plan" },
  { name: "Export notes as Markdown and PDF", cardId: 49 },
];
const CHATS_PLANNED: RailChat[] = [{ name: "Sync notes across devices", cardId: 38 }, ...CHATS];
const CHATS_REVISING: RailChat[] = [{ name: "Store notes in the cloud with end-to-end encryption", cardId: 39 }, ...CHATS_PLANNED];

/** The controls a card page offers here: the three the script's cards show. */
const CONTROLS = ["implement", "edit", "reject"] as const;

const $ = (selector: string) => document.querySelector(selector);
const button = (scope: string, text: string) =>
  [...document.querySelectorAll(`${scope} button`)].find((b) => b.textContent?.trim() === text) ?? null;

function stepFromUrl(): number {
  const n = Number(new URLSearchParams(location.search).get("step"));
  return Number.isInteger(n) && n >= 1 && n <= STEPS ? n : 1;
}

/** Type `text` into a controlled textarea the way a hand would, so its own onChange keeps it. */
function typeInto(box: HTMLTextAreaElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, text);
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Count from 0 to `length` over TYPE_MS, or jump straight there. */
function useTyped(length: number, on: boolean, instant: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return setN(0);
    if (instant) return setN(length);
    const started = performance.now();
    const timer = setInterval(() => {
      const next = Math.min(length, Math.round(((performance.now() - started) / TYPE_MS) * length));
      setN(next);
      if (next === length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [length, on, instant]);
  return n;
}

export default function DemoScreen() {
  const [step, setStep] = useState<number | null>(null);
  // An agent's step starts busy; a typing step starts with the words still coming.
  const [busy, setBusy] = useState(false);
  const [instant, setInstant] = useState(false);

  const go = useCallback((next: number) => {
    if (next === 2) {
      // The sheet opens on an empty box every time, as a fresh discussion does.
      localStorage.removeItem(`kanban-draft:create:${DISCUSSION}`);
      heldByButton.unspoken = DISCUSSION;
    }
    setStep(next);
    setBusy([3, 7, 8].includes(next));
    history.replaceState(null, "", next === 1 ? location.pathname : `?step=${next}`);
  }, []);

  useEffect(() => {
    setInstant(matchMedia("(prefers-reduced-motion: reduce)").matches);
    go(stepFromUrl());
  }, [go]);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), instant ? 0 : WORK_MS);
    return () => clearTimeout(timer);
  }, [busy, step, instant]);

  // The words the two typing steps write, and whether they have finished.
  const idea = useTyped(IDEA.length, step === 2, instant);
  const revision = useTyped(REVISION.length, step === 6, instant);
  useEffect(() => {
    if (step !== 2) return;
    let frame = 0;
    const fill = () => {
      const box = $("[data-demo-body] textarea");
      if (box instanceof HTMLTextAreaElement) {
        if (box.value !== IDEA.slice(0, idea)) typeInto(box, IDEA.slice(0, idea));
      } else frame = requestAnimationFrame(fill);
    };
    fill();
    return () => cancelAnimationFrame(frame);
  }, [step, idea]);
  const typing = (step === 2 && idea < IDEA.length) || (step === 6 && revision < REVISION.length);

  const sessions: SessionView[] = useMemo(
    () => [...RUNS, ...(busy && step === 3 ? [PLANNING] : []), ...(busy && step === 8 ? [BUILDING] : [])],
    [busy, step],
  );
  const actions = useMemo(() => demoActions(sessions), [sessions]);

  const c = useCopy();
  const spot = useMemo(() => (step === null || busy || typing ? null : spotFor(step, c.chat.send)), [step, busy, typing, c]);

  // Every press lands here first. Only the ringed control does anything, and what it does is
  // the script's next step — the screens under it never see the press.
  const press = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = spot?.find();
    if (step === null || !target || !(e.target instanceof Node) || !target.contains(e.target)) return;
    go(step === STEPS ? 1 : step + 1);
  };
  const block = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") return;
    if (e.key === "Enter" || e.key === " ") press(e);
    else block(e);
  };

  if (step === null) return null;

  const rail = step === 6 || step === 7;
  const chatDraft = step === 6 ? OPENER + REVISION.slice(0, revision) : "";
  const chatMessages: ChatMessage[] = step === 7 ? (busy ? [CHAT_SENT] : [CHAT_SENT, CHAT_REPLY]) : [];

  return (
    <div onClickCapture={press} onPointerDownCapture={block} onMouseDownCapture={block} onKeyDownCapture={key}>
      <ScreenActionsProvider value={actions}>
        <ScreenControlsProvider value={CONTROLS}>
          <ScreenMachineProvider value={{ projectRoot: PROJECT_ROOT, agent: AGENT_INFO, desktop: true, mockups: MOCKUPS[step === 8 || (step === 7 && !busy) ? 2 : 1] }}>
            <Window
              projectRoot={PROJECT_ROOT}
              running={sessions.length}
              unread={step === 8 && !busy ? 1 : 0}
              currentId={step === 4 ? 38 : step >= 5 && !(step === 8 && !busy) ? 39 : null}
              archive={step === 8 && !busy}
              total={step === 8 && !busy ? OPEN_AFTER_LANDING.length : (step <= 2 ? BOARD_BEFORE : BOARD_AFTER).board!.openIds.length}
              chats={step <= 2 ? CHATS : rail ? CHATS_REVISING : CHATS_PLANNED}
              chat={rail ? <DemoChat draft={chatDraft} messages={chatMessages} answering={step === 7 && busy} /> : undefined}
            >
              <Page step={step} busy={busy} />
            </Window>
          </ScreenMachineProvider>
        </ScreenControlsProvider>
      </ScreenActionsProvider>
      {spot && <Ring spot={spot} />}
      <Progress step={step} of={STEPS} chat={rail} replay={step === STEPS && !busy ? <ReplayButton /> : undefined} />
    </div>
  );
}

/** What the body shows at each step. Keyed so a screen that keeps its own copy of the board
 *  (Board does) reads the step's board afresh. */
function Page({ step, busy }: { step: number; busy: boolean }) {
  const k = `${step}-${busy}`;
  if (step <= 2)
    return (
      <>
        <Board key={k} screen={BOARD_BEFORE} tour={NO_TOUR} />
        {step === 2 && (
          <CreateSheet
            projectRoot={PROJECT_ROOT}
            discussion={DISCUSSION}
            onClose={noop}
            onSent={noop}
            onHandoff={noop}
            starting={null}
            failures={{}}
            onBecame={noop}
          />
        )}
      </>
    );
  if (step === 3) return <Board key={k} screen={BOARD_AFTER} tour={NO_TOUR} />;
  if (step === 4) return <CardPage key={k} screen={GROUP_PAGE} />;
  if (step === 5 || step === 6) return <CardPage key={k} screen={SUBTASK_PAGE} />;
  if (step === 7) return <CardPage key={k} screen={busy ? DISCUSSING_PAGE : REVISED_PAGE} />;
  if (busy) return <CardPage key={k} screen={REVISED_PAGE} />;
  return (
    <div className="h-full overflow-y-auto">
      <main className="mx-auto w-full max-w-[840px] px-6 py-6">
        <ArchivedCardView card={ARCHIVED_39} mockups={MOCKUPS[2]} diff={DIFF_39} />
      </main>
    </div>
  );
}

const noop = () => {};
const NO_TOUR = { owed: false, record: noop };

/** Where each step's ring goes. */
function spotFor(step: number, send: string): Spot {
  switch (step) {
    case 1:
      return { find: () => $('[data-demo="new-idea"]'), hint: "Start with an idea", side: "bottom", align: "end" };
    case 2:
      return { find: () => $(`[data-demo-body] button[aria-label="${send}"]`), hint: "Send it to your agent", side: "right" };
    case 3:
      return { find: () => $('[data-demo-body] a[href="/38"]'), hint: "Open the plan", side: "right", radius: 12 };
    case 4:
      return { find: () => $('[data-demo-body] a[href="/39"][aria-label^="#39 "]'), hint: "Open #39 first", side: "bottom", align: "start" };
    case 5:
      return { find: () => button("[data-demo-body] main", "Revise"), hint: "Change the draft", side: "right" };
    case 6:
      return { find: () => $(`#demo-chat button[aria-label="${send}"]`), hint: "Send the change", side: "left" };
    case 7:
      return { find: () => button("[data-demo-body] main", "Build"), hint: "Build and ship #39", side: "bottom", align: "start", tight: true };
    default:
      return { find: () => $('[data-demo="replay"]'), hint: "Watch it again", side: "top", align: "end" };
  }
}

const AGENT_INFO: AgentInfo = {
  name: "claude",
  command: "claude",
  isDefault: true,
  values: {},
  secretsSet: [],
  ignored: [],
  runtimes: [],
  options: [],
  machine: "",
  flows: [],
};

/** The screens' client: the runs it lists are the script's, and everything else waits forever. */
function demoActions(sessions: SessionView[]): ScreenActions {
  return new Proxy({} as ScreenActions, {
    get: (_, name) => (name === "listSessions" ? async () => sessions : pending),
  });
}

/** #39's conversation, as the script has it so far. */
function DemoChat({ draft, messages, answering }: { draft: string; messages: ChatMessage[]; answering: boolean }) {
  const panel = usePanelRef();
  const box = useRef<HTMLTextAreaElement | null>(null);
  const read = useMemo(() => chatRead(messages, answering), [messages, answering]);
  const rail: ChatRail = {
    cardId: 39,
    cardTitle: "Store notes in the cloud with end-to-end encryption",
    open: true,
    toggle: noop,
    fold: noop,
    overlay: false,
    unread: false,
    read,
    readFailed: false,
    retry: noop,
    live: answering ? "" : null,
    answering,
    stopped: null,
    stop: pending,
    background: 0,
    stopBackground: pending,
    draft,
    setDraft: noop,
    box,
    pasted: [],
    paste: pending,
    dropFiles: pending,
    unpaste: pending,
    pasteNote: null,
    imageSrc: () => "",
    pictures: { pasted: [], note: null, src: () => "", unpaste: noop, agent: AGENT, imagesAble: [AGENT] },
    recall: () => false,
    error: null,
    send: pending,
    say: pending,
    pickRuntime: pending,
    clear: pending,
    markRead: noop,
    panel,
    onLayoutChanged: noop,
    onDoubleClick: noop,
  };
  return (
    <div id="demo-chat" className="h-full">
      <ChatPane rail={rail} />
    </div>
  );
}
