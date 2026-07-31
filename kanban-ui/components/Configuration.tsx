"use client";

// The board's one configuration home (#41), opened from a quiet gear button in
// the header. It holds two things: the agent harness (which agent runs every
// card action, #68) and the global auto-refine switch. The gear replaces the old
// agent-name badge — the header doesn't grow a separate control per setting; new
// global settings (#16's other autonomy levels, later) join this same dialog.

import { useState } from "react";
import { FiAlertCircle, FiCheck, FiSettings } from "react-icons/fi";
import {
  setAutoRefineAction,
  setAutoRefineParallelismAction,
  setHarnessAction,
  setHarnessModelAction,
} from "@/app/actions";
import { type AgentInfo, type HarnessOption, MAX_PARALLEL, type SessionView } from "@/lib/types";
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
  autoRefineParallelism,
  sessions,
  onError,
}: {
  agent: AgentInfo;
  // The current auto-refine state, read on the server for the first paint. The
  // toggle owns it from here — another tab picks up a change on its next load.
  autoRefine: boolean;
  // How many cards refine at once (#88), read the same way and owned by the
  // stepper from here on.
  autoRefineParallelism: number;
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
              refiningIds={refiningCardIds(sessions)}
              onError={onError}
            />
            <ParallelismStepper initial={autoRefineParallelism} onError={onError} />
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

// The cards a refine is working on right now, in the order they started, or empty
// when none is (#51). There can be several at once (#88), so the label names each
// of them. Background runs and ones the user started from a card page (#99) both
// count: the label answers "what is being refined right now", and showing half of
// them would mislead. A running session always has a card, but the field is
// nullable (a create has no card), so a null is dropped rather than printing
// "Refining #null".
function refiningCardIds(sessions: SessionView[]): number[] {
  return sessions
    .filter((r) => r.status === "running" && r.action === "auto-refine" && r.cardId !== null)
    .map((r) => r.cardId as number);
}

// The auto-refine switch. Flips instantly and saves; on a save failure it flips
// back and reports the error where the page shows errors across its top. Off
// looks muted, on shows in the accent color.
function AutoRefineToggle({
  initial,
  refiningIds,
  onError,
}: {
  initial: boolean;
  // The cards being refined right now, whoever started the run. Shown as a small
  // label beside the switch while one is live, and nothing at all when none is —
  // the switch never carries idle text.
  refiningIds: number[];
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
          {/* Which cards a refine is on, while it is on any (#51) — background or
              user-started alike. Read-only, and gone the moment the runs end — no
              idle text, no "last refined". The pulse dot matches the running
              badge on a card. */}
          {refiningIds.length > 0 && (
            <span
              className="nb-chip"
              style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
            >
              <span
                className="size-[6px] rounded-full bg-nb-accent-deep animate-[nbPulse_1.1s_ease-in-out_infinite]"
                aria-hidden
              />
              Refining {refiningIds.map((id) => `#${id}`).join(", ")}
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
        asking you. With this off, no card is refined on its own — you can still refine one
        yourself with the <strong>Refine</strong> button on its page.
      </p>
    </div>
  );
}

// How many cards auto-refine works on at once (#88). A stepper, not a text
// field: the range is 1..MAX_PARALLEL, every value in it is one tap away, and
// there is nothing to type wrong. Each tap saves and, on a failure, steps back
// and reports the error where the switch above does. The setting saves whether
// or not auto-refine is on — it's what the next run will use, and hiding it
// behind the switch would make it look like it had been forgotten.
function ParallelismStepper({
  initial,
  onError,
}: {
  initial: number;
  onError?: (msg: string) => void;
}) {
  const [n, setN] = useState(initial);
  const [saving, setSaving] = useState(false);

  const step = async (delta: number) => {
    const next = n + delta;
    if (saving || next < 1 || next > MAX_PARALLEL) return;
    setN(next); // optimistic, like the switch
    setSaving(true);
    try {
      const res = await setAutoRefineParallelismAction(next);
      if (!res.ok) {
        setN(n); // save failed — step back
        onError?.(res.error || "couldn't save how many refine at once");
      }
    } catch (e) {
      setN(n);
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // The two ends are dead ends, not wraps: at 1 there is no minus, at the cap no
  // plus, so the range shows itself without a line of text explaining it.
  const stepBtn =
    "inline-flex size-7 cursor-pointer items-center justify-center rounded-[8px] border-[1.5px] border-nb-ink bg-nb-paper text-[16px] leading-none font-[800] text-nb-ink transition-[transform,box-shadow] duration-[120ms] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_0_var(--color-nb-ink)] active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none";

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] font-[800]">Cards at once</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="One fewer card at once"
            disabled={saving || n <= 1}
            onClick={() => step(-1)}
            className={stepBtn}
          >
            −
          </button>
          <span
            aria-live="polite"
            className="min-w-[1.25rem] text-center text-[14px] font-[800] tabular-nums"
          >
            {n}
          </span>
          <button
            type="button"
            aria-label="One more card at once"
            disabled={saving || n >= MAX_PARALLEL}
            onClick={() => step(1)}
            className={stepBtn}
          >
            +
          </button>
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
        How many cards the agent refines at the same time, each a different card. One by
        default. More is faster on a big backlog and heavier on your machine; {MAX_PARALLEL} is
        as high as it goes.
      </p>
    </div>
  );
}
