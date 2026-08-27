"use client";

// The guided first run (#172), and the two notices the board keeps once it is
// over.
//
// Setting a board up used to mean copying a line into a coding agent and hoping.
// Now the board asks for what only the user knows itself — what the project is
// and its tracks, the goal, and which agent does the work — one question a
// screen, in place of the board. Everything else setup does reads the repo and
// thinks, so it is an agent's job — and the board starts that agent itself when
// asked (#173): one ordinary run, in the runs panel, doing every step still
// unticked. The line to paste into a coding agent stays beside the offer, for
// whoever would rather finish there.
//
// Three rules shape it:
//
//   • Nothing is a dead end. Every screen has a way through to the board, and the
//     board has a way back in, so leaving is never losing.
//   • Every answer starts on something sensible — the repo's own name, the
//     tracks the board was scaffolded with — so someone in a hurry can press
//     through and still end up with a working board.
//   • The agent step is the exception: it can't be pressed past. Setup says it is
//     finished by deleting its checklist, and the steps after this flow are agent
//     runs, so a board that finished setup without an agent was never set up. It
//     ends on one thing only: an agent that answered a test.
//
// The checklist is the state. Which of setup's boxes are ticked decides what the
// flow opens on and when it is over — there is no second record of how far the
// user got, so closing the window and coming back lands on the same screen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronUp, FiCopy, FiFlag, FiPlay, FiTerminal, FiX } from "react-icons/fi";
import {
  finishSetupAgentStepAction,
  getSetupDraftAction,
  saveGoalAction,
  saveSetupProjectAction,
} from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { cn } from "@/lib/utils";
import { type AgentInfo, GUIDED_STEPS, type SetupDraft, type SetupState, type SetupStep } from "@/lib/types";
import { Button } from "./button";
import { configDialog, HarnessPicker } from "./Configuration";
import { GoalEditor } from "./Goal";
import { GuideDrawer } from "./Guide";
import { Header } from "./Header";
import { sessionsPanel } from "./sessions";

/** What starting the setup run answered. Same shape every board action comes back
 *  with: it happened, or this line says why not. */
export interface StartAnswer {
  ok: boolean;
  error?: string;
}

// The steps the flow asks for itself, in the order it asks them — only the ones
// this board's checklist actually holds, so a board written by an older version
// is walked through whatever it has instead of screens with nothing behind them.
function guidedSteps(setup: SetupState): SetupStep[] {
  return GUIDED_STEPS.map((name) => setup.steps.find((s) => s.name === name)).filter(
    (s): s is SetupStep => Boolean(s),
  );
}

/** Should the board open on the guided run? Yes until its LAST step is ticked —
 *  the agent one, which can't be skipped. Tested on that step alone rather than
 *  on all of them, because the goal can be left for later: a user who skipped it
 *  and finished the run has been through the flow, and being asked again on
 *  every load would make "skip" mean nothing. */
export function needsFirstRun(setup: SetupState | null): boolean {
  if (!setup) return false;
  const steps = guidedSteps(setup);
  return steps.length > 0 && !steps[steps.length - 1].done;
}

/** Is there anything in the run still worth reopening it for? Any unanswered
 *  step, the skipped goal included — which is why this is a different question
 *  from the one above. The run stops opening ITSELF once the last step is
 *  answered, but a goal left for later has to stay one click away, or skipping
 *  it would mean losing the only way back to it until setup ends. */
export function setupHasQuestionsLeft(setup: SetupState | null): boolean {
  return Boolean(setup) && guidedSteps(setup as SetupState).some((s) => !s.done);
}

// ---- finishing the rest here (#173) ----------------------------------------
//
// The steps setup has left read the repo and think, so they need an agent — but
// not the user's own. The board starts one itself: an ordinary run, in the runs
// panel, doing every step still unticked. Both screens that used to hand the work
// over now offer it, with the line to paste beside the offer rather than instead
// of it.
//
// The two things that stand in for the offer, and why:
//
//   • a run already going — one at a time, so the second press has nothing to do
//     but watch the first
//   • no goal written — nothing after the goal can be planned from a goal nobody
//     wrote, so a run started there would stop on its first step

/** Start the setup run, holding what the press is doing and what it answered. The
 *  two screens share it because they are the same press in two places. */
function useFinishSetup(onStart: () => Promise<StartAnswer>) {
  const c = useCopy().setup.done;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await onStart();
      if (!res.ok) setError(res.error || c.startFailed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }, [onStart, c]);
  return { start, starting, error };
}

/** Is the goal still unwritten? Then the offer asks for it instead. A checklist
 *  with no goal box at all — one written by an older version — can't be asked, so
 *  it never stands in the way. */
function goalMissing(setup: SetupState): boolean {
  const goal = setup.steps.find((s) => s.name === "goal");
  return Boolean(goal && !goal.done);
}

/** The way into a setup run that is already going — shown wherever the offer
 *  would have been, so pressing again is never the way to find the log. Both
 *  screens wear the window's header, so the runs panel is always there to open. */
function WatchingSetup({ runId }: { runId: string }) {
  const c = useCopy().setup.run;
  return (
    <span className="flex items-center gap-2 text-[13px] text-nb-ink-soft">
      <span className="size-[8px] shrink-0 rounded-full bg-nb-accent-deep animate-[nbPulse_1.1s_ease-in-out_infinite]" aria-hidden />
      {c.watching}{" "}
      <button
        type="button"
        className="cursor-pointer underline underline-offset-2 hover:text-nb-accent-deep"
        onClick={() => sessionsPanel.open(runId)}
      >
        {c.watch}
      </button>
    </span>
  );
}

/** The newest setup run stopped short (#230) — it failed, or it was cut off. Said
 *  where the live run said it was working, so one spot carries the whole of a
 *  run's life instead of the strip going quiet on the half that went wrong. Why
 *  it stopped stays in the log; this only says that it did. The offer stands
 *  beside it unchanged — pressing it again is the retry, and the run picks up
 *  from the first step still unticked. */
function SetupRunFailed({ runId }: { runId: string }) {
  const c = useCopy().setup.run;
  return (
    <span className="text-[13px]" style={{ color: "var(--color-nb-peach-ink)" }}>
      <span className="mr-1" aria-hidden>
        ⚠
      </span>
      {c.failed}{" "}
      <button
        type="button"
        className="cursor-pointer underline underline-offset-2 hover:text-nb-ink"
        onClick={() => sessionsPanel.open(runId)}
      >
        {c.readLog}
      </button>{" "}
      {c.failedAfter}
    </span>
  );
}

// Whether the user stepped out to look at the board, for this browser session
// only. Nothing is written to the board files: leaving the flow is not an answer,
// and a board that remembered it on disk would be a board that never asks again.
const LEFT_KEY = "kanban-ui.setup-left";

export function SetupFlow({
  setup,
  agent,
  projectRoot,
  goalWritten,
  desktop,
  setupInstruction,
  skillInstalled,
  setupRunId,
  failedSetupRunId,
  onFinishSetup,
  onAgentChanged,
  onSaved,
  onExit,
}: {
  setup: SetupState;
  agent: AgentInfo;
  /** The repo the header's badge names. The flow wears the window's own top row:
   *  in the app that row is the window's title bar (#175) — the traffic lights
   *  sit in it and it is what the window is dragged by — so a screen drawn
   *  without it is a window with lights over its content and nothing to hold. */
  projectRoot: string;
  /** Whether `memory/goal.md` holds the user's words — the header's goal chip. */
  goalWritten: boolean;
  /** Running inside the desktop app (#175), for the header's folder badge. */
  desktop: boolean;
  /** The line to paste into a coding agent, for the user who would rather finish
   *  there — from lib/agent.ts, so it is worded for the agent they picked. */
  setupInstruction: string;
  /** Whether that line would reach anything (#174). A board arrives without the
   *  skill now, so handing the line over on a project that has none would be
   *  handing over a paste that answers "I don't know that skill". */
  skillInstalled: boolean;
  /** The setup run going right now, from this tab or another (#173). */
  setupRunId: string | null;
  /** The newest setup run, when it stopped short and none has been started since
   *  (#230). Null while one is going, after one passed, and after one the user
   *  stopped — that one is not a failure. */
  failedSetupRunId: string | null;
  /** Start one. The board owns the run, so this only reports what it answered. */
  onFinishSetup: () => Promise<StartAnswer>;
  /** The agent step just answered the question this flow's last screen is drawn
   *  from — which agent runs the board, or none of them. */
  onAgentChanged: (agent: AgentInfo) => void;
  /** Re-read the board: every answer here changes a file the board is drawn from. */
  onSaved: () => void;
  /** Leave the flow for the board. The board keeps a way back in. */
  onExit: () => void;
}) {
  const c = useCopy().setup;
  const steps = useMemo(() => guidedSteps(setup), [setup]);
  // Where the flow opens: the first unanswered step. Held from here on, so
  // Continue and the steps down the side are what move it — a box that ticks
  // itself as it saves must not also drag the screen along under the user's hands.
  const [index, setIndex] = useState(() => {
    const at = steps.findIndex((s) => !s.done);
    return at === -1 ? steps.length : at;
  });
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  // The goal left for later. Kept for this run only — it changes nothing on disk,
  // it just stops the flow from parking on a screen the user walked past.
  const [goalSkipped, setGoalSkipped] = useState(false);
  // What a header control couldn't save — surfaced here, where the user is.
  const [chromeError, setChromeError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSetupDraftAction()
      .then((d) => alive && setDraft(d))
      .catch((e) => alive && setReadError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const step = steps[index] ?? null;
  const advance = useCallback(() => setIndex((i) => i + 1), []);

  return (
    // The same frame the board is drawn in (components/Window.tsx): the top row
    // and a rail sit straight on the window's cream, and the body says where it
    // starts by being paper. The rail holds the steps instead of open cards, so
    // setup reads as this window asking, not as a web page floating over it.
    <div className="flex h-screen flex-col overflow-hidden bg-nb-cream">
      <Header
        agent={agent}
        projectRoot={projectRoot}
        onError={setChromeError}
        goalWritten={goalWritten}
        desktop={desktop}
      />
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* What has been settled so far, the way back to any of it, and the way
            out to the board at its foot. */}
        <StepRail
          steps={steps}
          index={index}
          draft={draft}
          agent={agent}
          goalSkipped={goalSkipped}
          onGo={setIndex}
          onExit={onExit}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-[14px] bg-nb-paper">
          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8">
            <div className="w-full max-w-[720px]">
              {chromeError && (
                <div className="mb-4">
                  <Failure text={chromeError} />
                </div>
              )}
              {readError && <Failure text={readError} />}
              {!draft && !readError && (
                <p className="text-[13px] italic text-nb-ink-soft">{c.reading}</p>
              )}

              {draft && step?.name === "project" && (
                <ProjectStep
                  draft={draft}
                  onChange={setDraft}
                  onSaved={() => {
                    onSaved();
                    advance();
                  }}
                />
              )}

              {draft && step?.name === "goal" && (
                <GoalStep
                  initial={draft.goal}
                  onSkip={() => {
                    setGoalSkipped(true);
                    advance();
                  }}
                  onSaved={(text) => {
                    setDraft({ ...draft, goal: text });
                    setGoalSkipped(false);
                    onSaved();
                    advance();
                  }}
                />
              )}

              {draft && step?.name === "agent" && (
                <AgentStep
                  agent={agent}
                  answered={step.done}
                  onDone={(saved) => {
                    if (saved) onAgentChanged(saved);
                    onSaved();
                    advance();
                  }}
                />
              )}

              {draft && !step && (
                <DoneStep
                  setup={setup}
                  instruction={setupInstruction}
                  skillInstalled={skillInstalled}
                  runId={setupRunId}
                  failedRunId={failedSetupRunId}
                  onStart={onFinishSetup}
                  // The goal was left for later, and the run needs it. Back to
                  // that screen rather than a second goal box here: the one on
                  // the goal step is the flow's own, and it ticks the box.
                  onWriteGoal={() => {
                    const at = steps.findIndex((s) => s.name === "goal");
                    if (at >= 0) setIndex(at);
                  }}
                  onExit={onExit}
                />
              )}
            </div>
          </main>

          {/* The way to hand what is left to a coding agent, from any step. */}
          <Handover instruction={setupInstruction} skillInstalled={skillInstalled} />
        </div>
      </div>
    </div>
  );
}

// The window's rail, worn by setup: what the flow is, the steps down the side —
// each showing what it has settled — and the way out to the board at its foot. A
// step already answered can be gone back to — nothing here is one-way — and the
// one being asked is marked. Steps ahead are listed but not reachable: they read
// the answers before them.
function StepRail({
  steps,
  index,
  draft,
  agent,
  goalSkipped,
  onGo,
  onExit,
}: {
  steps: SetupStep[];
  index: number;
  draft: SetupDraft | null;
  agent: AgentInfo;
  goalSkipped: boolean;
  onGo: (index: number) => void;
  onExit: () => void;
}) {
  const c = useCopy().setup;
  const settled = (name: string): string => {
    if (!draft) return "";
    if (name === "project") {
      return draft.project.name
        ? draft.tracks.length === 1
          ? c.rail.projectSettledOne(draft.project.name)
          : c.rail.projectSettledMany(draft.project.name, draft.tracks.length)
        : "";
    }
    if (name === "goal") {
      if (draft.goal.trim()) return c.rail.goalWritten;
      return goalSkipped ? c.rail.goalSkipped : "";
    }
    if (name === "agent") {
      return agent.options.find((o) => o.name === agent.name)?.label ?? agent.name;
    }
    return "";
  };

  return (
    <div className="flex shrink-0 flex-col p-3 sm:w-[248px]">
      <div className="px-3 pb-4 pt-1">
        <h1 className="text-[15px] font-[800] leading-tight">{c.rail.title}</h1>
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">{c.rail.blurb}</p>
      </div>
      <nav aria-label={c.rail.steps} className="flex flex-col gap-1">
        {steps.map((step, i) => {
          const on = i === index;
          const reachable = step.done || i <= index;
          const note = step.done || on ? settled(step.name) : "";
          return (
            <button
              key={step.name}
              type="button"
              aria-current={on}
              disabled={!reachable}
              onClick={() => onGo(i)}
              className={`flex w-full items-start gap-2 rounded-[8px] px-3 py-2 text-left transition-colors duration-100 ${
                on
                  ? "bg-nb-accent-soft text-nb-accent-deep"
                  : reachable
                    ? "cursor-pointer text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink"
                    : "text-nb-ink-soft/50"
              }`}
            >
              <span className="mt-[3px] shrink-0">
                {step.done ? (
                  <FiCheck className="text-[13px]" aria-hidden />
                ) : (
                  <span
                    className="block size-[9px] rounded-full border-[1.5px] border-current"
                    aria-hidden
                  />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-[700]">{stepTitle(c, step.name)}</span>
                {note && <span className="mt-0.5 block truncate text-[11.5px]">{note}</span>}
              </span>
            </button>
          );
        })}
      </nav>
      {/* Leaving is never losing (the rules above) — the board keeps a way back in. */}
      <div className="mt-auto pt-3">
        <Button variant="ghost" size="sm" className="w-full" onClick={onExit}>
          {c.rail.exit}
        </Button>
      </div>
    </div>
  );
}

// The checklist's own wording is written for whoever runs setup from a terminal.
// On screen each step is a question being asked, so it gets a short title of its own
// (`i18n/setup`); the names are the script's. The checklist's own name for the last
// step is `agent` and stays that way — the rename is what the user reads, not what the
// command prints (#191).
function stepTitle(c: ReturnType<typeof useCopy>["setup"], name: string): string {
  return c.stepTitles[name as keyof typeof c.stepTitles] ?? name;
}

// ---- step 1: the project and its tracks ------------------------------------

function ProjectStep({
  draft,
  onChange,
  onSaved,
}: {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  onSaved: () => void;
}) {
  const t = useCopy();
  const c = t.setup.project;
  const shared = t.shared;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState<string[]>([]);

  const setTracks = (tracks: SetupDraft["tracks"]) => onChange({ ...draft, tracks });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveSetupProjectAction(
        draft.project.name,
        draft.project.description,
        draft.tracks,
      );
      if (!res.ok) {
        setError(res.error || c.saveFailed);
        return;
      }
      // A track that holds cards is never deleted out from under them. Say so
      // rather than moving on as if it had gone.
      if (res.keptBecauseUsed?.length) {
        setKept(res.keptBecauseUsed);
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepBody title={c.title} blurb={c.blurb}>
      <Field label={c.name}>
        <input
          className={INPUT}
          value={draft.project.name}
          autoFocus
          onChange={(e) => onChange({ ...draft, project: { ...draft.project, name: e.target.value } })}
        />
      </Field>
      <Field label={c.what}>
        <input
          className={INPUT}
          value={draft.project.description}
          placeholder={c.whatPlaceholder}
          onChange={(e) =>
            onChange({ ...draft, project: { ...draft.project, description: e.target.value } })
          }
        />
      </Field>

      <div className="mt-5 border-t border-nb-ink/12 pt-4">
        <p className="text-[13px] font-[800]">{c.tracks}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">
          <Rich>{c.tracksBlurb}</Rich>
        </p>
        <TrackRows tracks={draft.tracks} used={draft.usedTracks} onChange={setTracks} />
      </div>

      {kept.length > 0 && (
        <div className="mt-4">
          <Failure
            text={(kept.length === 1 ? c.keptOne : c.keptMany)(kept.join(" and "))}
          />
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={onSaved}>
              {c.continue}
            </Button>
          </div>
        </div>
      )}

      {error && <div className="mt-4"><Failure text={error} /></div>}

      {kept.length === 0 && (
        <StepButtons>
          <Button size="sm" disabled={saving || !draft.project.name.trim()} onClick={save}>
            {saving ? shared.saving : c.continue}
          </Button>
        </StepButtons>
      )}
    </StepBody>
  );
}

// The track list: a row each, a line saying what belongs in it, and a way to add
// or drop one. A track that already holds cards keeps its remove button away —
// dropping it would be dropping the work in it — but it can still be renamed,
// since a rename moves the folder and the cards go with it.
function TrackRows({
  tracks,
  used,
  onChange,
}: {
  tracks: SetupDraft["tracks"];
  used: string[];
  onChange: (tracks: SetupDraft["tracks"]) => void;
}) {
  const c = useCopy().setup.project;
  const patch = (i: number, next: Partial<SetupDraft["tracks"][number]>) =>
    onChange(tracks.map((t, at) => (at === i ? { ...t, ...next } : t)));

  return (
    <div className="mt-3 flex flex-col gap-2">
      {tracks.map((track, i) => {
        const locked = Boolean(track.was && used.includes(track.was));
        return (
          <div key={i} className="flex items-center gap-2">
            <input
              className={cn(INPUT, "w-[150px] shrink-0 font-mono text-[13px]")}
              value={track.name}
              aria-label={c.trackName(i + 1)}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <input
              className={cn(INPUT, "min-w-0 flex-1")}
              value={track.note}
              aria-label={c.trackNote(track.name || c.thisTrack)}
              placeholder={c.trackNotePlaceholder}
              onChange={(e) => patch(i, { note: e.target.value })}
            />
            <button
              type="button"
              disabled={locked || tracks.length === 1}
              title={locked ? c.trackLocked(track.was ?? "") : c.dropTrackHint}
              aria-label={c.dropTrack(track.name)}
              onClick={() => onChange(tracks.filter((_, at) => at !== i))}
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] text-nb-ink-soft transition-colors hover:bg-nb-ink/8 hover:text-nb-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <FiX className="text-[15px]" />
            </button>
          </div>
        );
      })}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...tracks, { name: "", note: "" }])}
        >
          {c.addTrack}
        </Button>
      </div>
    </div>
  );
}

// ---- step 2: the goal ------------------------------------------------------

function GoalStep({
  initial,
  onSkip,
  onSaved,
}: {
  initial: string;
  onSkip: () => void;
  onSaved: (text: string) => void;
}) {
  const t = useCopy();
  const c = t.setup.goal;
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await saveGoalAction(text);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || c.saveFailed);
      return;
    }
    onSaved(text);
  };

  return (
    <StepBody title={c.title} blurb={c.blurb}>
      <textarea
        className={cn(INPUT, "min-h-[220px] resize-y font-mono leading-relaxed")}
        value={text}
        autoFocus
        placeholder={c.placeholder}
        onChange={(e) => setText(e.target.value)}
      />
      <GuideDrawer
        guide="what-makes-a-good-goal"
        title={c.guideTitle}
        className="mt-2 text-[12px] leading-relaxed text-nb-ink-soft"
      >
        {c.guideLine}
      </GuideDrawer>

      {error && <div className="mt-4"><Failure text={error} /></div>}

      <StepButtons>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onSkip}>
          {c.skip}
        </Button>
        <Button size="sm" disabled={saving || !text.trim()} onClick={save}>
          {saving ? t.shared.saving : t.setup.project.continue}
        </Button>
      </StepButtons>
    </StepBody>
  );
}

// ---- step 3: the harness ----------------------------------------------------

// The one step that can't be pressed past. It is the Configuration dialog's own
// Harness pane — the same picker, the same settings, the same Test — because this
// is the same question, and a second screen asking it in other words would be a
// second place to keep right. It is called Harness here for the same reason it is
// called that in the dialog (#191): a first run that says Agent and a dialog that
// says Harness are two names for one thing, and a new user meets both.
//
// One thing opens Continue: a test that passed. There is no answer of the form
// "none of them" — the board always runs the agent it was given, and everything
// this flow leads to is a run, so an agent that hasn't answered once is a board
// that will fail on its first press instead of here, where the picker is.
function AgentStep({
  agent,
  answered,
  onDone,
}: {
  agent: AgentInfo;
  /** This box is already ticked — the run has been through here before, and is
   *  back only because an earlier step was left for later. Answered is answered:
   *  Continue moves on without asking for the test again. */
  answered: boolean;
  /** The agent setting as it reads after the answer is saved, when the save could
   *  report one — the screens after this one are drawn from it. */
  onDone: (agent?: AgentInfo) => void;
}) {
  const t = useCopy();
  const c = t.setup.agent;
  const [passed, setPassed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      const res = await finishSetupAgentStepAction();
      if (!res.ok) {
        setError(res.error || c.saveFailed);
        return;
      }
      onDone(res.agent);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepBody title={c.title} blurb={c.blurb}>
      <HarnessPicker
        agent={agent}
        onError={setError}
        onTested={(result) => setPassed(Boolean(result?.ok))}
      />

      {error && <div className="mt-4"><Failure text={error} /></div>}

      <StepButtons>
        <p className="mr-auto text-[12px] leading-relaxed text-nb-ink-soft">
          {passed || answered ? c.answered : c.testFirst}
        </p>
        <Button size="sm" disabled={saving || (!passed && !answered)} onClick={finish}>
          {saving ? t.shared.saving : t.setup.project.continue}
        </Button>
      </StepButtons>
    </StepBody>
  );
}

// ---- the closing screen ----------------------------------------------------

// What is left after the questions: the steps that read the repo and think. The
// board runs them itself now (#173) — one press, one run — and the line to paste
// into a coding agent sits under it for whoever would rather finish there.
function DoneStep({
  setup,
  instruction,
  skillInstalled,
  runId,
  failedRunId,
  onStart,
  onWriteGoal,
  onExit,
}: {
  setup: SetupState;
  instruction: string;
  skillInstalled: boolean;
  runId: string | null;
  failedRunId: string | null;
  onStart: () => Promise<StartAnswer>;
  onWriteGoal: () => void;
  onExit: () => void;
}) {
  const c = useCopy().setup.done;
  const left = setup.steps.filter((s) => !s.done);
  const { start, starting, error } = useFinishSetup(onStart);
  const noGoal = goalMissing(setup);
  return (
    <StepBody title={c.title} blurb={c.blurb}>
      {left.length > 0 && (
        <ul className="flex flex-col gap-2">
          {left.map((step) => (
            <li key={step.name} className="flex items-start gap-2 text-[13px] leading-relaxed">
              <span
                className="mt-[6px] size-[6px] shrink-0 rounded-full bg-nb-ink/30"
                aria-hidden
              />
              <Ticks text={step.text} />
            </li>
          ))}
        </ul>
      )}

      {/* The offer, or what stands in for it. */}
      <div className="mt-5 nb-panel-sm p-3" style={{ background: "var(--color-nb-accent-soft)" }}>
        {runId ? (
          <WatchingSetup runId={runId} />
        ) : noGoal ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] leading-relaxed">
            <span className="min-w-0 flex-1">
              <Rich>{c.goalFirst}</Rich>
            </span>
            <Button size="sm" className="shrink-0" onClick={onWriteGoal}>
              {c.writeGoal}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] leading-relaxed">
            <span className="min-w-0 flex-1">
              {failedRunId ? (
                <SetupRunFailed runId={failedRunId} />
              ) : (
                <Rich>{c.offer}</Rich>
              )}
            </span>
            <Button size="sm" className="shrink-0" disabled={starting} onClick={start}>
              <FiPlay className="text-[13px]" aria-hidden />
              {starting ? c.starting : c.finish}
            </Button>
          </div>
        )}
        {error && <div className="mt-3"><Failure text={error} /></div>}
      </div>

      <div className="mt-5">{!skillInstalled && <AddSkillFirst />}</div>
      <p className="text-[13px] leading-relaxed text-nb-ink-soft">{c.handOver}</p>
      <CopyLine text={instruction} />

      <StepButtons>
        <Button size="sm" onClick={onExit}>
          {c.open}
        </Button>
      </StepButtons>
    </StepBody>
  );
}

// ---- the board's own notices -----------------------------------------------

/** The way back into an unfinished setup, on the board itself (#172). A plain
 *  strip under the columns, not a card floating in a corner: the corner card
 *  could be hidden for the session and then never found again, and setup left
 *  half-done is a state of the board, not a nudge to dismiss. */
export function SetupNotice({
  setup,
  skillInstalled,
  setupRunId,
  failedSetupRunId,
  onFinishSetup,
  onResume,
}: {
  setup: SetupState;
  /** Whether a coding agent can see this board (#174). When it can't, the way out
   *  of this strip is the button that adds the skill — and the gear is on screen
   *  here, so it can open that pane. */
  skillInstalled: boolean;
  /** The setup run going right now, from this tab or another. */
  setupRunId: string | null;
  /** The newest setup run, when it stopped short and none has been started since
   *  (#230). Null while one is going, after one passed, and after one the user
   *  stopped. */
  failedSetupRunId: string | null;
  /** Start one. */
  onFinishSetup: () => Promise<StartAnswer>;
  /** Reopen the guided run. Absent when there is nothing left in it to ask —
   *  which is also how this strip knows the goal is written, since the goal is
   *  the one question of the run that can be walked past. */
  onResume?: () => void;
}) {
  const t = useCopy();
  const c = t.setup.notice;
  const { finish: finishLabel, starting: startingLabel } = t.setup.done;
  const { start, starting, error } = useFinishSetup(onFinishSetup);
  // The offer stands only once the run's own questions are answered. While one is
  // outstanding it is the goal — nothing after it can be planned — and Continue
  // setup is the way back to it, so the two would be the same press said twice.
  const canFinish = !onResume;
  return (
    <div
      className="mx-4 mb-4 shrink-0 nb-panel-sm p-3 text-[13px] sm:mx-6"
      style={{ background: "var(--color-nb-accent-soft)" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Meter done={setup.done} total={setup.total} label={c.meter(setup.done, setup.total)} />
        <span className="min-w-0 flex-1">
          <strong>{c.title}</strong>{" "}
          {setupRunId ? (
            <span className="text-nb-ink-soft">{c.working}</span>
          ) : failedSetupRunId ? (
            <SetupRunFailed runId={failedSetupRunId} />
          ) : setup.next ? (
            <span className="text-nb-ink-soft">
              {c.next} <Ticks text={setup.next.text} />
            </span>
          ) : (
            <span className="text-nb-ink-soft">{c.lastStep}</span>
          )}
        </span>
        {/* The run in flight wins over every offer: one at a time, and the way to
            it is the log, not a second press. */}
        {setupRunId ? (
          <WatchingSetup runId={setupRunId} />
        ) : (
          <>
            {onResume && (
              <Button size="sm" className="shrink-0" onClick={onResume}>
                {c.resume}
              </Button>
            )}
            {canFinish && (
              <Button size="sm" className="shrink-0" disabled={starting} onClick={start}>
                <FiPlay className="text-[13px]" aria-hidden />
                {starting ? startingLabel : finishLabel}
              </Button>
            )}
            {/* Handing the rest to a coding agent lives inside the run, one
                press away through Continue setup, so it isn't repeated here. What
                the strip does carry is the board with no skill at all, where that
                path would reach nothing; the gear is on screen from here, so it
                opens that pane rather than naming a command. */}
            {!skillInstalled && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                title={c.addSkillHint}
                onClick={() => configDialog.open("skill")}
              >
                <FiTerminal className="text-[13px]" aria-hidden />
                {c.addSkill}
              </Button>
            )}
          </>
        )}
      </div>
      {error && <div className="mt-3"><Failure text={error} /></div>}
    </div>
  );
}

/** The goal ask, long after setup (#53, #108): `goal.md` is empty, or an agent
 *  judged what is in it too vague to plan from. It rides on nothing — a board
 *  asking for a goal is not a board in setup — and the ✕ hides it for the
 *  browser session, since a board that otherwise works shouldn't carry a band it
 *  can't put down. */
export function GoalNotice({ onSaved }: { onSaved: () => void }) {
  // Start hidden and reveal after mount: sessionStorage doesn't exist during SSR,
  // so reading it in the first render would mismatch the server's markup.
  const c = useCopy().setup.goalNotice;
  const [dismissed, setDismissed] = useState(true);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setDismissed(sessionStorage.getItem(GOAL_DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;
  return (
    <div
      className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6"
      style={{ background: "var(--color-nb-accent-soft)" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="nb-tag shrink-0">
          {/* `.nb-tag` sets its own ink, so the one bit of accent goes on the icon. */}
          <FiFlag className="h-[12px] w-[12px]" style={{ color: "var(--color-nb-accent)" }} aria-hidden />
          {c.tag}
        </span>
        <span className="min-w-0 flex-1 text-nb-ink-soft [&_strong]:text-nb-ink">
          <Rich>{c.body}</Rich>
        </span>
        <Button size="sm" className="shrink-0" onClick={() => setEditing(true)}>
          {c.write}
        </Button>
        <button
          onClick={() => {
            sessionStorage.setItem(GOAL_DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label={c.dismiss}
          title={c.dismissHint}
          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] text-nb-ink-soft transition-[transform,background-color,color] duration-100 hover:bg-nb-ink/8 hover:text-nb-ink active:scale-90"
        >
          <FiX className="h-[14px] w-[14px]" />
        </button>
      </div>

      {editing && (
        <GoalEditor
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            // A saved goal is written and `reviewed: pending`, so the re-read
            // clears this on its own.
            onSaved();
          }}
        />
      )}
    </div>
  );
}

const GOAL_DISMISS_KEY = "kanban-ui.goal-notice-dismissed";

/** Did the user step out of the flow to look at the board? Session-only. */
export const leftSetup = {
  read: () => typeof window !== "undefined" && sessionStorage.getItem(LEFT_KEY) === "1",
  set: (left: boolean) => {
    if (typeof window === "undefined") return;
    if (left) sessionStorage.setItem(LEFT_KEY, "1");
    else sessionStorage.removeItem(LEFT_KEY);
  },
};

// ---- shared pieces ---------------------------------------------------------

const INPUT =
  "w-full rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent";

function StepBody({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <h2 className="text-[17px] font-[750] leading-tight">{title}</h2>
      <p className="mt-1.5 mb-4 text-[13px] leading-relaxed text-nb-ink-soft">{blurb}</p>
      {children}
    </div>
  );
}

function StepButtons({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">
        {label}
      </span>
      {children}
    </div>
  );
}

// The footer every screen carries: the way to hand the rest to a coding agent,
// for someone who would rather work there. It sits on the footer rather than on
// one screen, because wanting it is a fair thing at any point in the run.
//
// It is a drawer, not a note. The whole bar is the button — chevron at its far
// edge, hover on the row — and opening it raises half the window: this path
// REPLACES the guided one, so it gets the room the questions have rather than a
// strip under them. The slide is the rail's Memory panel's: a 0fr → 1fr grid
// row, which needs no measuring, with the content mounted throughout so there
// is something to slide — just off the tab order until it is open.
function Handover({ instruction, skillInstalled }: { instruction: string; skillInstalled: boolean }) {
  const c = useCopy().setup.handover;
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0 border-t border-nb-ink/12 bg-nb-wash">
      <button
        type="button"
        onClick={() => setOpen((on) => !on)}
        aria-expanded={open}
        aria-controls="setup-handover"
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-6 py-3 text-[12px] font-[600] text-nb-ink-soft transition-colors duration-100 hover:bg-nb-ink/5 hover:text-nb-ink sm:px-10"
      >
        <span className="flex items-center gap-2">
          <FiTerminal className="text-[13px]" aria-hidden />
          {open ? c.close : c.open}
        </span>
        <FiChevronUp
          aria-hidden
          className={`text-[14px] transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        {/* The height and breathing room live inside the sliding row, not on it:
            padding is floor a 0fr track can't shrink past, and closed has to
            close all the way. */}
        <div id="setup-handover" inert={!open} className="min-h-0">
          <div className="h-[50vh] overflow-y-auto px-6 pb-6 pt-2 sm:px-10">
            <div className="max-w-[720px]">
              <h3 className="text-[17px] font-[750] leading-tight">{c.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-nb-ink-soft">{c.blurb}</p>
              <div className="mt-4">
                {!skillInstalled && <AddSkillFirst />}
                <CopyLine text={instruction} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The line that adds the skill, without which a paste into a coding agent reaches nothing
 *  (#174). Shown wherever the board hands that paste over on a project that has no skill.
 *
 *  It is the command rather than a button: whoever is reading it is already headed for a
 *  terminal to paste the line below, so both lines land in the same place. On the board
 *  itself the strip offers the button instead. `npx` rather than `akb`, since someone who
 *  never installed the command can still run it. */
export function AddSkillFirst() {
  const c = useCopy().setup;
  return (
    <div className="mb-3">
      <p className="mb-1 text-[12px] leading-relaxed text-nb-ink-soft [&_strong]:text-nb-ink">
        <Rich>{c.addSkillFirst}</Rich>
      </p>
      <CopyLine text={ADD_SKILL_COMMAND} />
    </div>
  );
}

const ADD_SKILL_COMMAND = "npx ai4kanban@latest skill install";

// The checklist writes a step's file paths in backticks. Render those as code and
// leave the rest as plain text — the wording is the script's, shown as written.
function Ticks({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="font-mono text-[12px]">
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// How far setup got: one short segment per step, filled as far as it got, with
// the count beside it.
function Meter({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2" role="img" aria-label={label}>
      <span className="flex items-center gap-[4px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="h-[6px] w-[18px] rounded-[3px]"
            style={{
              background:
                i < done
                  ? "var(--color-nb-accent)"
                  : "color-mix(in srgb, var(--color-nb-ink) 18%, transparent)",
            }}
          />
        ))}
      </span>
      <span className="font-mono text-[13px] font-[700] tabular-nums text-nb-ink-soft">
        {done}/{total}
      </span>
    </span>
  );
}

// A line to paste into a coding agent, shown in full — a user without a working
// clipboard can still select it — with a copy button under it.
function CopyLine({ text }: { text: string }) {
  const t = useCopy();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="mt-3">
      <code className="block rounded-[8px] border-[1.5px] border-nb-ink bg-nb-paper px-2.5 py-1.5 font-mono text-[11.5px] leading-snug text-nb-ink">
        {text}
      </code>
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          title={t.setup.copy.hint}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              // No clipboard permission (or no clipboard at all) — the line is on
              // screen to select by hand, so there is nothing to report.
            }
          }}
        >
          {copied ? <FiCheck className="h-[14px] w-[14px]" /> : <FiCopy className="h-[14px] w-[14px]" />}
          {copied ? t.shared.copied : t.shared.copy}
        </Button>
      </div>
    </div>
  );
}

function Failure({ text }: { text: string }) {
  return (
    <div
      className="nb-panel-sm break-words p-2.5 text-[12px] leading-relaxed"
      style={{ background: "var(--color-nb-peach-soft)" }}
    >
      {text}
    </div>
  );
}
