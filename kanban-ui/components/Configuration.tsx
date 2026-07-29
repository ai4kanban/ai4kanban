"use client";

// The board's one configuration home (#41), opened from a quiet gear button in
// the header. It holds two things: the agent harness (which agent runs every
// card action, #68) and the global auto-refine switch. The gear replaces the old
// agent-name badge — the header doesn't grow a separate control per setting; new
// global settings (#16's other autonomy levels, later) join this same dialog.

import { useState } from "react";
import { FiAlertCircle, FiCheck, FiSettings } from "react-icons/fi";
import { setAutoRefineAction, setHarnessAction, setHarnessModelAction } from "@/app/actions";
import type { AgentInfo, HarnessOption, SessionView } from "@/lib/types";
import { Dialog } from "./Dialog";

// A harness's mark, e.g. the Claude sunburst at public/agents/claude.svg.
// alt="" because the agent name always sits right next to it.
function AgentMark({ src, size }: { src: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} style={{ flex: "0 0 auto" }} />;
}

export function Configuration({
  agent,
  autoRefine,
  sessions,
  onError,
}: {
  agent: AgentInfo;
  // The current auto-refine state, read on the server for the first paint. The
  // toggle owns it from here — another tab picks up a change on its next load.
  autoRefine: boolean;
  // The registry list the page already polls, passed down rather than polled
  // again here (#51): it's the only thing that knows a background refine is
  // running, and the dialog is not worth a second loop.
  sessions: SessionView[];
  // Save failures surface where the page already shows errors, across its top.
  onError?: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Ghost sticker button (design.md .nb-cta-ghost), a matched pair with the
          header's Sessions button: same 36px frame, solid ink border, hard offset
          shadow and press-down — the quiet siblings of the accent Create CTA. Now
          a gear (settings) icon: it opens the Configuration dialog, not a badge. */}
      <button
        type="button"
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] border-[1.5px] border-nb-ink bg-nb-paper text-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)] transition-[transform,box-shadow] duration-[120ms] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--color-nb-ink)] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_0_var(--color-nb-ink)]"
        title="Configuration"
        aria-label="Configuration"
        onClick={() => setOpen(true)}
      >
        <FiSettings className="text-[16px]" aria-hidden />
      </button>

      {open && (
        <Dialog title="Configuration" onClose={() => setOpen(false)}>
          {/* The agent harness — pick which agent runs every card action (#68). */}
          <span className="mb-2 block text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">
            Agent
          </span>
          <HarnessPicker agent={agent} onError={onError} />

          {/* Auto-refine — the global switch that gates the whole feature (#41). */}
          <div className="mt-5 border-t border-nb-ink/12 pt-4">
            <AutoRefineToggle
              initial={autoRefine}
              refiningId={refiningCardId(sessions)}
              onError={onError}
            />
          </div>
        </Dialog>
      )}
    </>
  );
}

// The harness picker: one row per agent we can run, the active one framed in
// ember with an "Active" chip, and under them the model that agent runs with
// (#71). Clicking a row saves that harness's name to docs/kanban/ui.config.json
// — nothing else changes, and a running session keeps the harness it started
// under. Selecting optimistically and reverting on a failed save, like the
// auto-refine switch.
function HarnessPicker({ agent, onError }: { agent: AgentInfo; onError?: (msg: string) => void }) {
  const [active, setActive] = useState(agent.name);
  const [saving, setSaving] = useState(false);
  // The model field, and the id last written to the file. Two pieces of state:
  // the field is free text the user can be halfway through typing, and only a
  // save makes it the setting.
  const [model, setModel] = useState(agent.model);
  const [savedModel, setSavedModel] = useState(agent.model);
  // The `harness.command` override already names a model flag, so the field
  // below isn't in effect. Switching agents drops that override, so the note
  // goes with it.
  const [modelIgnored, setModelIgnored] = useState(agent.modelIgnored);

  const pick = async (option: HarnessOption) => {
    if (saving || option.name === active) return;
    const prev = active;
    const prevModel = { text: model, saved: savedModel, ignored: modelIgnored };
    setActive(option.name);
    // The model belongs to the agent it was written for — `claude-opus-5` means
    // nothing to another agent — so switching clears the field, matching what
    // the server just wrote.
    setModel("");
    setSavedModel("");
    setModelIgnored(false);
    setSaving(true);
    try {
      const res = await setHarnessAction(option.name);
      if (!res.ok) {
        setActive(prev);
        setModel(prevModel.text);
        setSavedModel(prevModel.saved);
        setModelIgnored(prevModel.ignored);
        onError?.(res.error || "couldn't save the agent setting");
      }
    } catch (e) {
      setActive(prev);
      setModel(prevModel.text);
      setSavedModel(prevModel.saved);
      setModelIgnored(prevModel.ignored);
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Save the model on blur and on Enter, never on a keystroke — a model id is
  // typed a character at a time, and a write per character would be a write per
  // character into the user's config file. An unchanged field saves nothing.
  const saveModel = async () => {
    const next = model.trim();
    if (saving || next === savedModel) return;
    setSaving(true);
    try {
      const res = await setHarnessModelAction(next);
      if (res.ok) {
        setModel(next);
        setSavedModel(next);
      } else {
        setModel(savedModel);
        onError?.(res.error || "couldn't save the model setting");
      }
    } catch (e) {
      setModel(savedModel);
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // What the active row says under its name. A hand-edited `harness.command`
  // override is the one thing worth showing here — it's what actually runs, and
  // it's invisible otherwise.
  const overridden = agent.command !== agent.options.find((o) => o.name === agent.name)?.command;

  return (
    <div className="flex flex-col gap-2">
      {agent.options.map((option) => {
        const on = option.name === active;
        return (
          <button
            key={option.name}
            type="button"
            aria-pressed={on}
            disabled={saving}
            onClick={() => pick(option)}
            className="nb-outline flex w-full cursor-pointer items-center justify-between bg-nb-paper px-4 py-3 text-left disabled:cursor-wait"
            style={{
              borderColor: on
                ? "var(--color-nb-accent-deep)"
                : "color-mix(in srgb, var(--color-nb-ink) 22%, transparent)",
            }}
          >
            <span className="flex items-center gap-3">
              <span
                className="flex items-center justify-center rounded-[9px]"
                style={{
                  width: 34,
                  height: 34,
                  background: on ? "var(--color-nb-accent-soft)" : "var(--color-nb-wash)",
                }}
              >
                <AgentMark src={option.icon} size={19} />
              </span>
              <span>
                <span className="block text-[14px] font-[800]">{option.label}</span>
                <span className="block text-[12px] text-nb-ink-soft">
                  {on && overridden ? <code>{agent.command}</code> : option.blurb}
                </span>
              </span>
            </span>
            {on && (
              <span
                className="nb-chip"
                style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
              >
                <FiCheck aria-hidden style={{ width: 11, height: 11 }} />
                Active
              </span>
            )}
          </button>
        );
      })}

      {/* The model that agent runs with (#71). Free text, not a dropdown: model
          ids change between agent releases, and a stale list would block a model
          the agent already runs. */}
      <div className="mt-1">
        <label
          className="mb-1.5 block text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft"
          htmlFor="harness-model"
        >
          Model
        </label>
        <input
          id="harness-model"
          type="text"
          value={model}
          disabled={saving}
          placeholder="claude-opus-5"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setModel(e.target.value)}
          onBlur={saveModel}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait"
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          {modelIgnored
            ? `Not in effect: your ui.config.json's "harness.command" already names a model, and that wins.`
            : "Leave it empty to run the agent's own default. The id isn't checked here — a wrong one fails the run, and the log says why."}
        </p>
      </div>

      {/* Never move a user to another agent silently: when the config asks for a
          harness we don't ship, or still carries the pre-#68 `command` key that
          nothing reads, the dialog says which agent is actually running. */}
      {(agent.unknownName || agent.staleCommand) && (
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>
            {agent.unknownName
              ? `Your ui.config.json asks for the agent "${agent.unknownName}", which this UI doesn't know, so ${agent.options.find((o) => o.name === agent.name)?.label ?? agent.name} is running instead.`
              : `Your ui.config.json still has the old top-level "command" key. Nothing reads it — the agent above is what runs. You can delete the key; it's your file, so nothing here touches it.`}
          </span>
        </p>
      )}
    </div>
  );
}

// The card a background refine is working on right now, or null when none is
// (#51). The dispatcher runs one auto-refine at a time, so the first live one is
// the one. A running session always has a card, but the field is nullable (a
// create has no card), so a null is treated as nothing to show rather than
// printing "Refining #null".
function refiningCardId(sessions: SessionView[]): number | null {
  const live = sessions.find((r) => r.status === "running" && r.action === "auto-refine");
  return live?.cardId ?? null;
}

// The auto-refine switch. Flips instantly and saves; on a save failure it flips
// back and reports the error where the page shows errors across its top. Off
// looks muted, on shows in the accent color.
function AutoRefineToggle({
  initial,
  refiningId,
  onError,
}: {
  initial: boolean;
  // The card being refined right now, or null. Shown as a small label beside the
  // switch while a run is live, and nothing at all when none is — the switch
  // never carries idle text.
  refiningId: number | null;
  onError?: (msg: string) => void;
}) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    if (saving) return;
    const next = !on;
    setOn(next); // optimistic — the switch responds right away
    setSaving(true);
    try {
      const res = await setAutoRefineAction(next);
      if (!res.ok) {
        setOn(!next); // save failed — flip back
        onError?.(res.error || "couldn't save the auto-refine setting");
      }
    } catch (e) {
      setOn(!next);
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-[800]">Auto-refine</span>
          {/* Which card the background refine is on, while it is on one (#51).
              Read-only, and gone the moment the run ends — no idle text, no
              "last refined". The pulse dot matches the running badge on a card. */}
          {refiningId !== null && (
            <span
              className="nb-chip"
              style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
            >
              <span
                className="size-[6px] rounded-full bg-nb-accent-deep animate-[nbPulse_1.1s_ease-in-out_infinite]"
                aria-hidden
              />
              Refining #{refiningId}
            </span>
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Auto-refine"
          disabled={saving}
          onClick={toggle}
          className={`relative cursor-pointer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-[1.5px] border-nb-ink transition-colors duration-150 disabled:opacity-60 ${
            on ? "bg-nb-accent" : "bg-nb-wash"
          }`}
        >
          <span
            className={`inline-block size-[16px] rounded-full border border-nb-ink bg-nb-paper transition-transform duration-150 ${
              on ? "translate-x-[22px]" : "translate-x-[3px]"
            }`}
            aria-hidden
          />
        </button>
      </div>
      {/* The dialog has room, so what "on" means is an inline caption, not a
          hover-only title. No confirmation popup — auto-refine only ever
          auto-answers questions it is sure about. */}
      <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
        The agent refines cards in the background and answers its own safe questions without
        asking you. Refine only ever happens here — with this off, no card is refined.
      </p>
    </div>
  );
}
