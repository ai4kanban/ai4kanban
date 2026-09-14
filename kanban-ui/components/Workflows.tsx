"use client";

// Configuration → Workflows (#715).
//
// Every card on this board goes through one workflow: `plan → execute → review`. A workflow
// says WHO runs each of the three and who they may call in — nothing about the order, and
// nothing about what any of them is. The agents themselves are defined one section down, in
// Workflow agents; here they are only assigned.
//
// The list on the left is always drawn, even with one workflow on it: a pane that changes
// shape when a second workflow appears is a pane nobody can learn. Naming happens in that
// list, in a box with no buttons — a valid name saves when it loses focus, an empty one
// takes the row away again.
//
// What this pane knows about an agent is its name, its line and the stage it declares. Which
// agents can take a stage is the board's answer, asked for with the rest; so is every
// refusal. Nothing here has a copy of those rules.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiChevronDown,
  FiMoreHorizontal,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  cardsOnWorkflowAction,
  createWorkflowAction,
  deleteWorkflowAction,
  duplicateWorkflowAction,
  renameWorkflowAction,
  setWorkflowStageAction,
  workflowsAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { spellAgent } from "@/lib/agent-name";
import { WORKFLOW_STAGES } from "@/lib/types";
import type { WorkflowCandidate, WorkflowStage, WorkflowStageView, WorkflowView } from "@/lib/types";
import { Character } from "./Agents";
import { CAPTION, CONTROL, DANGER_BTN, FLAT_CONTROL, Loading, Note, QUIET_BTN } from "./settings";

/** What one workflow is called here. A built-in's name is the command's own English, so
 *  every language says it in its own words — the same rule a role's name follows; one this
 *  board added is the user's own words and is drawn exactly as they typed it. */
export function useWorkflowName(): (flow: { id: string; name: string; builtIn: boolean }) => string {
  const names = useCopy().configuration.workflows.builtInNames;
  return useCallback(
    (flow) => (flow.builtIn ? (names[flow.id as keyof typeof names] ?? flow.name) : flow.name),
    [names],
  );
}

/** Where the pane is, so a trip to Workflow agents and back lands on the same stage of the
 *  same workflow with the same thing selected. Held by the dialog rather than here, because
 *  the pane itself is unmounted while the other section is open. */
export interface WorkflowSpot {
  workflow: string;
  stage: WorkflowStage;
  /** Which picker was open when the trip started, so the same one reopens. */
  picking?: "lead" | "helper";
  /** The helper whose extra requirements were open. */
  helper?: string;
}

export function WorkflowsPanel({
  spot,
  onSpot,
  onManage,
  onError,
}: {
  /** Where to open, when coming back from Workflow agents. */
  spot?: WorkflowSpot;
  /** Taken whenever the pane moves, so the dialog can bring it back here. */
  onSpot?: (spot: WorkflowSpot) => void;
  /** Cross to Workflow agents, preselecting the stage being assigned. */
  onManage?: (stage: WorkflowStage) => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.workflows;
  const nameOf = useWorkflowName();
  const agentName = useCandidateName();
  const [flows, setFlows] = useState<WorkflowView[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState(spot?.workflow ?? "");
  const [stage, setStage] = useState<WorkflowStage>(spot?.stage ?? "plan");
  // The name box in the list, when one is open: which workflow it renames (empty on a
  // workflow just added, which is the same box).
  const [naming, setNaming] = useState<{ id: string; text: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState<"lead" | "helper" | null>(spot?.picking ?? null);
  const [helper, setHelper] = useState(spot?.helper ?? "");
  // What the extra-requirements box holds right now, by `<workflow>/<stage>/<agent>`, so
  // switching helpers never loses an edit that has not been saved yet.
  const [extras, setExtras] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await workflowsAction();
    setFlows(res.workflows);
    setLoadError(res.error ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Open on the first workflow, which on every board is the one new cards start on. Runs
  // again when a delete leaves nothing selected.
  useEffect(() => {
    if (!flows?.length) return;
    if (picked && flows.some((f) => f.id === picked)) return;
    setPicked(flows[0]!.id);
  }, [flows, picked]);

  // Say where the pane is, every time it moves. The dialog keeps it so a trip to Workflow
  // agents can come straight back — including the picker that was open and the helper whose
  // requirements were showing.
  useEffect(() => {
    if (!picked) return;
    onSpot?.({ workflow: picked, stage, ...(picking ? { picking } : {}), ...(helper ? { helper } : {}) });
  }, [picked, stage, picking, helper, onSpot]);

  const flow = flows?.find((f) => f.id === picked);
  const setup = flow?.stages.find((s) => s.stage === stage);

  const refused = (res: { ok: boolean; error?: string }): boolean => {
    if (res.ok) return false;
    onError?.(res.error || c.saveFailed);
    return true;
  };

  // Every write redraws from the board's own answer rather than patching what is on screen:
  // a stage carries a lead, its helpers and what each assignment asks for, and the board is
  // the only thing that knows what a change left behind.
  const write = async (res: Promise<{ ok: boolean; error?: string }>): Promise<boolean> => {
    const done = await res;
    if (refused(done)) return false;
    await load();
    return true;
  };

  const move = (
    to: WorkflowStage,
    m: Parameters<typeof setWorkflowStageAction>[2],
  ): Promise<boolean> => write(setWorkflowStageAction(picked, to, m));

  // Adding a workflow opens the name box on a row that is already real: the board allocates
  // the id, and an empty name takes the row straight back off. The alternative — a box that
  // holds an unnamed nothing — cannot show the three empty stages beside it.
  const add = async () => {
    const res = await createWorkflowAction(newName(flows ?? [], c.add));
    if (refused(res)) return;
    await load();
    setPicked(res.id!);
    setNaming({ id: res.id!, text: res.name ?? "" });
  };

  // Named in the words the list draws it in: a built-in's own name is the English the
  // command ships, so a copy taking that would sit in the list in another language.
  const duplicate = async () => {
    setMenu(false);
    const res = await duplicateWorkflowAction(picked, flow ? nameOf(flow) : undefined);
    if (refused(res)) return;
    await load();
    setPicked(res.id!);
    setNaming({ id: res.id!, text: res.name ?? "" });
  };

  // The box has no buttons: losing focus is the save. A valid name is written, an empty one
  // takes a just-added workflow away and is refused on one that was already there — the
  // board owns that second rule, so a name that would delete an existing workflow is simply
  // put back.
  const nameBlur = async () => {
    const box = naming;
    if (!box) return;
    setNaming(null);
    const wanted = box.text.trim();
    const was = flows?.find((f) => f.id === box.id);
    // An empty name IS the delete, with nothing asked and no draft kept: a workflow just
    // added goes straight back off the list, and one that was already there is dropped the
    // same way. The board refuses a delete an open card still depends on, and the redraw
    // puts the name back.
    if (!wanted) {
      const gone = await deleteWorkflowAction(box.id);
      if (!gone.ok) {
        await load();
        return void refused(gone);
      }
      setPicked("");
      await load();
      return;
    }
    if (was && wanted === was.name) return;
    const res = await renameWorkflowAction(box.id, wanted);
    if (!res.ok) {
      // Keep what was typed, in place, so the clash is fixed where it was made.
      setNaming({ ...box, text: wanted });
      return void refused(res);
    }
    await load();
  };

  const remove = async () => {
    setMenu(false);
    const gone = await deleteWorkflowAction(picked);
    if (refused(gone)) return;
    setPicked("");
    await load();
  };

  const extraKey = (agent: string) => `${picked}/${stage}/${agent}`;
  const extraOf = (agent: string): string =>
    extras[extraKey(agent)] ?? setup?.helpers.find((h) => h.agent === agent)?.extra ?? "";

  const saveExtra = async (agent: string) => {
    const text = extras[extraKey(agent)];
    if (text === undefined) return;
    const was = setup?.helpers.find((h) => h.agent === agent)?.extra ?? "";
    if (text === was) return;
    await move(stage, { kind: "extra", agent, extra: text });
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      {loadError && <Note icon={<FiAlertCircle />}>{loadError}</Note>}
      {!loaded && <Loading>{c.loading}</Loading>}
      {loaded && !loadError && flows === null && <Note icon={<FiAlertCircle />}>{c.tooOld}</Note>}

      {flows && (
        <div className="flex flex-1 items-start gap-6 max-sm:flex-col max-sm:gap-4">
          <div className="w-[190px] shrink-0 border-r border-nb-ink/10 pr-5 max-sm:w-full max-sm:border-r-0 max-sm:border-b max-sm:pr-0 max-sm:pb-4">
            <div className={`${CAPTION} mb-3 text-nb-ink-soft`}>{c.title}</div>
            <div className="max-h-[420px] overflow-y-auto">
              {flows.map((f) =>
                naming?.id === f.id ? (
                  <NameBox
                    key={f.id}
                    label={c.nameLabel}
                    placeholder={c.namePlaceholder}
                    value={naming.text}
                    onChange={(text) => setNaming({ ...naming, text })}
                    onBlur={() => void nameBlur()}
                  />
                ) : (
                  <button
                    key={f.id}
                    type="button"
                    aria-current={f.id === picked}
                    onClick={() => {
                      setPicked(f.id);
                      setPicking(null);
                      setHelper("");
                    }}
                    className={`mb-1 block w-full cursor-pointer rounded-[9px] px-2.5 py-2.5 text-left text-[12.5px] font-[700] transition-colors duration-100 ${
                      f.id === picked ? "bg-nb-accent-soft text-nb-accent-deep" : "text-nb-ink-soft"
                    }`}
                  >
                    <span className="block truncate">{nameOf(f)}</span>
                    {(f.builtIn || f.isDefault) && (
                      <span className="mt-1 block text-[10.5px] font-[500] text-nb-ink-soft">
                        {[f.builtIn ? c.builtIn : "", f.isDefault ? c.isDefault : ""].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
            <button type="button" className={`${QUIET_BTN} mt-3 w-full justify-center px-1.5`} onClick={() => void add()}>
              <FiPlus aria-hidden />
              {c.add}
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {flow && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[15px] font-[800] tracking-[-0.02em]">{nameOf(flow)}</span>
                    {flow.builtIn && (
                      <span className="rounded-[5px] bg-nb-wash px-1.5 py-0.5 text-[10px] font-[700] text-nb-ink-soft">
                        {c.builtIn}
                      </span>
                    )}
                  </div>
                  <MoreMenu
                    open={menu}
                    onOpen={() => setMenu((was) => !was)}
                    label={c.more}
                    items={[
                      { label: c.duplicate, run: () => void duplicate() },
                      ...(flow.builtIn
                        ? []
                        : [
                            {
                              label: c.rename,
                              run: () => {
                                setMenu(false);
                                setNaming({ id: flow.id, text: nameOf(flow) });
                              },
                            },
                          ]),
                    ]}
                    danger={
                      flow.builtIn
                        ? undefined
                        : { label: c.remove, confirm: c.confirmDelete(nameOf(flow)), inUse: c.inUse, id: flow.id, run: remove }
                    }
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {WORKFLOW_STAGES.map((name, i) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-current={name === stage}
                        onClick={() => {
                          setStage(name);
                          setPicking(null);
                          setHelper("");
                        }}
                        className={`flex h-9 cursor-pointer items-center whitespace-nowrap rounded-[9px] px-3 text-[12.5px] font-[700] transition-colors duration-100 ${
                          name === stage ? "bg-nb-accent-soft text-nb-accent-deep" : "bg-nb-wash text-nb-ink"
                        }`}
                      >
                        {c.stages[name]}
                      </button>
                      {i < WORKFLOW_STAGES.length - 1 && (
                        <FiArrowRight aria-hidden className="text-[12px] text-nb-ink-soft/45" />
                      )}
                    </div>
                  ))}
                </div>

                {setup && (
                  <div className="min-w-0">
                    {!setup.lead && <p className="mb-3 text-[12px] text-nb-peach-ink">{c.noLead}</p>}
                    <h4 className={`${CAPTION} mb-2 text-nb-ink-soft`}>{c.lead}</h4>
                    <div className="relative inline-block">
                      <LeadButton
                        setup={setup}
                        open={picking === "lead"}
                        pickLead={c.pickLead}
                        onOpen={() => setPicking((was) => (was === "lead" ? null : "lead"))}
                      />
                      {picking === "lead" && (
                        <Picker
                          candidates={setup.candidates.filter((a) => !setup.helpers.some((h) => h.agent === a.name))}
                          chosen={setup.lead}
                          onPick={async (name) => {
                            setPicking(null);
                            await move(stage, { kind: "lead", agent: name });
                          }}
                          onManage={() => onManage?.(stage)}
                        />
                      )}
                    </div>

                    <section className="mt-5">
                      <h4 className={`${CAPTION} mb-2 text-nb-ink-soft`}>{c.helpers}</h4>
                      <div className="flex flex-wrap gap-2">
                        {setup.helpers.map((h) => (
                          <HelperTile
                            key={h.agent}
                            agent={setup.candidates.find((a) => a.name === h.agent)}
                            name={h.agent}
                            selected={helper === h.agent}
                            onOpen={() => setHelper((was) => (was === h.agent ? "" : h.agent))}
                          />
                        ))}
                        <div className="relative">
                          <button
                            type="button"
                            className={`${QUIET_BTN} h-[42px] ${picking === "helper" ? "outline-2 outline-nb-accent" : ""}`}
                            onClick={() => setPicking((was) => (was === "helper" ? null : "helper"))}
                          >
                            <FiPlus aria-hidden />
                            {c.addHelper}
                          </button>
                          {picking === "helper" && (
                            <Picker
                              right
                              candidates={setup.candidates.filter(
                                (a) => a.name !== setup.lead && !setup.helpers.some((h) => h.agent === a.name),
                              )}
                              chosen=""
                              onPick={async (name) => {
                                setPicking(null);
                                if (await move(stage, { kind: "add-helper", agent: name })) setHelper(name);
                              }}
                              onManage={() => onManage?.(stage)}
                            />
                          )}
                        </div>
                      </div>

                      {helper && setup.helpers.some((h) => h.agent === helper) && (
                        <div className="mt-2 max-w-[460px] border-t border-nb-ink/12 pt-3">
                          <div className="flex items-center justify-between">
                            <h4 className={`${CAPTION} text-nb-ink-soft`}>
                              <span className="normal-case tracking-normal">
                                {agentName(setup.candidates.find((a) => a.name === helper), helper)}
                              </span>{" "}
                              · {c.extra}
                            </h4>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                aria-label={c.dropHelper}
                                className="grid size-6 cursor-pointer place-items-center text-nb-ink-soft"
                                onClick={async () => {
                                  const gone = helper;
                                  setHelper("");
                                  await move(stage, { kind: "drop-helper", agent: gone });
                                }}
                              >
                                <FiTrash2 aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label={c.dropHelper}
                                className="grid size-6 cursor-pointer place-items-center text-nb-ink-soft"
                                onClick={() => void saveExtra(helper).then(() => setHelper(""))}
                              >
                                <FiX aria-hidden />
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={extraOf(helper)}
                            placeholder={c.extraPlaceholder}
                            onChange={(e) => setExtras((all) => ({ ...all, [extraKey(helper)]: e.target.value }))}
                            onBlur={() => void saveExtra(helper)}
                            className={`${CONTROL} mt-2 h-[60px] resize-none text-[12px] leading-[19px]`}
                          />
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {flow && flow.problems.length > 0 && (
        <Note icon={<FiAlertCircle />}>
          {flow.problems.map((problem) => (
            <span key={problem} className="mt-1 block first:mt-0">
              {problem}
            </span>
          ))}
        </Note>
      )}
    </div>
  );
}

/** What one agent is CALLED here. The board ships its roles as a closed set, so the pane's
 *  own copy names them; a specialist says its own name in its `AGENT.md`, and an agent that
 *  says neither is spelled out of its id. The same three steps the Agents pane takes, so no
 *  screen calls the same agent two different things. */
function useCandidateName(): (agent: WorkflowCandidate | undefined, name: string) => string {
  const roles = useCopy().configuration.agents.roles;
  return useCallback(
    (agent, name) => roles[name as keyof typeof roles]?.name || agent?.title || spellAgent(name),
    [roles],
  );
}

/** And what it DOES, in one clause — the same three steps. */
function useCandidateGloss(): (agent: WorkflowCandidate) => string {
  const roles = useCopy().configuration.agents.roles;
  return useCallback(
    (agent) => roles[agent.name as keyof typeof roles]?.gloss || agent.gloss,
    [roles],
  );
}

// A name that is not taken yet, so the row the box opens on is real from the first keystroke.
function newName(flows: WorkflowView[], base: string): string {
  const taken = new Set(flows.map((f) => f.name.trim().toLowerCase()));
  if (!taken.has(base.trim().toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const tried = `${base} ${n}`;
    if (!taken.has(tried.toLowerCase())) return tried;
  }
}

function NameBox({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    box.current?.focus();
    box.current?.select();
  }, []);
  return (
    <input
      ref={box}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
      }}
      className={`${CONTROL} mb-1 h-[34px] px-2 py-1 text-[12.5px] outline-2 outline-nb-accent`}
    />
  );
}

function LeadButton({
  setup,
  open,
  pickLead,
  onOpen,
}: {
  setup: WorkflowStageView;
  open: boolean;
  pickLead: string;
  onOpen: () => void;
}) {
  const nameOf = useCandidateName();
  const lead = setup.candidates.find((a) => a.name === setup.lead);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${FLAT_CONTROL} flex h-[36px] min-w-[204px] cursor-pointer items-center gap-1.5 rounded-[10px] px-2 text-[12.5px] font-[700] ${
        open ? "outline-2 outline-nb-accent" : ""
      }`}
    >
      {setup.lead && <Character name={setup.lead} size={28} />}
      <span className="flex flex-1 items-center justify-between gap-3 px-1">
        <span className="truncate">{setup.lead ? nameOf(lead, setup.lead) : pickLead}</span>
        <FiChevronDown aria-hidden />
      </span>
    </button>
  );
}

function HelperTile({
  agent,
  name,
  selected,
  onOpen,
}: {
  agent: WorkflowCandidate | undefined;
  name: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const nameOf = useCandidateName();
  return (
    <button
      type="button"
      aria-current={selected}
      onClick={onOpen}
      className={`flex h-[42px] cursor-pointer items-center gap-1.5 rounded-[9px] px-2 transition-colors duration-100 ${
        selected ? "bg-nb-accent-soft" : "bg-nb-wash"
      }`}
    >
      <Character name={name} size={29} />
      <span className="text-[12px] font-[700]">{nameOf(agent, name)}</span>
      <FiChevronDown aria-hidden className="text-[11px]" />
    </button>
  );
}

/** One list of agents, searchable, with the way across to where they are defined under it.
 *  The lead picker and the helper picker are the same list: both pick ONE agent off the
 *  candidates the board offered for this stage, and neither can make one. */
function Picker({
  candidates,
  chosen,
  right,
  onPick,
  onManage,
}: {
  candidates: WorkflowCandidate[];
  chosen: string;
  right?: boolean;
  onPick: (name: string) => void;
  onManage: () => void;
}) {
  const c = useCopy().configuration.workflows;
  const nameOf = useCandidateName();
  const glossOf = useCandidateGloss();
  const [find, setFind] = useState("");
  const wanted = find.trim().toLowerCase();
  const shown = wanted
    ? candidates.filter((a) => `${a.name} ${a.title} ${nameOf(a, a.name)}`.toLowerCase().includes(wanted))
    : candidates;
  return (
    <div
      className={`absolute top-full z-30 mt-2 w-[278px] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-2 shadow-[3px_3px_0_var(--color-nb-ink)] ${
        right ? "right-0" : "left-0"
      }`}
    >
      <div className="relative mb-2">
        <FiSearch aria-hidden className="absolute left-2.5 top-2.5 text-[12px] text-nb-ink-soft" />
        <input
          autoFocus
          value={find}
          placeholder={c.find}
          onChange={(e) => setFind(e.target.value)}
          className={`${CONTROL} pl-8 text-[12px]`}
        />
      </div>
      {shown.length === 0 ? (
        <p className="px-2 py-3 text-[12px] text-nb-ink-soft">{c.noCandidates}</p>
      ) : (
        shown.map((a) => (
          <button
            key={a.name}
            type="button"
            onClick={() => onPick(a.name)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2 text-left ${
              a.name === chosen ? "bg-nb-accent-soft" : ""
            }`}
          >
            <Character name={a.name} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-[700]">{nameOf(a, a.name)}</span>
              <span className="block truncate text-[10.5px] text-nb-ink-soft">{glossOf(a)}</span>
            </span>
            {a.name === chosen && <FiCheck aria-hidden className="text-[13px]" />}
          </button>
        ))
      )}
      <div className="mt-1 border-t border-nb-ink/10 pt-1">
        <button
          type="button"
          onClick={onManage}
          className="flex w-full cursor-pointer items-center justify-between px-2 py-2 text-left text-[12px] font-[600]"
        >
          {c.manage}
          <FiArrowRight aria-hidden />
        </button>
      </div>
    </div>
  );
}

function MoreMenu({
  open,
  onOpen,
  label,
  items,
  danger,
}: {
  open: boolean;
  onOpen: () => void;
  label: string;
  items: { label: string; run: () => void }[];
  danger?: { label: string; confirm: string; inUse: (n: number) => string; id: string; run: () => void };
}) {
  // How many open cards the delete would strand, asked as the menu opens so the confirm row
  // can SAY it — a delete that fails after the click is a rule the user learns by hitting it.
  const [held, setHeld] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!open) return void setAsking(false);
    if (!danger) return;
    void cardsOnWorkflowAction(danger.id).then((res) => setHeld(res.cards.length));
  }, [open, danger]);
  return (
    <div className="relative">
      <button type="button" aria-label={label} className={`${QUIET_BTN} px-2`} onClick={onOpen}>
        <FiMoreHorizontal aria-hidden className="text-[17px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-[35px] z-20 w-[210px] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-1.5 shadow-[3px_3px_0_var(--color-nb-ink)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.run}
              className="block h-[31px] w-full cursor-pointer rounded-[7px] px-2.5 text-left text-[12px] font-[600]"
            >
              {item.label}
            </button>
          ))}
          {danger && !asking && (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="block h-[31px] w-full cursor-pointer rounded-[7px] px-2.5 text-left text-[12px] font-[600] text-nb-peach-ink"
            >
              {danger.label}
            </button>
          )}
          {danger && asking && (
            <div className="px-2.5 py-2">
              <p className="text-[12px] font-[700]">{danger.confirm}</p>
              {held ? <p className="mt-1 text-[11.5px] text-nb-ink-soft">{danger.inUse(held)}</p> : null}
              {held === 0 && (
                <button
                  type="button"
                  onClick={danger.run}
                  className={`${DANGER_BTN} mt-2 w-full justify-center`}
                >
                  {danger.label}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
