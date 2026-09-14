"use client";

// The board's team, in one pane (#422).
//
// Everyone working on your cards is here: the roles the board's own flows are run by, the
// specialists the command ships, then the ones this project added. A narrow picker column
// holding the whole roster, and the selected agent's page filling the space beside it.
//
// It replaces two screens. The Spec agents tile listed the specialists and switched them;
// the Rules pane wrote a rule per FLOW, in a column of command names. A rule belongs to an
// agent now, so who works on your cards and how you train them are one list rather than two
// that never mentioned each other.
//
// What this pane knows: the roles the board ships, and only their words. The names,
// what each one does, whether it may be switched off, the memory it owns and the settings it
// declares are the board's own roster, asked for when the pane opens — so an agent shipped
// later, or one this project adds, is drawn here with nothing in this file touched.
//
// The words are the exception, because an agent is user-facing and the board answers in
// English. A role is one of a closed set the command ships, so the copy carries its line and
// its instruction box; a specialist is a file, so it says both in its own `AGENT.md` under
// `akb.i18n` and the board hands over whichever language this machine reads. A role this
// copy has never heard of keeps the board's English and a generic box — never a blank.
//
// The characters are PNGs under `public/agent-art/`, one per bundled agent, named by the
// agent. An agent with no art draws its first letter in the same pixel style, which is the
// normal state for an agent you add — never a broken image.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowUpRight,
  FiCheck,
  FiCopy,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiFolder,
  FiPlus,
  FiScissors,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  agentsAction,
  createAgentAction,
  deleteAgentAction,
  listSessionsAction,
  memoryPruneAction,
  saveAgentFileAction,
  setAgentRuntimeAction,
  setAgentRuleAction,
  setMemoryPruneAction,
  setSpecAgentAction,
  setSpecAgentSettingAction,
  startPruneMemoryAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { spellAgent } from "@/lib/agent-name";
import { type Cadence, type CadenceUnit, formatCadence, parseCadence } from "@/lib/cadence";
import { WORKFLOW_STAGES } from "@/lib/types";
import type {
  AgentInfo,
  AgentView,
  WorkflowStage,
  MemoryPruneSchedule,
  SpecAgentSettingView,
} from "@/lib/types";
import { Button } from "./button";
import { AgentMark, PRUNER, useRuntimeName } from "./Configuration";
import { ConfirmationPopover } from "./confirm-popover";
import { useCopyText } from "./copy";
import {
  ACCENT_BTN,
  CAPTION,
  DANGER_BTN,
  FLAT_CONTROL,
  Loading,
  Note,
  Panel,
  QUIET_BTN,
  Switch,
} from "./settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

// The one agent on this board whose switch stops the board asking you anything (#447). Its
// page carries the only red strip in this dialog. Named here because there is exactly one.
// Asking before a switch goes on used to be named the same way; a second agent wanted it
// (#562), so it became a property of the role instead — `AgentView.confirm`.
const COSTLY = "decider";

// The one agent whose switch is a delivery setting (#509). Review is a paid run per
// delivery, so this switch ships ON and flipping it answers deliveries started afterwards —
// its page says so in the same words Configuration → General → Delivery uses for its own
// switches. Named here for the same reason as the one above: there is exactly one.
const PER_DELIVERY = "reviewer";

export function AgentsPanel({
  info,
  scope = "board",
  stage: openStage,
  onStage,
  onBack,
  backLabel = "",
  openOn = "",
  onPicked,
  onRuntimes,
  onError,
}: {
  /** The connectors this board can run, and which one is its default (#443) — what the
   *  runtime row on an agent's page offers. */
  info: AgentInfo;
  /** Which half of the roster this is (#715). `workflow` draws the agents a workflow can
   *  assign, grouped by the stage each declares, and is where one is created; `board` draws
   *  the agents that belong to the board itself — the discussion, the gate, the decider, the
   *  pruner — which no workflow assigns and every workflow gets. */
  scope?: "workflow" | "board";
  /** Which stage the `workflow` scope opens on. */
  stage?: WorkflowStage;
  /** Taken whenever the stage tab moves, so the dialog remembers where the pane was. */
  onStage?: (stage: WorkflowStage) => void;
  /** Back to the workflow this pane was opened from, when it was opened from one. */
  onBack?: () => void;
  /** What that trip came from, in the user's own words — `<workflow> · <stage>`. */
  backLabel?: string;
  /** The agent to open the page on, when the pane was opened by a deep link (#514). Empty
   *  the rest of the time, and then the column's first **Always on** row is selected. */
  openOn?: string;
  /** Taken, so selecting another row afterwards is never undone. */
  onPicked?: () => void;
  /** Cross to Configuration → Runtimes — where a runtime is actually set up. */
  onRuntimes?: () => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.agents;
  const titleOf = useAgentTitle();
  const [agents, setAgents] = useState<AgentView[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Which agent's page is drawn beside the column. Never empty once the roster is in: a
  // column beside an empty half is half a pane.
  const [picked, setPicked] = useState("");
  // What the two boxes hold right now, by agent, so selecting another row never loses an
  // edit that has not been saved yet.
  const [rules, setRules] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  // The agent whose rule was saved last, for the quiet `Saved` beside the caption.
  const [savedRule, setSavedRule] = useState("");
  // Why the board refused an `AGENT.md`, and whose. It holds the page open on that agent:
  // an agent left with a file the catalog cannot read drops out of the roster into the
  // problems list, with no way back into it from here.
  const [refusal, setRefusal] = useState<{ agent: string; why: string } | null>(
    null,
  );
  // What is being saved right now, by the thing being saved: an agent's name for its
  // switch, `name/key` for one of its settings.
  const [saving, setSaving] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  // Which stage the workflow pane is showing. The board scope has no tabs — a board agent
  // belongs to no stage — so it is read there only to keep one `useState` per render.
  const [stage, setStage] = useState<WorkflowStage>(openStage ?? "plan");
  useEffect(() => {
    if (openStage) setStage(openStage);
  }, [openStage]);
  // Focus the new agent's `AGENT.md` box once, when Add a specialist lands on it — the
  // whole point of the button is to carry straight on into writing the prompt.
  const [focusFile, setFocusFile] = useState(false);

  // The roster, and the boxes seeded from it. Read when the pane opens, and again after a
  // specialist is added — the board decides what the new agent's file says, so the pane
  // takes its answer rather than assembling one.
  const load = async (): Promise<void> => {
    const res = await agentsAction();
    setAgents(res.agents);
    setProblems(res.problems);
    setLoadError(res.error ?? null);
    setLoaded(true);
    if (!res.agents) return;
    setRules(Object.fromEntries(res.agents.map((a) => [a.name, a.rule])));
    setFiles(
      Object.fromEntries(
        res.agents.filter((a) => a.file).map((a) => [a.name, a.file!.text]),
      ),
    );
  };

  useEffect(() => {
    void load();
  }, []);

  // The agent a deep link named (#514) — Prune memory in the rail opens this pane on the
  // pruner's page. It selects the row rather than scrolling to it: the page sits beside the
  // column, so there is nothing off screen to reveal. It waits for the roster, because
  // selecting a name the column does not hold yet would draw no page at all.
  useEffect(() => {
    if (!openOn || !agents?.some((a) => a.name === openOn)) return;
    setPicked(openOn);
    onPicked?.();
  }, [openOn, agents, onPicked]);

  // The pane opens on the first **Always on** agent — entering Agents lands you on a page
  // you did not ask for, which is the price of never drawing the column beside an empty
  // half. Runs again when a delete leaves nothing selected.
  useEffect(() => {
    if (!agents?.length) return;
    const here = agents.filter((a) => (scope === "workflow" ? a.stage === stage : !a.stage));
    if (picked && here.some((a) => a.name === picked)) return;
    if (openOn && here.some((a) => a.name === openOn)) return;
    setPicked(here.length ? (here.find((a) => !a.switchable) ?? here[0]!).name : "");
  }, [agents, picked, openOn, scope, stage]);

  // Saving what a page holds when it is left. Read off a ref rather than off the render the
  // callback was made in, because one of the callers below fires as the pane is coming
  // apart. Unchanged text writes nothing, so calling it twice for one edit is free.
  //
  // A rule is free text, so a failure is only ever the board's — it goes to the dialog's
  // error strip. An `AGENT.md` can be wrong, and that answer belongs on the agent's own
  // page, which is why leaving can be refused.
  const latest = useRef({ agents, rules, files, onError, c });
  latest.current = { agents, rules, files, onError, c };
  const leave = useRef(async (name: string): Promise<boolean> => {
    const box = latest.current;
    const agent = box.agents?.find((a) => a.name === name);
    if (!agent) return true;

    const rule = (box.rules[name] ?? "").trim();
    if (rule !== agent.rule) {
      const res = await setAgentRuleAction(name, rule);
      if (res.ok) {
        setAgents(
          (all) =>
            all?.map((a) => (a.name === name ? { ...a, rule } : a)) ?? all,
        );
        setSavedRule(name);
      } else {
        box.onError?.(res.error || box.c.ruleFailed(name));
      }
    }

    const text = box.files[name];
    if (agent.file && text !== undefined && text !== agent.file.text) {
      const res = await saveAgentFileAction(name, text);
      if (!res.ok) {
        setRefusal({ agent: name, why: res.error || box.c.ruleFailed(name) });
        return false;
      }
      setAgents(
        (all) =>
          all?.map((a) =>
            a.name === name ? { ...a, file: { ...a.file!, text } } : a,
          ) ?? all,
      );
    }
    // Past the save, the box and the file say the same thing — written just now, or put back
    // to what was already there. Either way nothing is unsaved, so a refusal still on screen
    // would be telling the user their text is lost while it is sitting in the file.
    if (agent.file) setRefusal((was) => (was?.agent === name ? null : was));
    return true;
  });

  // Save the page being left, whether or not a blur comes: selecting another row blurs the
  // box, but closing the dialog takes it off screen with the caret still in it. A refusal at
  // that point drops the text — the file keeps its last accepted version, so the pane can
  // never leave an agent broken behind it.
  useEffect(() => {
    if (!picked) return;
    const write = leave.current;
    return () => {
      void write(picked);
    };
  }, [picked]);

  // One page at a time, and always one: pressing the selected row does nothing. A refused
  // `AGENT.md` holds the selection where it is, with the reason showing.
  const select = async (name: string) => {
    if (name === picked) return;
    if (picked && !(await leave.current(picked))) return;
    setPicked(name);
  };

  // Flip one switch: on screen at once, saved behind it, and put back if the save fails. A
  // switch that silently didn't land is a setting the user can't trust.
  const flip = async (agent: AgentView, on: boolean) => {
    setAgents(
      (all) =>
        all?.map((a) => (a.name === agent.name ? { ...a, enabled: on } : a)) ??
        all,
    );
    setSaving((names) => [...names, agent.name]);
    try {
      const res = await setSpecAgentAction(agent.name, on);
      if (!res.ok) {
        setAgents(
          (all) =>
            all?.map((a) =>
              a.name === agent.name ? { ...a, enabled: !on } : a,
            ) ?? all,
        );
        onError?.(
          res.error ||
            (on ? c.flipFailedOn : c.flipFailedOff)(titleOf(agent)),
        );
      }
    } finally {
      setSaving((names) => names.filter((n) => n !== agent.name));
    }
  };

  // Pick one of an agent's settings (#257) — the switch's own behaviour, for the same reason.
  const pick = async (agent: AgentView, key: string, value: string) => {
    const was = agent.values?.[key] ?? "";
    if (value === was) return;
    const put = (v: string) =>
      setAgents(
        (all) =>
          all?.map((a) =>
            a.name === agent.name
              ? { ...a, values: { ...a.values, [key]: v } }
              : a,
          ) ?? all,
      );
    const token = `${agent.name}/${key}`;
    put(value);
    setSaving((names) => [...names, token]);
    try {
      const res = await setSpecAgentSettingAction(agent.name, key, value);
      if (!res.ok) {
        put(was);
        onError?.(res.error || c.saveFailed(titleOf(agent)));
      }
    } finally {
      setSaving((names) => names.filter((n) => n !== token));
    }
  };

  // Which runtime this agent runs (#467) — the board's answer, so every checkout runs it as
  // the same thing. The roster is read again rather than patched: a runtime carries the
  // harness and the model with it, and both move with the pick.
  const bind = async (agent: AgentView, runtime: string) => {
    const token = `${agent.name}/runtime`;
    setSaving((names) => [...names, token]);
    try {
      const res = await setAgentRuntimeAction(agent.name, runtime);
      if (!res.ok) {
        onError?.(res.error || c.harnessFailed(titleOf(agent)));
        return;
      }
      await load();
    } finally {
      setSaving((names) => names.filter((n) => n !== token));
    }
  };

  // Naming the new agent leaves the page that is open, so a refused `AGENT.md` holds the
  // selection here the way selecting another row does.
  const openAdd = async () => {
    if (picked && !(await leave.current(picked))) return;
    setAdding(true);
  };

  // Add a specialist finishes on the new agent's own page, with its `AGENT.md` box focused:
  // an agent whose file is still the template is an agent that does nothing.
  //
  // The row stays up, and stays busy, until that page is actually on screen — writing the
  // agent and reading the roster back take a moment, and taking the row away first leaves
  // the column looking like nothing happened.
  const create = async (name: string): Promise<string> => {
    const res = await createAgentAction(name, scope === "workflow" ? stage : undefined);
    if (!res.ok) return res.error || c.saveFailed(name);
    await load();
    setPicked(res.agent ?? name);
    setFocusFile(true);
    setAdding(false);
    return "";
  };

  // Delete the agent whose page is open. The roster is read again BEFORE the selection is
  // cleared, so the save-on-leave under it finds no such agent and writes nothing back into
  // the folder that has just gone. Clearing it hands the page back to the first Always on
  // row, which is where the pane started.
  const remove = async (name: string) => {
    const gone = agents?.find((a) => a.name === name);
    setSaving((names) => [...names, name]);
    try {
      const res = await deleteAgentAction(name);
      if (!res.ok)
        return onError?.(
          res.error || c.deleteFailed(gone ? titleOf(gone) : spellAgent(name)),
        );
      setRefusal((was) => (was?.agent === name ? null : was));
      // Reseeds both boxes off the new roster, so the deleted agent's unsaved text goes
      // with it rather than sitting in a map nothing draws from.
      await load();
      setPicked("");
    } finally {
      setSaving((names) => names.filter((n) => n !== name));
    }
  };

  // Which agents this pane is answerable for. A workflow agent declares a stage; a board
  // agent declares none. The two panes are the same page beside two halves of one roster —
  // a rule, a runtime and an `AGENT.md` read the same way wherever the agent is assigned.
  const mine = agents?.filter((a) => (scope === "workflow" ? !!a.stage : !a.stage)) ?? null;
  const inStage = mine?.filter((a) => a.stage === stage) ?? [];
  const agent = mine?.find((a) => a.name === picked);
  const always = (mine ?? []).filter((a) => !a.switchable);
  const optional = (mine ?? []).filter((a) => a.switchable);
  const shipped = inStage.filter((a) => a.builtIn);
  const added = inStage.filter((a) => !a.builtIn);

  const row = (a: AgentView) => (
    <PickRow
      key={a.name}
      agent={a}
      held={a.name === picked}
      confirm={c.roles[a.name as keyof typeof c.roles]?.confirm}
      busy={saving.includes(a.name)}
      onOpen={() => void select(a.name)}
      onFlip={(next) => flip(a, next)}
    />
  );

  return (
    <div className="flex min-h-full flex-col gap-5">
      {loadError && <Note icon={<FiAlertCircle />}>{loadError}</Note>}
      {!loaded && <Loading>{c.loading}</Loading>}
      {loaded && !loadError && agents === null && (
        <Note icon={<FiAlertCircle />}>{c.tooOld}</Note>
      )}

      {/* Back to the workflow this pane was opened from, with the place it came from beside
          it. Only ever drawn on that trip: entering Workflow agents from the sidebar comes
          from nowhere, and a back button to nowhere is a dead control. */}
      {agents && onBack && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft"
          >
            <FiArrowLeft aria-hidden />
            {c.back}
          </button>
          {backLabel && <span className="text-[11.5px] text-nb-ink-soft">{backLabel}</span>}
        </div>
      )}

      {/* One tab per stage (#715). An agent declares the stage it belongs to, so this is
          which half of the pane's own roster is on screen — not a filter over all of them.
          The arrows between them are the order a card actually goes through, which is the one
          thing three same-looking tabs don't say. */}
      {agents && scope === "workflow" && (
        <div className="flex items-center gap-1">
          {WORKFLOW_STAGES.map((name, i) => (
            <Fragment key={name}>
              {i > 0 && (
                <FiChevronRight size={13} aria-hidden className="shrink-0 text-nb-ink-soft/60" />
              )}
              <button
                type="button"
                aria-current={name === stage}
                onClick={() => {
                  setStage(name);
                  onStage?.(name);
                }}
                className={`cursor-pointer rounded-[8px] px-3 py-1 text-[12px] font-[700] transition-colors duration-100 ${
                  name === stage ? "bg-nb-accent-soft text-nb-accent-deep" : "bg-nb-wash text-nb-ink-soft"
                }`}
              >
                {c.stageTabs[name]}
              </button>
            </Fragment>
          ))}
        </div>
      )}

      {agents && (
        <>
          <div className="flex flex-1 items-stretch gap-6 max-sm:flex-col max-sm:gap-4">
            {/* The whole roster in one narrow column, split the way the two halves are
                answered: who runs this board and cannot be switched off, then everything
                that can be. A row says which agent it is and whether it is on; the page
                beside it is where anything is actually changed. The rule down its right edge
                is what separates the two, the way the sidebar is separated from both. */}
            <div className="w-[252px] shrink-0 border-r border-nb-ink/10 pr-6 max-sm:w-full max-sm:border-r-0 max-sm:border-b max-sm:pr-0 max-sm:pb-4">
              {/* One column, split two ways depending on which half of the roster this is.
                  A BOARD agent is read by what it costs you: the ones that always run, then
                  the ones you switch on. A WORKFLOW agent is read by where it came from —
                  built-in or this project's — because what decides whether it runs is the
                  workflow that assigns it, not a switch here (#715). */}
              {scope === "workflow" ? (
                <>
                  <Roster title={c.builtIn}>
                    <div className="flex flex-col">{shipped.map(row)}</div>
                  </Roster>
                  {added.length > 0 && (
                    <div className="mt-4 border-t border-nb-ink/10 pt-4">
                      <Roster title={c.yours}>
                        <div className="flex flex-col">{added.map(row)}</div>
                      </Roster>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Roster title={c.always}>
                    <div className="flex flex-col">{always.map(row)}</div>
                  </Roster>
                  <div className="mt-4 border-t border-nb-ink/10 pt-4">
                    <Roster
                      title={c.optional}
                      action={
                        <span className="text-[11.5px] text-nb-ink-soft">
                          {c.onCount(optional.filter((a) => a.enabled).length)}
                        </span>
                      }
                    >
                      <div className="flex flex-col">{optional.map(row)}</div>
                    </Roster>
                  </div>
                </>
              )}
              {scope === "workflow" && inStage.length === 0 && (
                <p className="px-2 py-3 text-[11.5px] text-nb-ink-soft">{c.noneInStage}</p>
              )}
              {/* A board agent is one of a closed set the command ships, so there is nothing
                  to add here; a workflow agent is a file this project writes. */}
              {scope === "workflow" &&
                (adding ? (
                  <NewRow onCreate={create} onCancel={() => setAdding(false)} />
                ) : (
                  <button
                    type="button"
                    className={`${QUIET_BTN} mt-2.5 w-full justify-center`}
                    onClick={() => void openAdd()}
                  >
                    <FiPlus aria-hidden />
                    {c.add}
                  </button>
                ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {agent && (
                <Page
                  agent={agent}
                  rule={rules[agent.name] ?? ""}
                  file={files[agent.name]}
                  saved={savedRule === agent.name}
                  refusal={
                    refusal && refusal.agent === agent.name ? refusal.why : ""
                  }
                  focusFile={focusFile}
                  onFocused={() => setFocusFile(false)}
                  onRule={(text) => {
                    setRules((all) => ({ ...all, [agent.name]: text }));
                    setSavedRule("");
                  }}
                  onFile={(text) =>
                    setFiles((all) => ({ ...all, [agent.name]: text }))
                  }
                  onLeave={() => void leave.current(agent.name)}
                  onPick={(key, value) => void pick(agent, key, value)}
                  info={info}
                  onRuntime={(runtime) => void bind(agent, runtime)}
                  onRuntimes={onRuntimes}
                  onError={onError}
                  onDelete={() => remove(agent.name)}
                  busySwitch={saving.includes(agent.name)}
                  busy={(key) => saving.includes(`${agent.name}/${key}`)}
                />
              )}
            </div>
          </div>

          {problems.length > 0 && (
            <Note icon={<FiAlertCircle />}>
              {c.problems}
              {problems.map((problem) => (
                <span key={problem} className="mt-1 block">
                  {problem}
                </span>
              ))}
            </Note>
          )}
        </>
      )}
    </div>
  );
}

// --- one agent in the picker column ------------------------------------------

// A half of the roster, under its own name. Sentence case and soft ink: the column is a list
// of agents, and a caption shouting over each half would compete with the names.
function Roster({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h4 className="text-[12.5px] font-[600] text-nb-ink-soft">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

// The character, the name and whether the agent is on. The state is read here and flipped
// on the page beside it, so selecting an agent and switching it are never the same press.
// A paused agent keeps its character, greyed, and keeps its page.
function PickRow({
  agent,
  held,
  confirm,
  busy,
  onOpen,
  onFlip,
}: {
  agent: AgentView;
  held: boolean;
  /** What this agent asks before it goes on, in the reader's language. Absent on every
   *  agent that asks nothing. */
  confirm?: { title: string; body: string; turnOn: string };
  busy: boolean;
  onOpen: () => void;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const c = useCopy().configuration.agents;
  const title = useAgentTitle()(agent);
  const off = !agent.enabled;
  return (
    // A row, not a button: the switch lives in it (#715), and a control inside a button is
    // a control nobody can press. The name is the button; the switch is its own.
    <div
      className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 py-[5px] transition-colors duration-100 ${
        held ? "bg-nb-accent-soft" : "hover:bg-nb-sheet"
      }`}
    >
      <button
        type="button"
        aria-current={held}
        // The state too: the row carries it, and a label naming only the agent would take
        // that word off the one list where every agent's is read at once.
        aria-label={`${c.open(title)} · ${agent.enabled ? c.rowOn : c.rowOff}`}
        onClick={onOpen}
        // No frame and no marker: the ember wash is the whole of which row the page beside
        // the column belongs to, and a bar inside it says the same thing twice.
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent"
      >
        <span
          className={`flex size-[26px] shrink-0 items-end justify-center ${off ? "opacity-30 grayscale" : ""}`}
        >
          <Character name={agent.name} size={26} />
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-[12.5px] font-[700] ${off ? "text-nb-ink-soft" : "text-nb-ink"}`}
        >
          {title}
        </span>
      </button>
      {/* Read and flipped in the one place (#715). Only where there is a state at all: an
          always-on agent has nothing to switch, and a column of identical switches says
          nothing the caption above it hasn't. */}
      {agent.switchable && (
        <EnabledSwitch agent={agent} confirm={confirm} busy={busy} onFlip={onFlip} bare />
      )}
    </div>
  );
}

// The one press that puts an agent's file path on the clipboard, so it can be opened in the
// editor the person actually uses.
function CopyPath({ path }: { path: string }) {
  const c = useCopy().configuration.agents;
  const copy = useCopyText();
  return (
    <button
      type="button"
      aria-label={c.copyPath}
      title={c.copyPath}
      onClick={() => copy.copy(path)}
      className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft transition-colors duration-100 hover:bg-nb-ink/5 hover:text-nb-ink"
    >
      {copy.copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
    </button>
  );
}

// Add a specialist finishes here: the row the new agent will take asks for its name, and a
// name already taken — by a bundled agent, by a role, or by a folder already under
// `docs/kanban/agents/` — is refused right in the column, so the pane never creates the
// clash it would then have to report as a problem.
function NewRow({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => Promise<string>;
  onCancel: () => void;
}) {
  const c = useCopy().configuration.agents;
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setWhy(await onCreate(name.trim()));
    setBusy(false);
  };

  return (
    <div className="mt-2.5 rounded-[10px] bg-nb-sheet px-2.5 py-2">
      <span
        className={`${CAPTION} text-[10px] tracking-[0.08em] text-nb-ink-soft`}
      >
        {c.newAgent}
      </span>
      <input
        autoFocus
        value={name}
        disabled={busy}
        spellCheck={false}
        aria-label={c.newAgent}
        placeholder={c.namePlaceholder}
        onChange={(e) => {
          setName(e.target.value);
          setWhy("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void create();
          if (e.key === "Escape") onCancel();
        }}
        className="mt-[5px] w-full rounded-[8px] bg-nb-paper px-2 py-[3px] font-mono text-[11.5px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait"
      />
      <span className="mt-[3px] block text-[10.5px] leading-[13px] text-nb-ink-soft">
        {why || c.nameHint}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5">
        {/* Writing the agent and reading the roster back is not instant, so the button says
            it is working rather than sitting there looking unpressed. */}
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] bg-nb-accent px-2 py-[3px] text-[11px] font-[800] text-nb-paper disabled:cursor-wait disabled:opacity-60"
        >
          {busy && (
            <span
              className="size-1.5 rounded-full bg-nb-paper animate-[nbPulse_1.1s_ease-in-out_infinite]"
              aria-hidden
            />
          )}
          {busy ? c.creating : c.create}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer px-1 text-[11px] font-[700] text-nb-ink-soft"
        >
          {c.cancel}
        </button>
      </span>
    </div>
  );
}

// --- the page beside the column ----------------------------------------------

// Everything the selected agent is, as one screen: who it is and its switch across the top,
// then the settings it declares, the one box you write in, and what it remembers.
//
// Which box depends on whose the agent is. A bundled agent's prompt ships inside the
// command, so what you write for it is an instruction appended to the end of its every run.
// An agent this project added has no prompt but the one you write, so its box is the whole
// of its `AGENT.md`, frontmatter included — a second box of instructions on top of a file
// you already own is two places to say the same thing, and neither reads as the answer.
//
// Each box saves itself when it is left, with no pane-wide Save button, the way every other
// setting in this dialog already behaves.
function Page({
  agent,
  info,
  rule,
  file,
  saved,
  refusal,
  focusFile,
  onFocused,
  onRule,
  onFile,
  onLeave,
  onPick,
  onRuntime,
  onRuntimes,
  onError,
  onDelete,
  busySwitch,
  busy,
}: {
  agent: AgentView;
  info: AgentInfo;
  rule: string;
  file: string | undefined;
  saved: boolean;
  /** Why the board refused this agent's `AGENT.md`, or empty. */
  refusal: string;
  focusFile: boolean;
  onFocused: () => void;
  onRule: (text: string) => void;
  onFile: (text: string) => void;
  onLeave: () => void;
  onPick: (key: string, value: string) => void;
  /** Give this agent a connector of its own, or "" to put it back on the board's default. */
  onRuntime: (runtime: string) => void;
  /** Cross to Configuration → Runtimes, from the runtime row. */
  onRuntimes?: () => void;
  /** Where a failure the page cannot show in place goes — the dialog's error strip. */
  onError?: (msg: string) => void;
  onDelete: () => Promise<void>;
  /** The switch, or the delete, is in flight — they are the same agent-wide save. */
  busySwitch: boolean;
  busy: (key: string) => boolean;
}) {
  const c = useCopy().configuration.agents;
  // Delivery's own sentence, read from there rather than copied: the reviewer's switch is
  // one of the delivery settings, and there is one way to say what a flip answers.
  const frozen = useCopy().configuration.delivery.frozen;
  const box = useRef<HTMLTextAreaElement>(null);
  const [asking, setAsking] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!focusFile) return;
    box.current?.focus();
    onFocused();
  }, [focusFile, onFocused]);

  // What this agent is, and where the words written for it land — both in the reader's
  // language. A role the board ships is named here; every specialist says both lines in its
  // own `AGENT.md`, which is the only place a project can write them, so it falls through to
  // the board's own answer and to a placeholder keyed by the hook it plugs into.
  const role = c.roles[agent.name as keyof typeof c.roles] as
    | {
        gloss: string;
        rule: string;
        when?: string;
        confirm?: { title: string; body: string; turnOn: string };
        note?: string;
      }
    | undefined;
  const title = useAgentTitle()(agent);
  const gloss = role?.gloss ?? sentence(agent.gloss);
  const placeholder =
    role?.rule ??
    (agent.kind === "spec"
      ? c.specialistRule.spec(title)
      : agent.kind === "write"
        ? c.specialistRule.write(title)
        : c.rulePlaceholder(title));

  // Which box this page writes through: an added agent owns its whole file, a bundled one
  // owns only the words appended to its runs.
  const writesRule = !agent.file;
  const off = !agent.enabled;
  const when = agent.when
    ? clause(agent.when.replace(/^use when\s+/i, ""))
    : (role?.when ?? "");

  // The page fills the pane and the box you write in takes whatever the rest of it leaves.
  // Everything above the box is fixed-height — who the agent is, and what it runs — so the
  // one part of this page that is a workspace is the one part that grows, rather than the
  // page ending halfway up and leaving the bottom of the dialog empty.
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Narrow, the switch and the action drop under the name rather than squeezing it to
          one word a line. */}
      <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex size-[44px] shrink-0 items-end justify-center ${off ? "opacity-30 grayscale" : ""}`}
          >
            <Character name={agent.name} size={44} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[14px] font-[800] text-nb-ink">{title}</span>
              {agent.file && (
                <span className="min-w-0 text-[11px] text-nb-ink-soft">{c.yours}</span>
              )}
            </div>
            <p className="mt-0.5 max-w-[74ch] text-[12px] leading-snug text-nb-ink-soft">
              {gloss}
            </p>
            {/* A specialist is asked for by its own trigger, so the page says when. A role is
                called by its flows and normally has nothing to say here — the two that stand
                in for you (#493) and the one you talk to (#502) say it in their own copy.
                The trigger itself is one sentence; whatever an agent adds after it is a
                paragraph, and a paragraph in a header is read by nobody, so it opens. */}
            {when && <Trigger text={when} />}
          </div>
        </div>

        {/* Whether the agent is on is read and flipped in ONE place — its row in the column
            (#715). A second switch here, beside the first, is two controls for one answer.
            What is left is the pruner's own action (#514) and an added agent's Delete, each
            keeping the place it already had. */}
        <div className="flex shrink-0 items-start gap-3 max-sm:flex-wrap">
          {agent.name === PRUNER && <PruneControls onError={onError} />}

          {/* Only an agent this project added: a role runs the board's own flows and a
              bundled agent ships inside the command, so neither is this board's to remove. */}
          {agent.file && (
            <span ref={anchor} className="relative shrink-0">
              <button
                type="button"
                className={DANGER_BTN}
                disabled={busySwitch}
                onClick={() => setAsking(true)}
              >
                <FiTrash2 aria-hidden />
                {c.delete}
              </button>
              <ConfirmationPopover
                open={asking}
                anchorRef={anchor}
                align="right"
                confirm="filled"
                title={c.deleteTitle(title)}
                description={c.deleteBlurb}
                cancelLabel={c.cancel}
                confirmLabel={c.delete}
                busy={busySwitch}
                onDismiss={() => setAsking(false)}
                onConfirm={() => void onDelete()}
              />
            </span>
          )}
        </div>
      </div>

      <hr className="shrink-0 border-nb-ink/10" />

      {/* The one switch that stops nothing for you (#447), so its page says what that costs
          before the box that trains it — the only peach strip in this dialog. */}
      {agent.name === COSTLY && (
        <p className="flex shrink-0 items-start gap-2.5 rounded-[10px] bg-nb-peach-soft px-3.5 py-3">
          <FiAlertCircle className="mt-[2px] shrink-0 text-nb-peach-ink" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-[800] text-nb-peach-ink">
              {c.decider.costTitle}
            </span>
            <span className="mt-1 block text-[12px] leading-relaxed">{c.decider.cost}</span>
          </span>
        </p>
      )}

      {/* Everything this agent is set to, as rows: what the setting is on the left, its
          control on the right, and under the control the value in effect — what the runtime
          resolves to, what the pick costs. The runtime row is absent on rules older than the
          release that added it (#469), rather than drawn empty with a list that could only
          fail. */}
      {(agent.runs || agent.settings.length > 0) && (
        <div className="flex shrink-0 flex-col gap-5">
          {agent.runs && (
            <SettingRow
              label={c.runtime}
              help={
                agent.runs.unknownRuntime
                  ? c.unknownHarness(agent.runs.unknownRuntime)
                  : c.runtimeBlurb
              }
              control={
                <RuntimePick
                  agent={agent}
                  info={info}
                  busy={busy("runtime")}
                  onRuntime={onRuntime}
                  onRuntimes={onRuntimes}
                />
              }
            />
          )}
          {agent.settings.map((setting: SpecAgentSettingView) => (
            <SettingPick
              key={setting.key}
              setting={setting}
              value={agent.values?.[setting.key] ?? setting.default}
              off={off}
              busy={busy(setting.key)}
              onPick={(value) => onPick(setting.key, value)}
            />
          ))}
        </div>
      )}

      <section className="flex min-h-0 flex-1 flex-col">
        <h4 className="shrink-0 text-[13.5px] font-[800] leading-tight text-nb-ink">
          {writesRule ? c.rule : c.file}
        </h4>
        {/* Where the file actually is (#715). An agent this project added is a file on disk
            like any other, and a person editing it in their own editor needs the path — so
            it is drawn, in full, with one press to copy it. */}
        {!writesRule && agent.file && (
          <div className="mt-2 flex shrink-0 items-start gap-2 rounded-[10px] bg-nb-wash px-3 py-2">
            <code className="min-w-0 flex-1 select-text break-all font-mono text-[11.5px] leading-[20px] text-nb-ink">
              {agent.file.path}
            </code>
            <CopyPath path={agent.file.path} />
          </div>
        )}
        {writesRule ? (
          <textarea
            key={`rule/${agent.name}`}
            value={rule}
            onChange={(e) => onRule(e.target.value)}
            onBlur={onLeave}
            spellCheck={false}
            aria-label={c.ruleLabel(agent.name)}
            placeholder={placeholder}
            className="mt-2 min-h-[110px] w-full flex-1 resize-none rounded-[10px] bg-nb-wash px-3 py-2.5 text-[12px] leading-[17px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
          />
        ) : (
          <>
            <textarea
              ref={box}
              key={`file/${agent.name}`}
              value={file ?? ""}
              onChange={(e) => onFile(e.target.value)}
              onBlur={onLeave}
              spellCheck={false}
              aria-label={c.fileLabel(agent.name)}
              className="mt-2 min-h-[190px] w-full flex-1 resize-none rounded-[10px] bg-nb-wash px-2.5 py-2 font-mono text-[11px] leading-[15px] text-nb-ink focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
            />
            {/* The board reads the text the way its catalog reads an agent. A save it would
                refuse keeps every word of it, keeps this page open, and says what is wrong. */}
            {refusal && (
              <p className="mt-2 flex shrink-0 items-start gap-2 rounded-[9px] bg-nb-peach-soft px-2.5 py-[7px] text-[11.5px] leading-[16px] text-nb-peach-ink">
                <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
                <span className="min-w-0">
                  {c.notSaved} {refusal}
                </span>
              </p>
            )}
          </>
        )}
        {/* Where the words go, and — for the moment after a save — that they got there. One
            line, so the box is never followed by two. */}
        {saved ? (
          <p className="mt-1.5 flex shrink-0 items-center gap-1 text-[11.5px] font-[700] text-nb-mint-ink">
            <FiCheck aria-hidden />
            {c.saved}
          </p>
        ) : (
          <p className="mt-1.5 shrink-0 text-[11.5px] text-nb-ink-soft">{c.savedHere}</p>
        )}
      </section>

      {/* What this role has left to say — how the decider chooses (#447), what the triager
          costs beside the other two switches (#562). Its own copy, so a third role saying
          something here adds no branch. */}
      {role?.note && (
        <p className="max-w-[74ch] shrink-0 text-[11.5px] leading-relaxed text-nb-ink-soft">
          {role.note}
        </p>
      )}

      {agent.name === PER_DELIVERY && (
        <p className="max-w-[74ch] shrink-0 text-[11.5px] leading-relaxed text-nb-ink-soft">
          {frozen}
        </p>
      )}

      {agent.memory.length > 0 && <MemoryRow />}
    </div>
  );
}

// The agent's switch, in the page header. A switch the BOARD says asks (#447, #562) asks
// once on the way ON; switching it off, and every other switch either way, goes straight
// through. Which agents those are is the roster's answer and the words are that role's own,
// so neither is a name written down here.
function EnabledSwitch({
  agent,
  confirm,
  busy,
  bare,
  onFlip,
}: {
  agent: AgentView;
  /** What this role asks, in the reader's language. Absent on every role that asks nothing,
   *  and on a role this copy has never heard of — which switches straight through rather
   *  than opening a popover with no words in it. */
  confirm?: { title: string; body: string; turnOn: string };
  busy: boolean;
  /** Drawn in a column row (#715): the switch alone. The word beside it is what a page
   *  header needs, and a column of the same word down a narrow list is noise. */
  bare?: boolean;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const c = useCopy().configuration.agents;
  const title = useAgentTitle()(agent);
  const anchor = useRef<HTMLSpanElement>(null);
  const [asking, setAsking] = useState(false);
  const asks = agent.confirm && !!confirm;
  return (
    <span ref={anchor} className="relative flex shrink-0 items-center gap-2">
      <Switch
        on={agent.enabled}
        busy={busy}
        label={(agent.enabled ? c.switchOn : c.switchOff)(title)}
        onFlip={async (next) => {
          if (!asks || !next) return onFlip(next);
          setAsking(true);
        }}
      />
      {!bare && (
        <span
          className={`text-[12px] font-[700] ${agent.enabled ? "text-nb-ink" : "text-nb-ink-soft"}`}
        >
          {c.enabled}
        </span>
      )}
      {asks && (
        <ConfirmationPopover
          open={asking}
          anchorRef={anchor}
          align="right"
          confirm="filled"
          title={confirm!.title}
          description={confirm!.body}
          cancelLabel={c.cancel}
          confirmLabel={confirm!.turnOn}
          busy={busy}
          onDismiss={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void onFlip(true);
          }}
        />
      )}
    </span>
  );
}

// --- one setting on an agent's page ------------------------------------------

// One row: what the setting is and what it does on the left, its control on the right, and
// under the control the value in effect — what the pick costs, or what the runtime it names
// actually resolves to. The answer reads beside the thing that sets it rather than folded
// away behind a Change.
function SettingRow({
  label,
  help,
  control,
  effect,
  off,
}: {
  label: React.ReactNode;
  help?: React.ReactNode;
  control: React.ReactNode;
  /** Read under the control, in soft ink — never a second control. */
  effect?: React.ReactNode;
  /** The agent is paused. Its settings stay set-able: setting an agent you have paused is
   *  how it is ready for the day you switch it back on. */
  off?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-8 max-sm:flex-col max-sm:gap-2 ${off ? "opacity-70" : ""}`}
    >
      <div className="min-w-0 pt-[7px]">
        <p className="text-[13.5px] font-[700] leading-tight text-nb-ink">{label}</p>
        {help && (
          <p className="mt-1 max-w-[46ch] text-[11.5px] leading-snug text-nb-ink-soft">
            {help}
          </p>
        )}
      </div>
      <div className="flex w-[236px] shrink-0 flex-col gap-1 max-sm:w-full">
        {control}
        {effect && (
          <span className="text-[11.5px] leading-snug text-nb-ink-soft">{effect}</span>
        )}
      </div>
    </div>
  );
}

// --- an agent's own trigger ---------------------------------------------------

// When this agent is asked for. The first sentence is the answer and stays on the line;
// whatever the agent adds after it — what a discussion is for, where a card goes next —
// opens behind **View rules**, so a header is one line rather than a paragraph nobody reads.
function Trigger({ text }: { text: string }) {
  const c = useCopy().configuration.agents;
  const [open, setOpen] = useState(false);
  const cut = text.search(/(?<=[.。])\s*(?=\S)/);
  const lead = cut < 0 ? text : text.slice(0, cut);
  const rest = cut < 0 ? "" : text.slice(cut).trim();

  return (
    <p className="mt-1 max-w-[74ch] text-[11.5px] leading-snug text-nb-ink-soft">
      <span className="font-[600]">{c.runsWhen}</span> {open ? text : lead}
      {rest && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="ml-1.5 inline-flex cursor-pointer items-center gap-0.5 align-baseline font-[600] text-nb-ink transition-colors duration-100 hover:text-nb-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent"
        >
          {open ? c.hideRules : c.viewRules}
          <FiChevronDown
            size={11}
            aria-hidden
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </p>
  );
}

// One of the settings an agent declares (#257). Each choice carries its own cost, so the
// list says what a pick means before it is made and the row says it again once it is.
function SettingPick({
  setting,
  value,
  off,
  busy,
  onPick,
}: {
  setting: SpecAgentSettingView;
  /** The choice in effect — the saved one, or the setting's own default. */
  value: string;
  off: boolean;
  /** A save for this setting is in flight. */
  busy: boolean;
  onPick: (value: string) => void;
}) {
  const picked = setting.choices.find((choice) => choice.value === value);
  return (
    <SettingRow
      off={off}
      label={setting.label}
      help={setting.help}
      effect={picked?.cost}
      control={
        <Select value={value} disabled={busy} onValueChange={onPick}>
          <SelectTrigger
            aria-label={setting.label}
            className={`${FLAT_CONTROL} h-[32px] w-full text-[12.5px] disabled:cursor-wait`}
          >
            {/* A value the agent no longer offers still reads as itself rather than as an
                empty box. */}
            <SelectValue placeholder={value} />
          </SelectTrigger>
          <SelectContent>
            {setting.choices.map((choice) => (
              <SelectItem
                key={choice.value}
                value={choice.value}
                hint={
                  choice.cost ? (
                    <span className="max-w-[34ch] text-[11px] font-[400] leading-snug text-nb-ink-soft">
                      {choice.cost}
                    </span>
                  ) : undefined
                }
              >
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}

// --- what an agent remembers --------------------------------------------------

// One line saying the agent remembers, and what that buys the next answer. What it keeps is
// its own and read-only, so there is nothing here to open.
function MemoryRow() {
  const c = useCopy().configuration.agents;
  return (
    <Panel>
      <div className="flex items-start gap-2.5 py-3">
        <FiFolder size={14} aria-hidden className="mt-[2px] shrink-0 text-nb-ink-soft" />
        <div className="min-w-0">
          <span className="text-[13px] font-[700] text-nb-ink">{c.remembers}</span>
          <p className="mt-0.5 text-[12px] leading-snug text-nb-ink-soft">{c.remembersHint}</p>
        </div>
      </div>
    </Panel>
  );
}

// --- the memory pruner's own controls (#514) ---------------------------------

// One pass, and the schedule that repeats it.
//
// Pruning is the only agent work nothing on the board asks for, so this is the whole of how
// it is reached: **Run now** starts a pass, and the chip under it opens the opt-in that
// makes the board start one by itself. The chip is compact and closed by default — a
// standing switch row would give a setting that is off on almost every board the width of
// the page — and it says the cadence once one is running, which is the only state worth
// reading at a glance. Stacked rather than side by side (#569): the two are the same one
// column wide, and the header's name and gloss get the width back.
//
// Recurrence is OFF until it is asked for, and opening the popover enables nothing: a pass
// rewrites every memory file.
//
// The quiet line under the group is the last pass that PASSED. A run that failed or was
// stopped leaves it exactly where it was and says so on that same line, so a schedule that
// is not getting through is visible without opening Runs.
function PruneControls({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.agents.pruner;
  const [schedule, setSchedule] = useState<MemoryPruneSchedule | null>(null);
  const [tooOld, setTooOld] = useState(false);
  const [running, setRunning] = useState(false);
  // Whether the newest finished pass got through. Only ever drawn beside the button — the
  // last-run line below is the record of what passed, and a failure must not move it.
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);

  const readSchedule = useCallback(async () => {
    const res = await memoryPruneAction();
    setSchedule(res.schedule);
    setTooOld(!res.schedule && !res.error);
    if (res.error) onError?.(res.error);
  }, [onError]);

  // What the runs record says about pruning right now: whether one is going, and whether
  // the newest finished one got through. Polled while a pass is live and read once
  // otherwise — the page is a settings page, not a run log.
  const readRuns = useCallback(async () => {
    let live = false;
    try {
      const runs = (await listSessionsAction()).filter((r) => r.action === "prune-memory");
      live = runs.some((r) => r.status === "running");
      const done = runs.filter((r) => r.status !== "running").sort((a, b) => b.startedAt - a.startedAt)[0];
      setFailed(!!done && done.status !== "done");
    } catch {
      // the runs could not be read — the button still works, and it says nothing it can't
    }
    setRunning(live);
    return live;
  }, []);

  useEffect(() => {
    void readSchedule();
    void readRuns();
  }, [readSchedule, readRuns]);

  // While a pass is going, look again every few seconds — and re-read the schedule the
  // moment it stops, because a pass that passed is what moves the last-run line.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void readRuns().then((live) => {
        if (!live) void readSchedule();
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [running, readRuns, readSchedule]);

  const start = async () => {
    if (running) return;
    setRunning(true);
    setFailed(false);
    const res = await startPruneMemoryAction();
    if (!res.ok) {
      setRunning(false);
      onError?.(res.error || c.saveFailed);
      return;
    }
    void readRuns();
  };

  // Write the schedule and read back what landed. False is a refusal — the list says so
  // itself, in its own words, and the state on screen is still the one that is running.
  const save = async (next: { enabled: boolean; cadence: string }) => {
    const res = await setMemoryPruneAction(next);
    if (!res.ok) return false;
    await readSchedule();
    return true;
  };

  // The cadence the board is really on. A schedule can only be enabled with one the parser
  // reads, so `on` and a null `saved` cannot happen together — a cadence nothing recognises
  // arrives here as no schedule at all, and the list starts empty.
  const saved = parseCadence(schedule?.cadence ?? "");
  const on = schedule?.enabled ?? false;
  const state = on && saved ? c.cadenceLabel(saved.n, saved.unit, saved.at) : "";

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button type="button" className={ACCENT_BTN} disabled={running} onClick={() => void start()}>
        <FiScissors aria-hidden />
        {running ? c.running : c.run}
      </button>
      {!tooOld && (
        <span ref={anchor} className="relative">
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="listbox"
            title={c.chipLabel(state || c.off)}
            aria-label={c.chipLabel(state || c.off)}
            onClick={() => setOpen((was) => !was)}
            // Neutral while off, ember once it is running: the closed chip's whole job is
            // to say whether anything starts by itself, and what. Running, the cadence
            // alone is the whole answer; off, it takes the setting's name to mean anything.
            className={`flex h-[28px] cursor-pointer items-center gap-1.5 rounded-[8px] px-2 text-[11.5px] font-[700] transition-colors duration-100 ${
              state ? "bg-nb-accent-soft text-nb-accent-deep" : "bg-nb-wash text-nb-ink-soft hover:bg-nb-canvas"
            }`}
          >
            <FiClock size={12} aria-hidden />
            {state || c.chipLabel(c.off)}
            <FiChevronDown size={11} aria-hidden />
          </button>
          {open && (
            <CadenceMenu
              saved={saved}
              enabled={on}
              copy={c}
              anchorRef={anchor}
              onDismiss={() => setOpen(false)}
              onSave={save}
            />
          )}
        </span>
      )}
      <span className="text-[11px] text-nb-ink-soft">
        {failed && !running ? `${c.failed} · ` : ""}
        {schedule?.lastRun ? c.lastRun(schedule.lastRun) : c.neverRun}
      </span>
      {tooOld && <span className="text-[11px] text-nb-ink-soft">{c.tooOld}</span>}
    </div>
  );
}

// The cadence list, in order. Off first, three common cadences, then the one row that opens
// anything — `6h` / `1d` / `7d` are the cadences themselves, so a preset row needs no table
// of its own beyond the number and unit its words are read off.
type Preset = "6h" | "1d" | "7d";
type Pick = "off" | Preset | "custom";
const PRESETS = ["6h", "1d", "7d"] as const;
const PRESETS_AT: Record<Preset, { n: number; unit: CadenceUnit }> = {
  "6h": { n: 6, unit: "h" },
  "1d": { n: 1, unit: "d" },
  "7d": { n: 7, unit: "d" },
};
const ROWS: Pick[] = ["off", ...PRESETS, "custom"];

// What the pickers will offer per unit. A ceiling as much as a floor: a prune rewrites every
// memory file, so minutes below five is a job that never finishes before the next one starts,
// and a year is as far out as scheduling one still means anything.
const RANGE: Record<CadenceUnit, [number, number]> = { m: [5, 1440], h: [1, 720], d: [1, 365] };

/** What Custom is editing. `time` is null until a time is asked for, and only whole days may
 *  carry one. `from` is the cadence it was filled back from, which the range check spares. */
interface Draft {
  value: string;
  unit: CadenceUnit;
  time: string | null;
  from: { value: string; unit: CadenceUnit } | null;
}

const write = (n: number, unit: CadenceUnit, at: string | null): string =>
  formatCadence({ n, unit, at: at ?? "" });

// The chip's own panel: one list of cadences, and under it the only one that has anything
// to fill in.
//
// Picking a row IS the save. The switch this replaces asked for an intent and then a
// cadence, which left a schedule looking on with nothing to run on; here the two are one
// press, and the tick moves only once the write has landed. **Custom** is the one row that
// opens anything, and it writes on Save and nowhere else — leaving, by Escape, by Cancel,
// by a press outside or by closing Configuration, throws the draft away and changes nothing.
//
// Nothing here can compose a cadence the parser refuses, so a refusal is the board failing
// to write. It is said where it was pressed, in this copy's own words rather than the
// parser's, with the tick still on the cadence that is really running.
function CadenceMenu({
  saved,
  enabled,
  copy,
  anchorRef,
  onDismiss,
  onSave,
}: {
  /** The cadence in the config, whether or not it is switched on — a schedule that was
   *  switched off keeps it, and Custom offers it back. */
  saved: Cadence | null;
  enabled: boolean;
  copy: ReturnType<typeof useCopy>["configuration"]["agents"]["pruner"];
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  onDismiss: () => void;
  onSave: (next: { enabled: boolean; cadence: string }) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<Pick | null>(null);
  const [failed, setFailed] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const presetOf = (c: Cadence | null): Preset | null => {
    if (!c || c.at) return null;
    const id = `${c.n}${c.unit}`;
    return (PRESETS as readonly string[]).includes(id) ? (id as Preset) : null;
  };
  const picked: Pick = !enabled ? "off" : (presetOf(saved) ?? "custom");
  const label = (id: Pick) =>
    id === "off" ? copy.off : id === "custom" ? copy.custom : copy.cadenceLabel(PRESETS_AT[id].n, PRESETS_AT[id].unit, "");
  // Custom's right end: the cadence it would come back with — the saved one when it is no
  // preset, or the one a switched-off schedule is keeping.
  const note = saved && (picked === "custom" || !enabled) ? copy.cadenceLabel(saved.n, saved.unit, saved.at) : undefined;

  // Leaving never writes. A draft only exists until something is pressed, so there is
  // nothing here to lose that the user did not already decide to lose.
  const leave = useRef(onDismiss);
  leave.current = onDismiss;
  useEffect(() => {
    // Escape takes this list and nothing else. Configuration closes on the same key from
    // `window`, so the press is caught on the way down and stopped there — otherwise backing
    // out of the cadence takes the whole dialog with it. The unit list is its own layer and
    // answers Escape first, so a press inside it is left alone.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ((e.target as Element | null)?.closest?.("[data-radix-popper-content-wrapper]")) return;
      e.stopPropagation();
      leave.current();
    };
    // The unit list portals to <body>, so a press in it is a press in this panel.
    const onPointerDown = (e: PointerEvent) => {
      const at = e.target as Element | null;
      if (!at || anchorRef.current?.contains(at) || at.closest("[data-radix-popper-content-wrapper]")) return;
      leave.current();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchorRef]);

  // Open on the cadence in effect, so a keyboard lands in the list rather than at its edge.
  useEffect(() => {
    const rows = list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    rows?.[ROWS.indexOf(picked)]?.focus();
    // Once, as the list opens — moving the tick afterwards must not steal focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const rows = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (at + 1) % rows.length : (at < 1 ? rows.length : at) - 1;
    rows[next]?.focus();
  };

  const pick = async (id: Pick) => {
    if (busy) return;
    if (id === "custom") {
      setFailed("");
      setDraft(
        saved
          ? { value: String(saved.n), unit: saved.unit, time: saved.at || null, from: { value: String(saved.n), unit: saved.unit } }
          : { value: "", unit: "d", time: null, from: null },
      );
      return;
    }
    setDraft(null);
    // Already what is saved: there is nothing to write, and writing anyway would restate a
    // cadence the parser never recognised.
    if (id === picked) return onDismiss();
    setFailed("");
    setBusy(id);
    // Switching off keeps the cadence, so the same one comes back when it is switched on.
    const ok = await onSave({
      enabled: id !== "off",
      cadence: id === "off" ? (saved ? formatCadence(saved) : "") : id,
    });
    setBusy(null);
    if (ok) onDismiss();
    else setFailed(copy.presetFailed(label(id)));
  };

  return (
    <div className="nb-panel-sm absolute right-0 top-[calc(100%+8px)] z-40 w-[280px] bg-nb-paper p-1 text-left">
      <div ref={list} role="listbox" aria-label={copy.recurring} onKeyDown={step} className="flex flex-col">
        {ROWS.map((id) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={picked === id}
            disabled={!!busy}
            onClick={() => void pick(id)}
            className={`relative flex w-full cursor-pointer select-none items-center gap-3 rounded-[7px] py-1.5 pl-2.5 pr-8 text-left text-[13px] font-[600] text-nb-ink outline-none hover:bg-nb-wash focus-visible:bg-nb-wash disabled:cursor-wait disabled:opacity-60 ${
              id === "custom" && draft ? "bg-nb-wash" : ""
            }`}
          >
            {label(id)}
            {id === "custom" && <FiChevronDown size={11} aria-hidden className="-ml-2 shrink-0 opacity-45" />}
            {(busy === id || (id === "custom" && note)) && (
              <span className="ml-auto shrink-0 truncate text-[10.5px] font-[400] text-nb-ink-soft">
                {busy === id ? copy.saving : note}
              </span>
            )}
            {picked === id && (
              <span className="absolute right-2.5 flex items-center text-nb-accent-deep">
                <FiCheck size={13} aria-hidden />
              </span>
            )}
          </button>
        ))}
      </div>

      {draft && (
        <CadenceEdit
          draft={draft}
          busy={busy === "custom"}
          failed={failed}
          copy={copy}
          onChange={setDraft}
          onCancel={onDismiss}
          onSave={async (cadence) => {
            setFailed("");
            setBusy("custom");
            const ok = await onSave({ enabled: true, cadence });
            setBusy(null);
            if (ok) onDismiss();
            else setFailed(copy.saveFailed);
          }}
        />
      )}

      {!draft && failed && (
        <p className="m-1 rounded-[8px] bg-nb-peach-soft px-2.5 py-[6px] text-[11.5px] leading-[16px] text-nb-peach-ink">
          {failed}
        </p>
      )}
    </div>
  );
}

// Custom's own block: how many, of which unit, and — for whole days only — the time of day
// it lands at. A time is offered rather than sitting there empty, because most cadences
// name none, and it is the days unit's own extra: switching to minutes or hours takes it
// off screen and out of what gets written.
//
// The ranges below are the pickers' limits, not the board's. A cadence already in the file
// keeps whatever it means; it is only checked once the number or the unit is changed, so
// opening this on an old `2000m` cannot fail a save nobody asked for.
function CadenceEdit({
  draft,
  busy,
  failed,
  copy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  busy: boolean;
  failed: string;
  copy: ReturnType<typeof useCopy>["configuration"]["agents"]["pruner"];
  onChange: (next: Draft) => void;
  onCancel: () => void;
  onSave: (cadence: string) => Promise<void>;
}) {
  const [min, max] = RANGE[draft.unit];
  const kept = !!draft.from && draft.value === draft.from.value && draft.unit === draft.from.unit;
  const n = Number(draft.value);
  const numberOk = /^\d+$/.test(draft.value) && (kept ? n >= 1 : n >= min && n <= max);
  const at = draft.unit === "d" ? draft.time : null;
  const canSave = numberOk && at !== "";
  // The one thing that ever says a range, and only once a number is in the box: an empty
  // box is not a mistake yet.
  const wrong = draft.value !== "" && !numberOk ? copy.outOfRange(copy.units[draft.unit], min, max) : "";

  return (
    <div className="mt-1 border-t border-nb-ink/12 px-1.5 pb-1.5 pt-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[12.5px] text-nb-ink-soft">{copy.every}</span>
        <input
          value={draft.value}
          disabled={busy}
          autoFocus
          inputMode="numeric"
          aria-label={copy.every}
          aria-invalid={!!wrong}
          onChange={(e) => onChange({ ...draft, value: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave && !busy) void onSave(write(n, draft.unit, at));
          }}
          className={`w-[56px] shrink-0 rounded-[8px] bg-nb-wash px-2.5 py-1.5 text-center text-[12.5px] font-[700] focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait ${
            wrong ? "text-nb-peach-ink" : "text-nb-ink"
          }`}
        />
        <Select
          value={draft.unit}
          disabled={busy}
          onValueChange={(unit) => onChange({ ...draft, unit: unit as CadenceUnit })}
        >
          <SelectTrigger aria-label={copy.unit} className={`${FLAT_CONTROL} min-w-0 flex-1 px-2.5 py-1.5 text-[12.5px]`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["m", "h", "d"] as const).map((unit) => (
              <SelectItem key={unit} value={unit}>
                {copy.units[unit]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft.unit === "d" &&
        (draft.time === null ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange({ ...draft, time: "09:00" })}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-[8px] px-1 py-1 text-[12px] font-[600] text-nb-ink-soft hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-wait"
          >
            <FiPlus size={12} aria-hidden />
            {copy.addTime}
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-[12.5px] text-nb-ink-soft">{copy.atTime}</span>
            <input
              type="time"
              value={draft.time}
              disabled={busy}
              aria-label={copy.atTime}
              onChange={(e) => onChange({ ...draft, time: e.target.value })}
              className="shrink-0 rounded-[8px] bg-nb-wash px-2.5 py-1.5 text-center font-mono text-[12.5px] font-[700] text-nb-ink focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait"
            />
            <button
              type="button"
              disabled={busy}
              aria-label={copy.dropTime}
              title={copy.dropTime}
              onClick={() => onChange({ ...draft, time: null })}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-wait"
            >
              <FiX size={13} aria-hidden />
            </button>
          </div>
        ))}

      {(wrong || failed) && (
        <p className="mt-2 rounded-[8px] bg-nb-peach-soft px-2.5 py-[6px] text-[11.5px] leading-[16px] text-nb-peach-ink">
          {wrong || failed}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="xs" disabled={busy} onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button variant="accent" size="xs" disabled={!canSave || busy} onClick={() => void onSave(write(n, draft.unit, at))}>
          {busy ? copy.saving : copy.save}
        </Button>
      </div>
    </div>
  );
}

// --- what one agent runs (#443, #469) -----------------------------------------

// One control: the runtime this agent runs, which is the BOARD's — every checkout runs the
// agent on the same thing. The row carries its harness and its model with it, so nothing
// here repeats them and there is no second field to fill in.
//
// The list is the message box's (#272): every runtime once, Global default first, the pick
// ticked in place, and a right-end note per row — its model id, or "the board's" on Global
// default. Picking that first row is how an agent goes back to having no pick of its own.
// Install state is left off: a pick travels with the repository, so one computer's PATH is
// not the board's answer.
//
// Beside it, the way across to Configuration → Runtimes, which is the one place a runtime is
// actually set up.
function RuntimePick({
  agent,
  info,
  busy,
  onRuntime,
  onRuntimes,
}: {
  agent: AgentView;
  info: AgentInfo;
  busy: boolean;
  onRuntime: (runtime: string) => void;
  onRuntimes?: () => void;
}) {
  const c = useCopy().configuration.agents;
  const nameOf = useRuntimeName();
  const [open, setOpen] = useState(false);
  const picked = info.runtimes.find((r) => r.id === agent.runs.runtime);
  // The whole answer to "what does this run on", deduped: a row named after its own harness
  // says it once, and **Global default** — a row rather than a harness — says both.
  const shown = picked
    ? [...new Set([nameOf(picked), picked.label, picked.model].filter(Boolean))].join(" · ")
    : "";

  return (
    // One control and nothing under it. What the pick resolves to is IN the closed trigger,
    // and the way across to where a runtime is edited is the last entry of the open list —
    // both were lines under the box, and a row of three stacked answers to one question read
    // as three settings.
    //
    // `runs.runtime` is already the runtime in effect — Global default for an agent that
    // named none — and handing that first row back drops the agent's own pick, so the list is
    // drawn once with nothing mapped in or out.
    <Select
      open={open}
      onOpenChange={setOpen}
      value={agent.runs.runtime}
      disabled={busy}
      onValueChange={onRuntime}
    >
      <SelectTrigger
        aria-label={c.runtime}
        className={`${FLAT_CONTROL} h-[34px] w-full min-w-0 text-[12.5px] disabled:cursor-wait`}
      >
        {/* Not SelectValue: the trigger says more than the entry's own text — the row's name
            AND what it resolves to, which is the whole answer to "what does this run on". */}
        <span className="flex min-w-0 items-center gap-1.5">
          {picked && <AgentMark src={picked.icon} size={13} />}
          <span className="truncate">{shown}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {info.runtimes.map((row) => (
          <SelectItem
            key={row.id}
            value={row.id}
            note={row.fixed ? c.boardsOwn : row.model}
          >
            <span className="flex items-center gap-1.5">
              <AgentMark src={row.icon} size={13} />
              {nameOf(row)}
            </span>
          </SelectItem>
        ))}
        {onRuntimes && (
          <>
            <SelectSeparator />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRuntimes();
              }}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-[7px] py-1.5 pl-2.5 pr-2.5 text-left text-[12.5px] font-[600] text-nb-ink-soft transition-colors duration-100 hover:bg-nb-wash hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent"
            >
              {c.openRuntimes}
              <FiArrowUpRight size={12} aria-hidden className="ml-auto shrink-0" />
            </button>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

// --- the characters ----------------------------------------------------------

// The art is one PNG per agent at `public/agent-art/<name>.png`, drawn on a shared canvas
// with a shared pixel size — `agent-art.md` beside `design.md` is the recipe. An agent with
// no file of its own is the same character holding a card with its initial, so the pane is
// never a row of broken images and two art-less agents still differ.
export function Character({ name, size = 48 }: { name: string; size?: number }) {
  const [art, setArt] = useState(true);
  useEffect(() => setArt(true), [name]);
  if (!art) return <Lettered name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/agent-art/${name}.png`}
      alt=""
      width={size}
      height={size}
      onError={() => setArt(false)}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// The palette's five inks, picked by the agent's name — so two agents without art are two
// different colours and stay the colour they were.
const INKS = [
  "var(--color-nb-sky-ink)",
  "var(--color-nb-lilac-ink)",
  "var(--color-nb-mint-ink)",
  "var(--color-nb-peach-ink)",
  "var(--color-nb-accent-deep)",
];

// A 5x7 letter, drawn a block at a time so it lands on the character's own pixel grid
// rather than reading as text that wandered into it.
const GLYPHS: Record<string, string> = {
  a: "01110 10001 10001 11111 10001 10001 10001",
  b: "11110 10001 10001 11110 10001 10001 11110",
  c: "01110 10001 10000 10000 10000 10001 01110",
  d: "11110 10001 10001 10001 10001 10001 11110",
  e: "11111 10000 10000 11110 10000 10000 11111",
  f: "11111 10000 10000 11110 10000 10000 10000",
  g: "01110 10001 10000 10111 10001 10001 01111",
  h: "10001 10001 10001 11111 10001 10001 10001",
  i: "11111 00100 00100 00100 00100 00100 11111",
  j: "00111 00010 00010 00010 00010 10010 11110",
  k: "10011 10110 11100 11000 11100 10110 10011",
  l: "10000 10000 10000 10000 10000 10000 11111",
  m: "10001 11011 11111 10101 10001 10001 10001",
  n: "10001 11001 11101 10111 10011 10001 10001",
  o: "01110 10001 10001 10001 10001 10001 01110",
  p: "11110 10001 10001 11110 10000 10000 10000",
  q: "01110 10001 10001 10001 10101 10010 01101",
  r: "11110 10001 10001 11110 11100 10110 10011",
  s: "01111 10000 10000 01110 00001 00001 11110",
  t: "11111 00100 00100 00100 00100 00100 00100",
  u: "10001 10001 10001 10001 10001 10001 01110",
  v: "11011 11011 11011 01110 01110 00100 00100",
  w: "10001 10001 10001 10101 10101 11111 10001",
  x: "11011 11011 01110 00100 01110 11011 11011",
  y: "11011 11011 01110 00100 00100 00100 00100",
  z: "11111 00011 00110 00100 01100 11000 11111",
  "0": "01110 10001 10011 10101 11001 10001 01110",
  "1": "00100 01100 00100 00100 00100 00100 01110",
  "2": "01110 10001 00001 00010 00100 01000 11111",
  "3": "11111 00010 00100 00010 00001 10001 01110",
  "4": "10010 10010 10010 11111 00010 00010 00010",
  "5": "11111 10000 11110 00001 00001 10001 01110",
  "6": "00110 01000 10000 11110 10001 10001 01110",
  "7": "11111 00011 00110 00100 00100 00100 00100",
  "8": "01110 10001 10001 01110 10001 10001 01110",
  "9": "01110 10001 10001 01111 00001 00010 01100",
};

// The character with no prop, holding a card with the agent's initial — one PNG plus a card
// drawn over it, because the letter changes and the character does not. The card is in the
// agent's own ink, which is what keeps two added agents apart at a glance; the letter itself
// is the visor's cream, so the card reads as a held card and not as a second face.
//
// The rectangles are in the PNG's own 96x96 coordinates: the card sits on the torso, below
// the visor and above the legs, where every bundled character carries its prop.
function Lettered({ name, size = 48 }: { name: string; size?: number }) {
  const rows = (GLYPHS[name[0]?.toLowerCase() ?? ""] ?? GLYPHS.a!).split(" ");
  const ink =
    INKS[
      [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % INKS.length
    ]!;
  return (
    <span className="relative block" style={{ height: size, width: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/agent-art/base.png"
        alt=""
        width={size}
        height={size}
        style={{ imageRendering: "pixelated" }}
      />
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox="0 0 96 96"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <rect x={22} y={48} width={35} height={37} fill="#12130f" />
        <rect x={25} y={51} width={29} height={31} fill={ink} />
        {rows.map((row, y) =>
          [...row].map((on, x) =>
            on === "1" ? (
              <rect
                key={`${x}-${y}`}
                x={29 + x * 4}
                y={52 + y * 4}
                width={4}
                height={4}
                fill="#fcf8ea"
              />
            ) : null,
          ),
        )}
      </svg>
    </span>
  );
}

/** What an agent is CALLED, in the language this machine reads.
 *
 *  Three answers, in order. A role is one of a closed set the command ships, so this pane's
 *  own copy names it. Every other agent is a file and says its own name in its `AGENT.md`
 *  under `akb.i18n`, which the board hands over already picked for this language. An agent
 *  that says nothing keeps its own name, spelled out — the right answer in English, and
 *  never a blank. */
export function useAgentTitle(): (agent: AgentView) => string {
  const roles = useCopy().configuration.agents.roles;
  return useCallback(
    (agent: AgentView) =>
      roles[agent.name as keyof typeof roles]?.name || agent.title || spellAgent(agent.name),
    [roles],
  );
}

function sentence(text: string): string {
  return clause(sentenceStart(text.trim()));
}

// The `Runs when` line reads on from its label, so it keeps the agent's own capitalisation
// rather than being sentence-cased into "Runs when A card changes…".
function clause(text: string): string {
  const value = text.trim();
  return !value || /[.!?]$/.test(value) ? value : `${value}.`;
}

function sentenceStart(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
