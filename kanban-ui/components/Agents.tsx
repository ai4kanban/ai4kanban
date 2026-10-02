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
  FiArrowUpRight,
  FiCheck,
  FiCopy,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiPlus,
  FiRotateCcw,
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
  memoryReviewAction,
  setSpecAgentSettingAction,
  startPruneMemoryAction,
  startReviewMemoryAction,
  dismissalReviewAction,
  setDismissalReviewAction,
  startReviewDismissalsAction,
  productDescriptionAction,
  setProductDescriptionAction,
  startDescribeProductAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { spellAgent, useAgentName } from "@/lib/agent-name";
import { type Cadence, type CadenceUnit, formatCadence, parseCadence } from "@/lib/cadence";
import type {
  AgentAction,
  AgentInfo,
  AgentView,
  CadenceSchedule,
  WorkflowStage,
  MemoryReviewState,
  SpecAgentSettingView,
} from "@/lib/types";
import type { CadenceCopy } from "@/i18n/configuration/types";
import { Button } from "./button";
import { AgentMark, PRUNER, useRuntimeName } from "./Configuration";
import { GuideDrawer } from "./Guide";
import { ConfirmationPopover } from "./confirm-popover";
import { useCopyText } from "./copy";
import {
  DANGER_BTN,
  FLAT_CONTROL,
  Loading,
  Note,
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
import { POPUP_ROW, Popover, PopoverContent, PopoverTrigger, stepOptions } from "./ui/popover";
import { sayFailure } from "@/lib/start-failure";

// The one agent whose page carries the review action (#748). Named here because there is
// exactly one, and its page is the only place Review now belongs.
const REVIEWER_OF_MEMORY = "memory-reviewer";

// The dismissal reviewer (#929): the pruner's controls.
const REVIEWER_OF_DISMISSALS = "dismissal-reviewer";

// The product writer (#1268): the same controls.
const PRODUCT_WRITER = "product-writer";

// Configuration → Board's groups, by what starts each agent (#1208). Anything not named here
// — the discussion, an agent this project added — is one you start.
// A literal rather than PRUNER: Configuration imports this file, so its exports are
// not initialised yet when this is.
const ON_A_SCHEDULE = [REVIEWER_OF_MEMORY, "memory-pruner", REVIEWER_OF_DISMISSALS, PRODUCT_WRITER];
const ON_AN_EVENT = ["proposer", "triage"];
// Whose runtime every planning lead runs (#1316).
const PLANNING_HELPER = "discussion-helper";

/** The scheduled agents' cadences, for the column's rows. `reload` after a save. */
function useCadences(onError?: (msg: string) => void) {
  const [cadences, setCadences] = useState<Record<string, CadenceSchedule | null>>({});
  const reload = useCallback(async () => {
    const [prune, dismissals, product] = await Promise.all([
      memoryPruneAction(),
      dismissalReviewAction(),
      productDescriptionAction(),
    ]);
    const error = prune.error || dismissals.error || product.error;
    if (error) onError?.(error);
    setCadences({
      [PRUNER]: prune.schedule,
      [REVIEWER_OF_DISMISSALS]: dismissals.schedule,
      [PRODUCT_WRITER]: product.schedule,
    });
  }, [onError]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { cadences, reload };
}

// The board's own "who is the output for" row, on every spec agent (#445).
const OUTPUT_KEY = "output";

// Which copy says a scheduled agent's cadence.
const CADENCE_COPY: Record<string, "pruner" | "dismissalReviewer" | "productWriter" | undefined> = {
  "memory-pruner": "pruner",
  [REVIEWER_OF_DISMISSALS]: "dismissalReviewer",
  [PRODUCT_WRITER]: "productWriter",
};

/** The roster, and every write that touches it — read once and shared by the two panes that
 *  draw an agent (#944). Configuration → Board lists the agents the board runs itself;
 *  Configuration → Workflows lists the ones a workflow assigns, stage by stage. Both open
 *  the SAME page beside their column, so a rule, a runtime and an `AGENT.md` are written in
 *  one place wherever the agent was reached from. */
export function useAgentRoster(onError?: (msg: string) => void) {
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
  const [refusal, setRefusal] = useState<{ agent: string; why: string } | null>(null);
  // What is being saved right now, by the thing being saved: an agent's name for its
  // switch, `name/key` for one of its settings.
  const [saving, setSaving] = useState<string[]>([]);
  // Focus the new agent's `AGENT.md` box once, when New agent lands on it — the whole point
  // of the button is to carry straight on into writing the prompt.
  const [focusFile, setFocusFile] = useState(false);

  // The roster, and the boxes seeded from it. Read when the pane opens, and again after an
  // agent is added — the board decides what the new agent's file says, so the pane takes its
  // answer rather than assembling one.
  const load = useCallback(async (): Promise<void> => {
    const res = await agentsAction();
    setAgents(res.agents);
    setProblems(res.problems);
    setLoadError(res.error ?? null);
    setLoaded(true);
    if (!res.agents) return;
    setRules(Object.fromEntries(res.agents.map((a) => [a.name, a.rule])));
    setFiles(
      Object.fromEntries(res.agents.filter((a) => a.file).map((a) => [a.name, a.file!.text])),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        setAgents((all) => all?.map((a) => (a.name === name ? { ...a, rule } : a)) ?? all);
        setSavedRule(name);
      } else {
        box.onError?.(sayFailure(res, box.c.ruleFailed(name)));
      }
    }

    const text = box.files[name];
    if (agent.file && text !== undefined && text !== agent.file.text) {
      const res = await saveAgentFileAction(name, text);
      if (!res.ok) {
        setRefusal({ agent: name, why: sayFailure(res, box.c.ruleFailed(name))});
        return false;
      }
      setAgents(
        (all) => all?.map((a) => (a.name === name ? { ...a, file: { ...a.file!, text } } : a)) ?? all,
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
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const select = useCallback(async (name: string) => {
    const was = pickedRef.current;
    if (name === was) return;
    if (was && !(await leave.current(was))) return;
    setPicked(name);
  }, []);

  // Flip one switch: on screen at once, saved behind it, and put back if the save fails. A
  // switch that silently didn't land is a setting the user can't trust.
  const flip = async (agent: AgentView, on: boolean) => {
    setAgents((all) => all?.map((a) => (a.name === agent.name ? { ...a, enabled: on } : a)) ?? all);
    setSaving((names) => [...names, agent.name]);
    try {
      const res = await setSpecAgentAction(agent.name, on);
      if (!res.ok) {
        setAgents(
          (all) => all?.map((a) => (a.name === agent.name ? { ...a, enabled: !on } : a)) ?? all,
        );
        onError?.(sayFailure(res, (on ? c.flipFailedOn : c.flipFailedOff)(titleOf(agent))));
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
          all?.map((a) => (a.name === agent.name ? { ...a, values: { ...a.values, [key]: v } } : a)) ??
          all,
      );
    const token = `${agent.name}/${key}`;
    put(value);
    setSaving((names) => [...names, token]);
    try {
      const res = await setSpecAgentSettingAction(agent.name, key, value);
      if (!res.ok) {
        put(was);
        onError?.(sayFailure(res, c.saveFailed(titleOf(agent))));
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
        onError?.(sayFailure(res, c.harnessFailed(titleOf(agent))));
        return;
      }
      await load();
    } finally {
      setSaving((names) => names.filter((n) => n !== token));
    }
  };

  // Write one agent and read the roster back. It returns the name the board actually wrote,
  // so the caller can assign it where it was created and open its page — which is where a
  // new agent has to end up, because one whose file is still the template does nothing.
  const create = async (
    name: string,
    stage?: WorkflowStage,
  ): Promise<{ agent?: string; error?: string }> => {
    const res = await createAgentAction(name, stage);
    if (!res.ok) return { error: sayFailure(res, c.saveFailed(name))};
    await load();
    return { agent: res.agent ?? name };
  };

  // Delete the agent whose page is open. The roster is read again BEFORE the selection is
  // cleared, so the save-on-leave under it finds no such agent and writes nothing back into
  // the folder that has just gone. Clearing it hands the page back to the column's first row,
  // which is where the pane started.
  const remove = async (name: string) => {
    const gone = agents?.find((a) => a.name === name);
    setSaving((names) => [...names, name]);
    try {
      const res = await deleteAgentAction(name);
      if (!res.ok)
        return onError?.(sayFailure(res, c.deleteFailed(gone ? titleOf(gone) : spellAgent(name))));
      setRefusal((was) => (was?.agent === name ? null : was));
      // Reseeds both boxes off the new roster, so the deleted agent's unsaved text goes
      // with it rather than sitting in a map nothing draws from.
      await load();
      setPicked("");
    } finally {
      setSaving((names) => names.filter((n) => n !== name));
    }
  };

  return {
    agents,
    problems,
    loadError,
    loaded,
    load,
    picked,
    setPicked,
    select,
    rules,
    setRules,
    files,
    setFiles,
    savedRule,
    setSavedRule,
    refusal,
    saving,
    focusFile,
    setFocusFile,
    leave,
    flip,
    pick,
    bind,
    create,
    remove,
  };
}

export type AgentRoster = ReturnType<typeof useAgentRoster>;

/** The selected agent's whole page, wired to the roster above. Both panes draw this one:
 *  what is different between them goes in through the slots (#944). */
export function AgentDetail({
  roster,
  agent,
  info,
  scoped,
  inStage,
  usage,
  actions,
  extra,
  onDeleted,
  onCadence,
  onRuntimes,
  onFollowed,
  onError,
}: {
  roster: AgentRoster;
  agent: AgentView;
  info: AgentInfo;
  /** Drawn inside a workflow: this pane's actions and Delete sit at the name row's right. */
  scoped?: boolean;
  /** The agent is drawn as one stage's assignment — see `Page`. */
  inStage?: boolean;
  /** Under the agent's line: where else it is used, and what a role cannot be told. */
  usage?: React.ReactNode;
  /** Actions of this pane's own, beside Delete. */
  actions?: React.ReactNode;
  /** A section between the settings and the instruction box; on a built-in agent in a
   *  `scoped` pane it takes the rule box's place. */
  extra?: React.ReactNode;
  /** Run after the agent is gone, for a pane holding something else that named it. */
  onDeleted?: () => void | Promise<void>;
  /** Run after a scheduled agent's cadence is saved. */
  onCadence?: () => void;
  onRuntimes?: () => void;
  /** Cross to the page of the agent whose runtime this one runs (#1316). */
  onFollowed?: (agent: string) => void;
  onError?: (msg: string) => void;
}) {
  return (
    <Page
      onCadence={onCadence}
      agent={agent}
      rule={roster.rules[agent.name] ?? ""}
      file={roster.files[agent.name]}
      saved={roster.savedRule === agent.name}
      refusal={roster.refusal && roster.refusal.agent === agent.name ? roster.refusal.why : ""}
      focusFile={roster.focusFile}
      onFocused={() => roster.setFocusFile(false)}
      onRule={(text) => {
        roster.setRules((all) => ({ ...all, [agent.name]: text }));
        roster.setSavedRule("");
      }}
      onFile={(text) => roster.setFiles((all) => ({ ...all, [agent.name]: text }))}
      onLeave={() => void roster.leave.current(agent.name)}
      onPick={(key, value) => void roster.pick(agent, key, value)}
      info={info}
      onRuntime={(runtime) => void roster.bind(agent, runtime)}
      onRuntimes={onRuntimes}
      onFollowed={onFollowed}
      onError={onError}
      onDelete={async () => {
        await roster.remove(agent.name);
        await onDeleted?.();
      }}
      busySwitch={roster.saving.includes(agent.name)}
      busy={(key) => roster.saving.includes(`${agent.name}/${key}`)}
      scoped={scoped}
      inStage={inStage}
      usage={usage}
      actions={actions}
      extra={extra}
    />
  );
}

/** Configuration → Board: the agents the board runs itself (#742) — the discussion, the
 *  pruner, the triager. No workflow assigns them and every workflow gets them, so they
 *  are read by what STARTS each one: the ones you call, then the ones the board starts. */
export function AgentsPanel({
  info,
  openOn = "",
  onPicked,
  onRuntimes,
  onError,
}: {
  /** The connectors this board can run, and which one is its default (#443) — what the
   *  runtime row on an agent's page offers. */
  info: AgentInfo;
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
  const roster = useAgentRoster(onError);
  const { agents, picked, setPicked, select, saving } = roster;
  const { cadences, reload: reloadCadences } = useCadences(onError);

  // The agent a deep link named (#514) — Prune memory in the rail opens this pane on the
  // pruner's page. It selects the row rather than scrolling to it: the page sits beside the
  // column, so there is nothing off screen to reveal. It waits for the roster, because
  // selecting a name the column does not hold yet would draw no page at all.
  useEffect(() => {
    if (!openOn || !agents?.some((a) => a.name === openOn)) return;
    setPicked(openOn);
    onPicked?.();
  }, [openOn, agents, onPicked, setPicked]);

  // Which agents this pane is answerable for: a board agent declares no stage.
  const mine = agents?.filter((a) => !a.stage) ?? null;
  const agent = mine?.find((a) => a.name === picked);
  const inGroup = (names: string[]) =>
    (mine ?? [])
      .filter((a) => a.kind === "role" && names.includes(a.name))
      .sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
  const groups = [
    {
      id: "you" as const,
      rows: (mine ?? []).filter(
        (a) => !(a.kind === "role" && [...ON_A_SCHEDULE, ...ON_AN_EVENT].includes(a.name)),
      ),
    },
    { id: "schedule" as const, rows: inGroup(ON_A_SCHEDULE) },
    { id: "event" as const, rows: inGroup(ON_AN_EVENT) },
  ].filter((group) => group.rows.length > 0);

  // The pane opens on the first row — entering this pane lands you on a page you did not
  // ask for, which is the price of never drawing the column beside an empty half. Runs again
  // when a delete leaves nothing selected.
  const first = groups[0]?.rows[0]?.name ?? "";
  useEffect(() => {
    if (!mine) return;
    if (picked && mine.some((a) => a.name === picked)) return;
    if (openOn && mine.some((a) => a.name === openOn)) return;
    setPicked(first);
  }, [mine, first, picked, openOn, setPicked]);

  const row = (a: AgentView) => (
    <PickRow
      key={a.name}
      agent={a}
      held={a.name === picked}
      cadence={cadences[a.name]}
      busy={saving.includes(a.name)}
      onOpen={() => void select(a.name)}
      onFlip={(next) => roster.flip(a, next)}
    />
  );

  return (
    <div className="flex min-h-full flex-col gap-5">
      {roster.loadError && <Note icon={<FiAlertCircle />}>{roster.loadError}</Note>}
      {!roster.loaded && <Loading>{c.loading}</Loading>}
      {roster.loaded && !roster.loadError && agents === null && (
        <Note icon={<FiAlertCircle />}>{c.tooOld}</Note>
      )}

      {agents && (
        <>
          <div className="flex flex-1 items-stretch gap-6 max-sm:flex-col max-sm:gap-4">
            {/* The whole roster in one narrow column, grouped by what starts each agent
                (#1208). A row says what the agent does and what starts it; the page beside it
                is where anything is changed. Wide enough for a name that says the JOB (#742). */}
            <div className="w-[292px] shrink-0 border-r border-nb-ink/10 pr-6 max-sm:w-full max-sm:border-r-0 max-sm:border-b max-sm:pr-0 max-sm:pb-4">
              {groups.map((group, i) => (
                <div key={group.id} className={i > 0 ? "mt-4 border-t border-nb-ink/10 pt-4" : ""}>
                  <Roster title={c.groups[group.id]}>
                    <div className="flex flex-col">{group.rows.map(row)}</div>
                  </Roster>
                </div>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {agent && (
                <AgentDetail
                  roster={roster}
                  agent={agent}
                  info={info}
                  onCadence={() => void reloadCadences()}
                  onRuntimes={onRuntimes}
                  onError={onError}
                />
              )}
            </div>
          </div>

          {roster.problems.length > 0 && (
            <Note icon={<FiAlertCircle />}>
              {c.problems}
              {roster.problems.map((problem) => (
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
function Roster({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 text-[12.5px] font-[600] text-nb-ink-soft">{title}</h4>
      {children}
    </section>
  );
}

// The character, the name, what starts it, and — on an agent this project added — whether
// it is on. A paused agent keeps its character, greyed, and keeps its page.
function PickRow({
  agent,
  held,
  cadence,
  busy,
  onOpen,
  onFlip,
}: {
  agent: AgentView;
  held: boolean;
  /** A scheduled agent's cadence, which is what starts it (#1208). */
  cadence?: CadenceSchedule | null;
  busy: boolean;
  onOpen: () => void;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const c = useCopy().configuration.agents;
  const title = useAgentTitle()(agent);
  // What starts this agent, in four or five words (#742). Only the board's own roles carry
  // it; an agent this project added is called by name, so its row stays a single line.
  const saved = parseCadence(cadence?.cadence ?? "");
  const cadenceCopy = CADENCE_COPY[agent.name] && c[CADENCE_COPY[agent.name]!];
  const trigger =
    saved && cadenceCopy
      ? cadenceCopy.cadenceLabel(saved.n, saved.unit, saved.at)
      : (c.roles[agent.name as keyof typeof c.roles]?.trigger ?? "");
  const off = !agent.enabled;
  return (
    // A row, not a button: the switch lives in it (#715), and a control inside a button is
    // a control nobody can press. The name is the button; the switch is its own.
    <div
      className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 transition-colors duration-100 ${
        trigger ? "py-[7px]" : "py-[5px]"
      } ${held ? "bg-nb-accent-soft" : "hover:bg-nb-sheet"}`}
    >
      <button
        type="button"
        aria-current={held}
        // The state too, where there is one: the row carries it, and a label naming only the
        // agent would take that word off the one list where every agent's is read at once. A
        // workflow agent has no state to say (#749).
        aria-label={
          agent.switchable ? `${c.open(title)} · ${agent.enabled ? c.rowOn : c.rowOff}` : c.open(title)
        }
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
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[12.5px] font-[700] leading-[16px] ${off ? "text-nb-ink-soft" : "text-nb-ink"}`}
          >
            {title}
          </span>
          {trigger && (
            <span className="mt-[1px] block truncate text-[11px] leading-[14px] text-nb-ink-soft">
              {trigger}
            </span>
          )}
        </span>
      </button>
      {/* Read and flipped in the one place (#715). Only where there is a state at all: an
          always-on agent has nothing to switch, and a column of identical switches says
          nothing the caption above it hasn't. */}
      {agent.switchable && <EnabledSwitch agent={agent} busy={busy} onFlip={onFlip} bare />}
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

/** New agent finishes here: the row the new agent will take asks for its name, and a name
 *  already taken — by a bundled agent, by a role, or by a folder already under
 *  `docs/kanban/agents/` — is refused right in the column, so the pane never creates the
 *  clash it would then have to report as a problem. `onCreate` returns why it was refused,
 *  or empty when the agent was written. */
export function NewAgentRow({
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

  // The line under the row is part of it: bring both into the column's view.
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.scrollIntoView({ block: "nearest" });
  }, [why]);

  return (
    <div ref={row}>
      <div className="flex w-full items-center gap-2 rounded-[9px] bg-nb-wash py-[5px] pl-2.5 pr-[5px] focus-within:outline-[1.5px] focus-within:outline-nb-ink/25">
        <span aria-hidden className="size-[26px] shrink-0 rounded-[8px] border-[1.5px] border-dashed border-nb-ink/20" />
        <input
          autoFocus
          value={name}
          // Read-only, not disabled: a refused name keeps the caret for the fix.
          readOnly={busy}
          spellCheck={false}
          aria-label={c.newAgent}
          placeholder={c.namePlaceholder}
          onChange={(e) => {
            setName(e.target.value);
            setWhy("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
            if (e.key === "Escape") {
              // The dialog closes on Escape too; this one only takes the row away.
              e.stopPropagation();
              onCancel();
            }
          }}
          className={`min-w-0 flex-1 bg-transparent text-[12.5px] font-[700] leading-[16px] text-nb-ink outline-none placeholder:font-[500] placeholder:text-nb-ink-soft/60 ${busy ? "cursor-wait" : ""}`}
        />
        {/* Writing the agent and reading the roster back is not instant, so the button says
            it is working rather than sitting there looking unpressed. */}
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void create()}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] bg-nb-paper px-2.5 py-[5px] text-[11.5px] font-[700] leading-[14px] text-nb-ink transition-colors duration-100 hover:bg-nb-canvas focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-ink/45 disabled:hover:bg-nb-paper ${
            busy ? "disabled:cursor-wait disabled:text-nb-ink-soft" : "disabled:cursor-not-allowed disabled:text-nb-ink-soft/50"
          }`}
        >
          {busy && (
            <span
              className="size-1.5 rounded-full bg-nb-ink-soft animate-[nbPulse_1.1s_ease-in-out_infinite]"
              aria-hidden
            />
          )}
          {busy ? c.creating : c.create}
        </button>
      </div>
      <p className={`break-words px-2.5 pt-1 text-[10.5px] leading-[14px] ${why ? "text-nb-peach-ink" : "text-nb-ink-soft/70"}`}>
        {why || c.nameHint}
      </p>
    </div>
  );
}

// --- the page beside the column ----------------------------------------------

// Everything the selected agent is, as one screen: who it is and its switch across the top,
// then the settings it declares and the one box you write in.
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
  onCadence,
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
  onFollowed,
  onError,
  onDelete,
  busySwitch,
  busy,
  scoped,
  inStage,
  usage,
  actions,
  extra,
}: {
  agent: AgentView;
  onCadence?: () => void;
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
  onFollowed?: (agent: string) => void;
  /** Where a failure the page cannot show in place goes — the dialog's error strip. */
  onError?: (msg: string) => void;
  onDelete: () => Promise<void>;
  /** The switch, or the delete, is in flight — they are the same agent-wide save. */
  busySwitch: boolean;
  busy: (key: string) => boolean;
  /** What the pane around this page adds (#944). `scoped` puts `actions` and Delete at the
   *  name row's right, `usage` sits under its line, and `extra` between the settings and the
   *  instruction box. */
  scoped?: boolean;
  /** This pane is one stage's assignment (#944), not the agent's board-wide page: what it is
   *  told for this stage alone is edited here, and who its output is for stays as saved. */
  inStage?: boolean;
  usage?: React.ReactNode;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const c = useCopy().configuration.agents;
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
        note?: string;
      }
    | undefined;
  const title = useAgentTitle()(agent);
  const placeholder =
    role?.rule ??
    (agent.builtIn ? c.specialistRule.byAgent[agent.name]?.(title) : undefined) ??
    (agent.kind === "spec" ? c.specialistRule.spec(title) : c.rulePlaceholder(title));

  // Which box this page writes through: an added agent owns its whole file, a bundled one
  // owns only the words appended to its runs.
  const writesRule = !agent.file;
  const off = !agent.enabled;
  // In a workflow the one box on the page is where instructions go (#976): the board-wide
  // rule and who the output is for stay as saved, edited elsewhere.
  const settings = inStage ? agent.settings.filter((s) => s.key !== OUTPUT_KEY) : agent.settings;

  // The page fills the pane and the box you write in takes whatever the rest of it leaves.
  // Everything above the box is fixed-height — who the agent is, and what it runs — so the
  // one part of this page that is a workspace is the one part that grows, rather than the
  // page ending halfway up and leaving the bottom of the dialog empty. `min-h-full` rather
  // than `h-full`: the guide below opens in place, and the one thing that must not happen
  // is the page ending under the pane's floor.
  /* Only an agent this project added: a role runs the board's own flows and a bundled agent
     ships inside the command, so neither is this board's to remove. Where it is drawn is the
     pane's answer — beside the board's own controls, or at the workflow pane's name row. */
  const removal = agent.file ? (
    <span ref={anchor} className="relative shrink-0">
      <button type="button" className={DANGER_BTN} disabled={busySwitch} onClick={() => setAsking(true)}>
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
  ) : null;

  // The board's own controls — the scheduled agents' cadence and Run now, the memory
  // review's Run now — or, in a `scoped` pane (#944), that pane's actions. Either way on the
  // name row, so the description below keeps the full width.
  const controls = scoped ? (
    actions
  ) : agent.name === PRUNER ? (
    <PruneControls onSaved={onCadence} onError={onError} />
  ) : agent.name === REVIEWER_OF_DISMISSALS ? (
    <DismissalControls onSaved={onCadence} onError={onError} />
  ) : agent.name === PRODUCT_WRITER ? (
    <ProductControls onSaved={onCadence} onError={onError} />
  ) : agent.name === REVIEWER_OF_MEMORY ? (
    <ReviewControls onError={onError} />
  ) : null;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`flex size-[44px] shrink-0 items-end justify-center ${off ? "opacity-30 grayscale" : ""}`}
        >
          <Character name={agent.name} size={44} />
        </span>
        <div className="min-w-0 flex-1">
          {/* Narrow, the controls drop under the name rather than squeezing it. */}
          <div className="flex min-h-[24px] items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-[14px] font-[800] text-nb-ink">{title}</span>
              {agent.file && !scoped && <span className="shrink-0 text-[11px] text-nb-ink-soft">{c.yours}</span>}
            </div>
            {(controls || removal) && (
              <div className="flex shrink-0 items-center gap-1.5">
                {controls}
                {removal}
              </div>
            )}
          </div>
          {/* A specialist's description is a paragraph at times, and a paragraph in a
              header is read by nobody, so all but its first sentence opens. A role says when
              it runs only in its own copy (#493, #502). */}
          <p className="mt-0.5 max-w-[74ch] text-[12px] leading-snug text-nb-ink-soft">
            {role ? role.gloss : <Clipped text={sentence(agent.gloss)} />}
          </p>
          {role?.when && <Trigger text={role.when} />}
          {usage}
        </div>
      </div>

      <hr className="shrink-0 border-nb-ink/10" />

      {/* Everything this agent is set to, as rows: what the setting is on the left, its
          control on the right, and under the control the value in effect — what the runtime
          resolves to, what the pick costs. The runtime row is absent on rules older than the
          release that added it (#469), rather than drawn empty with a list that could only
          fail. */}
      {(agent.runs || settings.length > 0) && (
        <div className="flex shrink-0 flex-col gap-5">
          {agent.runs && (
            <SettingRow
              label={c.runtime}
              help={
                (agent.runs.unknownRuntime && c.unknownHarness(agent.runs.unknownRuntime)) ||
                (agent.name === PLANNING_HELPER && c.runtimeShared)
              }
              control={
                agent.runs.follows ? (
                  <RuntimeFollowed agent={agent} info={info} onFollowed={onFollowed} />
                ) : (
                  <RuntimePick
                    agent={agent}
                    info={info}
                    busy={busy("runtime")}
                    onRuntime={onRuntime}
                    onRuntimes={onRuntimes}
                  />
                )
              }
            />
          )}
          {settings.map((setting: SpecAgentSettingView) => (
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

      {/* What only THIS assignment asks of the agent (#944) — the workflow pane's own
          section, between what the agent runs as and the instructions it always carries.
          Absent on an agent this project added (#1007): its `AGENT.md` below is the one
          place its requirements are written. */}
      {extra}

      {!(inStage && writesRule) && (
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
          {/* What may go in the file, one press from the box you write it in (#935). It opens
              here rather than in a browser: the desktop window hands an external link to the
              system browser, and a hand-off that fails is a click that did nothing. Only an
              agent this project added — a built-in agent's box is a rule, not an `AGENT.md`. */}
          {!writesRule && agent.file && (
            <GuideDrawer
              guide="agents"
              title={c.guideTitle}
              className="mt-2 shrink-0 text-[12px] leading-relaxed text-nb-ink-soft"
            >
              {c.guideLine}
            </GuideDrawer>
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
      )}

      {/* What this role has left to say — what the memory review rewrites rather than
          repeats (#748). Its own copy, so another role saying something here adds no branch. */}
      {role?.note && (
        <p className="max-w-[74ch] shrink-0 text-[11.5px] leading-relaxed text-nb-ink-soft">
          {role.note}
        </p>
      )}
    </div>
  );
}

// An added agent's switch (#715). No board agent has one (#1208).
function EnabledSwitch({
  agent,
  busy,
  bare,
  onFlip,
}: {
  agent: AgentView;
  busy: boolean;
  /** Drawn in a column row (#715): the switch alone. The word beside it is what a page
   *  header needs, and a column of the same word down a narrow list is noise. */
  bare?: boolean;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const c = useCopy().configuration.agents;
  const title = useAgentTitle()(agent);
  return (
    <span className="relative flex shrink-0 items-center gap-2">
      <Switch
        on={agent.enabled}
        busy={busy}
        label={(agent.enabled ? c.switchOn : c.switchOff)(title)}
        onFlip={onFlip}
      />
      {!bare && (
        <span
          className={`text-[12px] font-[700] ${agent.enabled ? "text-nb-ink" : "text-nb-ink-soft"}`}
        >
          {c.enabled}
        </span>
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

// When this agent is asked for.
function Trigger({ text }: { text: string }) {
  const c = useCopy().configuration.agents;
  return (
    <p className="mt-1 max-w-[74ch] text-[11.5px] leading-snug text-nb-ink-soft">
      <span className="font-[600]">{c.runsWhen}</span> <Clipped text={text} />
    </p>
  );
}

// The first sentence stays on the line; the rest opens behind **View rules**.
function Clipped({ text }: { text: string }) {
  const c = useCopy().configuration.agents;
  const [open, setOpen] = useState(false);
  const cut = text.search(/(?<=[.。])\s*(?=\S)/);
  const lead = cut < 0 ? text : text.slice(0, cut);
  const rest = cut < 0 ? "" : text.slice(cut).trim();

  return (
    <>
      {open ? text : lead}
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
    </>
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

// --- the controls an agent that runs on a cadence carries (#514, #119) -------

// Compact, on the name row: the cadence chip, then Run now (#1208). Always on, so the chip
// is neutral and the accent is Run now's alone. The last run is the foot of the chip's list;
// only a failed one is said out here, beside the controls.
const COMPACT_BTN =
  "inline-flex h-[24px] shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[7px] px-2 text-[11.5px] font-[700] transition-[background-color,transform] duration-100 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

// What each agent owns is its data and its words; this owns the layout, so the pages cannot
// drift apart.
function CadenceControls({
  copy,
  icon,
  schedule,
  tooOld,
  running,
  failed,
  onStart,
  onSave,
}: {
  copy: CadenceCopy;
  /** The action's own mark, so Run now reads as this agent's work. */
  icon: React.ReactNode;
  /** The saved schedule, or null on rules older than it — which draws Run now with no chip. */
  schedule: CadenceSchedule | null;
  tooOld: boolean;
  running: boolean;
  /** The newest finished one did not get through. */
  failed: boolean;
  onStart: () => void;
  onSave: (next: { enabled: boolean; cadence: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const saved = parseCadence(schedule?.cadence ?? "");
  const state = saved ? copy.cadenceLabel(saved.n, saved.unit, saved.at) : "";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {tooOld && <span className="text-[11px] text-nb-ink-soft">{copy.tooOld}</span>}
      {failed && !running && <span className="text-[11px] text-nb-peach-ink">{copy.failed}</span>}
      {!tooOld && state && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={copy.chipLabel(state)}
              aria-label={copy.chipLabel(state)}
              className={`${COMPACT_BTN} bg-nb-ink/[0.08] text-nb-ink hover:bg-nb-ink/[0.12]`}
            >
              <FiClock size={11} aria-hidden className="text-nb-ink-soft" />
              {state}
              <FiChevronDown size={10} aria-hidden className="text-nb-ink-soft" />
            </button>
          </PopoverTrigger>
          {open && (
            <CadenceMenu
              saved={saved}
              lastRun={schedule?.lastRun ?? ""}
              copy={copy}
              onDismiss={() => setOpen(false)}
              onSave={onSave}
            />
          )}
        </Popover>
      )}
      <button
        type="button"
        className={`${COMPACT_BTN} bg-nb-accent-soft text-nb-accent-deep hover:bg-nb-accent/28`}
        disabled={running}
        onClick={() => void onStart()}
      >
        {icon}
        {running ? copy.running : copy.run}
      </button>
    </div>
  );
}

// --- the memory pruner's own controls (#514) ---------------------------------

function PruneControls({ onSaved, onError }: { onSaved?: () => void; onError?: (msg: string) => void }) {
  const c = useCopy().configuration.agents.pruner;
  return (
    <ScheduledControls
      copy={c}
      icon={<FiScissors size={11} aria-hidden />}
      onSaved={onSaved}
      action="prune-memory"
      read={memoryPruneAction}
      save={setMemoryPruneAction}
      start={startPruneMemoryAction}
      onError={onError}
    />
  );
}

// --- the dismissal reviewer's own controls (#929) ----------------------------

function DismissalControls({ onSaved, onError }: { onSaved?: () => void; onError?: (msg: string) => void }) {
  const c = useCopy().configuration.agents.dismissalReviewer;
  return (
    <ScheduledControls
      copy={c}
      icon={<FiRotateCcw size={11} aria-hidden />}
      onSaved={onSaved}
      action="review-dismissals"
      read={dismissalReviewAction}
      save={setDismissalReviewAction}
      start={startReviewDismissalsAction}
      onError={onError}
    />
  );
}

// --- the product writer's own controls (#1268) -------------------------------

function ProductControls({ onSaved, onError }: { onSaved?: () => void; onError?: (msg: string) => void }) {
  const c = useCopy().configuration.agents.productWriter;
  return (
    <ScheduledControls
      copy={c}
      icon={<FiFileText size={11} aria-hidden />}
      onSaved={onSaved}
      action="describe-product"
      read={productDescriptionAction}
      save={setProductDescriptionAction}
      start={startDescribeProductAction}
      onError={onError}
    />
  );
}

// A scheduled agent's data — its schedule and its runs — for the layout above.
function ScheduledControls({
  copy: c,
  icon,
  action,
  read,
  save: write,
  start: begin,
  onSaved,
  onError,
}: {
  copy: CadenceCopy;
  icon: React.ReactNode;
  onSaved?: () => void;
  action: AgentAction;
  read: () => Promise<{ schedule: CadenceSchedule | null; error?: string }>;
  save: (next: { enabled: boolean; cadence: string }) => Promise<{ ok: boolean; error?: string }>;
  start: () => Promise<{ ok: boolean; error?: string }>;
  onError?: (msg: string) => void;
}) {
  const [schedule, setSchedule] = useState<CadenceSchedule | null>(null);
  const [tooOld, setTooOld] = useState(false);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);

  const readSchedule = useCallback(async () => {
    const res = await read();
    setSchedule(res.schedule);
    setTooOld(!res.schedule && !res.error);
    if (res.error) onError?.(res.error);
  }, [read, onError]);

  // What the runs record says about pruning right now: whether one is going, and whether
  // the newest finished one got through. Polled while a pass is live and read once
  // otherwise — the page is a settings page, not a run log.
  const readRuns = useCallback(async () => {
    let live = false;
    try {
      const runs = (await listSessionsAction()).filter((r) => r.action === action);
      live = runs.some((r) => r.status === "running");
      const done = runs.filter((r) => r.status !== "running").sort((a, b) => b.startedAt - a.startedAt)[0];
      setFailed(!!done && done.status !== "done");
    } catch {
      // the runs could not be read — the button still works, and it says nothing it can't
    }
    setRunning(live);
    return live;
  }, [action]);

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
    const res = await begin();
    if (!res.ok) {
      setRunning(false);
      onError?.(sayFailure(res, c.saveFailed));
      return;
    }
    void readRuns();
  };

  // Write the schedule and read back what landed. False is a refusal — the list says so
  // itself, in its own words, and the state on screen is still the one that is running.
  const save = async (next: { enabled: boolean; cadence: string }) => {
    const res = await write(next);
    if (!res.ok) return false;
    await readSchedule();
    onSaved?.();
    return true;
  };

  return (
    <CadenceControls
      copy={c}
      icon={icon}
      schedule={schedule}
      tooOld={tooOld}
      running={running}
      failed={failed}
      onStart={() => void start()}
      onSave={save}
    />
  );
}

// --- the memory reviewer's one action (#748) ----------------------------------

// The pruner's controls with the cadence chip taken out: the review is daily, so there is
// nothing to set. Review now, and the last review beside it.
function ReviewControls({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.agents.memoryReviewer;
  const [review, setReview] = useState<MemoryReviewState | null>(null);
  const [running, setRunning] = useState(false);

  const readReview = useCallback(async () => {
    const res = await memoryReviewAction();
    setReview(res.review);
    if (res.error) onError?.(res.error);
  }, [onError]);

  // Whether one is going right now. Polled while it is and read once otherwise — the page is
  // a settings page, not a run log.
  const readRuns = useCallback(async () => {
    let live = false;
    try {
      const runs = await listSessionsAction();
      live = runs.some((r) => r.action === "review-memory" && r.status === "running");
    } catch {
      // the runs could not be read — the button still works, and it says nothing it can't
    }
    setRunning(live);
    return live;
  }, []);

  useEffect(() => {
    void readReview();
    void readRuns();
  }, [readReview, readRuns]);

  // And read the last review back the moment one stops, because a review that PASSED is what
  // moves that line.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void readRuns().then((live) => {
        if (!live) void readReview();
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [running, readRuns, readReview]);

  const start = async () => {
    if (running) return;
    setRunning(true);
    const res = await startReviewMemoryAction();
    if (!res.ok) {
      setRunning(false);
      onError?.(sayFailure(res, c.startFailed));
      return;
    }
    void readRuns();
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-[11px] text-nb-ink-soft">{review?.lastRun ? c.lastRun(review.lastRun) : c.neverRun}</span>
      <button
        type="button"
        className={`${COMPACT_BTN} bg-nb-accent-soft text-nb-accent-deep hover:bg-nb-accent/28`}
        disabled={running}
        onClick={() => void start()}
      >
        <FiRotateCcw size={11} aria-hidden />
        {running ? c.running : c.run}
      </button>
    </div>
  );
}

// The cadence list, in order: three common cadences, then the one row that opens anything — `6h` / `1d` / `7d` are the cadences themselves, so a preset row needs no table
// of its own beyond the number and unit its words are read off.
type Preset = "6h" | "1d" | "7d";
type Pick = Preset | "custom";
const PRESETS = ["6h", "1d", "7d"] as const;
const PRESETS_AT: Record<Preset, { n: number; unit: CadenceUnit }> = {
  "6h": { n: 6, unit: "h" },
  "1d": { n: 1, unit: "d" },
  "7d": { n: 7, unit: "d" },
};
const ROWS: Pick[] = [...PRESETS, "custom"];

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
  lastRun,
  copy,
  onDismiss,
  onSave,
}: {
  saved: Cadence | null;
  /** The last pass that passed, for the list's foot. */
  lastRun: string;
  copy: CadenceCopy;
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
  const picked: Pick = presetOf(saved) ?? "custom";
  const label = (id: Pick) =>
    id === "custom" ? copy.custom : copy.cadenceLabel(PRESETS_AT[id].n, PRESETS_AT[id].unit, "");
  // Custom's right end: the saved cadence, when it is no preset.
  const note = saved && picked === "custom" ? copy.cadenceLabel(saved.n, saved.unit, saved.at) : undefined;

  // Leaving never writes. A draft only exists until something is pressed, so there is
  // nothing here to lose that the user did not already decide to lose.

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
    // `enabled` for rules older than #1208, which still read it.
    const ok = await onSave({ enabled: true, cadence: id });
    setBusy(null);
    if (ok) onDismiss();
    else setFailed(copy.presetFailed(label(id)));
  };

  return (
    <PopoverContent
      align="end"
      aria-label={copy.recurring}
      // Open on the cadence in effect, so a keyboard lands in the list rather than at its edge.
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        list.current?.querySelectorAll<HTMLElement>('[role="option"]')[ROWS.indexOf(picked)]?.focus();
      }}
      className="w-[280px] text-left"
    >
      <div ref={list} role="listbox" aria-label={copy.recurring} onKeyDown={stepOptions} className="flex flex-col">
        {ROWS.map((id) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={picked === id}
            disabled={!!busy}
            onClick={() => void pick(id)}
            data-active={id === "custom" && !!draft}
            className={`${POPUP_ROW} gap-3 pr-8`}
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

      <p className="mt-1 border-t border-nb-ink/10 px-2.5 pt-1.5 pb-0.5 text-[11px] text-nb-ink-soft">
        {lastRun ? copy.lastRun(lastRun) : copy.neverRun}
      </p>
    </PopoverContent>
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
  copy: CadenceCopy;
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
  const { picked, shown } = useRuntimeShown(agent, info);

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

// A planning lead's runtime (#1316): the planning helper's, read-only, with the way to change it.
function RuntimeFollowed({
  agent,
  info,
  onFollowed,
}: {
  agent: AgentView;
  info: AgentInfo;
  onFollowed?: (agent: string) => void;
}) {
  const c = useCopy().configuration.agents;
  const { picked, shown } = useRuntimeShown(agent, info);
  const follows = agent.runs.follows;
  return (
    <div className="flex min-w-0 flex-col items-end gap-1 pt-[7px] max-sm:items-start max-sm:pt-0">
      <span className="flex max-w-full items-center gap-1.5 text-[12.5px] text-nb-ink">
        {picked && <AgentMark src={picked.icon} size={13} />}
        <span className="truncate">{shown}</span>
      </span>
      {onFollowed && follows && (
        <button
          type="button"
          onClick={() => onFollowed(follows)}
          className="flex cursor-pointer items-center gap-0.5 rounded-[4px] text-[11.5px] font-[600] text-nb-accent-deep hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
        >
          {c.runtimeFollows}
          <FiChevronRight size={11} aria-hidden />
        </button>
      )}
    </div>
  );
}

// The runtime an agent runs and the whole answer to "what does this run on", deduped: a row
// named after its own harness says it once, and **Global default** — a row rather than a
// harness — says both.
function useRuntimeShown(agent: AgentView, info: AgentInfo) {
  const nameOf = useRuntimeName();
  const picked = info.runtimes.find((r) => r.id === agent.runs.runtime);
  const shown = picked
    ? [...new Set([nameOf(picked), picked.label, picked.model].filter(Boolean))].join(" · ")
    : "";
  return { picked, shown };
}

// --- the characters ----------------------------------------------------------

// The art is one PNG per agent at `public/agent-art/<name>.png`, drawn on a shared canvas
// with a shared pixel size — `agent-art.md` beside `design.md` is the recipe. An agent with
// no file of its own is the same character holding a card with its initial, so the pane is
// never a row of broken images and two art-less agents still differ.
export function Character({ name, size = 48 }: { name: string; size?: number }) {
  const [art, setArt] = useState(true);
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before hydration fired its error with nobody listening.
  useEffect(() => setArt(!(img.current?.complete && img.current.naturalWidth === 0)), [name]);
  if (!art) return <Lettered name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
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

/** What an agent is CALLED — the one lookup every screen names an agent by
 *  (`@/lib/agent-name`), handed the name this pane has already read off the roster. */
export function useAgentTitle(): (agent: AgentView) => string {
  const nameOf = useAgentName();
  return useCallback((agent: AgentView) => nameOf(agent.name, agent.title), [nameOf]);
}

function sentence(text: string): string {
  const value = text.trim();
  const cased = value ? value[0].toUpperCase() + value.slice(1) : value;
  return !cased || /[.!?。]$/.test(cased) ? cased : `${cased}.`;
}
