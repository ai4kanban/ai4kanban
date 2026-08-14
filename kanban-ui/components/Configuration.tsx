"use client";

// The board's one configuration home (#41), opened from a quiet gear button in
// the header. A sidebar on its left names the sections — Agent (which agent runs
// every card action, #68, and the settings that agent declares, #93) and Skill
// (driving this same board from a coding agent, #174). The sidebar is how the
// dialog grows: a new group of settings is one more entry there with a pane of
// its own, and the agent's growing field list (the model, the reasoning level
// #97, #95's provider and base URL) never squeezes what joins it.
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
import { FiAlertCircle, FiCheck, FiCode, FiSettings, FiTerminal, FiZap } from "react-icons/fi";
import {
  setHarnessAction,
  setHarnessSecretAction,
  setHarnessSettingAction,
  testConnectionAction,
} from "@/app/actions";
import { missingRequired, pickedProvider, providerSetting, shownForProvider } from "@/lib/providers";
import type { AgentInfo, ConnectionTest, HarnessOption, HarnessSetting } from "@/lib/types";
import { TOOL_BTN } from "./chrome";
import { Dialog } from "./Dialog";
import { SkillPanel } from "./Skill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// The look of every box and list in this pane. One string, because the provider
// list, the model box and the reasoning list are the same control with different
// contents.
const CONTROL =
  "w-full rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait";

// The pane's small sticker button — the key field's Save/Replace/Clear and the
// Test button. Same press-down as the header's ghost buttons, one size down.
const QUIET_BTN =
  "cursor-pointer rounded-[8px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-1.5 text-[12px] font-[700] text-nb-ink transition-[transform,box-shadow] duration-[120ms] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_0_var(--color-nb-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none";

// The pane's dropdowns are ui/select.tsx — its default trigger IS the CONTROL
// frame, so a list and a text box read as the same control. `disabled` here is
// always a save in flight, hence the cursor-wait override.

// A harness's mark, e.g. the Claude sunburst at public/agents/claude.svg.
// alt="" because the agent name always sits right next to it.
function AgentMark({ src, size }: { src: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} style={{ flex: "0 0 auto" }} />;
}

// The dialog's sections, in sidebar order. Adding a settings group is one entry
// here plus its pane below — nothing else moves.
type Section = "agent" | "skill";
const SECTIONS: { id: Section; label: string; icon: IconType }[] = [
  { id: "agent", label: "Agent", icon: FiTerminal },
  { id: "skill", label: "Skill", icon: FiCode },
];

// --- opening the dialog from elsewhere (#174) --------------------------------
// A tiny shared store, the same shape as the sessions panel's (components/
// sessions.tsx), so a sibling that isn't in this tree can open the dialog on one
// section. The setup strip uses it: the line it hands to a coding agent only
// works once the skill is installed, so when it isn't, the way out of that strip
// is this dialog's Skill pane rather than a sentence telling the user to go
// find the gear.
let openRequest: { at: number; section: Section } | null = null;
const requestSubs = new Set<() => void>();
export const configDialog = {
  open(section: Section = "agent") {
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
  const [open, setOpen] = useState(false);
  // Which pane shows. Reopening the dialog starts back on Agent.
  const [section, setSection] = useState<Section>("agent");
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

  return (
    <>
      {/* The last tool in the header's cluster (components/chrome.tsx) — no frame
          of its own, one hairline between it and Sessions. */}
      <button
        type="button"
        className={TOOL_BTN}
        title="Configuration"
        aria-label="Configuration"
        onClick={() => {
          setSection("agent");
          setOpen(true);
        }}
      >
        <FiSettings size={15} aria-hidden />
      </button>

      {open && (
        <Dialog
          title="Configuration"
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
          width={720}
          height="90vh"
          flush
        >
          {/* The section list. A quiet vertical nav on the wash, the active entry
              in the ember tint — the same active language as the harness rows. */}
          <nav
            aria-label="Configuration sections"
            className="flex w-[150px] shrink-0 flex-col gap-1 border-r border-nb-ink/12 bg-nb-wash p-3"
          >
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const on = id === section;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={on}
                  onClick={() => setSection(id)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-[700] transition-colors duration-100 ${
                    on
                      ? "bg-nb-accent-soft text-nb-accent-deep"
                      : "text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink"
                  }`}
                >
                  <Icon className="shrink-0 text-[15px]" aria-hidden />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* The panes. Every one stays mounted and the inactive ones hide: the
              fields hold optimistic state seeded from the server's first paint,
              so unmounting on a section switch would throw away a value saved a
              moment ago. The dialog's fixed height keeps the panes steady;
              a pane taller than it scrolls here. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {/* The agent harness — pick which agent runs every card action (#68),
                and the settings that agent declares (#93). */}
            <div hidden={section !== "agent"}>
              <HarnessPicker agent={agent} onError={onError} />
            </div>
            {/* Driving this same board from a coding agent (#174) — an extra a
                board does not arrive with. Mounted only while it is the section
                on screen: it reads the project when it draws, and one of those
                reads spawns a process to ask what `akb` on the PATH is. */}
            {section === "skill" && <SkillPanel onError={onError} />}
          </div>
        </Dialog>
      )}
    </>
  );
}

// The harness picker: one square card per agent we can run, the active one
// framed in ember, and under them the settings that agent declares (#93) — for
// Claude Code, the model it runs with (#71). Clicking a card saves
// that harness's name to docs/kanban/ui.config.json — nothing else changes, and
// a running session keeps the harness it started under. Selecting optimistically
// and reverting on a failed save.
//
// Exported, because the guided first run asks for the agent with this same pane
// (#172): the agent step there is this picker and its Test, not a second screen
// that asks the same questions in different words. `onTested` is how that flow
// hears the answer — it is the one place that needs to know whether the setup on
// screen has actually answered.
export function HarnessPicker({
  agent,
  onError,
  onTested,
}: {
  agent: AgentInfo;
  onError?: (msg: string) => void;
  /** The last test's result, or null when there is none to speak of — including
   *  the moment a setting changes and the old result stops applying. */
  onTested?: (result: ConnectionTest | null) => void;
}) {
  // The agent setting as the file now reads it. It starts as the server's first
  // paint and is replaced by what a switch writes back, so the override note and
  // the notices below always describe the agent on screen rather than the one
  // that was picked when the page loaded.
  const [info, setInfo] = useState(agent);
  const [active, setActive] = useState(agent.name);
  const [saving, setSaving] = useState(false);
  // What the fields show, and what was last written to the file — keyed by the
  // setting's key. Two pieces of state because a field is text the user can be
  // halfway through typing, and only a save makes it the setting.
  const [values, setValues] = useState(agent.values);
  const [saved, setSaved] = useState(agent.values);
  // The settings the agent's `command` override already names, so those fields
  // aren't in effect. Every agent has its own override, so switching redraws
  // these from the new one's.
  const [ignored, setIgnored] = useState(agent.ignored);
  // Which of the agent's keys are set (#94) — set or not set, never a key. A
  // key lives in docs/kanban/.env, so nothing here ever holds one longer than
  // the moment between typing it and saving it.
  const [secretsSet, setSecretsSet] = useState(agent.secretsSet);
  // A provider picked in the list but not written to the file yet, because a box
  // it can't do without is still empty (#95) — the endpoint before its base URL
  // is typed. The fields follow the pick right away, so the box it is waiting on
  // is on screen; the pick saves itself the moment that box is filled. Without
  // this the endpoint could never be picked at all: its base URL only shows once
  // it is picked, and it can't be picked until the base URL is there.
  const [pending, setPending] = useState("");

  const activeOption = info.options.find((o) => o.name === active);
  const settings = activeOption?.settings ?? [];

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
      ).map((key) => settings.find((s) => s.key === key)?.label ?? key);

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
    setSaving(true);
    const revert = () => {
      setActive(prev.name);
      setValues(prev.values);
      setSaved(prev.saved);
      setIgnored(prev.ignored);
      setSecretsSet(prev.secretsSet);
    };
    try {
      const res = await setHarnessAction(option.name);
      if (!res.ok || !res.agent) {
        revert();
        onError?.(res.error || "couldn't save the agent setting");
        return;
      }
      // The file as it now reads: this agent's own block — the settings it had
      // when it was last picked and any `command` override in it — plus its
      // provider, worked out from the keys docs/kanban/.env already holds (#95).
      // Switching never touches that .env either: a key belongs to the variable
      // it is written under, not to whoever was picked when you typed it, so the
      // new agent's keys can already be set and this is what says which.
      setInfo(res.agent);
      setValues(res.agent.values);
      setSaved(res.agent.values);
      setIgnored(res.agent.ignored);
      setSecretsSet(res.agent.secretsSet);
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
      const res = await setHarnessSecretAction(setting.key, next);
      if (!res.ok) {
        onError?.(res.error || `couldn't save the ${setting.label.toLowerCase()}`);
        return false;
      }
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
      const res = await setHarnessSettingAction(setting.key, value);
      if (res.ok) {
        put(value);
        setSaved((all) => ({ ...all, [setting.key]: value }));
        return true;
      }
      put(was);
      onError?.(res.error || `couldn't save the ${setting.label.toLowerCase()} setting`);
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

  // A hand-edited the agent's `command` override is the one thing worth a note under
  // the cards — it's what actually runs, and it's invisible otherwise.
  const overridden = info.command !== info.options.find((o) => o.name === info.name)?.command;

  return (
    <div className="flex flex-col gap-2">
      {/* One square card per agent, all of them visible at once — the name and
          the mark say what each is, no note needed. The ember frame alone marks
          the active one.

          A fixed four-column grid rather than a wrapping row: the cards then sit
          on the same four columns whatever the count, instead of the last row's
          width drifting with however many agents we ship. The dialog is sized
          for four, so a fifth starts a second row under the first. */}
      <div className="grid grid-cols-4 gap-2">
        {info.options.map((option) => {
          const on = option.name === active;
          return (
            <button
              key={option.name}
              type="button"
              aria-pressed={on}
              disabled={saving}
              onClick={() => pick(option)}
              className="nb-outline flex cursor-pointer flex-col items-center gap-2 bg-nb-paper px-2 pb-2.5 pt-4 disabled:cursor-wait"
              style={{
                borderColor: on
                  ? "var(--color-nb-accent-deep)"
                  : "color-mix(in srgb, var(--color-nb-ink) 22%, transparent)",
              }}
            >
              <span
                className="flex items-center justify-center rounded-[9px]"
                style={{
                  width: 38,
                  height: 38,
                  background: on ? "var(--color-nb-accent-soft)" : "var(--color-nb-wash)",
                }}
              >
                <AgentMark src={option.icon} size={22} />
              </span>
              <span className="text-[12px] font-[800]">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* The override, when there is one, so what actually runs is never hidden.
          Only while the active card is the saved one — mid-switch it names the
          agent that is on its way out. Each agent has an override of its own, so
          switching back brings that agent's note back with it. */}
      {overridden && active === info.name && (
        <p className="text-[12px] leading-relaxed text-nb-ink-soft">
          Runs your override: <code>{info.command}</code>
        </p>
      )}

      {/* The settings the picked agent declares (#93), in its own order — for
          Claude Code, the provider it talks to (#95), the model it runs with
          (#71) and how hard that model thinks (#97). Nothing here knows an
          agent's name: another agent draws its own list in this same place. One
          group under the divider, so the list reads as the agent's own.

          Only the fields the picked provider needs are drawn: the base URL for
          an endpoint, the key for a provider that takes one, neither for the
          subscription. A field that isn't drawn doesn't reach a run either, so
          what you see here is what the agent is given. */}
      {activeOption && activeOption.settings.length > 0 && (
        <div className="mt-2 border-t border-nb-ink/12 pt-4">
          <div className="flex flex-col gap-4">
            {activeOption.settings
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
        </div>
      )}

      {/* Test the setup that is saved (#96). Last in the pane, under the
          settings it tests. It is keyed on the saved setup, so changing any of
          it throws the old result away rather than leaving a "Passed" standing
          for a setup that is gone. */}
      <ConnectionTester
        key={`${active}|${JSON.stringify(saved)}|${[...secretsSet].sort().join(",")}`}
        agentLabel={activeOption?.label ?? active}
        unsavedPick={Boolean(pending)}
        disabled={saving}
        onResult={onTested}
      />

      {/* Never move a user to another agent silently: when the config asks for a
          harness we don't ship, or still carries the pre-#68 `command` key that
          nothing reads, the dialog says which agent is actually running. */}
      {(info.unknownName || info.staleCommand) && (
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>
            {info.unknownName
              ? `Your ui.config.json asks for the agent "${info.unknownName}", which this UI doesn't know, so ${info.options.find((o) => o.name === info.name)?.label ?? info.name} is running instead.`
              : `Your ui.config.json still has the old top-level "command" key. Nothing reads it — the agent above is what runs. You can delete the key; it's your file, so nothing here touches it.`}
          </span>
        </p>
      )}
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
  unsavedPick,
  disabled,
  onResult,
}: {
  agentLabel: string;
  // A provider is picked but not written yet, so the saved setup isn't the one
  // on screen and a test now would answer a question nobody asked.
  unsavedPick: boolean;
  // A save is in flight — the setup is mid-change.
  disabled: boolean;
  // Told each time the answer changes, for the guided first run's agent step
  // (#172), which can't be pressed past until this setup has answered once.
  // Nothing in the dialog itself listens.
  onResult?: (result: ConnectionTest | null) => void;
}) {
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

  const test = async () => {
    if (running || disabled || unsavedPick) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await testConnectionAction());
    } catch (e) {
      // The action doesn't throw for anything the test itself hit — this is the
      // call not getting there (the server went away mid-test). Shown the same
      // way a failure is, in the words we were given.
      setResult({ ok: false, ms: 0, output: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mt-4 border-t border-nb-ink/12 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={running || disabled || unsavedPick}
          onClick={() => void test()}
          className={`${QUIET_BTN} inline-flex shrink-0 items-center gap-1.5`}
        >
          <FiZap className="text-[13px]" aria-hidden />
          {running ? "Testing…" : "Test"}
        </button>
        <p className="text-[12px] leading-relaxed text-nb-ink-soft">
          {unsavedPick
            ? "Save the provider pick above first — Test runs the setup that is saved."
            : `Sends one tiny message through ${agentLabel} as it is saved here. On a paid provider that costs a few tokens.`}
        </p>
      </div>
      {(running || result) && <TestResult running={running} result={result} />}
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
function TestResult({ running, result }: { running: boolean; result: ConnectionTest | null }) {
  const tone = running
    ? { bg: "var(--color-nb-wash)", ink: "var(--color-nb-ink-soft)" }
    : result?.ok
      ? { bg: "var(--color-nb-mint-soft)", ink: "var(--color-nb-mint-ink)" }
      : { bg: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" };

  return (
    <div
      aria-live="polite"
      className="mt-3 rounded-[10px] border-[1.5px] border-nb-ink px-3 py-2.5"
      style={{ background: tone.bg }}
    >
      <p className="flex items-start gap-2 text-[13px] font-[700]" style={{ color: tone.ink }}>
        {running ? (
          <>
            <span
              className="mt-[5px] size-[6px] shrink-0 rounded-full bg-nb-ink-soft animate-[nbPulse_1.1s_ease-in-out_infinite]"
              aria-hidden
            />
            Running one small chat through this setup…
          </>
        ) : result?.ok ? (
          <>
            <FiCheck className="mt-[2px] shrink-0" aria-hidden />
            Passed — the agent answered in {seconds(result.ms)}.
          </>
        ) : (
          <>
            <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
            {result?.missing
              ? `Failed — the ${result.missing} command isn't on this machine.`
              : result?.timedOut
                ? `Failed — no answer after ${seconds(result?.ms ?? 0)}, so the test gave up.`
                : "Failed — the agent didn't answer."}
          </>
        )}
      </p>

      {/* The one failure with an instruction attached: name the command that
          installs the agent's CLI, so there is something to do about it. */}
      {!running && result?.install && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          Install it, then test again:{" "}
          <code className="rounded bg-nb-ink/8 px-1 py-0.5">{result.install}</code>
        </p>
      )}

      {/* The agent's own words, as they came — so they can be read, searched, or
          pasted somewhere that knows what they mean. */}
      {!running && result?.output && (
        <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-nb-ink/15 bg-nb-paper px-2.5 py-2 text-[11px] leading-relaxed text-nb-ink">
          {result.output}
        </pre>
      )}
    </div>
  );
}

// How long a test took, in the plainest form: "1.4s". Whole seconds past ten —
// nobody needs a tenth of a second on a run that slow.
function seconds(ms: number): string {
  const s = ms / 1000;
  return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
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
  const id = `harness-setting-${setting.key}`;
  const providers = setting.providers ?? [];
  const shown = providers.find((p) => p.id === value);

  return (
    <div>
      <label
        className="mb-1.5 block text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft"
        htmlFor={id}
      >
        {setting.label}
      </label>
      <Select value={value || undefined} disabled={disabled} onValueChange={onPick}>
        <SelectTrigger id={id} className="disabled:cursor-wait">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {shown && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">{shown.blurb}</p>
      )}
      {(waitingFor.length > 0 || setting.help) && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          {waitingFor.length > 0 ? (
            <strong className="text-nb-accent-deep">
              Not saved yet — fill in the {waitingFor.join(" and ")} below and this pick saves
              itself.
            </strong>
          ) : (
            setting.help
          )}
        </p>
      )}
    </div>
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
  isSet,
  disabled,
  onSave,
}: {
  setting: HarnessSetting;
  // Whether docs/kanban/.env holds this key right now — the whole of what the
  // server tells us about a saved one. A key written into that file by hand
  // shows up here the same as one typed in the dialog.
  isSet: boolean;
  disabled: boolean;
  // Saves the key, or clears it when given "". Resolves true when the file was
  // written; the error is already reported by the time it resolves false.
  onSave: (value: string) => Promise<boolean>;
}) {
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
    <div>
      <label
        className="mb-1.5 block text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft"
        htmlFor={id}
      >
        {setting.label}
      </label>
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
            className={`w-full rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait ${typed ? "[-webkit-text-security:disc]" : ""}`}
          />
          <button type="button" disabled={disabled || !typed.trim()} onClick={() => void save()} className={QUIET_BTN}>
            Save
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
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2">
          <span className="flex items-center gap-2 text-[13px] font-[700] text-nb-ink">
            <FiCheck className="shrink-0 text-nb-accent-deep" aria-hidden />
            Set — it&rsquo;s in docs/kanban/.env
          </span>
          <span className="flex items-center gap-2">
            <button type="button" disabled={disabled} onClick={() => setReplacing(true)} className={QUIET_BTN}>
              Replace
            </button>
            <button type="button" disabled={disabled} onClick={() => void onSave("")} className={QUIET_BTN}>
              Clear
            </button>
          </span>
        </div>
      )}
      <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">{setting.help}</p>
    </div>
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
  const id = `harness-setting-${setting.key}`;

  // What the list offers. A value hand-written into ui.config.json that isn't on
  // the list is added to it rather than dropped: the file is the user's, the run
  // really is getting that value, and a dropdown that fell back to its first
  // choice would say the agent's default while the run says otherwise.
  const choices = setting.choices ?? [];
  const listed = value && !choices.some((c) => c.value === value)
    ? [...choices, { value, label: `${value} (from your ui.config.json)` }]
    : choices;

  // A choice can mean "nothing saved" and carry the value "" (the reasoning
  // list's Agent's default) — but Radix refuses an empty-string item value, so
  // that choice wears this stand-in inside the select and is mapped back to ""
  // on the way out. No declared choice can collide: the values are ours, from
  // lib/agent.ts.
  const EMPTY = "—empty—";
  const toItem = (v: string) => v || EMPTY;

  return (
    <div>
      <label
        className="mb-1.5 block text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft"
        htmlFor={id}
      >
        {setting.label}
      </label>
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
          <SelectTrigger id={id} className="disabled:cursor-wait">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {listed.map((choice) => (
              <SelectItem key={choice.value} value={toItem(choice.value)}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
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
      )}
      <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
        {ignored && setting.overriddenHelp ? setting.overriddenHelp : setting.help}
      </p>
    </div>
  );
}
