"use client";

// The spec agents, listed and switched (#191).
//
// A spec agent fills one part of a card's spec — the screen it changes, the library it
// picks — in a run of its own, while the card is being planned. They start on their own,
// so before this section there was no screen that said which ones exist or let one be
// turned off.
//
// What this section knows: nothing. The names, the two lines under each one, the settings
// an agent declares and the choices each setting offers are the board's own list, asked for
// when the section opens — so `akb spec` and this can never say different things. It reads,
// switches and sets, and that is all: an agent's prompt is not something the UI writes.

import { useEffect, useState } from "react";
import { FiAlertCircle, FiChevronDown } from "react-icons/fi";
import { setSpecAgentAction, setSpecAgentSettingAction, specAgentsAction } from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { SpecAgentSettingView, SpecAgentView } from "@/lib/types";

/** The section in the Configuration dialog. It reads the board's list when it first draws;
 *  the board's poll never carries it, and nothing else on screen shows these switches. */
export function SpecAgentsPanel({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.specAgents;
  const [agents, setAgents] = useState<SpecAgentView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // What is being saved right now, by the thing being saved: an agent's name for its
  // switch, `name/key` for one of its settings. One at a time is the normal case, but a
  // second change shouldn't wait on the first.
  const [saving, setSaving] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void specAgentsAction().then((res) => {
      if (!live) return;
      setAgents(res.agents);
      setLoadError(res.error ?? null);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // Flip one switch: on screen at once, saved behind it, and put back if the save fails.
  // The switch is the whole section, so a flip that silently didn't land would be a
  // setting the user can't trust.
  const flip = async (agent: SpecAgentView) => {
    const on = !agent.enabled;
    setAgents((all) => all?.map((a) => (a.name === agent.name ? { ...a, enabled: on } : a)) ?? all);
    setSaving((names) => [...names, agent.name]);
    try {
      const res = await setSpecAgentAction(agent.name, on);
      if (!res.ok) {
        setAgents((all) => all?.map((a) => (a.name === agent.name ? { ...a, enabled: !on } : a)) ?? all);
        onError?.(res.error || (on ? c.flipFailedOn : c.flipFailedOff)(agent.name));
      }
    } finally {
      setSaving((names) => names.filter((n) => n !== agent.name));
    }
  };

  // Pick one of an agent's settings (#257): on screen at once, saved behind it, and put
  // back if the save fails — the switch's own behaviour, for the same reason. The error
  // goes across the top of the dialog, where the section's errors already appear.
  const pick = async (agent: SpecAgentView, key: string, value: string) => {
    const was = agent.values?.[key] ?? "";
    if (value === was) return;
    const put = (v: string) =>
      setAgents(
        (all) =>
          all?.map((a) => (a.name === agent.name ? { ...a, values: { ...a.values, [key]: v } } : a)) ?? all,
      );
    const token = `${agent.name}/${key}`;
    put(value);
    setSaving((names) => [...names, token]);
    try {
      const res = await setSpecAgentSettingAction(agent.name, key, value);
      if (!res.ok) {
        put(was);
        onError?.(res.error || c.saveFailed(agent.name));
      }
    } finally {
      setSaving((names) => names.filter((n) => n !== token));
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">{c.title}</h3>
        <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-nb-ink-soft">{c.blurb}</p>
      </div>

      {loadError && <Note text={loadError} />}
      {!loaded && <Loading text={c.loading} />}
      {loaded && !loadError && agents === null && <Note text={c.tooOld} />}

      {agents && (
        <div className="border-y border-nb-ink/12">
          {agents.map((agent) => {
            const off = !agent.enabled;
            const busy = saving.includes(agent.name);
            return (
              <article
                key={agent.name}
                className="border-b border-nb-ink/12 py-4 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className={`text-[14px] font-[800] ${off ? "text-nb-ink-soft" : "text-nb-ink"}`}>
                      {agentTitle(agent.name)}
                    </h4>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-[11px] font-[700] leading-none text-nb-ink-soft">
                      {agent.enabled ? c.enabled : c.paused}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={agent.enabled}
                      aria-label={(agent.enabled ? c.switchOn : c.switchOff)(agentTitle(agent.name))}
                      disabled={busy}
                      onClick={() => void flip(agent)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-nb-ink transition-[background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent disabled:cursor-wait disabled:opacity-50 ${
                        agent.enabled ? "bg-nb-accent" : "bg-nb-wash"
                      }`}
                    >
                      <span
                        className={`inline-block size-[16px] rounded-full border border-nb-ink bg-nb-paper transition-transform duration-150 ${
                          agent.enabled ? "translate-x-[22px]" : "translate-x-[3px]"
                        }`}
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>

                <dl className={`mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px] leading-relaxed ${off ? "text-nb-ink-soft" : ""}`}>
                  <dt className="font-[700] text-nb-ink-soft">{c.contributes}</dt>
                  <dd className="text-nb-ink-soft">{sentence(agent.owns)}</dd>
                  <dt className="font-[700] text-nb-ink-soft">{c.runsWhen}</dt>
                  <dd className="text-nb-ink-soft">{sentence(agent.calledOn.replace(/^called on\s+/i, ""))}</dd>
                </dl>

                {/* What this agent is set to (#257). One line per setting, on the row
                    itself, so nothing has to be opened to read the answer or to change
                    it. An agent that declares none draws nothing here, and so does a
                    board reading rules older than the settings — its rows look exactly
                    as they did. */}
                {agent.settings?.length ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {agent.settings.map((setting) => (
                      <SettingLine
                        key={setting.key}
                        setting={setting}
                        value={agent.values?.[setting.key] ?? setting.default}
                        off={off}
                        busy={saving.includes(`${agent.name}/${setting.key}`)}
                        onPick={(value) => void pick(agent, setting.key, value)}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One setting on an agent's row: a line saying what it is set to and what that choice
// costs, and a Change that opens the choices in place.
//
// Folded by default, because the answer is the thing worth reading and the pane is a list
// of agents, not a form. Open, every choice says its own cost in the agent's own words, so
// a pick is made by comparing rather than by trying one.
//
// A switched-off agent keeps its line, greyed with the rest of the row and still working:
// setting an agent you have paused is how it is ready for the day you switch it back on.
function SettingLine({
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
  const copy = useCopy().configuration.specAgents;
  const [open, setOpen] = useState(false);
  const picked = setting.choices.find((c) => c.value === value);
  const shown = picked?.label ?? value;

  return (
    <div
      className={`rounded-[10px] border border-nb-ink/22 bg-nb-wash px-3 py-2 ${off ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Closed, the line carries the cost too — that is the whole answer, and it wraps
            rather than trailing off in an ellipsis. Open, the cost is dropped: every
            choice below says its own, and repeating the picked one says it twice. */}
        <p className={`min-w-0 text-[12px] leading-relaxed text-nb-ink-soft [&_strong]:font-[700] ${off ? "[&_strong]:text-nb-ink-soft" : "[&_strong]:text-nb-ink"}`}>
          <Rich>
            {!open && picked?.cost
              ? copy.settingWithCost(setting.label, shown, picked.cost)
              : copy.setting(setting.label, shown)}
          </Rich>
        </p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-[1px] text-[12px] font-[700] text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
        >
          {copy.change}
          <FiChevronDown
            aria-hidden
            className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div
          role="radiogroup"
          aria-label={setting.label}
          className="mt-2.5 flex flex-col gap-1 border-t border-nb-ink/14 pt-2.5"
        >
          {setting.choices.map((choice) => {
            const on = choice.value === value;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={busy}
                onClick={() => onPick(choice.value)}
                className="flex cursor-pointer items-start gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-100 hover:bg-nb-ink/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-wait disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className={`mt-[3px] flex size-[13px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-nb-ink ${
                    on ? "bg-nb-accent" : "bg-nb-paper"
                  }`}
                >
                  {on && <span className="size-[4px] rounded-full bg-nb-paper" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[12px] ${on ? "font-[800] text-nb-ink" : "font-[700] text-nb-ink"}`}>
                    {choice.label}
                  </span>
                  <span className="block text-[12px] leading-relaxed text-nb-ink-soft">{choice.cost}</span>
                </span>
              </button>
            );
          })}
          {setting.help && (
            <p className="mt-1 px-2 text-[12px] leading-relaxed text-nb-ink-soft">{setting.help}</p>
          )}
        </div>
      )}
    </div>
  );
}

function agentTitle(name: string): string {
  const words = name.split("-");
  return words.map((word, index) => (index === 0 ? sentenceStart(displayWord(word)) : displayWord(word))).join(" ");
}

function displayWord(word: string): string {
  return word.toLowerCase() === "ui" ? "UI" : word;
}

function sentence(text: string): string {
  const value = sentenceStart(text.trim());
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function sentenceStart(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function Loading({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-[12px] text-nb-ink-soft" aria-live="polite">
      <span className="size-1.5 rounded-full bg-nb-ink-soft animate-[nbPulse_1.1s_ease-in-out_infinite]" aria-hidden />
      {text}
    </p>
  );
}

// The one line this section says when it has no list to draw.
function Note({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
      <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
