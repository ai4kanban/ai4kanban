"use client";

// The first run, as a conversation (#280).
//
// It used to be three screens of boxes. The product's promise is that you hand it something
// vague and it works the rest out, and a form does the opposite — so one screen is kept, the
// agent picker, and the other two are talked through.
//
// One full window per step, one thing asked in each. No step rail, no board behind it, no
// transcript to scroll and no list of what the agent opened: the view IS the turn, so the
// only thing to read is the question and the only thing to do is answer it.
//
//   1 · the agent   the picker, moved to the front — nothing is ever run before it is
//                   answered, which is the whole reason it goes first
//   2 · the project the agent reads the repo and says what it thinks this is; the user
//                   agrees or says what is wrong. Nothing reaches disk before the press.
//   3 · the goal    asked on its own, always in the user's own words, never drafted
//
// The conversation is not a run: it is the chat the board already holds with its agent
// (lib/setup-chat.ts), so it takes no place in the runs panel and writes no run log. What
// follows from that is that nothing resumes one that went wrong — it is started over, or
// left for the screens behind "I'll fill it in myself".

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  finishSetupAgentStepAction,
  openSetupChatAction,
  readSetupChatAction,
  saveGoalAction,
  saveSetupProjectAction,
  saySetupChatAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { SetupChatRead } from "@/lib/setup-chat";
import type { AgentInfo, SetupDraft, SetupProposal, SetupStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { HarnessPicker, type RunTest } from "./Configuration";
import { DiscardNewBoard } from "./desktop";
import { GuideDrawer } from "./Guide";

// How often the conversation is re-read: fast while a turn is out, so the waiting view
// gives way the moment the reply lands; slow while it is the user's turn, where the only
// thing a read can still catch is a reply someone started in a terminal.
const LIVE_MS = 500;
const IDLE_MS = 2500;

export function FirstRun({
  steps,
  index,
  draft,
  agent,
  onAgentChanged,
  onSaved,
  onSkipGoal,
  onNoTalk,
  onBackToAgent,
  onByHand,
  onExit,
  canDiscard,
}: {
  /** The run's steps, in the order it asks them — agent, project, goal. */
  steps: SetupStep[];
  /** Which of them is being asked. */
  index: number;
  /** The board's answers as they stand, for the tracks a proposal is matched against. */
  draft: SetupDraft;
  agent: AgentInfo;
  /** The agent step just settled which agent runs the board. */
  onAgentChanged: (agent: AgentInfo) => void;
  /** A box was ticked: re-read the board, and move on. */
  onSaved: () => void;
  /** The goal is being left for later. It ticks nothing, and the run moves on. */
  onSkipGoal: () => void;
  /** This board cannot hold the conversation — rules too old, or an agent that can't
   *  resume a session. The project screen that exists today takes over. */
  onNoTalk: () => void;
  /** Back to the picker a failed turn came from. A turn fails because the agent is not
   *  logged in far more often than for any other reason, and the board's answer to that is
   *  the screen that tests it — never an explanation of how to log one in. */
  onBackToAgent: () => void;
  /** The way out of the conversation, to the screens that exist today. It carries the
   *  proposal on screen when there is one, so a correction already made is not lost by
   *  stepping off the conversation to finish by hand. */
  onByHand: (seed?: SetupProposal) => void;
  /** The way out to the board. */
  onExit: () => void;
  /** Whether the folder this board was made in can still be given back — the app
   *  makes one the moment a boardless folder is opened, and this is the way out of a
   *  folder picked by mistake. */
  canDiscard: boolean;
}) {
  const c = useCopy().setup.firstRun;
  const step = steps[index] ?? null;
  const at = index + 1;
  // What the conversation has settled — held here because the way out sits on the frame,
  // under every turn, rather than inside the turn that produced it. The last answer stands:
  // a turn still being waited on, and one that failed, both have no proposal of their own,
  // and the way out has to carry what was settled before them.
  const held = useRef<SetupProposal | null>(null);
  // Stable, because the conversation's poll is keyed on it — a new function every render
  // would restart the poll every render.
  const remember = useCallback((p: SetupProposal | null) => {
    if (p) held.current = p;
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-nb-paper">
      <div className="flex shrink-0 items-center gap-2.5 px-6 pt-5 sm:px-9">
        <span className="text-[13.5px] font-[800]">{c.title}</span>
        <span className="ml-auto">
          <Steps at={at} total={steps.length} label={c.step(at, steps.length)} />
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 sm:px-9">
        <div className="w-full max-w-[720px] py-8">
          {step?.name === "agent" && (
            <AgentTurn
              agent={agent}
              answered={step.done}
              onDone={(saved) => {
                if (saved) onAgentChanged(saved);
                onSaved();
              }}
            />
          )}
          {step?.name === "project" && (
            <ProjectTurn
              draft={draft}
              onSaved={onSaved}
              onNoTalk={onNoTalk}
              onProposal={remember}
              onBackToAgent={onBackToAgent}
            />
          )}
          {step?.name === "goal" && (
            <GoalTurn initial={draft.goal} onSaved={onSaved} onSkip={onSkipGoal} />
          )}
        </div>
      </div>

      {/* The same ways out on every turn. Choosing one is not an answer and is written
          nowhere — except the last, which is the folder itself being given back, and it
          stands apart on the right for that reason. */}
      <div className="flex shrink-0 items-center gap-5 border-t border-nb-ink/12 px-6 py-4 sm:px-9">
        <button
          type="button"
          className="cursor-pointer text-[13px] font-[700] text-nb-accent-deep underline-offset-2 hover:underline"
          onClick={() => onByHand(held.current ?? undefined)}
        >
          {c.byHand}
        </button>
        <button
          type="button"
          className="cursor-pointer text-[13px] font-[700] text-nb-ink-soft underline-offset-2 hover:text-nb-ink hover:underline"
          onClick={onExit}
        >
          {c.toBoard}
        </button>
        {canDiscard && (
          <span className="ml-auto">
            <DiscardNewBoard shape="link" />
          </span>
        )}
      </div>
    </div>
  );
}

// ---- 1 · the agent ----------------------------------------------------------

// The one step that can't be pressed past, and now the first thing a new user meets: the
// conversation costs a call to an agent, so nothing may start before one is chosen. It is
// the Configuration dialog's own Harness pane, as it was on the screen this replaces — the
// same picker, the same settings, the same Test.
//
// One button, and it is the test: pressing it runs the pane's own call and moves on only if
// that call came back. So the step can be pressed, and still cannot be pressed past.
function AgentTurn({
  agent,
  answered,
  onDone,
}: {
  agent: AgentInfo;
  answered: boolean;
  onDone: (agent?: AgentInfo) => void;
}) {
  const t = useCopy();
  const c = t.setup.firstRun.agent;
  const [passed, setPassed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  // The pane's own Test, handed up so this button can be the one that presses it.
  const runTest = useRef<RunTest["current"]>(null);

  const finish = async () => {
    setSaving(true);
    try {
      const res = await finishSetupAgentStepAction();
      if (!res.ok) {
        setError(res.error || t.setup.agent.saveFailed);
        return;
      }
      onDone(res.agent);
    } finally {
      setSaving(false);
    }
  };

  const go = async () => {
    setError(null);
    // A box already ticked, or a test that has just passed, is answered — asking for the
    // call again would spend one to learn what the pane above already says.
    if (!passed && !answered) {
      const run = runTest.current;
      if (!run) return;
      setTesting(true);
      let result: Awaited<ReturnType<typeof run>> = null;
      try {
        result = await run();
      } finally {
        setTesting(false);
      }
      // A test that did not pass stops here. The pane above has already said what came
      // back, in the agent's own words, and the board adds nothing to it.
      if (!result?.ok) return;
    }
    await finish();
  };

  const label = agent.options.find((o) => o.name === agent.name)?.label ?? agent.name;
  return (
    <>
      <Ask>{c.ask}</Ask>
      <Under>{c.blurb}</Under>
      <div className="mt-6">
        <HarnessPicker
          agent={agent}
          onError={setError}
          onTested={(r) => setPassed(Boolean(r?.ok))}
          runTest={runTest}
        />
      </div>
      {error && <Failure text={error} />}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button disabled={saving || testing} onClick={go}>
          {testing ? t.configuration.harness.test.running : saving ? t.shared.saving : c.test}
        </Button>
        <span className="text-[13px] text-nb-ink-soft">
          {passed || answered ? c.answered : c.testNote(label)}
        </span>
      </div>
    </>
  );
}

// ---- 2 · the project --------------------------------------------------------

// The turn that replaces the form's first screen. The agent reads the repo and comes back
// with one sentence about the project and the tracks its work falls into; the user agrees or
// says what is wrong. Nothing is written until Yes.
function ProjectTurn({
  draft,
  onSaved,
  onNoTalk,
  onProposal,
  onBackToAgent,
}: {
  draft: SetupDraft;
  onSaved: () => void;
  onNoTalk: () => void;
  /** What the last turn came back with, for the way out on the frame to carry. */
  onProposal: (proposal: SetupProposal | null) => void;
  onBackToAgent: () => void;
}) {
  const t = useCopy();
  const c = t.setup.firstRun;
  const [read, setRead] = useState<SetupChatRead | null>(null);
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  // Why the last turn could not be sent — the conversation itself went wrong, so the whole
  // view is the failure.
  const [error, setError] = useState<string | null>(null);
  // Why writing the answer failed. Kept apart from the turn: the agent said its piece and
  // the summary is still on screen, so this is a line under it rather than a dead end.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  // The board is waiting on a turn it just asked for. Held here as well as read from the
  // server, so the waiting view is up from the click rather than from the next poll.
  const [sent, setSent] = useState(false);

  const poll = useRef<() => void>(() => {});
  // The opening turn is sent once. Without this a send that never got off the ground would
  // be retried by every tick, which is the poll hammering the agent rather than the failed
  // view offering Try again.
  const opened = useRef(false);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const next = await readSetupChatAction().catch(() => null);
      if (!alive) return;
      if (next) {
        setRead(next);
        onProposal(next.proposal);
        if (!next.answering) setSent(false);
        // Nothing here can hold the conversation, so the screens that exist today take
        // over rather than the run stalling on a view that will never fill in.
        if (!next.supported) {
          onNoTalk();
          return;
        }
        // Nothing said yet: the board speaks first.
        if (!next.started && !opened.current) {
          opened.current = true;
          setSent(true);
          const res = await openSetupChatAction();
          if (alive && !res.ok) {
            setSent(false);
            setError(res.error ?? null);
          }
        }
      }
      if (alive) timer = setTimeout(tick, next?.answering ? LIVE_MS : IDLE_MS);
    };
    poll.current = () => {
      if (timer) clearTimeout(timer);
      void tick();
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [onNoTalk, onProposal]);

  const say = useCallback(
    async (text: string) => {
      setError(null);
      setSent(true);
      setSaid("");
      const res = await saySetupChatAction(text);
      if (!res.ok) {
        setSent(false);
        setError(res.error ?? null);
        return;
      }
      poll.current();
    },
    [],
  );

  const retry = useCallback(async () => {
    setError(null);
    setSent(true);
    const res = await openSetupChatAction();
    if (!res.ok) {
      setSent(false);
      setError(res.error ?? null);
      return;
    }
    poll.current();
  }, []);

  const agree = async () => {
    const proposal = read?.proposal;
    if (!proposal) return;
    setBusy(true);
    setSaveError(null);
    try {
      // The folder each track came from: the one the agent named where it is renaming one,
      // and the track's own name where it already exists. Without it a rename would make a
      // folder and strand the old one with its cards in it.
      const have = new Set(draft.tracks.map((t) => t.name));
      const tracks = proposal.tracks.map((row) => ({
        name: row.name,
        note: row.note,
        was: row.was && have.has(row.was) ? row.was : have.has(row.name) ? row.name : undefined,
      }));
      const res = await saveSetupProjectAction(proposal.name, proposal.description, tracks);
      if (!res.ok) {
        setSaveError(res.error || t.setup.project.saveFailed);
        return;
      }
      if (res.keptBecauseUsed?.length) {
        setKept(res.keptBecauseUsed);
        return;
      }
      onSaved();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const waiting = sent || !read || read.answering;
  if (waiting && !error) {
    return (
      <>
        <Spin />
        <div className="mt-6">
          <Ask>{c.reading.ask}</Ask>
          <Under>{c.reading.blurb}</Under>
        </div>
      </>
    );
  }

  // A turn that failed: what the agent said, verbatim, and the line that nothing was
  // written. The board never explains how to log a harness in.
  const failed = error ?? read?.failed ?? null;
  if (failed || !read?.proposal) {
    return (
      <>
        <div
          className="nb-panel-sm break-words p-4 text-[15px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
        >
          <span className="mr-1.5" aria-hidden>
            ⚠
          </span>
          <span className="whitespace-pre-wrap font-mono text-[13px]">{failed ?? c.failed.noAnswer}</span>
          <span className="mt-2 block text-[14px]">{c.failed.nothingWritten}</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={onBackToAgent}>{c.failed.backToAgent}</Button>
          <Button variant="ghost" onClick={retry}>
            {c.failed.retry}
          </Button>
        </div>
      </>
    );
  }

  const proposal = read.proposal;
  // A repo with nothing to read: what little it saw, one question, and no finding dressed
  // up as one.
  if (proposal.unsure) {
    return (
      <>
        <Ask>{proposal.summary}</Ask>
        {proposal.ask && <Under>{proposal.ask}</Under>}
        <Box value={said} onChange={setSaid} hint={c.yourWords} rows={3} />
        <div className="mt-5">
          <Button disabled={!said.trim()} onClick={() => void say(said)}>
            {c.project.send}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <ProjectHeading name={proposal.name} description={proposal.description} />
      {/* The tracks as a counted list, one to a line with what belongs in it — not four
          words in a row. A reader meeting the board for the first time has never heard of a
          track: the lead-in says how many and what one is, and each line says what that one
          holds, so what the Yes agrees to is on screen rather than assumed. */}
      {proposal.tracks.length > 0 && (
        <div className="mt-5">
          <p className="text-[16px] leading-[1.55]">{c.project.tracks(proposal.tracks.length)}</p>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-[15px] leading-[1.5]">
            {proposal.tracks.map((track) => (
              <Fragment key={track.name}>
                <dt className="font-mono text-[14px] font-[700]">{track.name}</dt>
                <dd className="min-w-0 text-nb-ink-soft">{track.note}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}
      <Under>{c.project.right}</Under>
      <Box value={said} onChange={setSaid} hint={c.project.hint} rows={3} />
      {saveError && <Failure text={saveError} />}

      {kept.length > 0 && (
        <div className="mt-4">
          <Failure text={(kept.length === 1 ? t.setup.project.keptOne : t.setup.project.keptMany)(kept.join(" and "))} />
          <div className="mt-3">
            <Button onClick={onSaved}>{t.setup.project.continue}</Button>
          </div>
        </div>
      )}

      {kept.length === 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button disabled={busy} onClick={agree}>
            {busy ? t.shared.saving : c.project.yes}
          </Button>
          <Button variant="ghost" disabled={!said.trim()} onClick={() => void say(said)}>
            {c.project.send}
          </Button>
        </div>
      )}
    </>
  );
}

// ---- 3 · the goal -----------------------------------------------------------

// The one answer nothing can settle for the user, so it gets a view of its own and an empty
// box: no draft, and nothing read off the repo. Text the user did not write is no goal.
function GoalTurn({
  initial,
  onSaved,
  onSkip,
}: {
  initial: string;
  onSaved: () => void;
  onSkip: () => void;
}) {
  const t = useCopy();
  const c = t.setup.firstRun.goal;
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await saveGoalAction(text);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || t.setup.goal.saveFailed);
      return;
    }
    onSaved();
  };

  return (
    <>
      <Ask>{c.ask}</Ask>
      <Under>{c.blurb}</Under>
      {/* The link alone: the drawer puts its `children` in front of the trigger, and this
          view has nothing to say in front of it. */}
      <GuideDrawer
        guide="what-makes-a-good-goal"
        title={c.guide}
        className="mt-3 text-[13px] font-[700] text-nb-accent-deep"
      >
        {""}
      </GuideDrawer>
      <Box value={text} onChange={setText} hint={t.setup.firstRun.yourWords} rows={6} autoFocus />
      {error && <Failure text={error} />}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button disabled={saving || !text.trim()} onClick={save}>
          {saving ? t.shared.saving : c.save}
        </Button>
        <button
          type="button"
          disabled={saving}
          className="cursor-pointer text-[13px] font-[700] text-nb-ink-soft underline-offset-2 hover:text-nb-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSkip}
        >
          {c.later}
        </button>
      </div>
    </>
  );
}

// ---- the pieces every view is made of ---------------------------------------

function Ask({ children }: { children: React.ReactNode }) {
  return <p className="text-[26px] font-[800] leading-[1.22] tracking-[-0.01em] sm:text-[30px]">{children}</p>;
}

function ProjectHeading({ name, description }: { name: string; description: string }) {
  return (
    <header>
      <h2 className="text-[26px] font-[800] leading-[1.22] tracking-[-0.01em] sm:text-[30px]">{name}</h2>
      {description && (
        <p className="mt-2 text-[16px] leading-[1.55] text-nb-ink-soft first-letter:uppercase">
          {description}
        </p>
      )}
    </header>
  );
}

function Under({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-[1.6] text-nb-ink-soft">{children}</p>;
}

/** The box the user answers in. Always empty to begin with: no draft, and nothing read off
 *  the repo — only a grey hint. */
function Box({
  value,
  onChange,
  hint,
  rows,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  hint: string;
  rows: number;
  autoFocus?: boolean;
}) {
  return (
    <textarea
      className={cn(
        "mt-5 w-full resize-y rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3.5 py-3",
        "text-[14px] leading-relaxed text-nb-ink placeholder:text-nb-ink-soft/60",
        "focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent",
      )}
      rows={rows}
      value={value}
      autoFocus={autoFocus}
      placeholder={hint}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** The agent is working. One turning arc and one line — never the files it opened, and
 *  never a blank screen, so a long read is honest without being noise. */
function Spin() {
  return (
    <svg viewBox="0 0 24 24" width={30} height={30} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2.6" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="var(--color-nb-accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="origin-center animate-spin"
        style={{ animationDuration: "1.1s" }}
      />
    </svg>
  );
}

/** Which of the run's steps this is. A dot each, and the count beside them. */
function Steps({ at, total, label }: { at: number; total: number; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[12px] font-[700] text-nb-ink-soft" role="img" aria-label={label}>
      <span className="flex items-center gap-[6px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="block size-[7px] rounded-full"
            style={{
              background:
                i === at - 1
                  ? "var(--color-nb-accent)"
                  : i < at - 1
                    ? "var(--color-nb-ink-soft)"
                    : "color-mix(in srgb, var(--color-nb-ink) 20%, transparent)",
            }}
          />
        ))}
      </span>
      <span className="ml-0.5 tabular-nums">{label}</span>
    </span>
  );
}

function Failure({ text }: { text: string }) {
  return (
    <div
      className="nb-panel-sm mt-4 break-words p-2.5 text-[12px] leading-relaxed"
      style={{ background: "var(--color-nb-peach-soft)" }}
    >
      {text}
    </div>
  );
}
