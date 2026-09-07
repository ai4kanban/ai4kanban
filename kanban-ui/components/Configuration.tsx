"use client";

// The board's one configuration home (#41), opened from a quiet gear button in
// the header. A sidebar on its left names the sections — General (the coding-agent
// setup #174, how a delivery is built #303/#308, and the language this machine
// reads in #334), Runtimes (the list of runtimes the board owns and what each one
// runs as, #68/#93/#443/#467/#468), Agents (the spec agents that fill part of a card's
// spec, the connector and model each agent runs #443, the rule each one carries
// and the AGENT.md of one you add, #191/#306/#420/#422) and Notifications (#326).
// The sidebar is how the dialog grows: a new group of settings is one more entry
// there with a pane of its own, and the harness's growing field list (the model,
// the reasoning level #97, #95's provider and base URL) never squeezes what joins
// it.
//
// A pane earns its sidebar entry by being a list too long to sit beside another.
// Setup, Auto-delivery and Language were three entries for five settings, so they
// are three captioned groups of one General pane instead — everything a board is
// set up with on one screen, in the order you meet it.
//
// The Auto-refine section is gone (#211). There is no switch to keep: a refine
// follows the run that touched the card, so nothing is left to turn on or to
// budget.
//
// The agent's own settings are NOT written here: this file draws whatever list
// the picked agent declares in lib/agent.ts, and knows no agent by name.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { IconType } from "react-icons";
import { FiAlertCircle, FiBell, FiCheck, FiChevronDown, FiChevronRight, FiCloud, FiSettings, FiSliders, FiTerminal, FiUsers, FiX, FiZap } from "react-icons/fi";
import {
  hasWorkspaceAction,
  installedAgentsAction,
  loggedOutAgentsAction,
  setHarnessAction,
  setHarnessSecretAction,
  setHarnessSettingAction,
  setRuntimeHarnessAction,
  setRuntimeSecretAction,
  setRuntimeSettingAction,
  testConnectionAction,
} from "@/app/actions";
import type { ConfigurationCopy } from "@/i18n/configuration/types";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import {
  missingRequired,
  pickedProvider,
  providerSetting,
  shownForProvider,
} from "@/lib/providers";
import type {
  AgentInfo,
  ConnectionTest,
  HarnessGap,
  HarnessOption,
  HarnessSetting,
  LoggedOutAgent,
  RuntimeView,
  WriteResult,
} from "@/lib/types";
import { TOOL_BTN } from "./chrome";
import { AgentsPanel } from "./Agents";
import { CloudPanel } from "./Cloud";
import { Dialog } from "./Dialog";
import { GeneralPanel } from "./General";
import { RuntimesPanel } from "./Runtimes";
import { MODEL_ROW, ModelRow } from "./model-row";
import { ACCENT_BTN, CAPTION, CONTROL, FLAT_CONTROL, Note, QUIET_BTN } from "./settings";
import { WorkspacePanel } from "./Workspace";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// Every box, list and small button in here is the settings kit's
// (components/settings.tsx) — CONTROL is the fill a field wears, FLAT_CONTROL the same one
// for a ui/select.tsx trigger, QUIET_BTN the flat button attached to one. They live there
// because every pane in this dialog draws them.
//
// Nothing in this dialog wears a frame. A hairline round every card, box and button turned
// a pane of six settings into a page of boxes; a fill says the same thing more quietly, and
// what is left of the lines are the rules BETWEEN a card's rows, which is where the eye
// actually needs them. The dialog spends ONE neutral ramp on all of it — paper pane, sheet
// for what groups (a card, a list, a plate), wash for what you can change (a field, a button,
// a tile), canvas for the hover under that — which is the card page's ground and the rung
// below it, not a third grey of its own.

// A harness's mark, e.g. the Claude sunburst at public/agents/claude.svg. `name` is passed
// only where the mark stands alone — on the cards the agent's name sits right next to it.
export function AgentMark({ src, size, name }: { src: string; size: number; name?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      title={name}
      width={size}
      height={size}
      style={{ flex: "0 0 auto" }}
    />
  );
}

/** What one runtime is called on screen. **Global default** is the board's own row and the
 *  command writes its name in English, so every language says it in its own words (#468);
 *  every other row is the user's own words, in whatever language they typed them. */
export function useRuntimeName(): (row: { fixed?: boolean; name: string }) => string {
  const c = useCopy().configuration.runtimes;
  return (row) => (row.fixed ? c.globalDefault : row.name);
}

// The dialog's sections, in sidebar order — what the board is set up with, then the tool
// it runs on, then what that tool is told, then where the answers go. Adding a settings
// group is one entry here plus its pane below; nothing else moves.
type Section = "general" | "runtimes" | "agents" | "workspace" | "cloud";
const SECTIONS: { id: Section; icon: IconType }[] = [
  { id: "general", icon: FiSliders },
  { id: "runtimes", icon: FiTerminal },
  { id: "agents", icon: FiUsers },
  // The workspace this board lives in (#317). Only on a Cloud board — a Local one has no
  // workspace to run, so the entry is left out rather than drawn onto an empty pane.
  { id: "workspace", icon: FiCloud },
  // How work reaches the person this machine signs in as (#326) — named for the job, not
  // for Cloud, which is what carries it. Beside Workspace rather than instead of it: one is
  // the machine's sign-in, the other is this board.
  { id: "cloud", icon: FiBell },
];

// --- opening the dialog from elsewhere (#174) --------------------------------
// A tiny shared store, the same shape as the runs panel's (components/
// sessions.tsx), so a sibling that isn't in this tree can open the dialog on one
// section. The setup strip uses it: the line it hands to a coding agent only
// works once the skill is installed, so when it isn't, the way out of that strip
// is this dialog's General pane rather than a sentence telling the user to go find
// the gear.
let openRequest: { at: number; section: Section } | null = null;
const requestSubs = new Set<() => void>();
export const configDialog = {
  open(section: Section = "general") {
    // A fresh object every time, so asking for the same section twice still
    // reaches a dialog the user closed in between.
    openRequest = { at: openRequest ? openRequest.at + 1 : 1, section };
    for (const fn of requestSubs) fn();
  },
};
function useOpenRequest() {
  return useSyncExternalStore(
    (fn) => {
      requestSubs.add(fn);
      return () => requestSubs.delete(fn);
    },
    () => openRequest,
    () => openRequest,
  );
}

export function Configuration({
  agent,
  onError,
}: {
  agent: AgentInfo;
  // Save failures surface where the page already shows errors, across its top.
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration;
  const [open, setOpen] = useState(false);
  // Which pane shows. Reopening the dialog starts back on General.
  const [section, setSection] = useState<Section>("general");
  const router = useRouter();

  // Someone outside this tree asked for the dialog — open it on the section they
  // named. Keyed on the request object, so a second ask for the same section
  // reopens rather than doing nothing.
  const request = useOpenRequest();
  useEffect(() => {
    if (!request) return;
    setSection(request.section);
    setOpen(true);
  }, [request]);

  // Whether this checkout points at a workspace (#317), so the Workspace entry is offered
  // only where there is one. The pointer alone rather than whether the board opened: a
  // checkout whose workspace has been deleted still needs the pane, since leaving Cloud is
  // one of the two ways out of it. Asked when the dialog opens, not on every render.
  const [cloudBoard, setCloudBoard] = useState(false);
  useEffect(() => {
    if (!open) return;
    void hasWorkspaceAction().then(setCloudBoard);
  }, [open]);
  const sections = SECTIONS.filter((entry) => entry.id !== "workspace" || cloudBoard);

  return (
    <>
      {/* The last tool in the header's cluster (components/chrome.tsx) — no frame
          of its own, one hairline between it and Sessions. */}
      <button
        type="button"
        className={TOOL_BTN}
        title={c.open}
        aria-label={c.open}
        onClick={() => {
          setSection("general");
          setOpen(true);
        }}
      >
        <FiSettings size={15} aria-hidden />
      </button>

      {open && (
        <Dialog
          title={c.title}
          onClose={() => {
            setOpen(false);
            // Re-read the settings on the server. Every field in here is seeded
            // from a prop when it mounts, and closing unmounts them — so without
            // this the next open would redraw the page's first paint and a
            // setting saved a moment ago would look lost, while the file has it.
            // On close rather than on each save: nothing on screen shows these
            // settings while the dialog is up, and a refresh per keystroke-blur
            // would re-read the whole board for nobody.
            router.refresh();
          }}
          // Wide enough to put a field's help beside its control rather than under
          // it (see Field below), which is what kept the harness pane scrolling.
          width={1040}
          height="min(760px, calc(100dvh - 2rem))"
          flush
        >
          {/* The section list. A quiet vertical nav on the wash, the active entry
              in the ember tint — the same active language as the harness rows. */}
          <nav
            aria-label={c.sections}
            className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-nb-ink/10 bg-nb-cream p-3 max-sm:w-full max-sm:flex-row max-sm:overflow-x-auto max-sm:border-b max-sm:border-r-0 max-sm:p-2"
          >
            {sections.map(({ id, icon: Icon }) => {
              const on = id === section;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={on}
                  onClick={() => setSection(id)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-[700] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent max-sm:w-auto max-sm:shrink-0 ${
                    on
                      ? "bg-nb-accent-soft text-nb-accent-deep"
                      : "text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink"
                  }`}
                >
                  <Icon className="shrink-0 text-[15px]" aria-hidden />
                  {c.section[id]}
                </button>
              );
            })}
          </nav>

          {/* The panes. Every one stays mounted and the inactive ones hide: the
              fields hold optimistic state seeded from the server's first paint,
              so unmounting on a section switch would throw away a value saved a
              moment ago. The dialog's fixed height keeps the panes steady;
              a pane taller than it scrolls here. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-12 max-sm:p-4 max-sm:pb-8">
            {/* What the board is set up with, in three groups on one pane (see General.tsx):
                the coding-agent setup (#174), how a delivery is built (#303, #308) and the
                language this machine reads in (#334). Mounted only while it is the section
                on screen — the setup group spawns a process to ask what `akb` on the PATH
                is, and that answer should be the one from a moment ago. */}
            {section === "general" && <GeneralPanel onError={onError} />}
            {/* The runtimes this board owns (#468) — one row each, **Global default** first,
                and under an open row the whole of what that row runs as.

                Always mounted, unlike the panes below it: every box in here holds optimistic
                state seeded from the server's first paint, and unmounting on a section switch
                would throw away a value saved a moment ago. */}
            <div hidden={section !== "runtimes"}>
              <RuntimesPanel agent={agent} onError={onError} />
            </div>
            {/* The team (#420, #422) — everyone working on the board, the rule each one
                carries, what it remembers, its settings and, for an agent this project
                added, its own AGENT.md. Mounted only while it is the section on screen: it
                asks the board for its roster when it draws, and that roster carries the
                switches and the rules as they read right now. */}
            {section === "agents" && <AgentsPanel info={agent} onError={onError} />}
            {/* The Cloud sign-in (#326) — the account this MACHINE acts as, not a setting of
                this board. Mounted only while it is the section on screen: it asks the
                service who is signed in, over the network. */}
            {/* The workspace this board lives in (#317) — its name, the machines that run its
                work, the export, leaving Cloud and the deletion. Mounted only while it is the
                section on screen: it asks the service what the workspace holds right now. */}
            {section === "workspace" && cloudBoard && <WorkspacePanel onError={onError} />}
            {section === "cloud" && <CloudPanel onError={onError} />}
          </div>
        </Dialog>
      )}
    </>
  );
}

// One setting's frame: its label and control on the left, its plain lines of
// help beside them rather than under. A hint stacked under every field is what
// used to push the last setting off the bottom of the pane; the pane is wide
// enough to read both at once. Narrow, they stack again in the old order.
export function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  // Lines, not a line: the provider list says what the picked entry is as well
  // as what the field is for.
  help: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,17rem)] gap-x-5 max-sm:grid-cols-1">
      <label
        className={`col-start-1 row-start-1 mb-1.5 block ${CAPTION} text-nb-ink-soft`}
        htmlFor={id}
      >
        {label}
      </label>
      <div className="col-start-1 row-start-2">{children}</div>
      <div className="col-start-2 row-start-2 flex flex-col justify-center gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft max-sm:col-start-1 max-sm:row-start-3 max-sm:mt-1.5">
        {help}
      </div>
    </div>
  );
}

// An agent's settings are drawn from words the board's RULES hand down — a setting's label
// and help, a provider's blurb, what the agent can't do — and those are English wherever the
// board runs. This turns one into the language the rest of the dialog is in; a word the copy
// doesn't carry draws as the rules wrote it, so a newer rules build still reads.
function useRulesText() {
  const map = useCopy().configuration.harness.rulesText;
  return (text: string) => map[text] ?? text;
}

// The harness picker: one square card per agent we can run, the active one
// framed in ember, and under them the settings that agent declares (#93) — for
// Claude Code, the model it runs with (#71). Clicking a card saves
// that harness's name to docs/kanban/ui.config.json — nothing else changes, and
// a run in flight keeps the harness it started under. Selecting optimistically
// and reverting on a failed save.
//
// Exported, because the guided first run asks for the agent with this same pane
// (#172): the agent step there is this picker and its Test, not a second screen
// that asks the same questions in different words. `onTested` is how that flow
// hears the answer — it is the one place that needs to know whether the setup on
// screen has actually answered.
/** A handle on the pane's own Test, for a screen whose only way forward is to run it
 *  (#280): the first run's agent step is one button, and pressing it has to be the same
 *  call the Test button makes. The picker fills it in; it answers what the test found. */
export interface RunTest {
  current: (() => Promise<ConnectionTest | null>) | null;
}

/** What a picker in row mode sets: one runtime on the board's list (#468) — the harness it
 *  runs, the settings under it and its key, all written against the row's own id, so two rows
 *  on one CLI never write into each other. */
export interface RuntimeTarget {
  /** The row as the command reads it now — the seed every field starts from. */
  runtime: RuntimeView;
  /** Told the whole setting after each save, so the pane behind redraws its list without a
   *  read of its own. */
  onSaved: (agent: AgentInfo) => void;
}

export function HarnessPicker({
  agent,
  onError,
  onTested,
  runTest,
  bind,
}: {
  agent: AgentInfo;
  onError?: (msg: string) => void;
  /** The last test's result, or null when there is none to speak of — including
   *  the moment a setting changes and the old result stops applying. */
  onTested?: (result: ConnectionTest | null) => void;
  /** Filled in with the pane's own Test, so a screen outside it can run one (#280). */
  runTest?: RunTest;
  /** Draw ONE runtime instead of the grid that picks the board's default (#468) — what an
   *  expanded row in Configuration → Runtimes holds. The grid and the fields are the same
   *  ones; only what they are written against differs. */
  bind?: RuntimeTarget;
}) {
  // The agent setting as the file now reads it. It starts as the server's first
  // paint and is replaced by what a switch writes back, so the override note and
  // the notices below always describe the agent on screen rather than the one
  // that was picked when the page loaded.
  const c = useCopy().configuration.harness;
  const cr = useCopy().configuration.runtimes;
  const rules = useRulesText();
  // What this picker is set to right now: the board's default connector, or the one row this
  // pane draws the settings of. Read once, here, so every piece of state below is seeded the
  // same way whichever of the two it is.
  const seed = (
    info: AgentInfo,
    row?: RuntimeView,
  ): {
    active: string;
    command: string;
    values: Record<string, string>;
    secretsSet: string[];
    ignored: string[];
  } =>
    bind
      ? {
          active: row?.harness ?? bind.runtime.harness,
          command: row?.runs ?? "",
          values: row?.values ?? {},
          secretsSet: row?.secretsSet ?? [],
          ignored: row?.ignored ?? [],
        }
      : {
          active: info.name,
          command: info.command,
          values: info.values,
          secretsSet: info.secretsSet,
          ignored: info.ignored,
        };
  const start = seed(agent, bind?.runtime);
  const [info, setInfo] = useState(agent);
  // The agents to offer, and which of them this machine can run (#207). Kept apart from
  // `info` because it is the one part of the setting that changes without anybody saving
  // anything: installing a CLI in a terminal makes an agent runnable, and the picker
  // re-asks each time it opens so that shows up without a reload.
  const [options, setOptions] = useState(agent.options);
  // Which rows their own CLI says nobody is logged into (#392), each with the command that
  // logs it back in. Kept apart from `options` for the same reason they are kept apart from
  // `info`, and one more: this answer costs a spawn per CLI, so it arrives after the grid is
  // already on screen and never holds it up. Empty until then, and empty on a board whose
  // rules are older than the question.
  //
  // It is read two ways. A CARD says the CLI behind it is signed out, which is a harness
  // answer; the note under the grid says THIS ROW is, which is a row answer — a row signing
  // with a key of its own is never on the list however its CLI answers (#467).
  const [out, setOut] = useState<LoggedOutAgent[]>([]);
  const loggedOut = Object.fromEntries(out.map((one) => [one.harness, one.login]));
  const [active, setActive] = useState(start.active);
  const [saving, setSaving] = useState(false);
  // What the fields show, and what was last written to the file — keyed by the
  // setting's key. Two pieces of state because a field is text the user can be
  // halfway through typing, and only a save makes it the setting.
  const [values, setValues] = useState(start.values);
  const [saved, setSaved] = useState(start.values);
  // The settings the agent's `command` override already names, so those fields
  // aren't in effect. Every agent has its own override, so switching redraws
  // these from the new one's.
  const [ignored, setIgnored] = useState(start.ignored);
  // Which of the agent's keys are set (#94) — set or not set, never a key. A
  // key lives in docs/kanban/.env, so nothing here ever holds one longer than
  // the moment between typing it and saving it.
  const [secretsSet, setSecretsSet] = useState(start.secretsSet);
  // A provider picked in the list but not written to the file yet, because a box
  // it can't do without is still empty (#95) — the endpoint before its base URL
  // is typed. The fields follow the pick right away, so the box it is waiting on
  // is on screen; the pick saves itself the moment that box is filled. Without
  // this the endpoint could never be picked at all: its base URL only shows once
  // it is picked, and it can't be picked until the base URL is there.
  const [pending, setPending] = useState("");
  // Whether the agent's own settings are open, once someone has said so. Null until then,
  // which reads as shut. Put back to null on a switch: that answer is about the agent that
  // was picked, not the new one.
  const [advanced, setAdvanced] = useState<boolean | null>(null);

  // Look again the moment the picker draws — opening the dialog mounts it, and so does the
  // agent step of the guided first run. The page load already answered this, and that
  // answer is what the first paint shows, so nothing greys out a moment after the user
  // sees it; this only catches a CLI installed since. A look that comes back with nothing
  // (no rules to ask) leaves the page's answer standing.
  useEffect(() => {
    let live = true;
    void installedAgentsAction()
      .then((fresh) => {
        if (live && fresh.length > 0) setOptions(fresh);
      })
      .catch(() => {
        // Nothing to say: the agents on screen are still the agents, and the board has
        // louder ways to report a server it can't reach.
      });
    return () => {
      live = false;
    };
  }, []);

  // And then the second look, the one that spawns (#392). It runs beside the first rather
  // than after it: the grid is drawn from the page's own answer either way, and a CLI that
  // takes its time to say whether it is logged in must never be what a user waits on.
  //
  // Nothing to report leaves the picker exactly as it was. It gates nothing anywhere — every
  // way of starting a run still starts — so a reading that never arrives costs nothing.
  useEffect(() => {
    let live = true;
    void loggedOutAgentsAction()
      .then((fresh) => {
        if (live) setOut(fresh);
      })
      .catch(() => {
        // Nothing to say: an agent nobody could ask about is an agent this pane says nothing
        // about, which is what it did before the question existed.
      });
    return () => {
      live = false;
    };
  }, []);

  // The whole setting as the command now reads it, after a save that changed which harness
  // runs. A switch is also a fresh look at the PATH, so it is one more moment the picker is
  // right about what this machine has.
  const settle = (fresh: AgentInfo) => {
    setInfo(fresh);
    setOptions(fresh.options);
    const next = bind ? fresh.runtimes.find((r) => r.id === bind.runtime.id) : undefined;
    const now = seed(fresh, next);
    setActive(now.active);
    setValues(now.values);
    setSaved(now.values);
    setIgnored(now.ignored);
    setSecretsSet(now.secretsSet);
    bind?.onSaved(fresh);
  };

  // A save that only wrote one field: the fields on screen are already right, so nothing is
  // reseeded — this is only what the pane BEHIND the picker needs to redraw its row.
  const told = (fresh: AgentInfo | undefined) => {
    if (fresh && bind) bind.onSaved(fresh);
  };

  const activeOption = options.find((o) => o.name === active);
  const settings = activeOption?.settings ?? [];
  // Every setting the connector declares, the model included: a runtime is the whole answer
  // to what a run runs as (#467), so this is the one place one is set up.
  const connectorSettings = settings;

  // What "filled in" means on this side: a key is filled when the server says
  // the file holds it, anything else when the box has something in it. The
  // server asks the same question of the same declared list.
  const filled = (key: string): boolean => {
    const setting = settings.find((s) => s.key === key);
    return setting?.kind === "secret" ? secretsSet.includes(key) : Boolean(values[key]?.trim());
  };

  // The provider list this agent declares, and the entry in effect — which
  // decides what else is drawn. An agent with no list has no providers and every
  // setting it declares is drawn, as before.
  const list = providerSetting(settings);
  const picked = list ? pickedProvider(list, values[list.key] ?? "", filled) : undefined;
  // The boxes a deferred pick is still waiting on, by their labels.
  const waitingFor = !pending
    ? []
    : missingRequired(
        list?.providers?.find((p) => p.id === pending),
        filled,
      ).map((key) => rules(settings.find((s) => s.key === key)?.label ?? key));

  // Shut until someone opens it, on the grid and on a runtime row alike: every field behind
  // it has a working default, so what a row opens on is its name and the CLI it runs.
  const showAdvanced = advanced ?? false;

  const pick = async (option: HarnessOption) => {
    if (saving || option.name === active) return;
    const prev = { name: active, values, saved, ignored, secretsSet };
    setActive(option.name);
    // These settings belong to the agent they were written for — `claude-opus-5`
    // means nothing to another agent — and each agent keeps its own block in the
    // file, so the fields empty out while the switch saves and the new agent's
    // own come back from the server a moment later, along with which of its keys
    // that file holds. Neither is knowable here, so nothing is guessed in the
    // meantime.
    setValues({});
    setSaved({});
    setIgnored([]);
    setSecretsSet([]);
    setPending("");
    setAdvanced(null);
    setSaving(true);
    const revert = () => {
      setActive(prev.name);
      setValues(prev.values);
      setSaved(prev.saved);
      setIgnored(prev.ignored);
      setSecretsSet(prev.secretsSet);
    };
    try {
      const res = bind
        ? await setRuntimeHarnessAction(bind.runtime.id, option.name)
        : await setHarnessAction(option.name);
      if (!res.ok || !res.agent) {
        revert();
        onError?.(res.error || c.saveFailed);
        return;
      }
      // The file as it now reads: this agent's own block — the settings it had
      // when it was last picked and any `command` override in it — plus its
      // provider, worked out from the keys docs/kanban/.env already holds (#95).
      // Switching never touches that .env either: a key belongs to the variable
      // it is written under, not to whoever was picked when you typed it, so the
      // new agent's keys can already be set and this is what says which.
      settle(res.agent);
    } catch (e) {
      revert();
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Save one key, or clear it when the value is empty (#94). It goes to
  // docs/kanban/.env and nowhere else, and nothing comes back but whether it
  // worked — the dialog never learns a saved key.
  const saveSecret = async (setting: HarnessSetting, next: string): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    try {
      const res: WriteResult & { agent?: AgentInfo } = bind
        ? await setRuntimeSecretAction(bind.runtime.id, setting.key, next)
        : await setHarnessSecretAction(setting.key, next);
      if (!res.ok) {
        onError?.(res.error || c.saveSecretFailed(rules(setting.label).toLowerCase()));
        return false;
      }
      told(res.agent);
      setSecretsSet((all) =>
        next ? [...new Set([...all, setting.key])] : all.filter((k) => k !== setting.key),
      );
      return true;
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Write one setting to the file and move the field to what was written. No
  // guard of its own — the callers below decide when a save may start, because a
  // deferred provider pick saves on the back of another field's save (#95) and
  // would otherwise be turned away by a guard that hasn't caught up yet.
  const writeSetting = async (setting: HarnessSetting, value: string): Promise<boolean> => {
    const was = saved[setting.key] ?? "";
    const put = (v: string) => setValues((all) => ({ ...all, [setting.key]: v }));
    setSaving(true);
    try {
      const res: WriteResult & { agent?: AgentInfo } = bind
        ? await setRuntimeSettingAction(bind.runtime.id, setting.key, value)
        : await setHarnessSettingAction(setting.key, value);
      if (res.ok) {
        put(value);
        setSaved((all) => ({ ...all, [setting.key]: value }));
        told(res.agent);
        return true;
      }
      put(was);
      onError?.(res.error || c.saveSettingFailed(rules(setting.label).toLowerCase()));
      return false;
    } catch (e) {
      put(was);
      onError?.(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // The deferred pick, saved the moment the box it was waiting on has something
  // in it. `key`/`value` is the field that has just been saved — its new value
  // hasn't reached this state yet.
  const savePending = async (key: string, value: string) => {
    if (!pending || !list) return;
    const provider = list.providers?.find((p) => p.id === pending);
    const missing = missingRequired(provider, (k) => (k === key ? Boolean(value.trim()) : filled(k)));
    if (missing.length) return;
    setPending("");
    await writeSetting(list, pending);
  };

  // Save one setting. A text box saves on blur and on Enter, never on a
  // keystroke — an id is typed a character at a time, and a write per character
  // would be a write per character into the user's config file; a list saves the
  // moment you pick. An unchanged field saves nothing.
  const saveSetting = async (setting: HarnessSetting, next: string) => {
    const value = next.trim();
    if (saving || value === (saved[setting.key] ?? "")) return;
    if (await writeSetting(setting, value)) await savePending(setting.key, value);
  };

  // Pick a provider (#95). The fields follow it at once, so the boxes it needs
  // are on screen; the pick itself waits when one of those boxes has to be
  // filled first, and saves itself as soon as it is.
  const pickProvider = async (id: string) => {
    if (saving || !list || id === (values[list.key] ?? "")) return;
    setValues((all) => ({ ...all, [list.key]: id }));
    const provider = list.providers?.find((p) => p.id === id);
    if (missingRequired(provider, filled).length) {
      setPending(id);
      return;
    }
    setPending("");
    await writeSetting(list, id);
  };

  const labelOf = (name: string) => options.find((o) => o.name === name)?.label ?? name;

  // Which harness Test is about to spawn — the card that is on, whichever pane this is. The
  // ROW it spawns is the tester's own `pin`.
  const spawns = active || bind?.runtime.harness || "";
  const testLabel = labelOf(spawns);


  // The row this pane is drawing is signed out, which is not the same question as whether its
  // CLI is: two rows on one harness can differ, and only a row holding no key of its own is
  // ever on the list.
  const rowLoggedOut = bind ? out.find((one) => one.runtime === bind.runtime.id)?.login : undefined;
  // A row whose picked provider takes no key of its own runs on this computer's login, and
  // that is worth one line where the key field would otherwise be.
  const usesCliLogin =
    !!bind &&
    activeOption?.installed !== false &&
    !rowLoggedOut &&
    !connectorSettings.some(
      (setting) =>
        setting.kind === "secret" && shownForProvider(activeOption?.settings ?? [], setting.key, picked),
    );

  // Test the setup that is saved (#96). Keyed on that setup, so changing any of it throws
  // the old result away rather than leaving a "Passed" standing for a setup that is gone.
  //
  // Its own button goes at the pane's top right — the one thing here that is a press rather
  // than a setting, and the answer people open this pane to get. Where the press belongs to
  // a screen outside (the guided first run), all that is left is the result, and that stays
  // at the foot, under the button that started it.
  const tester = (
    <ConnectionTester
      key={`${bind?.runtime.id ?? ""}|${active}|${JSON.stringify(saved)}|${[...secretsSet].sort().join(",")}`}
      agentLabel={testLabel}
      expected={spawns}
      labelOf={labelOf}
      pin={bind?.runtime.id}
      unsavedPick={Boolean(pending)}
      disabled={saving}
      onResult={onTested}
      runTest={runTest}
    />
  );

  // Where a runtime row's Test goes: on the Advanced fold's line, the row's last line and the
  // only one in it not already spoken for. The row's title line carries Rename and Delete, and
  // a third button under those two read as a stack of controls in the corner.
  const onTheFold = Boolean(bind) && connectorSettings.length > 0;

  // What the picked connector needs said. It hangs off the block the picked card is in rather
  // than sitting under every grid: these are that connector's own lines, and under a list of
  // connectors that don't have them they read as the pane's.
  const notes = activeOption && (
    <>
      {/* The picked agent's CLI isn't here (#207). Said as a line rather than by dimming
          the card, because this one has something to do about it: the command that
          installs it. It shows the moment the agent is picked — including mid-switch,
          before the save lands — since that is when the user is asking what this agent
          needs. It says nothing about whether the CLI would then work: that is Test's
          answer, from a real run. */}
      {activeOption.installed === false && (
        <Note icon={<FiAlertCircle />}>
          <Rich>
            {bind ? cr.notInstalledHint(activeOption.label) : c.missingHint(activeOption.binary)}
          </Rich>{" "}
          <code className="rounded bg-nb-ink/8 px-1 py-0.5">{activeOption.install}</code>
        </Note>
      )}

      {/* The picked agent's CLI is here and logged out (#392), with the command that logs it
          back in. Never both this and the line above: an agent that isn't installed has
          nothing to be logged out of, and the probe skips it.

          It warns and stops nothing. Implement, Schedule, Resolve and a chat all
          start under this agent exactly as they would without it — so a probe that read the
          CLI wrong costs one run, not the agent. */}
      {activeOption.installed !== false &&
        (bind ? rowLoggedOut : loggedOut[activeOption.name]) && (
          <Note icon={<FiAlertCircle />}>
            <Rich>
              {bind ? cr.signedOutHint(activeOption.label) : c.loggedOutHint(activeOption.binary)}
            </Rich>{" "}
            <code className="rounded bg-nb-ink/8 px-1 py-0.5">
              {bind ? rowLoggedOut : loggedOut[activeOption.name]}
            </code>
          </Note>
        )}

      {/* Nothing to sign in and no key to paste: this row goes through the CLI's own login
          on this computer. One line where the key field would otherwise be, outside the
          fold, so it is read without opening anything. */}
      {usesCliLogin && <Note>{cr.cliLogin(activeOption.label)}</Note>}

      {/* The row asks for a harness this build doesn't ship, so another one runs. Never move
          a user to another CLI in silence. */}
      {bind?.runtime.unknownHarness && (
        <Note icon={<FiAlertCircle />}>
          {cr.unknownHarness(bind.runtime.unknownHarness, activeOption.label)}
        </Note>
      )}

      {/* What the picked agent can't do that another on the grid can. Drawn from the list
          the board hands down, so nothing here knows an agent's name.

          Above the settings rather than at the foot of the pane: this is what a switch
          costs, and it belongs at the moment of the switch. An agent that lacks nothing
          draws nothing, and so does a board reading older rules, which doesn't answer this
          at all.

          Never in a runtime row. Five lines of prose is the tallest thing in an open row and
          it answers a question the row isn't asking: a row is what THIS runtime runs, and a
          board with four rows on one CLI would say the same five lines four times. The pane
          below is where the CLIs are compared, and it still says all of it. */}
      {!bind && activeOption.gaps?.length ? (
        <div className="mt-3">
          <HarnessGaps heading={c.gaps(activeOption.label)} gaps={activeOption.gaps} />
        </div>
      ) : null}
    </>
  );

  const fields = activeOption && (
    <>
      {/* The settings the picked agent declares (#93), in its own order — for
          Claude Code, the provider it talks to (#95), the model it runs with
          (#71) and how hard that model thinks (#97). Nothing here knows an
          agent's name: another agent draws its own list in this same place.

          Folded, always, however much the file already holds: every one of these fields
          left alone runs the CLI's own default, so the pane's one real question is which
          agent — and a fold that opened itself on a saved model made four fields the first
          thing read on a pane that had already answered.

          Only the fields the picked provider needs are drawn: the base URL for
          an endpoint, the key for a provider that takes one, neither for the
          subscription. A field that isn't drawn doesn't reach a run either, so
          what you see here is what the agent is given. */}
      {connectorSettings.length > 0 && (
        <Advanced
          open={showAdvanced}
          onToggle={() => setAdvanced(!showAdvanced)}
          aside={onTheFold ? tester : undefined}
        >
          <div className="flex flex-col gap-5">
            {connectorSettings
              .filter((setting) => shownForProvider(activeOption.settings, setting.key, picked))
              .map((setting) =>
                // The provider list is its own kind of field (#95): picking one
                // redraws the fields under it, and a pick that needs a box
                // filled in first waits for it.
                setting.kind === "provider" ? (
                  <ProviderField
                    key={setting.key}
                    setting={setting}
                    value={values[setting.key] ?? ""}
                    waitingFor={pending === (values[setting.key] ?? "") ? waitingFor : []}
                    disabled={saving}
                    onPick={pickProvider}
                  />
                ) : // A key is its own kind of field (#94): it is never shown
                // back, so it says set or not set instead of holding a value.
                setting.kind === "secret" ? (
                  <SecretField
                    key={setting.key}
                    setting={setting}
                    note={cr.keyNote}
                    isSet={secretsSet.includes(setting.key)}
                    disabled={saving}
                    onSave={async (v) => {
                      const ok = await saveSecret(setting, v);
                      if (ok) await savePending(setting.key, v);
                      return ok;
                    }}
                  />
                ) : (
                  <SettingField
                    key={setting.key}
                    setting={setting}
                    value={values[setting.key] ?? ""}
                    ignored={ignored.includes(setting.key)}
                    disabled={saving}
                    onChange={(v) => setValues((all) => ({ ...all, [setting.key]: v }))}
                    onSave={(v) => saveSetting(setting, v)}
                  />
                ),
              )}
          </div>
        </Advanced>
      )}
    </>
  );

  const detail = (notes || fields) && (
    <div>
      {notes}
      {fields}
    </div>
  );

  // One runtime, whole (#468): the CLI it runs, what that CLI needs said, its settings behind
  // the fold, and the Test. The same grid and the same fields as the pane below — smaller
  // cards, because a row is already an indent in.
  if (bind) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <HarnessCards
            options={options}
            picked={active}
            loggedOut={loggedOut}
            disabled={saving}
            compact
            caption={cr.connector}
            onPick={pick}
          />
          {notes}
        </div>
        <div>{fields}</div>
        {/* A connector that declares no settings has no fold to hang the Test on, so there
            it stands on its own. */}
        {!onTheFold && tester}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* A pane whose first grid is missing has nowhere to hang the Test on. */}
      {!runTest && options.every((o) => o.installed === false) && tester}

      {/* The connectors, and this connector's own settings under whichever block holds the
          picked card. The Test rides the first block's caption line rather than taking a row
          of its own: one button, right-aligned, above a pane whose whole first answer is a
          grid. */}
      <HarnessCards
        options={options}
        picked={active}
        loggedOut={loggedOut}
        disabled={saving}
        aside={!runTest && tester}
        between={detail}
        onPick={pick}
      />

      {runTest && tester}

      {/* Never move a user to another agent silently: when the config asks for a
          harness we don't ship, or still carries the pre-#68 `command` key that
          nothing reads, the dialog says which agent is actually running. */}
      {(info.unknownName || info.staleCommand) && (
        <Note icon={<FiAlertCircle />}>
          {info.unknownName
            ? c.unknown(
                info.unknownName,
                options.find((o) => o.name === info.name)?.label ?? info.name,
              )
            : c.staleCommand}
        </Note>
      )}
    </div>
  );
}

/** The card grid that picks a connector — the pane's own, everywhere one is picked: the grid
 *  that sets what **Global default** runs, the grid inside an expanded runtime row, and the
 *  grid on the row **+ Add runtime** opens, which has no runtime behind it yet (#468).
 *
 *  Two blocks: the connectors this machine can run, then the ones it can't (#207). Which
 *  block a card is in is the whole of that answer, so no card wears a "not installed" word of
 *  its own — a grid where most connectors aren't installed used to repeat that badge down
 *  every row. A card in the second block is still a card you can press: someone whose CLI
 *  lives outside the PATH this board was started with would otherwise be shut out of the tool
 *  they use every day.
 *
 *  A fixed six-column grid rather than a wrapping row: the cards then sit on the same six
 *  columns whatever the count, instead of the last row's width drifting with however many
 *  connectors we ship. */
export function HarnessCards({
  options,
  picked,
  loggedOut = {},
  disabled,
  compact,
  caption,
  aside,
  between,
  onPick,
}: {
  options: HarnessOption[];
  /** The one that is on, by connector name. */
  picked: string;
  /** What to call the first block, where the caller has a better word than "Installed" —
   *  inside a runtime row the grid IS the Connector field, and a caption naming the field
   *  under the row's own name reads as one thing where two captions read as none. */
  caption?: string;
  /** The connectors nobody is logged into, by name — a word on the card (#392). */
  loggedOut?: Record<string, string>;
  disabled?: boolean;
  /** Smaller cards, for the grid inside a runtime row where it is one field among several. */
  compact?: boolean;
  /** The Test, on the first block's caption line. */
  aside?: React.ReactNode;
  /** What belongs directly under the block holding the picked card. */
  between?: React.ReactNode;
  onPick: (option: HarnessOption) => void;
}) {
  const c = useCopy().configuration.harness;
  // `=== false` on purpose: a board reading older rules doesn't answer this at all, and an
  // unanswered question counts as here rather than putting every connector under "not
  // installed".
  const here = options.filter((o) => o.installed !== false);
  const missing = options.filter((o) => o.installed === false);
  const pickedMissing = missing.some((o) => o.name === picked);

  const card = (option: HarnessOption) => {
    const on = option.name === picked;
    // The CLI is here, and nobody is logged in to it (#392). This connector IS on the machine
    // and one command away from working, so it stays in the installed block and says so on
    // the card; the peach ink is only a second way to see the word.
    //
    // The picked connector says it under the grid instead, with the command that logs it in.
    const signedOut = !on && option.installed !== false && !!loggedOut[option.name];
    const notHere = option.installed === false;
    return (
      <button
        key={option.name}
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={() => onPick(option)}
        title={
          notHere ? c.notHere(option.binary) : signedOut ? c.loggedOutHere(option.binary) : undefined
        }
        // One fill per card and no frame: the same sheet every group's card in the dialog
        // sits on, the ember wash when it is the picked one. The fill is what marks the pick
        // now, so it has to be the ember one — a hairline is not what tells them apart any
        // more.
        className={`flex cursor-pointer flex-col items-center rounded-[12px] transition-colors duration-100 disabled:cursor-wait ${
          compact ? "gap-1.5 px-2 pb-2 pt-2.5" : "gap-2 px-2 pb-2.5 pt-4"
        } ${on ? "bg-nb-accent-soft" : "bg-nb-sheet hover:bg-nb-wash"}`}
      >
        <span
          className={`flex items-center justify-center ${compact ? "h-[24px]" : "h-[30px]"}`}
          // A missing connector's mark dims, unless it is the one this row runs — the line
          // under the grid is where that case is said, in full, with the install command.
          style={{ opacity: notHere && !on ? 0.45 : 1 }}
        >
          <AgentMark src={option.icon} size={compact ? 21 : 26} />
        </span>
        <span
          className={`font-[800] ${compact ? "text-[11.5px]" : "text-[12px]"} ${
            notHere && !on ? "text-nb-ink-soft" : ""
          }`}
        >
          {option.label}
        </span>
        {signedOut && (
          <span className="-mt-1 text-[10px] font-[700] uppercase leading-none tracking-[0.04em] text-nb-peach-ink">
            {c.loggedOut}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {here.length > 0 && (
        <AgentGrid caption={caption ?? (missing.length ? c.installed : "")} aside={aside}>
          {here.map(card)}
        </AgentGrid>
      )}
      {!pickedMissing && between}
      {missing.length > 0 && <AgentGrid caption={c.notInstalled}>{missing.map(card)}</AgentGrid>}
      {pickedMissing && between}
    </>
  );
}

// One block of agent cards, under the word that says what they have in common. The caption
// is left out when there is only one block: a lone "Installed" over every agent we ship
// names a distinction that isn't being drawn.
//
// `aside` is the Test and whatever it answered, on that same line — the caption is one short
// word, and a button given a row to itself left the pane opening on empty space.
function AgentGrid({
  caption,
  aside,
  children,
}: {
  caption: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      {(caption || aside) && (
        <div className="mb-2 flex items-start justify-between gap-3">
          {/* Nudged down onto the button's own text, which sits inside its padding. */}
          <p className={`pt-[7px] ${CAPTION} text-nb-ink-soft`}>{caption}</p>
          {aside && <div className="min-w-0 flex-1">{aside}</div>}
        </div>
      )}
      <div className="grid grid-cols-6 gap-2">{children}</div>
    </div>
  );
}

// One connector's settings, always behind a fold: everything in here has a default that
// works, the fold is what says so, and it keeps a pane — or a runtime row — whose real
// question is which CLI from opening on six fields nobody should have to answer.
function Advanced({
  open,
  onToggle,
  aside,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  /** The Test, beside the fold's own label — a runtime row's last line, and the only one in
   *  the row that isn't already spoken for. Beside it rather than at the far right: a button
   *  alone in the corner reads as the row's, not as this fold's. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = useCopy().configuration.harness;
  return (
    // The margin is what separates the fold from a note above it. Directly under the agent
    // grid — the usual case — there is no note, and the pane's own gap is separation enough.
    <div className="mt-3 first:mt-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex cursor-pointer items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft transition-colors duration-100 hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
        >
          {open ? (
            <FiChevronDown className="shrink-0 text-[13px]" aria-hidden />
          ) : (
            <FiChevronRight className="shrink-0 text-[13px]" aria-hidden />
          )}
          {c.advanced}
        </button>
        {aside}
      </div>
      {open ? (
        <div className="mt-4">{children}</div>
      ) : (
        <p className="mt-1 pl-[19px] text-[12px] leading-relaxed text-nb-ink-soft">{c.advancedBlurb}</p>
      )}
    </div>
  );
}

// What the picked agent can't do that another one on the grid can.
//
// Not a warning: none of these is broken, and every agent here runs the board. So it reads
// in the pane's own quiet grey rather than the peach a real failure wears, and it wears the
// same small uppercase heading the settings below it do — one more thing about this agent,
// not an alarm.
//
// Nothing folds and nothing is a paragraph. Each gap is one row: a cross, what it is, then
// what you lose, all short enough to take in without stopping. Someone glancing reads the
// labels down the left and moves on; someone weighing two agents reads the right-hand
// column too.
//
// The cross wears the pane's grey, not the peach a failure wears: none of this is broken,
// and every agent here runs the board. It is aria-hidden — the heading says "not supported"
// once, and a reader that hears it four more times learns nothing.
function HarnessGaps({ heading, gaps }: { heading: string; gaps: HarnessGap[] }) {
  const rules = useRulesText();
  return (
    <div className="rounded-[10px] bg-nb-sheet px-3 py-2.5">
      <p className={`mb-1.5 ${CAPTION} text-nb-ink-soft`}>{heading}</p>
      <dl className="flex flex-col gap-1">
        {gaps.map((gap) => (
          // The label column is fixed so the consequences line up into a column of their
          // own — a list you can run your eye down, not five sentences.
          <div key={gap.id} className="flex gap-2 text-[12px] leading-snug max-sm:flex-col max-sm:gap-0">
            <dt className="flex w-[142px] shrink-0 items-center gap-1.5 font-[700] text-nb-ink">
              <FiX className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
              {rules(gap.label)}
            </dt>
            <dd className="text-nb-ink-soft max-sm:pl-[19px]">{rules(gap.blurb)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Does this setup actually run? (#96) One button, and a panel under it with the
// answer.
//
// The test is a real run of the agent — the same command and the same
// environment a card run gets — asking for one word. So a test that passes is a
// card run that starts, which a checklist of "is the CLI there, is a key set"
// could never promise: it can't see a revoked key, a gateway that is up but
// refuses this model, or a proxy that needs a VPN.
//
// It tests what is SAVED, not what is on screen. Every box here saves as it
// changes, so the two are the same thing — except a provider pick still waiting
// on a box, which is why the button stands down while one is pending rather than
// testing a setup the user has already moved on from.
//
// The result lives here and only here: closing the dialog throws it away, and
// nothing about the test reaches the board, the runs panel, or a card.
function ConnectionTester({
  agentLabel,
  expected,
  labelOf,
  pin,
  unsavedPick,
  disabled,
  onResult,
  runTest,
}: {
  agentLabel: string;
  /** The agent this pane says the press will spawn, and how to name one. The answer says
   *  which agent it really was, and the two disagreeing is the one thing a result must not
   *  keep to itself. */
  expected: string;
  labelOf: (harness: string) => string;
  /** The runtime to spawn (#468) — the row the button is on. Absent tests Global default,
   *  which is what setup's own step is about. */
  pin?: string;
  // A provider is picked but not written yet, so the saved setup isn't the one
  // on screen and a test now would answer a question nobody asked.
  unsavedPick: boolean;
  // A save is in flight — the setup is mid-change.
  disabled: boolean;
  // Told each time the answer changes, for the guided first run's agent step
  // (#172), which can't be pressed past until this setup has answered once.
  // Nothing in the dialog itself listens.
  onResult?: (result: ConnectionTest | null) => void;
  // Handed this button's own press, for the first run's agent step (#280) — one
  // button there, and it has to be this call. Being asked for it is also what takes
  // this button off the pane: the press has an owner, and two controls that start the
  // same call, both reading "Testing…" while it runs, is the same button drawn twice.
  runTest?: RunTest;
}) {
  const c = useCopy().configuration.harness.test;
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConnectionTest | null>(null);

  // Report the answer out, including the null this starts on: the tester is
  // keyed on the saved setup, so a changed setting remounts it and that null is
  // how a "Passed" for a setup the user has moved on from is taken back.
  const report = useRef(onResult);
  report.current = onResult;
  useEffect(() => {
    report.current?.(result);
  }, [result]);

  const test = async (): Promise<ConnectionTest | null> => {
    if (running || disabled || unsavedPick) return null;
    setRunning(true);
    setResult(null);
    let answer: ConnectionTest;
    try {
      answer = await testConnectionAction(pin);
    } catch (e) {
      // The action doesn't throw for anything the test itself hit — this is the
      // call not getting there (the server went away mid-test). Shown the same
      // way a failure is, in the words we were given.
      answer = { ok: false, ms: 0, output: e instanceof Error ? e.message : String(e) };
    }
    setResult(answer);
    setRunning(false);
    return answer;
  };
  if (runTest) runTest.current = test;

  // Whose press this is. When it is somebody else's, all that is left here is what came
  // back — and the one line that is not a duplicate: a pick that has not been saved, which
  // is why a press outside would appear to do nothing.
  const own = !runTest;
  if (!own && !unsavedPick && !running && !result) return null;

  // Which agent answered, when it isn't the one this pane offered.
  const ran = result?.harness && result.harness !== expected ? c.ran(labelOf(result.harness)) : "";
  // A pass is one word beside the button, not a panel: it says the setup works and there is
  // nothing to do about it. A failure keeps the panel — it carries the agent's own output —
  // and so does a pass by an agent the pane didn't offer, which has that to say too.
  const passedInline = own && !running && result?.ok === true && !ran;

  return (
    <div>
      {/* The button alone, at the pane's right edge. What it costs is a hover away rather
          than a line of prose across the top of a pane whose first question is which agent;
          the one sentence that stays on screen is the one with something to do about it. */}
      {own ? (
        <div className="flex items-center justify-end gap-3">
          {unsavedPick && (
            <p className="min-w-0 text-[12px] leading-relaxed text-nb-ink-soft">{c.unsavedPick}</p>
          )}
          {passedInline && result && (
            <p
              aria-live="polite"
              className="flex min-w-0 items-center gap-1.5 text-[12px] font-[700] text-nb-mint-ink"
            >
              <FiCheck className="shrink-0" aria-hidden />
              {c.passed(seconds(result.ms, c))}
            </p>
          )}
          {/* The pane's own button shape, in the accent: no ink frame and no hard shadow —
              this asks a question about the setup rather than committing anything — but not
              the neutral wash either, which lost it among the settings it sits between. */}
          <button
            type="button"
            title={c.blurb(agentLabel)}
            disabled={running || disabled || unsavedPick}
            onClick={() => void test()}
            className={ACCENT_BTN}
          >
            <FiZap className="text-[13px]" aria-hidden />
            {running ? c.running : c.run}
          </button>
        </div>
      ) : (
        unsavedPick && <p className="text-[12px] leading-relaxed text-nb-ink-soft">{c.unsavedPick}</p>
      )}
      {/* While it runs, the button already says so — a panel repeating it in a sentence is
          the one thing on a pane that is about to be replaced anyway. Elsewhere (the guided
          first run, whose button is not this one) the panel is the only thing saying it. */}
      {(own ? Boolean(result) && !passedInline : running || result) && (
        <TestResult copy={c} running={running} result={result} ran={ran} />
      )}
    </div>
  );
}

// What the test found. Three shapes, because they are three different things to
// do next: it worked, the CLI isn't installed, or the agent said no.
//
// A failure shows the agent's own output and nothing on top of it. The board
// explains exactly one case in its own words — a CLI that isn't there, whose
// real error ("spawn claude ENOENT") tells a user nothing. Everything else is
// already a real message from the thing that refused, and a guess written over
// it would send people down the wrong path.
//
// Exported, because the button is not the only thing that makes this call: the first run
// tries the agents this machine has before it draws anything (#404), and a probe where none
// answered has to show what came back the way a failed Test shows it.
export function TestResult({
  copy,
  running,
  result,
  ran,
}: {
  copy: ConfigurationCopy["harness"]["test"];
  running: boolean;
  result: ConnectionTest | null;
  /** What actually spawned, when it isn't what the pane offered. Empty when they agree. */
  ran: string;
}) {
  const tone = running
    ? { bg: "var(--color-nb-wash)", ink: "var(--color-nb-ink-soft)" }
    : result?.ok
      ? { bg: "var(--color-nb-mint-soft)", ink: "var(--color-nb-mint-ink)" }
      : { bg: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" };

  return (
    <div
      aria-live="polite"
      className="mt-3 rounded-[10px] px-3 py-2.5"
      style={{ background: tone.bg }}
    >
      <p className="flex items-start gap-2 text-[13px] font-[700]" style={{ color: tone.ink }}>
        {running ? (
          <>
            <span
              className="mt-[5px] size-[6px] shrink-0 rounded-full bg-nb-ink-soft animate-[nbPulse_1.1s_ease-in-out_infinite]"
              aria-hidden
            />
            {copy.trying}
          </>
        ) : result?.ok ? (
          <>
            <FiCheck className="mt-[2px] shrink-0" aria-hidden />
            {copy.passed(seconds(result.ms, copy))}
          </>
        ) : (
          <>
            <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
            {result?.missing
              ? copy.failedMissing(result.missing)
              : result?.timedOut
                ? copy.failedTimeout(seconds(result?.ms ?? 0, copy))
                : copy.failed}
          </>
        )}
      </p>

      {/* Which agent answered, when it isn't the one this pane offered — a pass for an
          agent you didn't mean to test is a pass that means nothing. */}
      {!running && ran && (
        <p className="mt-1.5 text-[12px] font-[700] leading-relaxed" style={{ color: tone.ink }}>
          {ran}
        </p>
      )}

      {/* The one failure with an instruction attached: name the command that
          installs the agent's CLI, so there is something to do about it. */}
      {!running && result?.install && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          {copy.install}{" "}
          <code className="rounded bg-nb-ink/8 px-1 py-0.5">{result.install}</code>
        </p>
      )}

      {/* The agent's own words, as they came — so they can be read, searched, or
          pasted somewhere that knows what they mean. */}
      {!running && result?.output && (
        <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-nb-paper px-2.5 py-2 text-[11px] leading-relaxed text-nb-ink">
          {result.output}
        </pre>
      )}
    </div>
  );
}

// How long a test took, in the plainest form: "1.4s". Whole seconds past ten —
// nobody needs a tenth of a second on a run that slow.
function seconds(ms: number, copy: ConfigurationCopy["harness"]["test"]): string {
  const s = ms / 1000;
  return copy.seconds(String(s < 10 ? s.toFixed(1) : Math.round(s)));
}

// The provider the agent talks to (#95) — who pays for a run and where it goes.
// A list, because the entries are the agent's own and there is nothing to type:
// its subscription, its vendor's API, a gateway that answers in the same format.
//
// The picked entry says in one line what it is, since "Anthropic-compatible
// endpoint" means nothing to someone who hasn't set one up. Picking redraws the
// fields under it — the whole point of the setting — and a pick that can't work
// until a box below is filled says so instead of saving something that would
// send a run nowhere.
function ProviderField({
  setting,
  value,
  waitingFor,
  disabled,
  onPick,
}: {
  setting: HarnessSetting;
  value: string;
  // The labels of the boxes this pick is still waiting on, when it is waiting.
  // Empty when the pick on screen is the one in the file.
  waitingFor: string[];
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  const c = useCopy().configuration.harness;
  const rules = useRulesText();
  const id = `harness-setting-${setting.key}`;
  const providers = setting.providers ?? [];
  const shown = providers.find((p) => p.id === value);

  return (
    <Field
      id={id}
      label={rules(setting.label)}
      help={
        <>
          {shown && <p>{rules(shown.blurb)}</p>}
          {waitingFor.length > 0 ? (
            <p>
              <strong className="text-nb-accent-deep">{c.waitingFor(waitingFor.join(" and "))}</strong>
            </p>
          ) : (
            setting.help && <p>{rules(setting.help)}</p>
          )}
        </>
      }
    >
      <Select value={value || undefined} disabled={disabled} onValueChange={onPick}>
        <SelectTrigger id={id} className={`${FLAT_CONTROL} disabled:cursor-wait`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {rules(provider.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// A key the agent takes (#94) — an API key, saved to docs/kanban/.env and
// nowhere else. It is the one field that never shows what it holds:
//
// - Not set: a box that hides what you type, like a password field, and a Save
//   beside it. Nothing is written until you press Save or Enter, so a key can't
//   be half-saved by clicking away.
// - Set: one line saying so, with Replace and Clear. The key is never read back
//   into the page — a user who forgot theirs makes a new one, and reading it
//   back would buy nothing for the risk of putting it on screen.
//
// The typed key lives here only until the save comes back, and then it's gone.
function SecretField({
  setting,
  note,
  isSet,
  disabled,
  onSave,
}: {
  setting: HarnessSetting;
  /** The line beside the box, INSTEAD of the setting's own help: where the key lives and who
   *  reads it is the pane's answer, not the connector's, and two lines saying it is one too
   *  many (#468). */
  note?: string;
  // Whether docs/kanban/.env holds this key right now — the whole of what the
  // server tells us about a saved one. A key written into that file by hand
  // shows up here the same as one typed in the dialog.
  isSet: boolean;
  disabled: boolean;
  // Saves the key, or clears it when given "". Resolves true when the file was
  // written; the error is already reported by the time it resolves false.
  onSave: (value: string) => Promise<boolean>;
}) {
  const c = useCopy().configuration.harness.secret;
  const rules = useRulesText();
  const [typed, setTyped] = useState("");
  // Replace was pressed on a key that is set: show the box again. A save or a
  // Cancel puts the line back.
  const [replacing, setReplacing] = useState(false);
  const id = `harness-secret-${setting.key}`;
  const typing = !isSet || replacing;

  const done = (ok: boolean) => {
    if (!ok) return;
    setTyped("");
    setReplacing(false);
  };

  const save = async () => {
    const value = typed.trim();
    if (!value || disabled) return; // an empty box is nothing to save — Clear is how you unset
    done(await onSave(value));
  };

  return (
    <Field
      id={id}
      label={rules(setting.label)}
      help={<p>{note ?? (setting.help && rules(setting.help))}</p>}
    >
      {typing ? (
        <div className="flex items-center gap-2">
          <input
            id={id}
            // NOT type="password", on purpose. Chrome ignores autoComplete="off"
            // on a password field: it offers to save what you type as a website
            // password, and — worse — it autofills a stored password into the
            // box. A user who accepted that fill saved someone's password into
            // docs/kanban/.env as their agent key, and every run 401'd. A text
            // box is not a credential field to any password manager, so neither
            // happens. The masking is CSS instead (below), and it is the only
            // thing type="password" was here for: this box is write-only —
            // a saved key is never read back into it.
            type="text"
            value={typed}
            disabled={disabled}
            placeholder={setting.placeholder}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            // Not a login box: an agent key has no business in a password
            // manager, and a browser offering to fill one would be noise. The
            // data- attributes say the same to 1Password and LastPass, which
            // read their own and not the standard one.
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            // The dots. Only while there's something to hide — the property
            // masks the placeholder too, and a placeholder that says what shape
            // of key to paste is worth reading.
            className={`${CONTROL} ${typed ? "[-webkit-text-security:disc]" : ""}`}
          />
          <button type="button" disabled={disabled || !typed.trim()} onClick={() => void save()} className={QUIET_BTN}>
            {c.save}
          </button>
          {replacing && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setTyped("");
                setReplacing(false);
              }}
              className={QUIET_BTN}
            >
              {c.cancel}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-[10px] bg-nb-sheet px-3 py-2">
          <span className="flex items-center gap-2 text-[13px] font-[700] text-nb-ink">
            <FiCheck className="shrink-0 text-nb-accent-deep" aria-hidden />
            {c.set}
          </span>
          <span className="flex items-center gap-2">
            <button type="button" disabled={disabled} onClick={() => setReplacing(true)} className={QUIET_BTN}>
              {c.replace}
            </button>
            <button type="button" disabled={disabled} onClick={() => void onSave("")} className={QUIET_BTN}>
              {c.clear}
            </button>
          </span>
        </div>
      )}
    </Field>
  );
}

// One setting an agent declares: its label, the control, and one plain line of
// help under it. Two shapes (#93) — a box to type in and a list to pick one
// from. The box saves when it loses focus or on Enter, the list the moment you
// pick, so neither writes into the user's config file on every keystroke.
//
// A setting the hand-written the agent's `command` already names shows its own "not
// in effect" line instead of the help: the override wins, and a filled-in field
// should never look like it is doing something it isn't.
function SettingField({
  setting,
  value,
  ignored,
  disabled,
  onChange,
  onSave,
}: {
  setting: HarnessSetting;
  value: string;
  ignored: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}) {
  const c = useCopy().configuration.harness;
  const rules = useRulesText();
  const id = `harness-setting-${setting.key}`;

  // What the list offers. A value hand-written into ui.config.json that isn't on
  // the list is added to it rather than dropped: the file is the user's, the run
  // really is getting that value, and a dropdown that fell back to its first
  // choice would say the agent's default while the run says otherwise.
  const choices = setting.choices ?? [];
  const listed = value && !choices.some((c) => c.value === value)
    ? [...choices, { value, label: c.fromConfig(value) }]
    : choices;

  // A choice can mean "nothing saved" and carry the value "" (the reasoning
  // list's Agent's default) — but Radix refuses an empty-string item value, so
  // that choice wears this stand-in inside the select and is mapped back to ""
  // on the way out. No declared choice can collide: the values are ours, from
  // lib/agent.ts.
  const EMPTY = "—empty—";
  const toItem = (v: string) => v || EMPTY;

  return (
    <Field
      id={id}
      label={rules(setting.label)}
      help={
        <p>
          {rules((ignored && setting.overriddenHelp ? setting.overriddenHelp : setting.help) ?? "")}
        </p>
      }
    >
      {setting.kind === "select" ? (
        <Select
          value={toItem(value)}
          disabled={disabled}
          onValueChange={(v) => {
            const next = v === EMPTY ? "" : v;
            onChange(next);
            onSave(next);
          }}
        >
          <SelectTrigger id={id} className={`${FLAT_CONTROL} disabled:cursor-wait`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {listed.map((choice) => (
              <SelectItem key={choice.value} value={toItem(choice.value)}>
                {rules(choice.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <SuggestBox
          id={id}
          setting={setting}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onSave={onSave}
        />
      )}
    </Field>
  );
}

// A box to type in, with the values this machine already knows under it — today only the
// Model box, whose ids the CLI reads off the agent's own files as it reads the settings
// (agent/harnesses/models.ts).
//
// It suggests and never limits. Typing is untouched, whatever is typed is what gets saved,
// and nothing is checked against the list: a model released this morning must not be harder
// to set because a cache hasn't heard of it. A setting with nothing to offer draws the plain
// input it always did, and this whole component is out of the way.
function SuggestBox({
  id,
  setting,
  value,
  disabled,
  onChange,
  onSave,
}: {
  id: string;
  setting: HarnessSetting;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
}) {
  const c = useCopy().configuration.harness;
  const all = setting.suggestions ?? [];
  const [open, setOpen] = useState(false);
  // Which row the arrow keys are on, -1 for none — then Enter saves what is typed instead of
  // picking, which is what a box with an id nobody suggested has to do.
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  // Typing narrows the list. A value that IS one of the ids is the exception: filtering
  // would leave one row repeating the box, so the whole list stays up and switching to a
  // neighbour is one arrow key.
  const typed = value.trim().toLowerCase();
  const shown =
    !typed || all.some((one) => one.toLowerCase() === typed)
      ? all
      : all.filter((one) => one.toLowerCase().includes(typed));

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const pick = (picked: string) => {
    onChange(picked);
    onSave(picked);
    close();
  };
  const move = (by: number) => {
    if (!shown.length) return;
    setOpen(true);
    setActive((at) => Math.min(shown.length - 1, Math.max(0, at + by)));
  };

  if (!all.length) {
    return (
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={setting.placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={CONTROL}
      />
    );
  }

  return (
    <div ref={box} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        value={value}
        disabled={disabled}
        placeholder={setting.placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => onSave(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(open ? 1 : 0);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          } else if (e.key === "Enter") {
            if (open && active >= 0 && shown[active]) {
              e.preventDefault();
              pick(shown[active]);
            } else {
              close();
              e.currentTarget.blur();
            }
          } else if (e.key === "Escape" && open) {
            // The dialog closes on Escape from a window listener. Closing just this list is
            // what a native picker does, so the key stops here.
            e.stopPropagation();
            close();
          } else if (e.key === "Tab") {
            close();
          }
        }}
        className={`${CONTROL} pr-9`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={c.suggestions}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setOpen((was) => !was);
          setActive(-1);
        }}
        className="absolute right-1 top-1/2 flex -translate-y-1/2 cursor-pointer items-center rounded-[8px] p-1.5 text-nb-ink-soft transition-colors hover:text-nb-ink disabled:cursor-wait"
      >
        <FiChevronDown size={15} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && shown.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-56 overflow-y-auto rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-1 shadow-[3px_3px_0_0_var(--color-nb-ink)]"
        >
          {shown.map((one, at) => (
            <li key={one}>
              <button
                id={`${id}-option-${at}`}
                type="button"
                role="option"
                aria-selected={one === value}
                // Keeps the focus in the box, so the pick lands before a blur saves what was
                // half-typed.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(at)}
                onClick={() => pick(one)}
                className={`${MODEL_ROW} ${at === active ? "bg-nb-wash" : ""}`}
              >
                <ModelRow id={one} picked={one === value} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
