"use client";

// The guided first run (#172), and the two notices the board keeps once it is
// over.
//
// Setting a board up used to mean copying a line into a coding agent and hoping.
// Now the board asks for what only the user knows itself — what the project is
// and its tracks, the goal, and which agent does the work — one question a
// screen, in place of the board. Everything else setup does reads the repo and
// thinks, and is still an agent's job (#173).
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
//     ends on an agent that answered a test, or on the user saying they will
//     drive the board from their own coding agent.
//
// The checklist is the state. Which of setup's boxes are ticked decides what the
// flow opens on and when it is over — there is no second record of how far the
// user got, so closing the window and coming back lands on the same screen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCheck, FiCopy, FiFlag, FiTerminal, FiX } from "react-icons/fi";
import {
  finishSetupAgentStepAction,
  getSetupDraftAction,
  saveGoalAction,
  saveSetupProjectAction,
} from "@/app/actions";
import { cn } from "@/lib/utils";
import { type AgentInfo, GUIDED_STEPS, type SetupDraft, type SetupState, type SetupStep } from "@/lib/types";
import { Button } from "./button";
import { HarnessPicker } from "./Configuration";
import { GoalEditor } from "./Goal";
import { Logo } from "./Logo";

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

// Whether the user stepped out to look at the board, for this browser session
// only. Nothing is written to the board files: leaving the flow is not an answer,
// and a board that remembered it on disk would be a board that never asks again.
const LEFT_KEY = "kanban-ui.setup-left";

export function SetupFlow({
  setup,
  agent,
  setupInstruction,
  onSaved,
  onExit,
}: {
  setup: SetupState;
  agent: AgentInfo;
  /** The line to paste into a coding agent, for the user who would rather finish
   *  there — from lib/agent.ts, so it is worded for the agent they picked. */
  setupInstruction: string;
  /** Re-read the board: every answer here changes a file the board is drawn from. */
  onSaved: () => void;
  /** Leave the flow for the board. The board keeps a way back in. */
  onExit: () => void;
}) {
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
    <main className="min-h-screen overflow-y-auto bg-nb-cream p-4 sm:p-8">
      <div className="mx-auto w-full max-w-[860px]">
        <div className="nb-panel flex min-h-[520px] flex-col overflow-hidden">
          <header className="flex items-start gap-4 border-b-[1.5px] border-nb-ink px-7 pb-5 pt-6">
            <div className="min-w-0 flex-1">
              <Logo size="sm" />
              <h1 className="mt-3 text-[20px] font-[700] leading-tight">Set up this board</h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-nb-ink-soft">
                Three questions only you can answer. Everything else is worked out from your
                repo afterwards.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="mt-1 shrink-0" onClick={onExit}>
              Go to the board
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* What has been settled so far, and the way back to any of it. */}
            <StepRail
              steps={steps}
              index={index}
              draft={draft}
              agent={agent}
              goalSkipped={goalSkipped}
              onGo={setIndex}
            />

            <div className="min-w-0 flex-1 p-6">
              {readError && <Failure text={readError} />}
              {!draft && !readError && (
                <p className="text-[13px] italic text-nb-ink-soft">Reading the board…</p>
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
                  onDone={() => {
                    onSaved();
                    advance();
                  }}
                />
              )}

              {draft && !step && <DoneStep setup={setup} instruction={setupInstruction} onExit={onExit} />}
            </div>
          </div>

          {/* The way to hand what is left to a coding agent, from any step. The way
              out to the board is up in the header, beside the run's own title. */}
          <Handover instruction={setupInstruction} />
        </div>
      </div>
    </main>
  );
}

// The steps down the side, each showing what it has settled. A step already
// answered can be gone back to — nothing here is one-way — and the one being
// asked is marked. Steps ahead are listed but not reachable: they read the
// answers before them.
function StepRail({
  steps,
  index,
  draft,
  agent,
  goalSkipped,
  onGo,
}: {
  steps: SetupStep[];
  index: number;
  draft: SetupDraft | null;
  agent: AgentInfo;
  goalSkipped: boolean;
  onGo: (index: number) => void;
}) {
  const settled = (name: string): string => {
    if (!draft) return "";
    if (name === "project") {
      return draft.project.name
        ? `${draft.project.name} · ${draft.tracks.length} track${draft.tracks.length === 1 ? "" : "s"}`
        : "";
    }
    if (name === "goal") {
      if (draft.goal.trim()) return "Written";
      return goalSkipped ? "Left for later" : "";
    }
    if (name === "agent") {
      return agent.options.find((o) => o.name === agent.name)?.label ?? agent.name;
    }
    return "";
  };

  return (
    <nav
      aria-label="Setup steps"
      className="flex shrink-0 flex-col gap-1 border-b border-nb-ink/12 bg-nb-wash p-3 sm:w-[212px] sm:border-b-0 sm:border-r"
    >
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
              <span className="block text-[13px] font-[700]">{STEP_TITLES[step.name] ?? step.name}</span>
              {note && <span className="mt-0.5 block truncate text-[11.5px]">{note}</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// The checklist's own wording is written for whoever runs setup from a terminal.
// On screen each step is a question being asked, so it gets a short title of its
// own; the names are the script's.
const STEP_TITLES: Record<string, string> = {
  project: "Project",
  goal: "Goal",
  agent: "Agent",
};

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
        setError(res.error || "couldn't save the project");
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
    <StepBody
      title="What is this project?"
      blurb="The name and one line about it. The agent reads this whenever it plans work, so plain words beat a pitch."
    >
      <Field label="Name">
        <input
          className={INPUT}
          value={draft.project.name}
          autoFocus
          onChange={(e) => onChange({ ...draft, project: { ...draft.project, name: e.target.value } })}
        />
      </Field>
      <Field label="What it is">
        <input
          className={INPUT}
          value={draft.project.description}
          placeholder="A board that plans itself, in plain markdown."
          onChange={(e) =>
            onChange({ ...draft, project: { ...draft.project, description: e.target.value } })
          }
        />
      </Field>

      <div className="mt-5 border-t border-nb-ink/12 pt-4">
        <p className="text-[13px] font-[800]">The tracks work falls into</p>
        <p className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">
          One bucket per kind of work — every card lives in one. These are the board&rsquo;s
          own folders, so a name here is a folder under <code>docs/kanban/todo/</code>.
        </p>
        <TrackRows tracks={draft.tracks} used={draft.usedTracks} onChange={setTracks} />
      </div>

      {kept.length > 0 && (
        <div className="mt-4">
          <Failure
            text={`Saved, but ${kept.join(" and ")} ${kept.length === 1 ? "holds" : "hold"} cards, so ${kept.length === 1 ? "it stays" : "they stay"} on the board. Move or archive the cards first if you really want ${kept.length === 1 ? "it" : "them"} gone.`}
          />
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={onSaved}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {error && <div className="mt-4"><Failure text={error} /></div>}

      {kept.length === 0 && (
        <StepButtons>
          <Button size="sm" disabled={saving || !draft.project.name.trim()} onClick={save}>
            {saving ? "Saving…" : "Continue"}
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
              aria-label={`Track ${i + 1} name`}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <input
              className={cn(INPUT, "min-w-0 flex-1")}
              value={track.note}
              aria-label={`What ${track.name || "this track"} is for`}
              placeholder="what belongs in it"
              onChange={(e) => patch(i, { note: e.target.value })}
            />
            <button
              type="button"
              disabled={locked || tracks.length === 1}
              title={
                locked
                  ? `${track.was} holds cards — move them before dropping it`
                  : "Drop this track"
              }
              aria-label={`Drop ${track.name}`}
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
          Add a track
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
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await saveGoalAction(text);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "could not save the goal");
      return;
    }
    onSaved(text);
  };

  return (
    <StepBody
      title="Where is this headed?"
      blurb="Your own words: what you want, how far out, and roughly what comes next. Every proposal the agent makes is judged against this, and rough and short is fine — you can change it whenever."
    >
      <textarea
        className={cn(INPUT, "min-h-[220px] resize-y font-mono leading-relaxed")}
        value={text}
        autoFocus
        placeholder="In a year I want…"
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mt-2 text-[12px] leading-relaxed text-nb-ink-soft">
        The agent never drafts this for you.{" "}
        <a
          href="https://github.com/ai4kanban/ai4kanban/blob/main/docs/guides/what-makes-a-good-goal.md"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-nb-ink"
        >
          What makes a good goal
        </a>
      </p>

      {error && <div className="mt-4"><Failure text={error} /></div>}

      <StepButtons>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onSkip}>
          Skip for now
        </Button>
        <Button size="sm" disabled={saving || !text.trim()} onClick={save}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </StepButtons>
    </StepBody>
  );
}

// ---- step 3: the agent -----------------------------------------------------

// The one step that can't be pressed past. It is the Configuration dialog's own
// Agent pane — the same picker, the same settings, the same Test — because this
// is the same question, and a second screen asking it in other words would be a
// second place to keep right.
//
// Continue opens on one of two answers: a test that passed, or the user saying
// they will run the board from their own coding agent. Neither is skipping: both
// name something that can do the work.
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
  onDone: () => void;
}) {
  const [passed, setPassed] = useState(false);
  const [ownAgent, setOwnAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      await finishSetupAgentStepAction();
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepBody
      title="Which agent does the work?"
      blurb="Every button on this board starts a run — refine a card, propose work, implement it. Pick the agent those runs go to, then press Test: it sends one tiny message through and says what came back."
    >
      <HarnessPicker
        agent={agent}
        onError={setError}
        onTested={(result) => setPassed(Boolean(result?.ok))}
      />

      {error && <div className="mt-4"><Failure text={error} /></div>}

      <div className="mt-5 border-t border-nb-ink/12 pt-4">
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed">
          <input
            type="checkbox"
            checked={ownAgent}
            onChange={(e) => setOwnAgent(e.target.checked)}
            className="mt-[3px] size-[15px] shrink-0 cursor-pointer accent-[var(--color-nb-accent)]"
          />
          <span>
            <span className="font-[700]">I&rsquo;ll drive this board from my own coding agent.</span>{" "}
            <span className="text-nb-ink-soft">
              The board&rsquo;s buttons stay quiet, and you do the work from the agent you already
              have open. You can pick one here later — the gear in the header.
            </span>
          </span>
        </label>
      </div>

      <StepButtons>
        <p className="mr-auto text-[12px] leading-relaxed text-nb-ink-soft">
          {passed || ownAgent || answered
            ? "That’s everything only you could answer."
            : "Press Test above, or say you’ll use your own coding agent."}
        </p>
        <Button size="sm" disabled={saving || (!passed && !ownAgent && !answered)} onClick={finish}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </StepButtons>
    </StepBody>
  );
}

// ---- the closing screen ----------------------------------------------------

// What is left after the questions: the steps that read the repo and think. The
// board can't run them yet (#173), so this hands them over in one line and opens
// the board.
function DoneStep({
  setup,
  instruction,
  onExit,
}: {
  setup: SetupState;
  instruction: string;
  onExit: () => void;
}) {
  const left = setup.steps.filter((s) => !s.done);
  return (
    <StepBody
      title="Answered — the board is yours"
      blurb="What is left reads your repo and thinks: the calls a planner needs settled, the map of what the project is made of, and the first cards."
    >
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

      <p className="mt-5 text-[13px] leading-relaxed text-nb-ink-soft">
        Paste this into your coding agent to finish them:
      </p>
      <CopyLine text={instruction} />

      <StepButtons>
        <Button size="sm" onClick={onExit}>
          Open the board
        </Button>
      </StepButtons>
    </StepBody>
  );
}

// ---- the board's own notices -----------------------------------------------

/** The way back into an unfinished setup, on the board itself (#172). A plain
 *  strip above the columns, not a card floating in a corner: the corner card
 *  could be hidden for the session and then never found again, and setup left
 *  half-done is a state of the board, not a nudge to dismiss. */
export function SetupNotice({
  setup,
  instruction,
  onResume,
}: {
  setup: SetupState;
  instruction: string;
  /** Reopen the guided run. Absent when there is nothing left in it to ask. */
  onResume?: () => void;
}) {
  const [handing, setHanding] = useState(false);
  return (
    <div
      className="mx-4 mt-4 nb-panel-sm p-3 text-[13px] sm:mx-6"
      style={{ background: "var(--color-nb-accent-soft)" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Meter done={setup.done} total={setup.total} />
        <span className="min-w-0 flex-1">
          <strong>Setting up this board.</strong>{" "}
          {setup.next ? (
            <span className="text-nb-ink-soft">
              Next: <Ticks text={setup.next.text} />
            </span>
          ) : (
            <span className="text-nb-ink-soft">Finishing the last step.</span>
          )}
        </span>
        {onResume ? (
          <Button size="sm" className="shrink-0" onClick={onResume}>
            Continue setup
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => setHanding((on) => !on)}
          >
            <FiTerminal className="text-[13px]" aria-hidden />
            Finish in your coding agent
          </Button>
        )}
      </div>
      {handing && <CopyLine text={instruction} />}
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
          Project goal
        </span>
        <span className="min-w-0 flex-1 text-nb-ink-soft">
          <strong className="text-nb-ink">The project goal is missing or unclear.</strong> Every
          proposal the agent makes is judged against it — rough and short is fine.
        </span>
        <Button size="sm" className="shrink-0" onClick={() => setEditing(true)}>
          Write the goal
        </Button>
        <button
          onClick={() => {
            sessionStorage.setItem(GOAL_DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label="Dismiss"
          title="Hide for this session"
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
function Handover({ instruction }: { instruction: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t-[1.5px] border-nb-ink bg-nb-wash px-7 py-3">
      <button
        type="button"
        onClick={() => setOpen((on) => !on)}
        className="flex cursor-pointer items-center gap-2 text-[12px] text-nb-ink-soft transition-colors hover:text-nb-ink"
      >
        {open ? <FiArrowLeft className="text-[13px]" aria-hidden /> : <FiTerminal className="text-[13px]" aria-hidden />}
        {open ? "Never mind — keep going here" : "Rather set this up from your coding agent?"}
      </button>
      {open && (
        <div className="mt-2">
          <p className="mb-2 text-[12px] leading-relaxed text-nb-ink-soft">
            Paste this into it. It picks up wherever setup got to, so nothing you answered here
            is asked again.
          </p>
          <CopyLine text={instruction} />
        </div>
      )}
    </div>
  );
}

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
function Meter({ done, total }: { done: number; total: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-2"
      role="img"
      aria-label={`Setup: ${done} of ${total} steps done`}
    >
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
          title="Copy for your coding agent"
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
          {copied ? "Copied" : "Copy"}
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
