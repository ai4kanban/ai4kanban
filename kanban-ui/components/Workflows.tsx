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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiMoreHorizontal,
  FiPlus,
  FiSearch,
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
  WorkflowStage,
  WorkflowStageView,
  WorkflowView,
} from "@/lib/types";
import { AgentDetail, Character, NewAgentRow, useAgentRoster } from "./Agents";
import {
  ACCENT_BTN,
  CAPTION,
  CONTROL,
  FLAT_CONTROL,
  Loading,
  Note,
  QUIET_BTN,
  Switch,
} from "./settings";

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
    if (made.error || !made.agent) return made.error || c.saveFailed;
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
  const isLead = !!setup && !reviewing && shown === setup.lead;

  // Everything about the WORKFLOW rather than about the agent on screen. Drawn in the right
  // column's top corner whether or not this stage has anybody in it — a workflow you cannot
  // rename because its review stage is empty is a workflow nobody can fix.
  const menuNode = flow ? (
    <MoreMenu
      open={menu}
      onOpen={() => setMenu((was) => !was)}
      onDismiss={() => setMenu(false)}
      label={c.more(nameOf(flow))}
      flowName={nameOf(flow)}
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
            <div className="mb-5 flex shrink-0 flex-col gap-3">
              <div className="relative w-full">
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
                    <button
                      type="button"
                      aria-label={c.title}
                      aria-expanded={picking === "flow"}
                      onClick={() => setPicking((was) => (was === "flow" ? null : "flow"))}
                      className={`${FLAT_CONTROL} flex h-[44px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-[10px] px-3 ${
                        picking === "flow" ? "outline-2 outline-nb-accent" : ""
                      }`}
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
                  )
                )}
                {picking === "flow" && (
                  <FlowPicker
                    flows={flows}
                    chosen={picked}
                    onPick={(id) => {
                      setPicking(null);
                      setPicked(id);
                    }}
                    onAdd={() => void add()}
                    onDismiss={() => setPicking(null)}
                  />
                )}
              </div>

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
                    <div className="relative">
                      {setup.lead ? (
                        <StageRow
                          name={setup.lead}
                          agent={setup.candidates.find((a) => a.name === setup.lead)}
                          held={shown === setup.lead}
                          onOpen={() => void select(setup.lead)}
                          swap={
                            flow.builtIn
                              ? undefined
                              : {
                                  label: c.pickLead,
                                  open: picking === "lead",
                                  onOpen: () => setPicking((was) => (was === "lead" ? null : "lead")),
                                }
                          }
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPicking((was) => (was === "lead" ? null : "lead"))}
                          className={`${FLAT_CONTROL} flex h-[36px] w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 text-[12.5px] font-[700] ${
                            picking === "lead" ? "outline-2 outline-nb-accent" : ""
                          }`}
                        >
                          {c.pickLead}
                          <FiChevronDown aria-hidden />
                        </button>
                      )}
                      {picking === "lead" && (
                        <AgentPicker
                          candidates={setup.candidates.filter(
                            (a) => a.canLead && !setup.helpers.some((h) => h.agent === a.name),
                          )}
                          chosen={setup.lead}
                          onPick={async (name) => {
                            setPicking(null);
                            if (await move(stage, { kind: "lead", agent: name })) show(name);
                          }}
                          onDismiss={() => setPicking(null)}
                        />
                      )}
                    </div>
                    {leadUndeclared(setup) && (
                      <p className="mt-1.5 text-[11.5px] text-nb-peach-ink">{c.leadUndeclared}</p>
                    )}
                  </section>
                )}

                <section className="min-w-0">
                  <Caption>{reviewing ? c.reviewers : c.helpers}</Caption>
                  {setup.helpers.map((h) => (
                    <StageRow
                      key={h.agent}
                      name={h.agent}
                      agent={setup.candidates.find((a) => a.name === h.agent)}
                      held={shown === h.agent}
                      onOpen={() => void select(h.agent)}
                    />
                  ))}
                  {!setup.helpers.length && (
                    <p className="px-2.5 py-2 text-[11.5px] text-nb-ink-soft">
                      {reviewing ? c.noReviewers : c.noneInStage}
                    </p>
                  )}
                  {adding ? (
                    <NewAgentRow onCreate={createAgent} onCancel={() => setAdding(false)} />
                  ) : (
                    <div className="relative mt-2.5">
                      <button
                        type="button"
                        onClick={() => setPicking((was) => (was === "helper" ? null : "helper"))}
                        className={`${QUIET_BTN} w-full justify-center ${
                          picking === "helper" ? "outline-2 outline-nb-accent" : ""
                        }`}
                      >
                        <FiPlus aria-hidden />
                        {reviewing ? c.addReviewer : c.addHelper}
                      </button>
                      {picking === "helper" && (
                        <AgentPicker
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
                          onDismiss={() => setPicking(null)}
                        />
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* The selected agent, whole: what it is, where else it is used, what this stage
              asks of it on top of that, and the instructions it carries everywhere. */}
          <div className="flex min-w-0 flex-1 flex-col">
            {agent && flow && (
              <AgentDetail
                roster={roster}
                agent={agent}
                info={info}
                onRuntimes={onRuntimes}
                onError={onError}
                corner={menuNode}
                usage={<Usage agent={agent} here={flow} users={usersOf(agent.name)} scoped={!isLead} />}
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
                extra={
                  !isLead ? (
                    <section className="shrink-0">
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <h4 className={`${CAPTION} text-nb-ink-soft`}>{c.extra}</h4>
                        <span className="shrink-0 text-[10.5px] text-nb-ink-soft">
                          {c.extraScope(nameOf(flow), c.stages[stage])}
                        </span>
                      </div>
                      <textarea
                        key={extraKey(agent.name)}
                        value={extraOf(agent.name)}
                        placeholder={c.extraPlaceholder}
                        aria-label={c.extra}
                        onChange={(e) =>
                          setExtras((all) => ({ ...all, [extraKey(agent.name)]: e.target.value }))
                        }
                        onBlur={() => void saveExtra(agent.name)}
                        className={`${CONTROL} h-[60px] resize-none text-[12px] leading-[19px]`}
                      />
                    </section>
                  ) : undefined
                }
              />
            )}
            {!agent && flow && (
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[12px] leading-[19px] text-nb-ink-soft">{c.emptyPage}</p>
                {menuNode}
              </div>
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

/** Where else this agent is used, and what that means for the box below (#944). A shared
 *  agent's instructions are shared with it, so the way to change only what THIS workflow
 *  asks is the extra requirements — said here, where the edit is about to be made. */
function Usage({
  agent,
  here,
  users,
  scoped,
}: {
  agent: AgentView;
  here: WorkflowView;
  users: WorkflowView[];
  /** Whether this assignment has extra requirements of its own — a lead has none. */
  scoped: boolean;
}) {
  const c = useCopy().configuration.workflows;
  const nameOf = useWorkflowName();
  const others = users.filter((f) => f.id !== here.id);
  const line = !users.length
    ? c.unused
    : others.length
      ? c.alsoUsedBy(others.map(nameOf))
      : c.usedOnlyHere;
  return (
    <>
      <p className="mt-1 text-[11.5px] leading-[17px] text-nb-ink">
        {line}
        {others.length > 0 && scoped && <span className="text-nb-ink-soft"> {c.extraPointer}</span>}
      </p>
      {agent.kind === "role" && (
        <p className="mt-0.5 text-[11.5px] leading-[17px] text-nb-ink-soft">{c.roleNote}</p>
      )}
    </>
  );
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
  swap?: { label: string; open: boolean; onOpen: () => void };
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
        <button
          type="button"
          aria-label={swap.label}
          aria-expanded={swap.open}
          onClick={swap.onOpen}
          className={`grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft ${
            swap.open ? "outline-2 outline-nb-accent" : ""
          }`}
        >
          <FiChevronDown aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A press anywhere else, or Escape, closes the layer this ref is on — what every other menu
 *  in the app does, and what a menu that only closes on a pick makes the user hunt for.
 *
 *  The press is measured against the popover's POSITIONING parent, which holds the button
 *  that opened it: measured against the popover alone, pressing that button would close the
 *  layer here and its own toggle would open it straight back. Escape stops where it is caught
 *  — the dialog closes on Escape too, and one key should shut one thing. */
function useDismiss<T extends HTMLElement>(onDismiss: () => void) {
  const box = useRef<T>(null);
  const close = useRef(onDismiss);
  close.current = onDismiss;
  useEffect(() => {
    const pressed = (e: PointerEvent) => {
      const at = e.target as Element | null;
      const near = box.current?.parentElement;
      if (!at || !near || near.contains(at)) return;
      close.current();
    };
    const typed = (e: KeyboardEvent) => {
      // Nothing open under this ref: the key is the dialog's, not ours.
      if (e.key !== "Escape" || !box.current) return;
      e.stopPropagation();
      close.current();
    };
    document.addEventListener("pointerdown", pressed, true);
    document.addEventListener("keydown", typed, true);
    return () => {
      document.removeEventListener("pointerdown", pressed, true);
      document.removeEventListener("keydown", typed, true);
    };
  }, []);
  return box;
}

/** The workflows this board has, searchable, with **New workflow** under them as a button of
 *  its own: making one is not picking one, and a row that looks like the rest would be
 *  pressed by accident. */
function FlowPicker({
  flows,
  chosen,
  onPick,
  onAdd,
  onDismiss,
}: {
  flows: WorkflowView[];
  chosen: string;
  onPick: (id: string) => void;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const c = useCopy().configuration.workflows;
  const nameOf = useWorkflowName();
  const [find, setFind] = useState("");
  const wanted = find.trim().toLowerCase();
  const shown = wanted ? flows.filter((f) => nameOf(f).toLowerCase().includes(wanted)) : flows;
  const box = useDismiss<HTMLDivElement>(onDismiss);
  return (
    <div
      ref={box}
      className="absolute left-0 top-full z-30 mt-2 w-full rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-2 shadow-[3px_3px_0_var(--color-nb-ink)]"
    >
      <div className="relative mb-2">
        <FiSearch aria-hidden className="absolute left-2.5 top-2.5 text-[12px] text-nb-ink-soft" />
        <input
          autoFocus
          value={find}
          placeholder={c.findWorkflow}
          onChange={(e) => setFind(e.target.value)}
          className={`${CONTROL} pl-8 text-[12px]`}
        />
      </div>
      {shown.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onPick(f.id)}
          className={`flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2 text-left ${
            f.id === chosen ? "bg-nb-accent-soft" : ""
          }`}
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-[700]">{nameOf(f)}</span>
          {f.builtIn && <span className="shrink-0 text-[10.5px] text-nb-ink-soft">{c.builtIn}</span>}
          {f.isDefault && <Pill>{c.isDefault}</Pill>}
          {f.problems.length > 0 && <Pill tone="peach">{c.notReady}</Pill>}
        </button>
      ))}
      <div className="mt-2 border-t border-nb-ink/10 pt-2">
        <button type="button" onClick={onAdd} className={`${ACCENT_BTN} w-full justify-center`}>
          <FiPlus aria-hidden />
          {c.add}
        </button>
      </div>
    </div>
  );
}

/** One list of agents, searchable. The lead picker and the helper picker are the same list:
 *  both pick ONE agent off the candidates the board offered for this stage. Only the helper
 *  picker can make one — the template writes a helper, never a lead. */
function AgentPicker({
  candidates,
  chosen,
  onPick,
  onNew,
  onDismiss,
}: {
  candidates: WorkflowCandidate[];
  chosen: string;
  onPick: (name: string) => void;
  onNew?: () => void;
  onDismiss: () => void;
}) {
  const c = useCopy().configuration.workflows;
  const nameOf = useCandidateName();
  const glossOf = useCandidateGloss();
  const [find, setFind] = useState("");
  const wanted = find.trim().toLowerCase();
  const shown = wanted
    ? candidates.filter((a) => `${a.name} ${a.title} ${nameOf(a, a.name)}`.toLowerCase().includes(wanted))
    : candidates;
  const box = useDismiss<HTMLDivElement>(onDismiss);
  return (
    <div
      ref={box}
      className="absolute left-0 top-full z-30 mt-2 w-full min-w-[262px] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-2 shadow-[3px_3px_0_var(--color-nb-ink)]"
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
              <span className="block truncate text-[10.5px] text-nb-ink-soft">{glossOf(a, a.name)}</span>
            </span>
            {a.name === chosen && <FiCheck aria-hidden className="text-[13px]" />}
          </button>
        ))
      )}
      {onNew && (
        <div className="mt-1 border-t border-nb-ink/10 pt-1.5">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full cursor-pointer items-center gap-1.5 px-2 text-left text-[12px] font-[700]"
          >
            <FiPlus aria-hidden />
            {c.newAgent}
          </button>
          <span className="mt-0.5 block px-2 pb-1 text-[10.5px] leading-[15px] text-nb-ink-soft">
            {c.newAgentHint}
          </span>
        </div>
      )}
    </div>
  );
}

/** Everything about the WORKFLOW rather than about the agent on screen: renaming it,
 *  duplicating it, whether its deliveries get a Git worktree of their own (#874), and
 *  deleting it. */
function MoreMenu({
  open,
  onOpen,
  onDismiss,
  label,
  flowName,
  items,
  danger,
  flow,
  onSaved,
  onError,
}: {
  open: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  label: string;
  flowName: string;
  items: { label: string; run: () => void }[];
  danger?: { label: string; confirm: string; inUse: (n: number) => string; id: string; run: () => void };
  flow: WorkflowView;
  onSaved: () => Promise<void>;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.workflows;
  // How many open cards the delete would strand, asked as the menu opens so the confirm row
  // can SAY it — a delete that fails after the click is a rule the user learns by hitting it.
  const [held, setHeld] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const box = useDismiss<HTMLDivElement>(onDismiss);
  const on = !flow.needsArtifact;
  useEffect(() => {
    if (!open) return void setAsking(false);
    if (!danger) return;
    void cardsOnWorkflowAction(danger.id).then((res) => setHeld(res.cards.length));
  }, [open, danger]);
  return (
    <div className="relative shrink-0">
      <button type="button" aria-label={label} className={`${QUIET_BTN} px-2`} onClick={onOpen}>
        <FiMoreHorizontal aria-hidden className="text-[17px]" />
      </button>
      {open && (
        <div
          ref={box}
          className="absolute right-0 top-[35px] z-20 w-[258px] rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-1.5 shadow-[3px_3px_0_var(--color-nb-ink)]"
        >
          {/* Whose menu this is. It opens beside the selected agent, so without this line
              every row in it reads as something done to that agent. */}
          <p className={`${CAPTION} truncate px-2.5 pt-1 pb-1.5 text-nb-ink-soft/70`}>{flowName}</p>
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
          {/* On is a branch and a worktree per delivery, for code; off works in the project
              and delivers files. A built-in's is fixed, so it is shown rather than offered. */}
          <div className="mt-1 border-t border-nb-ink/10 px-2.5 pt-2 pb-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-[12px] font-[600]">{c.worktree}</span>
              {flow.builtIn ? (
                <span className="shrink-0 text-[11.5px] text-nb-ink-soft">
                  {on ? c.worktreeOn : c.worktreeOff}
                </span>
              ) : (
                <Switch
                  on={on}
                  label={c.worktree}
                  onFlip={async (next) => {
                    const res = await setWorkflowWorktreeAction(flow.id, next);
                    if (res.ok) await onSaved();
                    else onError?.(c.worktreeSaveFailed);
                  }}
                />
              )}
            </div>
            <p className="mt-1 text-[10.5px] leading-[15px] text-nb-ink-soft">{c.worktreeHint}</p>
          </div>
          {danger && !asking && (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="mt-1 block h-[31px] w-full cursor-pointer rounded-[7px] px-2.5 text-left text-[12px] font-[600] text-nb-peach-ink"
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
                  className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-nb-peach-soft px-2.5 py-1.5 text-[12px] font-[700] text-nb-peach-ink"
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
