"use client";

// Flow rules: one rule, in your own words, on any flow the board can start (#306).
//
// A flow's instructions ship inside the command, so a convention a project depends on —
// run these tests, install dependencies this way — had nowhere to live. A rule is plain
// words added to the end of one flow's instructions. Every session the board starts from
// that flow reads it.
//
// Layout B: a narrow column naming every flow with a dot on the ones in use, and the rest
// of the pane one tall box for whichever is picked — the roomiest place in the dialog to
// write a paragraph.
//
// What this pane knows: nothing. Which flows exist, what each one is, and what a flow's
// rule is for are the board's own list, asked for when the pane opens — so a flow shipped
// later appears here with nothing in this file touched.

import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheck } from "react-icons/fi";
import { flowRulesAction, setFlowRuleAction } from "@/app/actions";
import type { FlowRuleView } from "@/lib/types";

export function FlowRulesPanel({ onError }: { onError?: (msg: string) => void }) {
  const [flows, setFlows] = useState<FlowRuleView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Which flow's box is on screen. The pane opens on the first flow — `implement`, the one
  // its rule has the most to say about — and the pick is not remembered between openings,
  // the same way the dialog itself reopens on Harness.
  const [picked, setPicked] = useState("");
  // What each box holds right now, so switching flows never loses an edit that has not
  // been saved yet. Seeded from the board and kept as the user types, which is also what
  // the dots and the count read — a rule reads as set the moment it says something.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // The flow whose rule was saved last, for the quiet `Saved` beside its name. Cleared the
  // moment that box is typed in again.
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let live = true;
    void flowRulesAction().then((res) => {
      if (!live) return;
      setFlows(res.flows);
      setLoadError(res.error ?? null);
      setLoaded(true);
      if (res.flows?.length) {
        setPicked(res.flows[0].command);
        setDrafts(Object.fromEntries(res.flows.map((flow) => [flow.command, flow.rule])));
      }
    });
    return () => {
      live = false;
    };
  }, []);

  // Save one flow's rule — per flow, no pane-wide Save button, matching Harness, Spec
  // agents and Auto-delivery. Unchanged text writes nothing, so calling it twice for one
  // edit is free. A rule is free text, so there is no invalid state to draw: a save that
  // does not land goes to the dialog's error strip, like every other pane's.
  //
  // It reads the boxes off a ref rather than off the render it was made in, because the
  // callers below outlive that render — one of them fires as the pane is coming apart.
  const latest = useRef({ flows, drafts, onError });
  latest.current = { flows, drafts, onError };
  const save = useRef(async (command: string) => {
    const box = latest.current;
    const flow = box.flows?.find((f) => f.command === command);
    if (!flow) return;
    const rule = (box.drafts[command] ?? "").trim();
    if (rule === flow.rule) return;
    setSaving(true);
    try {
      const res = await setFlowRuleAction(command, rule);
      if (!res.ok) {
        box.onError?.(res.error || `couldn't save the ${command} rule`);
        return;
      }
      setFlows((all) => all?.map((f) => (f.command === command ? { ...f, rule } : f)) ?? all);
      setSaved(command);
    } finally {
      setSaving(false);
    }
  });

  // Save the box being left, whether or not a blur comes: picking another flow blurs it,
  // but closing the dialog takes it off screen with the caret still in it.
  useEffect(() => {
    if (!picked) return;
    const write = save.current;
    return () => {
      void write(picked);
    };
  }, [picked]);

  const flow = flows?.find((f) => f.command === picked);
  const inUse = flows?.filter((f) => (drafts[f.command] ?? "").trim()).length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0">
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">Flow rules</h3>
        <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-nb-ink-soft">
          One rule, in your own words, added to the end of a flow&apos;s instructions. Every
          session the board starts from that flow reads it — so a long rule makes every card
          slower.
        </p>
      </div>

      {loadError && <Note text={loadError} />}
      {!loaded && <Loading />}
      {loaded && !loadError && flows === null && (
        <Note text="The board's rules in this project are too old to carry flow rules. Update the command and reopen this dialog." />
      )}

      {flows && flow && (
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Every flow the board has, the ones in use dotted. This column is what
              scrolls; the box beside it never does. */}
          <div className="flex w-[136px] shrink-0 flex-col">
            <p className="mb-1.5 text-[10.5px] font-[800] uppercase tracking-[0.1em] text-nb-ink-soft">
              {inUse} of {flows.length} set
            </p>
            <div
              role="tablist"
              aria-label="Flows"
              aria-orientation="vertical"
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {flows.map((f) => {
                const on = f.command === picked;
                const set = Boolean((drafts[f.command] ?? "").trim());
                return (
                  <button
                    key={f.command}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setPicked(f.command)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2 py-[3px] text-left transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent ${
                      on ? "bg-nb-accent-soft" : "hover:bg-nb-ink/5"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`inline-block size-[7px] shrink-0 rounded-full ${
                        set ? "bg-nb-accent" : "border-[1.5px] border-nb-ink-soft/50"
                      }`}
                    />
                    <span
                      className={`truncate font-mono text-[12px] font-[700] ${
                        on ? "text-nb-accent-deep" : set ? "text-nb-ink" : "text-nb-ink-soft"
                      }`}
                    >
                      {f.command}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* The one box, for whichever flow is picked. */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* What this box changes: the command that starts the flow, and one clause of
                plain words — `correct`, `plan-release` and `run` name nothing a user can
                guess at. */}
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="font-mono text-[13px] font-[800] text-nb-ink">{flow.command}</span>
              <span className="min-w-0 text-[11.5px] leading-[16px] text-nb-ink-soft">{flow.gloss}</span>
              {saved === flow.command && !saving && (
                <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-[700] text-nb-mint-ink">
                  <FiCheck aria-hidden />
                  Saved
                </span>
              )}
            </div>

            <textarea
              key={flow.command}
              value={drafts[flow.command] ?? ""}
              onChange={(e) => {
                const text = e.target.value;
                setDrafts((all) => ({ ...all, [flow.command]: text }));
                setSaved("");
              }}
              onBlur={() => void save.current(flow.command)}
              spellCheck={false}
              aria-label={`Rule for the ${flow.command} flow`}
              placeholder={`No rule. Every \`${flow.command}\` run reads exactly what the board ships.`}
              className="min-h-0 flex-1 resize-none rounded-[12px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2.5 text-[12.5px] leading-[20px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
            />

            {/* What this flow's rule is for, or what it can cost — read beside the flow it
                belongs to rather than in a warning met before the user knows which flow
                they want. Most flows have nothing particular to say and show no line. */}
            {flow.note && (
              <p className="mt-2 text-[11.5px] leading-[17px] text-nb-ink-soft">{flow.note}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <p className="flex items-center gap-2 text-[12px] text-nb-ink-soft" aria-live="polite">
      <span className="size-1.5 rounded-full bg-nb-ink-soft animate-[nbPulse_1.1s_ease-in-out_infinite]" aria-hidden />
      Loading flows…
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
