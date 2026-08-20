"use client";

// The spec agents, listed and switched (#191).
//
// A spec agent fills one part of a card's spec — the screen it changes, the library it
// picks — in a run of its own, while the card is being planned. They start on their own,
// so before this section there was no screen that said which ones exist or let one be
// turned off.
//
// What this section knows: nothing. The names, the two lines under each one and the order
// they come in are the board's own list, asked for when the section opens — so `akb spec`
// and this can never say different things. It reads and switches, and that is all: an
// agent's prompt is not something the UI writes.

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { setSpecAgentAction, specAgentsAction } from "@/app/actions";
import type { SpecAgentView } from "@/lib/types";

/** The section in the Configuration dialog. It reads the board's list when it first draws;
 *  the board's poll never carries it, and nothing else on screen shows these switches. */
export function SpecAgentsPanel({ onError }: { onError?: (msg: string) => void }) {
  const [agents, setAgents] = useState<SpecAgentView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The names whose switch is being saved right now — one at a time is the normal case,
  // but a second flip shouldn't wait on the first.
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
        onError?.(res.error || `couldn't switch ${agent.name} ${on ? "on" : "off"}`);
      }
    } finally {
      setSaving((names) => names.filter((n) => n !== agent.name));
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">Spec agents</h3>
        <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-nb-ink-soft">
          Choose which specialists may add focused recommendations while a card is being
          planned. They never run while a card is being built.
        </p>
      </div>

      {loadError && <Note text={loadError} />}
      {!loaded && <Loading />}
      {loaded && !loadError && agents === null && (
        <Note text="The board's rules in this project are too old to list the spec agents. Update the command and reopen this dialog." />
      )}

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
                      {agent.enabled ? "Enabled" : "Paused"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={agent.enabled}
                      aria-label={`${agentTitle(agent.name)} — ${agent.enabled ? "enabled" : "paused"}`}
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
                  <dt className="font-[700] text-nb-ink-soft">Contributes</dt>
                  <dd className="text-nb-ink-soft">{sentence(agent.owns)}</dd>
                  <dt className="font-[700] text-nb-ink-soft">Runs when</dt>
                  <dd className="text-nb-ink-soft">{sentence(agent.calledOn.replace(/^called on\s+/i, ""))}</dd>
                </dl>
              </article>
            );
          })}
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

function Loading() {
  return (
    <p className="flex items-center gap-2 text-[12px] text-nb-ink-soft" aria-live="polite">
      <span className="size-1.5 rounded-full bg-nb-ink-soft animate-[nbPulse_1.1s_ease-in-out_infinite]" aria-hidden />
      Loading spec agents…
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
