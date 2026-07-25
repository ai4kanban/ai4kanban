"use client";

// The board's one configuration home (#41), opened from a quiet gear button in
// the header. It holds two things: the agent connector (which agent runs every
// card action) and the global auto-refine switch. The gear replaces the old
// agent-name badge — the header doesn't grow a separate control per setting; new
// global settings (#16's other autonomy levels, later) join this same dialog.

import { useState } from "react";
import { FiCheck, FiSettings } from "react-icons/fi";
import { setAutoRefineAction } from "@/app/actions";
import type { AgentInfo } from "@/lib/types";
import { Dialog } from "./Dialog";

// The official Claude sunburst mark (public/agents/claude.svg). alt="" because
// the agent name always sits right next to it.
function ClaudeMark({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/agents/claude.svg" alt="" width={size} height={size} style={{ flex: "0 0 auto" }} />;
}

export function Configuration({
  agent,
  autoRefine,
  onError,
}: {
  agent: AgentInfo;
  // The current auto-refine state, read on the server for the first paint. The
  // toggle owns it from here — another tab picks up a change on its next load.
  autoRefine: boolean;
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
          {/* The agent connector — the active agent that runs every card action. */}
          <span className="mb-2 block text-[11px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">
            Agent
          </span>
          <div
            className="nb-outline flex items-center justify-between bg-nb-paper px-4 py-3"
            style={{ borderColor: "var(--color-nb-accent-deep)" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex items-center justify-center rounded-[9px]"
                style={{ width: 34, height: 34, background: "var(--color-nb-accent-soft)" }}
              >
                <ClaudeMark size={19} />
              </span>
              <div>
                <div className="text-[14px] font-[800]">{agent.name}</div>
                <div className="text-[12px] text-nb-ink-soft">Subscription plan</div>
              </div>
            </div>
            <span
              className="nb-chip"
              style={{ background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }}
            >
              <FiCheck aria-hidden style={{ width: 11, height: 11 }} />
              Active
            </span>
          </div>

          {/* Placeholder — more agents are on the way. */}
          <div
            className="mt-2 flex items-center justify-center rounded-[14px] px-4 py-3 text-[12px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft"
            style={{ border: "1.5px dashed color-mix(in srgb, var(--color-nb-ink) 22%, transparent)" }}
          >
            More agents are coming
          </div>

          {/* Auto-refine — the global switch that gates the whole feature (#41). */}
          <div className="mt-5 border-t border-nb-ink/12 pt-4">
            <AutoRefineToggle initial={autoRefine} onError={onError} />
          </div>
        </Dialog>
      )}
    </>
  );
}

// The auto-refine switch. Flips instantly and saves; on a save failure it flips
// back and reports the error where the page shows errors across its top. Off
// looks muted, on shows in the accent color.
function AutoRefineToggle({
  initial,
  onError,
}: {
  initial: boolean;
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
        <span className="text-[14px] font-[800]">Auto-refine</span>
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
