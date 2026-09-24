"use client";

// Configuration → Workflows (#715, #944).
//
// Every card on this board goes through one workflow: `plan → execute → review`. A workflow
// says WHO runs each of the three and who they may call in. This pane is the one place both
// halves of that answer live: pick a workflow at the top of the middle column, step through
// its three stages, and the agent you select there opens its own page — its brief, its
// instructions, what it runs on — beside the list.
//
// The agents themselves are the board's roster (`components/Agents.tsx`), shared with
// Configuration → Board so an agent reads and writes the same wherever it was reached from.
// What belongs to the ASSIGNMENT rather than to the agent — the extra requirements, the
// stage it sits in — is the only thing this pane adds to that page.
//
// Which agents can take a stage is the board's answer, asked for with the rest; so is every
// refusal. Nothing here has a copy of those rules.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiChevronDown,
  FiChevronRight,
  FiLink,
  FiMoreHorizontal,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import {
  cardsOnWorkflowAction,
  createWorkflowAction,
  deleteWorkflowAction,
  dismissRetiredAssignmentAction,
  duplicateWorkflowAction,
  renameWorkflowAction,
  setWorkflowStageAction,
  setWorkflowWorktreeAction,
  workflowsAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { useAgentName } from "@/lib/agent-name";
import { WORKFLOW_STAGES } from "@/lib/types";
import type {
  AgentInfo,
  AgentView,
  WorkflowCandidate,
  WorkflowHelper,
  WorkflowStage,
  WorkflowStageView,
  WorkflowView,
} from "@/lib/types";
import { AgentDetail, Character, NewAgentRow, useAgentRoster } from "./Agents";
import { ELASTIC_CHIP } from "./chips";
import {
  ACCENT_BTN,
  CAPTION,
  CONTROL,
  FLAT_CONTROL,
  Loading,
  Note,
  QUIET_BTN,
  SwitchTrack,
} from "./settings";
import { sayFailure } from "@/lib/start-failure";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  POPUP_ROW,
  POPUP_TRIGGER,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverOption,
  PopoverSearch,
  PopoverTrigger,
  stepOptions,
} from "./ui/popover";

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

/** Whether one stage cannot start. No lead, a lead this board no longer has, and a lead that
 *  belongs to another stage all read the same to the user, and all three fall out of the
 *  candidates the board already sent: those are exactly the agents that may take this stage.
 *  Review has no lead, only reviewers, and is never blocked (#820). */
export const stageBlocked = (setup: WorkflowStageView): boolean =>
  setup.stage !== "review" && (!setup.lead || !setup.candidates.some((a) => a.name === setup.lead));

/** Whether a stage runs on a lead picked before agents declared whether they may lead (#846).
 *  It still runs; the pane only says so. */
const leadUndeclared = (setup: WorkflowStageView): boolean =>
  setup.candidates.some((a) => a.name === setup.lead && !a.canLead);

/** A quiet chip — **Built-in**, **Default**. Peach is the palette's attention hue and is all
 *  that separates **Not ready** from the other two. */
function Pill({ children, tone = "wash" }: { children: string; tone?: "wash" | "peach" }) {
  return (
    <span
      className={`shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-[700] ${
        tone === "peach" ? "bg-nb-peach-soft text-nb-peach-ink" : "bg-nb-ink/7 text-nb-ink-soft"
      }`}
    >
      {children}
    </span>
  );
}

function Caption({ children }: { children: string }) {
  return <h4 className={`${CAPTION} mb-1.5 text-nb-ink-soft`}>{children}</h4>;
}

export function WorkflowsPanel({
  info,
  onRuntimes,
  onError,
}: {
  /** The connectors this board can run, and which one is its default (#443) — what the
   *  runtime row on the selected agent's page offers. */
  info: AgentInfo;
  /** Cross to Configuration → Runtimes — where a runtime is actually set up. */
  onRuntimes?: () => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.workflows;
  const ca = useCopy().configuration.agents;
  const nameOf = useWorkflowName();
  const roster = useAgentRoster(onError);
  const [flows, setFlows] = useState<WorkflowView[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const [stage, setStage] = useState<WorkflowStage>("plan");
  // The name box, when one is open: which workflow it renames (a workflow just added is the
  // same box, on a row the board has already allocated).
  const [naming, setNaming] = useState<{ id: string; text: string } | null>(null);
  const [menu, setMenu] = useState(false);
  // Which layer is open over the column: the workflow list, the lead picker, or the list of
  // agents this stage could still be given.
  const [picking, setPicking] = useState<"flow" | "lead" | "helper" | null>(null);
  const [adding, setAdding] = useState(false);
  // What the extra-requirements box holds right now, by `<workflow>/<stage>/<agent>`, so
  // switching agents never loses an edit that has not been saved yet.
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

  const flow = flows?.find((f) => f.id === picked);
  const setup = flow?.stages.find((s) => s.stage === stage);
  // The review stage has reviewers and no lead (#820).
  const reviewing = stage === "review";
  // Which of the three cannot start, so the tabs can say which one to fix.
  const blocked = new Set((flow?.stages ?? []).filter(stageBlocked).map((s) => s.stage));
  // Every agent this stage has, in the order the column draws them.
  const assigned = useMemo(
    () => (setup ? [...(reviewing || !setup.lead ? [] : [setup.lead]), ...setup.helpers.map((h) => h.agent)] : []),
    [setup, reviewing],
  );

  // Always land on an agent of this stage that the board still has: a page beside an empty
  // column is half a pane, and the one the last stage had is not in this one. A stage can
  // also still name an agent this board deleted — that name has no page, so it is never the
  // one selected, and the stage says so in its own line instead.
  const { picked: shown, setPicked: show, select } = roster;
  const here = useCallback(
    (name: string) => !!roster.agents?.some((a) => a.name === name),
    [roster.agents],
  );
  useEffect(() => {
    if (!roster.agents) return;
    if (shown && assigned.includes(shown) && here(shown)) return;
    show(assigned.find(here) ?? "");
  }, [roster.agents, assigned, shown, show, here]);

  const refused = (res: { ok: boolean; error?: string }): boolean => {
    if (res.ok) return false;
    onError?.(sayFailure(res, c.saveFailed));
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

  // Adding a workflow opens the name box on a workflow that is already real: the board
  // allocates the id, and an empty name takes it straight back off.
  const add = async () => {
    setPicking(null);
    const res = await createWorkflowAction(newName(flows ?? [], c.add));
    if (refused(res)) return;
    await load();
    setPicked(res.id!);
    setNaming({ id: res.id!, text: res.name ?? "" });
  };

  // Named in the words the selector draws it in: a built-in's own name is the English the
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

  // A new agent is created AND assigned in one press: the button that opened this row was
  // "add one to this stage", and an agent created but left unassigned would look like the
  // press did nothing. The template writes a helper, never a lead (#944).
  const createAgent = async (name: string): Promise<string> => {
    const made = await roster.create(name, stage);
    if (made.error || !made.agent) return sayFailure(made, c.saveFailed);
    setAdding(false);
    if (!(await move(stage, { kind: "add-helper", agent: made.agent }))) return "";
    show(made.agent);
    // Its page opens with the `AGENT.md` box focused: the whole point of the press was to
    // carry straight on into writing the prompt.
    roster.setFocusFile(true);
    return "";
  };

  // Which workflows assign this agent, anywhere in their three stages — what a shared agent's
  // page says before its instructions are edited, and what its delete warns about.
  const usersOf = useCallback(
    (name: string): WorkflowView[] =>
      (flows ?? []).filter((f) =>
        f.stages.some((s) => s.lead === name || s.helpers.some((h) => h.agent === name)),
      ),
    [flows],
  );

  const agent = roster.agents?.find((a) => a.name === shown);
  const isYours = (name: string) => !!roster.agents?.find((a) => a.name === name)?.file;
  const helperRows = (helpers: WorkflowHelper[]) =>
    helpers.map((h) => (
      <StageRow
        key={h.agent}
        name={h.agent}
        agent={setup?.candidates.find((a) => a.name === h.agent)}
        held={shown === h.agent}
        onOpen={() => void select(h.agent)}
      />
    ));
  const isLead = !!setup && !reviewing && shown === setup.lead;

  // Beside the workflow's name, whatever the stage holds and whoever is selected (#964).
  const menuNode = flow ? (
    <MoreMenu
      open={menu}
      onOpenChange={setMenu}
      label={c.more(nameOf(flow))}
      flow={flow}
      onSaved={load}
      onError={onError}
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
          : {
              label: c.remove,
              confirm: c.confirmDelete(nameOf(flow)),
              inUse: c.inUse,
              id: flow.id,
              run: remove,
            }
      }
    />
  ) : null;

  return (
    <div className="flex min-h-full flex-col gap-5">
      {loadError && <Note icon={<FiAlertCircle />}>{loadError}</Note>}
      {!loaded && <Loading>{c.loading}</Loading>}
      {loaded && !loadError && flows === null && <Note icon={<FiAlertCircle />}>{c.tooOld}</Note>}

      {flows && (
        <div className="flex flex-1 items-stretch gap-6 max-sm:flex-col max-sm:gap-4">
          {/* The workflow, its three stages and the agents in the one that is open — top to
              bottom in the order they are read, with the rule down the right edge running
              the whole height of the pane. */}
          <div className="flex w-[292px] shrink-0 flex-col border-r border-nb-ink/10 pr-6 max-sm:w-full max-sm:border-r-0 max-sm:border-b max-sm:pr-0 max-sm:pb-4">
            <div className="mb-5 flex shrink-0 flex-col gap-5">
              <Popover open={picking === "flow"} onOpenChange={(open) => setPicking(open ? "flow" : null)}>
                <PopoverAnchor asChild>
                  <div className="flex w-full items-center gap-2">
                    <div className="min-w-0 flex-1">
                      {naming ? (
                        <NameBox
                          label={c.nameLabel}
                          placeholder={c.namePlaceholder}
                          value={naming.text}
                          onChange={(text) => setNaming({ ...naming, text })}
                          onBlur={() => void nameBlur()}
                        />
                      ) : (
                        flow && (
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={c.title}
                              className={`${FLAT_CONTROL} ${POPUP_TRIGGER} flex h-[44px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-[10px] px-3`}
                            >
                              <span className="min-w-0 flex-1 truncate text-left text-[14px] font-[800]">
                                {nameOf(flow)}
                              </span>
                              {flow.builtIn && (
                                <span className="shrink-0 text-[11px] font-normal text-nb-ink-soft">{c.builtIn}</span>
                              )}
                              {flow.isDefault && <Pill>{c.isDefault}</Pill>}
                              {flow.problems.length > 0 && <Pill tone="peach">{c.notReady}</Pill>}
                              <FiChevronDown aria-hidden className="shrink-0 text-nb-ink-soft" />
                            </button>
                          </PopoverTrigger>
                        )
                      )}
                    </div>
                    {menuNode}
                  </div>
                </PopoverAnchor>
                {picking === "flow" && (
                  <FlowPicker
                    flows={flows}
                    chosen={picked}
                    onPick={(id) => {
                      setPicking(null);
                      setPicked(id);
                    }}
                    onAdd={() => void add()}
                  />
                )}
              </Popover>

              {flow?.retiredAssignment && (
                <Note>
                  {c.retired}{" "}
                  <button
                    type="button"
                    className="cursor-pointer font-[700] text-nb-accent-deep underline underline-offset-2"
                    onClick={() => void write(dismissRetiredAssignmentAction(flow.id))}
                  >
                    {c.retiredSeen}
                  </button>
                </Note>
              )}

              {/* The arrows between them are the order a card actually goes through, which is
                  the one thing three same-looking tabs don't say. */}
              <div className="flex shrink-0 items-center gap-1">
                {WORKFLOW_STAGES.map((name, i) => (
                  <div key={name} className="flex items-center gap-1">
                    {i > 0 && (
                      <FiChevronRight size={13} aria-hidden className="shrink-0 text-nb-ink-soft/60" />
                    )}
                    <button
                      type="button"
                      aria-current={name === stage}
                      title={blocked.has(name) ? c.notReadyHint : undefined}
                      onClick={() => {
                        setStage(name);
                        setPicking(null);
                        setAdding(false);
                      }}
                      className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 py-1 text-[12px] font-[700] transition-colors duration-100 ${
                        name === stage ? "bg-nb-accent-soft text-nb-accent-deep" : "bg-nb-wash text-nb-ink-soft"
                      }`}
                    >
                      {c.stages[name]}
                      {blocked.has(name) && (
                        <span
                          role="img"
                          aria-label={c.notReadyHint}
                          className="size-[6px] shrink-0 rounded-full bg-nb-peach-ink"
                        />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {setup && flow && (
              <>
                {stageBlocked(setup) && (
                  <p className="mb-3 text-[12px] text-nb-peach-ink">{c.stageProblem}</p>
                )}
                {/* A built-in's lead is what its name promises, so it is shown and not
                    offered (#774). On a workflow of this board's own the chevron beside it
                    is what swaps it. */}
                {!reviewing && (
                  <section className="mb-4">
                    <Caption>{c.lead}</Caption>
                    <Popover open={picking === "lead"} onOpenChange={(open) => setPicking(open ? "lead" : null)}>
                      <PopoverAnchor asChild>
                        <div>
                          {setup.lead ? (
                            <StageRow
                              name={setup.lead}
                              agent={setup.candidates.find((a) => a.name === setup.lead)}
                              held={shown === setup.lead}
                              onOpen={() => void select(setup.lead)}
                              swap={flow.builtIn ? undefined : c.pickLead}
                            />
                          ) : (
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`${FLAT_CONTROL} ${POPUP_TRIGGER} flex h-[36px] w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 text-[12.5px] font-[700]`}
                              >
                                {c.pickLead}
                                <FiChevronDown aria-hidden />
                              </button>
                            </PopoverTrigger>
                          )}
                        </div>
                      </PopoverAnchor>
                      {picking === "lead" && (
                        <AgentPicker
                          label={c.pickLead}
                          candidates={setup.candidates.filter(
                            (a) => a.canLead && !setup.helpers.some((h) => h.agent === a.name),
                          )}
                          chosen={setup.lead}
                          onPick={async (name) => {
                            setPicking(null);
                            if (await move(stage, { kind: "lead", agent: name })) show(name);
                          }}
                        />
                      )}
                    </Popover>
                    {leadUndeclared(setup) && (
                      <p className="mt-1.5 text-[11.5px] text-nb-peach-ink">{c.leadUndeclared}</p>
                    )}
                  </section>
                )}

                <section className="min-w-0">
                  <Caption>{reviewing ? c.reviewers : c.helpers}</Caption>
                  {helperRows(setup.helpers.filter((h) => !isYours(h.agent)))}
                  {setup.helpers.some((h) => isYours(h.agent)) && <YoursDivider label={c.yoursDivider} />}
                  {helperRows(setup.helpers.filter((h) => isYours(h.agent)))}
                  {!setup.helpers.length && (
                    <p className="px-2.5 py-2 text-[11.5px] text-nb-ink-soft">
                      {reviewing ? c.noReviewers : c.noneInStage}
                    </p>
                  )}
                  {adding ? (
                    <NewAgentRow onCreate={createAgent} onCancel={() => setAdding(false)} />
                  ) : (
                    <Popover open={picking === "helper"} onOpenChange={(open) => setPicking(open ? "helper" : null)}>
                      <PopoverTrigger asChild>
                        <button type="button" className={`${QUIET_BTN} ${POPUP_TRIGGER} mt-2.5 w-full justify-center`}>
                          <FiPlus aria-hidden />
                          {reviewing ? c.addReviewer : c.addHelper}
                        </button>
                      </PopoverTrigger>
                      {picking === "helper" && (
                        <AgentPicker
                          label={reviewing ? c.addReviewer : c.addHelper}
                          candidates={setup.candidates.filter(
                            (a) =>
                              !a.canLead &&
                              a.name !== setup.lead &&
                              !setup.helpers.some((h) => h.agent === a.name),
                          )}
                          chosen=""
                          onPick={async (name) => {
                            setPicking(null);
                            if (await move(stage, { kind: "add-helper", agent: name })) show(name);
                          }}
                          onNew={() => {
                            setPicking(null);
                            setAdding(true);
                          }}
                        />
                      )}
                    </Popover>
                  )}
                </section>
              </>
            )}
          </div>

          {/* The selected agent: what it is, where else it is used, and what this stage
              asks of it. */}
          <div className="flex min-w-0 flex-1 flex-col">
            {agent && flow && (
              <AgentDetail
                roster={roster}
                agent={agent}
                info={info}
                onRuntimes={onRuntimes}
                onError={onError}
                scoped
                tag={<SharedChip here={flow} users={usersOf(agent.name)} />}
                usage={<Usage agent={agent} />}
                deleteNote={deleteNote(c, usersOf(agent.name).map(nameOf))}
                onDeleted={load}
                actions={
                  !isLead ? (
                    <button
                      type="button"
                      className={QUIET_BTN}
                      onClick={async () => {
                        const gone = agent.name;
                        show("");
                        await move(stage, { kind: "drop-helper", agent: gone });
                      }}
                    >
                      <FiTrash2 aria-hidden />
                      {c.dropHelper}
                    </button>
                  ) : undefined
                }
                inStage={!isLead}
                extra={
                  /* Only an agent the command ships (#1007): one this project added owns its
                     whole `AGENT.md`, which is the box below, and a second place to write
                     requirements only asks which one to use. */
                  !isLead && !agent.file ? (
                    <section className="shrink-0">
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <h4 className={`${CAPTION} shrink-0 text-nb-ink-soft`}>{c.extra}</h4>
                        <span className="min-w-0 truncate text-[10.5px] text-nb-ink-soft">
                          {c.extraScope(nameOf(flow), c.stages[stage])}
                        </span>
                      </div>
                      <ExtraBox
                        key={extraKey(agent.name)}
                        value={extraOf(agent.name)}
                        placeholder={c.extraPlaceholder}
                        label={c.extra}
                        onChange={(text) => setExtras((all) => ({ ...all, [extraKey(agent.name)]: text }))}
                        onBlur={() => void saveExtra(agent.name)}
                      />
                    </section>
                  ) : undefined
                }
              />
            )}
            {!agent && flow && (
              <p className="min-w-0 text-[12px] leading-[19px] text-nb-ink-soft">{c.emptyPage}</p>
            )}
          </div>
        </div>
      )}

      {/* An agent whose `AGENT.md` the catalog cannot read is not in the roster, so the
          reason it is missing is said here rather than nowhere. */}
      {flows && roster.problems.length > 0 && (
        <Note icon={<FiAlertCircle />}>
          {ca.problems}
          {roster.problems.map((problem) => (
            <span key={problem} className="mt-1 block">
              {problem}
            </span>
          ))}
        </Note>
      )}
    </div>
  );
}

/** The stage's instruction box, as tall as its words. */
function ExtraBox({
  value,
  placeholder,
  label,
  onChange,
  onBlur,
}: {
  value: string;
  placeholder: string;
  label: string;
  onChange: (text: string) => void;
  onBlur: () => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(fit, [value, fit]);
  // A narrower pane wraps the same words onto more lines.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [fit]);
  return (
    <textarea
      ref={box}
      rows={2}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`${CONTROL} min-h-[60px] resize-none overflow-hidden text-[12px] leading-[19px]`}
    />
  );
}

/** The workflows besides this one that assign the agent — its instructions are theirs too. */
const othersOf = (here: WorkflowView, users: WorkflowView[]) => users.filter((f) => f.id !== here.id);

/** Beside a shared agent's name: which workflows share it, and in its tip what that means. */
function SharedChip({ here, users }: { here: WorkflowView; users: WorkflowView[] }) {
  const c = useCopy().configuration.workflows;
  const nameOf = useWorkflowName();
  const others = othersOf(here, users).map(nameOf);
  if (!others.length) return null;
  return (
    <span
      tabIndex={0}
      className="nb-chip nb-tip nb-tip-start min-w-0 self-center"
      data-tip={c.sharedTip(others)}
      style={{
        ...ELASTIC_CHIP,
        background: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)",
        color: "var(--color-nb-ink-soft)",
      }}
    >
      <FiLink aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      <span className="truncate">{c.sharedWith(others)}</span>
    </span>
  );
}

/** Between the built-in helpers and the ones this project added. */
function YoursDivider({ label }: { label: string }) {
  return (
    <div role="separator" aria-label={label} className="flex items-center gap-2 px-2.5 py-1.5">
      <span className="h-px flex-1 bg-nb-ink/10" />
      <span className="shrink-0 text-[10.5px] font-[700] leading-[14px] text-nb-ink-soft/70">{label}</span>
      <span className="h-px flex-1 bg-nb-ink/10" />
    </div>
  );
}

/** Under a built-in role's line. */
function Usage({ agent }: { agent: AgentView }) {
  const c = useCopy().configuration.workflows;
  return agent.kind === "role" ? (
    <p className="mt-1 text-[11.5px] leading-[17px] text-nb-ink-soft">{c.roleNote}</p>
  ) : null;
}

/** One more line in the delete confirmation: an agent two workflows assign is about to go
 *  from both, and the confirmation is the last place that can be said. */
function deleteNote(
  c: { deleteUsedBy: (flows: string[]) => string },
  flows: string[],
): string | undefined {
  return flows.length ? c.deleteUsedBy(flows) : undefined;
}

/** What one agent is CALLED here — the one lookup every screen names an agent by
 *  (`@/lib/agent-name`), handed the name this pane has already read off the candidate. */
function useCandidateName(): (agent: WorkflowCandidate | undefined, name: string) => string {
  const nameOf = useAgentName();
  return useCallback((agent, name) => nameOf(name, agent?.title), [nameOf]);
}

/** And what it DOES, in one clause — the same three steps. */
function useCandidateGloss(): (agent: WorkflowCandidate | undefined, name: string) => string {
  const roles = useCopy().configuration.agents.roles;
  return useCallback(
    (agent, name) => roles[name as keyof typeof roles]?.gloss || agent?.gloss || "",
    [roles],
  );
}

// A name that is not taken yet, so the workflow the box opens on is real from the first
// keystroke.
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
      className={`${CONTROL} h-[44px] px-3 text-[14px] font-[800] outline-2 outline-nb-accent`}
    />
  );
}

/** One agent of the open stage, in the column. Pressing it opens its page beside the list;
 *  the chevron, where there is one, swaps who leads instead. */
function StageRow({
  name,
  agent,
  held,
  onOpen,
  swap,
}: {
  name: string;
  agent: WorkflowCandidate | undefined;
  held: boolean;
  onOpen: () => void;
  /** The label of the chevron that swaps who leads; the row must sit in that Popover. */
  swap?: string;
}) {
  const nameOf = useCandidateName();
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 py-[5px] transition-colors duration-100 ${
        held ? "bg-nb-accent-soft" : "hover:bg-nb-sheet"
      }`}
    >
      <button
        type="button"
        aria-current={held}
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent"
      >
        <span className="flex size-[26px] shrink-0 items-end justify-center">
          <Character name={name} size={26} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-[700] leading-[16px] text-nb-ink">
          {nameOf(agent, name)}
        </span>
      </button>
      {swap && (
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={swap}
            className={`${POPUP_TRIGGER} grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft`}
          >
            <FiChevronDown aria-hidden />
          </button>
        </PopoverTrigger>
      )}
    </div>
  );
}

/** The workflows this board has, searchable, with **New workflow** under them as a button of
 *  its own: making one is not picking one, and a row that looks like the rest would be
 *  pressed by accident. */
function FlowPicker({
  flows,
  chosen,
  onPick,
  onAdd,
}: {
  flows: WorkflowView[];
  chosen: string;
  onPick: (id: string) => void;
  onAdd: () => void;
}) {
  const c = useCopy().configuration.workflows;
  const nameOf = useWorkflowName();
  const [find, setFind] = useState("");
  const wanted = find.trim().toLowerCase();
  const shown = wanted ? flows.filter((f) => nameOf(f).toLowerCase().includes(wanted)) : flows;
  return (
    <PopoverContent
      aria-label={c.title}
      onKeyDown={stepOptions}
      className="w-[var(--radix-popover-trigger-width)]"
    >
      <PopoverSearch value={find} placeholder={c.findWorkflow} onChange={(e) => setFind(e.target.value)} />
      <div role="listbox" aria-label={c.title}>
        {shown.map((f) => (
          <PopoverOption key={f.id} selected={f.id === chosen} onClick={() => onPick(f.id)} className="py-2">
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-[700]">{nameOf(f)}</span>
            {f.builtIn && <span className="shrink-0 text-[10.5px] font-[400] text-nb-ink-soft">{c.builtIn}</span>}
            {f.isDefault && <Pill>{c.isDefault}</Pill>}
            {f.problems.length > 0 && <Pill tone="peach">{c.notReady}</Pill>}
          </PopoverOption>
        ))}
      </div>
      <div className="mt-1 border-t border-nb-ink/10 p-1 pt-2">
        <button type="button" onClick={onAdd} className={`${ACCENT_BTN} w-full justify-center`}>
          <FiPlus aria-hidden />
          {c.add}
        </button>
      </div>
    </PopoverContent>
  );
}

/** One list of agents, searchable. The lead picker and the helper picker are the same list:
 *  both pick ONE agent off the candidates the board offered for this stage. Only the helper
 *  picker can make one — the template writes a helper, never a lead. */
function AgentPicker({
  label,
  candidates,
  chosen,
  onPick,
  onNew,
}: {
  label: string;
  candidates: WorkflowCandidate[];
  chosen: string;
  onPick: (name: string) => void;
  onNew?: () => void;
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
    <PopoverContent
      aria-label={label}
      onKeyDown={stepOptions}
      className="w-[var(--radix-popover-trigger-width)] min-w-[262px]"
    >
      <PopoverSearch value={find} placeholder={c.find} onChange={(e) => setFind(e.target.value)} />
      {shown.length === 0 ? (
        <p className="px-2.5 py-3 text-[12px] text-nb-ink-soft">{c.noCandidates}</p>
      ) : (
        <div role="listbox" aria-label={label}>
          {shown.map((a) => (
            <PopoverOption key={a.name} selected={a.name === chosen} onClick={() => onPick(a.name)} className="px-2">
              <Character name={a.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-[700]">{nameOf(a, a.name)}</span>
                <span className="block truncate text-[10.5px] font-[400] text-nb-ink-soft">{glossOf(a, a.name)}</span>
              </span>
            </PopoverOption>
          ))}
        </div>
      )}
      {onNew && (
        <div className="mt-1 border-t border-nb-ink/10 pt-1">
          <button type="button" onClick={onNew} className={`${POPUP_ROW} gap-1.5 text-[12px] font-[700]`}>
            <FiPlus aria-hidden />
            {c.newAgent}
          </button>
          <span className="block px-2.5 pb-1.5 text-[10.5px] leading-[15px] text-nb-ink-soft">{c.newAgentHint}</span>
        </div>
      )}
    </PopoverContent>
  );
}

/** Everything about the WORKFLOW: duplicating, renaming and deleting it, and — folded away
 *  under Advanced settings — whether its deliveries get a Git worktree of their own (#874). */
function MoreMenu({
  open,
  onOpenChange,
  label,
  items,
  danger,
  flow,
  onSaved,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  items: { label: string; run: () => void }[];
  danger?: { label: string; confirm: string; inUse: (n: number) => string; id: string; run: () => void };
  flow: WorkflowView;
  onSaved: () => Promise<void>;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.workflows;
  // How many open cards the delete would strand, asked as the menu opens so the confirm step
  // can SAY it — a delete that fails after the click is a rule the user learns by hitting it.
  const [held, setHeld] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [flipping, setFlipping] = useState(false);
  // A pick moves on to something else — often the name box, which saves on blur — so focus
  // goes back to the button only when the menu was left without one.
  const acted = useRef(false);
  const on = !flow.needsArtifact;
  useEffect(() => {
    if (!open) {
      setAsking(false);
      setAdvanced(false);
      return;
    }
    acted.current = false;
    if (!danger) return;
    void cardsOnWorkflowAction(danger.id).then((res) => setHeld(res.cards.length));
  }, [open, danger]);
  const act = (run: () => void) => () => {
    acted.current = true;
    run();
  };
  const flip = async () => {
    if (flipping) return;
    setFlipping(true);
    const res = await setWorkflowWorktreeAction(flow.id, !on);
    if (res.ok) await onSaved();
    else onError?.(c.worktreeSaveFailed);
    setFlipping(false);
  };
  const row = "h-[31px] text-[12px]";
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`${FLAT_CONTROL} ${POPUP_TRIGGER} grid size-[44px] shrink-0 cursor-pointer place-items-center rounded-[10px] text-nb-ink`}
        >
          <FiMoreHorizontal aria-hidden className="text-[17px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        onCloseAutoFocus={(e) => {
          if (acted.current) e.preventDefault();
        }}
        className="w-[258px] p-1.5"
      >
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={act(item.run)} className={row}>
            {item.label}
          </DropdownMenuItem>
        ))}
        {danger && !asking && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setAsking(true);
            }}
            className={`${row} mt-1 text-nb-peach-ink`}
          >
            {danger.label}
          </DropdownMenuItem>
        )}
        {danger && asking && held !== null && (
          <div className="mt-1 px-2.5 py-2">
            {held > 0 ? (
              <p className="text-[11.5px] text-nb-ink-soft">{danger.inUse(held)}</p>
            ) : (
              <DropdownMenuItem
                onSelect={act(danger.run)}
                className="justify-center gap-1.5 bg-nb-peach-soft text-[12px] font-[700] text-nb-peach-ink [overflow-wrap:anywhere] data-[highlighted]:bg-nb-peach/45 hover:bg-nb-peach/45"
              >
                {danger.confirm}
              </DropdownMenuItem>
            )}
          </div>
        )}
        {/* On is a branch and a worktree per delivery, for code; off works in the project
            and delivers files. A built-in's is fixed, so it is shown rather than offered. */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-expanded={advanced}
          onSelect={(e) => {
            e.preventDefault();
            setAdvanced((was) => !was);
          }}
          className={`${row} justify-between text-nb-ink-soft`}
        >
          {c.advanced}
          {advanced ? <FiChevronDown aria-hidden /> : <FiChevronRight aria-hidden />}
        </DropdownMenuItem>
        {advanced && (
          <div className="pb-1">
            {flow.builtIn ? (
              <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                <span className="min-w-0 text-[12px] font-[600]">{c.worktree}</span>
                <span className="shrink-0 text-[11.5px] text-nb-ink-soft">{on ? c.worktreeOn : c.worktreeOff}</span>
              </div>
            ) : (
              <DropdownMenuCheckboxItem
                checked={on}
                disabled={flipping}
                onSelect={(e) => {
                  e.preventDefault();
                  void flip();
                }}
                className="justify-between gap-3 text-[12px]"
              >
                <span className="min-w-0">{c.worktree}</span>
                <SwitchTrack on={on} />
              </DropdownMenuCheckboxItem>
            )}
            <p className="mt-0.5 px-2.5 text-[10.5px] leading-[15px] text-nb-ink-soft">{c.worktreeHint}</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
