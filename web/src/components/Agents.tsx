// 设置 → 工作流 and 看板 (#2106), after legacy kanban-ui/components/Workflows.tsx and Agents.tsx:
// a project's workflows as the approvals their previews make (#2154) then what lands them, the board's own scheduled agents, and one agent
// page for both: its instructions and, when it runs on its own, its cadence and Run now. With no
// agent picked, a workflow shows its own rules (#2166).

import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { FaHammer } from "react-icons/fa";
import { FiAlertCircle, FiArchive, FiArrowDown, FiCheck, FiChevronDown, FiClock, FiEye, FiFileText, FiPlay, FiRotateCcw, FiScissors, FiSearch } from "react-icons/fi";
import { POPUP_PANEL } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { LANG, T } from "../i18n";
import { AGENT_ART } from "../lib/agent-art";

type Data = api.ProjectAgents;
type Item = api.ProjectAgent;
type Flow = Data["workflows"][number];
type Save = (agent: string, body: Parameters<typeof api.updateProjectAgent>[2]) => Promise<void>;

const COMPACT_BTN =
  "inline-flex h-[24px] shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[7px] px-2 text-[11.5px] font-[700] transition-[background-color,transform] duration-100 active:scale-[0.97] nb-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
const POPUP_ROW =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] font-[600] text-nb-ink outline-none hover:bg-nb-wash";
const RUN_ICON: Record<string, ReactNode> = {
  "memory-pruner": <FiScissors size={11} aria-hidden />,
  "project-writer": <FiFileText size={11} aria-hidden />,
  "dismissal-reviewer": <FiRotateCcw size={11} aria-hidden />,
  proposer: <FiRotateCcw size={11} aria-hidden />,
};
const AUTO_NOTE: Record<string, string> = { proposer: "cards", "dismissal-reviewer": "dismissals", "memory-pruner": "pruner" };
const PRESETS = ["6h", "1d", "7d"];

const problemOf = (e: unknown) => (e instanceof api.ApiError && e.code === "offline" ? T.errors.offline : T.errors.generic);
const role = (id: string) => (Object.hasOwn(T.agents.roles, id) ? T.agents.roles[id] : undefined);
const humanise = (id: string) => id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
const whenOf = (a: Item) => a.when?.[LANG] || a.when?.en;
export const titleOf = (a: Pick<Item, "agent" | "title">) => a.title[LANG] || role(a.agent)?.title || humanise(a.agent);
const placeholderOf = (a: Item) => {
  const r = role(a.agent);
  return r?.placeholder ?? (r?.helper ? T.agents.helperPlaceholder(titleOf(a)) : T.agents.placeholder(titleOf(a)));
};
const stub = (agent: string): Item => ({ agent, title: {}, description: {}, when: {}, workflows: [], rule: "", schedule: null, last_run: null });

const CADENCE = /^(\d+)\s*([mhd])(?:\s+at\s+(\d{1,2}):(\d{2}))?$/i;
/** Same reading as cli/src/lib/cadence.ts. */
function parseCadence(raw: string): { n: number; unit: "m" | "h" | "d"; at: string } | null {
  const m = raw.trim().match(CADENCE);
  if (!m || Number(m[1]) < 1) return null;
  const unit = m[2]!.toLowerCase() as "m" | "h" | "d";
  if (m[3] === undefined) return { n: Number(m[1]), unit, at: "" };
  if (unit !== "d" || Number(m[3]) > 23 || Number(m[4]) > 59) return null;
  return { n: Number(m[1]), unit, at: `${m[3].padStart(2, "0")}:${m[4]}` };
}

const isAuto = (s: NonNullable<Item["schedule"]>) => s.cadence.trim().toLowerCase() === "auto";
/** The chip: 已停用, 自动 or the cadence. */
function stateOf(a: Item): string {
  const s = a.schedule!;
  if (!s.on) return T.agents.cadence.off;
  if (isAuto(s)) return T.agents.cadence.auto;
  const c = parseCadence(s.cadence);
  return c ? T.agents.cadence.label(c.n, c.unit, c.at) : s.cadence;
}

/** 下次运行, from the last good run and a fixed cadence; empty when it can't be told. */
function nextRunLine(s: NonNullable<Item["schedule"]>): string {
  const c = parseCadence(s.cadence);
  if (!s.on || !c || !s.last_success) return "";
  const last = new Date(s.last_success.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2"));
  if (Number.isNaN(last.getTime())) return "";
  let next: Date;
  if (c.unit !== "d") next = new Date(last.getTime() + c.n * (c.unit === "m" ? 60_000 : 3_600_000));
  else {
    const [h, m] = c.at ? c.at.split(":").map(Number) : [last.getHours(), last.getMinutes()];
    next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + c.n, h, m);
  }
  const w = T.agents.cadence;
  const hours = (next.getTime() - Date.now()) / 3_600_000;
  return w.nextRun(hours < 1 ? w.soon : hours < 24 ? w.inHours(Math.round(hours)) : hours < 48 ? w.tomorrow : w.inDays(Math.round(hours / 24)));
}

export function useAway(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    // Capture, so Esc closes the popup before the dialog under it.
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key, true);
    };
  }, [ref, open, close]);
}

/** Both project sections, read once per project. */
export function ProjectAgents({ project, section }: { project: string; section: "workflows" | "board" }) {
  const [data, setData] = useState<Data | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    api.readProjectAgents(project).then(setData, (e) => setProblem(problemOf(e)));
  }, [project]);
  if (!data) return problem ? <p className="text-[13px] text-nb-peach-ink">{problem}</p> : null;
  const byId = new Map(data.data.map((a) => [a.agent, a]));
  const of = (id: string) => byId.get(id) ?? stub(id);
  const patch = (a: Item) => setData((d) => d && { ...d, data: d.data.some((x) => x.agent === a.agent) ? d.data.map((x) => (x.agent === a.agent ? a : x)) : [...d.data, a] });
  const save: Save = async (agent, body) => patch(await api.updateProjectAgent(project, agent, body));
  const run = async (agent: string) => {
    await api.runProjectAgent(project, agent);
    const a = of(agent);
    patch({ ...a, last_run: { at: new Date().toISOString(), status: "running" } });
  };
  const page = (a: Item) => <Page key={a.agent} agent={a} board={data.board.includes(a.agent)} save={save} run={run} />;
  const saveFlow = async (flow: string, rule: string) => {
    const f = await api.updateWorkflowRule(project, flow, rule);
    setData((d) => d && { ...d, workflows: d.workflows.map((x) => (x.id === f.id ? f : x)) });
  };
  const flowPage = (f: Flow) => <FlowPage key={f.id} flow={f} save={(rule) => saveFlow(f.id, rule)} />;
  return section === "workflows" ? <WorkflowsPanel flows={data.workflows} of={of} page={page} flowPage={flowPage} /> : <BoardPanel names={data.board} of={of} page={page} />;
}

/** On a phone the page sits under the column: bring it into view on a pick. */
function usePick(first: string) {
  const [held, setHeld] = useState(first);
  const ref = useRef<HTMLDivElement>(null);
  const pick = (id: string) => {
    setHeld(id);
    if (matchMedia("(max-width: 639px)").matches) requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return { held, pick, clear: () => setHeld(""), ref };
}

function WorkflowsPanel({ flows, of, page, flowPage }: { flows: Flow[]; of: (id: string) => Item; page: (a: Item) => ReactNode; flowPage: (f: Flow) => ReactNode }) {
  const c = T.agents;
  const [flowId, setFlowId] = useState(flows[0]?.id ?? "");
  const flow = flows.find((f) => f.id === flowId) ?? flows[0];
  const { held, pick, clear, ref } = usePick("");
  const [picking, setPicking] = useState(false);
  if (!flow) return <p className="text-[13px] text-nb-ink-soft">{c.noWorkflows}</p>;
  const row = (id: string) => <StageRow key={id} agent={of(id)} held={id === held} onPick={() => pick(id)} />;
  const preview = (id: string) => <StageRow key={id} agent={of(id)} held={id === held} onPick={() => pick(id)} preview />;
  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex flex-1 items-stretch gap-6 max-sm:flex-col max-sm:gap-4">
        <div
          className="relative w-[292px] shrink-0 border-r border-nb-ink/10 max-sm:w-full max-sm:border-r-0 max-sm:border-b max-sm:pb-4"
          onClick={(e) => {
            const hit = (e.target as Element).closest("button, [role=dialog]");
            if (!hit || !e.currentTarget.contains(hit)) clear();
          }}
        >
          <div className="flex flex-col sm:absolute sm:inset-y-0 sm:left-0 sm:right-6">
            <FlowPicker
              flows={flows}
              flow={flow}
              open={picking}
              onOpen={setPicking}
              onPick={(f) => {
                setPicking(false);
                setFlowId(f.id);
                clear();
              }}
            />
            <div className="-ml-1 -mr-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pl-1 pr-2 pt-2.5">
              {flow.stages.map((stage, i) => (
                <Fragment key={i}>
                  {i > 0 && <Down />}
                  <section className="relative min-w-0 shrink-0 rounded-[12px] border border-nb-ink/10 px-1 pb-2.5 pt-5">
                    <Legend icon={<FiEye aria-hidden className="text-[11px]" />} label={c.approval(i + 1)} />
                    {stage.map(preview)}
                  </section>
                </Fragment>
              ))}
              {flow.stages.length > 0 && <Down />}
              {flow.land.length > 0 ? (
                <section className="relative min-w-0 shrink-0 rounded-[12px] border border-nb-ink/10 px-1 pb-2.5 pt-5">
                  <Legend icon={<FaHammer aria-hidden className="text-[11px]" />} label={c.land} />
                  {flow.land.map(row)}
                </section>
              ) : (
                <p className="flex shrink-0 items-center justify-center gap-1.5 text-[12px] font-[600] text-nb-ink-soft">
                  <FiArchive aria-hidden className="text-[12px]" />
                  {c.archives}
                </p>
              )}
              {flow.scheduled.length > 0 && (
                <section className="relative mt-6 min-w-0 shrink-0 rounded-[12px] border border-nb-ink/10 px-1 pb-2.5 pt-3.5">
                  <Legend icon={<FiClock aria-hidden className="text-[11px]" />} label={c.scheduled} />
                  <Rule label={c.scheduledWhen} />
                  {flow.scheduled.map(row)}
                </section>
              )}
            </div>
          </div>
        </div>
        <div ref={ref} className="flex min-w-0 flex-1 flex-col max-sm:scroll-mt-4">
          {held ? page(of(held)) : flowPage(flow)}
        </div>
      </div>
    </div>
  );
}

const Down = () => <FiArrowDown aria-hidden strokeWidth={2.5} className="mx-auto mb-2 shrink-0 text-[16px] text-nb-ink" />;

function Legend({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <h4 className="absolute -top-[10px] left-2 flex items-center gap-1.5 bg-nb-paper px-1.5">
      <span className="grid size-[20px] shrink-0 place-items-center rounded-[6px] bg-nb-canvas text-nb-ink">{icon}</span>
      <span className="text-[12.5px] font-[500] leading-[20px] text-nb-ink">{label}</span>
    </h4>
  );
}

function Rule({ label }: { label: string }) {
  return (
    <div role="separator" aria-label={label} className="flex h-[26px] items-center gap-2 px-2.5">
      <span className="shrink-0 text-[10.5px] font-[700] leading-[14px] text-nb-ink-soft/70">{label}</span>
      <span className="h-px flex-1 bg-nb-ink/10" />
    </div>
  );
}

const offOf = (a: Item) => !!a.schedule && !a.schedule.on;

function StageRow({ agent, held, onPick, preview }: { agent: Item; held: boolean; onPick: () => void; preview?: boolean }) {
  const off = offOf(agent);
  return (
    <div className={`relative flex w-full items-center gap-2 rounded-[9px] px-2.5 py-[5px] transition-colors duration-100 ${held ? "" : "hover:bg-nb-sheet"}`}>
      {held && <span aria-hidden className="absolute inset-y-[6px] -left-[6px] w-[3px] rounded-full bg-nb-accent" />}
      <button type="button" aria-current={held} onClick={onPick} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left nb-focus">
        <span className={`flex size-[26px] shrink-0 items-end justify-center ${off ? "opacity-30 grayscale" : ""}`}>
          <Character name={agent.agent} size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[12.5px] font-[700] leading-[16px] ${off ? "text-nb-ink-soft" : "text-nb-ink"}`}>{titleOf(agent)}</span>
          {preview && <span className="block truncate text-[11px] leading-[15px] text-nb-ink-soft">{whenOf(agent) || T.agents.everyCard}</span>}
        </span>
      </button>
    </div>
  );
}

const flowName = (f: Flow) => f.names[LANG] ?? f.name;

/** The workflows this project uses, searchable. */
function FlowPicker({ flows, flow, open, onOpen, onPick }: { flows: Flow[]; flow: Flow; open: boolean; onOpen: (v: boolean) => void; onPick: (f: Flow) => void }) {
  const c = T.agents;
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  useAway(box, open, () => onOpen(false));
  useEffect(() => setQ(""), [open]);
  const shown = flows.filter((f) => flowName(f).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div ref={box} className="relative mb-4 shrink-0">
      <button
        type="button"
        aria-label={c.workflows}
        aria-expanded={open}
        onClick={() => onOpen(!open)}
        className="flex h-[44px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-nb-wash px-3 text-nb-ink nb-focus"
      >
        <span className="min-w-0 flex-1 truncate text-left text-[14px] font-[800]">{flowName(flow)}</span>
        {flow.builtin && <span className="shrink-0 text-[11px] font-normal text-nb-ink-soft">{c.builtIn}</span>}
        <FiChevronDown aria-hidden className={cn("shrink-0 text-nb-ink-soft", open && "rotate-180")} />
      </button>
      {open && (
        <div role="dialog" aria-label={c.workflows} className={cn(POPUP_PANEL, "absolute inset-x-0 top-[calc(100%+6px)] z-30 p-1")}>
          <div className="relative mb-1 p-1">
            <FiSearch aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-nb-ink-soft" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && shown[0] && onPick(shown[0])}
              placeholder={c.findWorkflow}
              className="w-full rounded-[8px] bg-nb-wash py-1.5 pl-8 pr-2.5 text-[12px] text-nb-ink placeholder:text-nb-ink-soft/60 nb-field max-md:text-[16px]"
            />
          </div>
          <div role="listbox" aria-label={c.workflows} className="max-h-[320px] overflow-y-auto">
            {shown.map((f) => (
              <button key={f.id} type="button" role="option" aria-selected={f.id === flow.id} onClick={() => onPick(f)} className={cn(POPUP_ROW, "py-2 pr-8")}>
                <span className="min-w-0 flex-1 break-words text-[12.5px] font-[700]">{flowName(f)}</span>
                {f.id === flow.id && (
                  <span className="absolute right-2.5 flex items-center text-nb-accent-deep">
                    <FiCheck aria-hidden className="size-[13px]" />
                  </span>
                )}
              </button>
            ))}
            {shown.length === 0 && <p className="px-2.5 py-2 text-[12px] text-nb-ink-soft">{c.noMatches}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** 看板: the board's own agents, all of them on a schedule. */
function BoardPanel({ names, of, page }: { names: string[]; of: (id: string) => Item; page: (a: Item) => ReactNode }) {
  const { held, pick, ref } = usePick(names[0] ?? "");
  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex flex-1 items-stretch gap-6 max-sm:flex-col max-sm:gap-4">
        <div className="w-[292px] shrink-0 border-r border-nb-ink/10 pr-6 max-sm:w-full max-sm:border-r-0 max-sm:border-b max-sm:pr-0 max-sm:pb-4">
          <section>
            <h4 className="mb-1.5 text-[12.5px] font-[600] text-nb-ink-soft">{T.agents.onSchedule}</h4>
            <div className="flex flex-col">
              {names.map((id) => (
                <PickRow key={id} agent={of(id)} held={id === held} onPick={() => pick(id)} />
              ))}
            </div>
          </section>
        </div>
        <div ref={ref} className="flex min-w-0 flex-1 flex-col max-sm:scroll-mt-4">
          {held && page(of(held))}
        </div>
      </div>
    </div>
  );
}

function PickRow({ agent, held, onPick }: { agent: Item; held: boolean; onPick: () => void }) {
  const off = offOf(agent);
  return (
    <div className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 py-[7px] transition-colors duration-100 ${held ? "bg-nb-accent-soft" : "hover:bg-nb-sheet"}`}>
      <button type="button" aria-current={held} onClick={onPick} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left nb-focus">
        <span className={`flex size-[26px] shrink-0 items-end justify-center ${off ? "opacity-30 grayscale" : ""}`}>
          <Character name={agent.agent} size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[12.5px] font-[700] leading-[16px] ${off ? "text-nb-ink-soft" : "text-nb-ink"}`}>{titleOf(agent)}</span>
          {agent.schedule && <span className="mt-[1px] block truncate text-[11px] leading-[14px] text-nb-ink-soft">{stateOf(agent)}</span>}
        </span>
      </button>
    </div>
  );
}

type Note = { kind: "idle" } | { kind: "saved" } | { kind: "failed"; why: string };

function Page({ agent, board, save, run }: { agent: Item; board: boolean; save: Save; run: (agent: string) => Promise<void> }) {
  const c = T.agents;
  const r = role(agent.agent);
  const title = titleOf(agent);
  const off = offOf(agent);
  const [problem, setProblem] = useState<string | null>(null);
  const when = board ? r?.when : whenOf(agent);
  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex size-[44px] shrink-0 items-end justify-center ${off ? "opacity-30 grayscale" : ""}`}>
          <Character name={agent.agent} size={44} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-[24px] items-center justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 truncate text-[14px] font-[800] text-nb-ink">{title}</span>
            </div>
            {agent.schedule && <ScheduledControls agent={agent} board={board} save={save} run={run} onProblem={setProblem} />}
          </div>
          <p className={`${agent.schedule ? "mt-2" : "mt-0.5"} max-w-[74ch] text-[12px] leading-snug text-nb-ink-soft`}>{agent.description[LANG] || r?.gloss}</p>
          {when && (
            <p className="mt-1 max-w-[74ch] text-[11.5px] leading-snug text-nb-ink-soft">
              <span className="font-[600]">{c.runsWhen}</span> {when}
            </p>
          )}
          {problem && <p className="mt-1.5 text-[11.5px] leading-snug text-nb-peach-ink">{problem}</p>}
        </div>
      </div>

      <hr className="shrink-0 border-nb-ink/10" />

      <RuleBox value={agent.rule} label={c.rule} placeholder={placeholderOf(agent)} save={(rule) => save(agent.agent, { rule })} failed={(why) => c.ruleFailed(title, why)} />

      {board && r?.note && <p className="max-w-[74ch] shrink-0 text-[11.5px] leading-relaxed text-nb-ink-soft">{r.note}</p>}
    </div>
  );
}

/** 你的要求, saved on blur: an agent's, or a workflow's own. */
function RuleBox({ value, label, placeholder, save, failed }: { value: string; label: string; placeholder: string; save: (rule: string) => Promise<void>; failed: (why: string) => string }) {
  const [draft, setDraft] = useState(value);
  const [note, setNote] = useState<Note>({ kind: "idle" });
  const commit = async () => {
    if (draft.trim() === value.trim()) return;
    try {
      await save(draft.trim());
      setNote({ kind: "saved" });
    } catch (e) {
      setNote({ kind: "failed", why: problemOf(e) });
    }
  };
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h4 className="shrink-0 text-[13.5px] font-[800] leading-tight text-nb-ink">{T.agents.rule}</h4>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (note.kind === "saved") setNote({ kind: "idle" });
        }}
        onBlur={() => void commit()}
        aria-label={label}
        spellCheck={false}
        placeholder={placeholder}
        className="mt-2 min-h-[110px] w-full flex-1 resize-none rounded-[10px] bg-nb-wash px-3 py-2.5 text-[12px] leading-[17px] text-nb-ink placeholder:text-nb-ink-soft/60 nb-field max-md:text-[16px]"
        style={note.kind === "failed" ? { outline: "1.5px solid var(--color-nb-ink)", outlineOffset: "-1.5px" } : undefined}
      />
      {note.kind === "failed" ? (
        <p className="mt-2 flex shrink-0 items-start gap-2 rounded-[9px] bg-nb-peach-soft px-2.5 py-[7px] text-[11.5px] leading-[16px] text-nb-peach-ink">
          <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
          <span className="min-w-0">{failed(note.why)}</span>
        </p>
      ) : note.kind === "saved" ? (
        <p className="mt-1.5 flex shrink-0 items-center gap-1 text-[11.5px] font-[700] text-nb-mint-ink">
          <FiCheck aria-hidden />
          {T.agents.saved}
        </p>
      ) : (
        <p className="mt-1.5 shrink-0 text-[11.5px] text-nb-ink-soft">{T.agents.savedHere}</p>
      )}
    </section>
  );
}

/** 工作流规则: how every card on the workflow is written. */
function FlowPage({ flow, save }: { flow: Flow; save: (rule: string) => Promise<void> }) {
  const c = T.agents;
  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-[44px] shrink-0 place-items-center rounded-[12px] bg-nb-canvas text-nb-ink">
          <FiFileText aria-hidden className="text-[20px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-[24px] items-center">
            <span className="min-w-0 truncate text-[14px] font-[800] text-nb-ink">{c.workflowRules}</span>
          </div>
          <p className="mt-0.5 max-w-[74ch] text-[12px] leading-snug text-nb-ink-soft">{c.workflowRulesGloss}</p>
        </div>
      </div>

      <hr className="shrink-0 border-nb-ink/10" />

      <RuleBox value={flow.rule} label={c.workflowRules} placeholder={c.workflowRulesPlaceholder} save={save} failed={c.workflowRulesFailed} />
    </div>
  );
}

function ScheduledControls({ agent, board, save, run, onProblem }: { agent: Item; board: boolean; save: Save; run: (agent: string) => Promise<void>; onProblem: (p: string | null) => void }) {
  const c = T.agents;
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const close = () => setOpen(false);
  useAway(box, open, close);
  const running = starting || agent.last_run?.status === "running";
  const warn = agent.last_run?.status === "failed";
  const start = async () => {
    setStarting(true);
    onProblem(null);
    try {
      await run(agent.agent);
    } catch (e) {
      onProblem(c.runFailed(problemOf(e)));
    }
    setStarting(false);
  };
  const runLabel = board ? (role(agent.agent)?.run ?? c.run) : c.run;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span ref={box} className="relative inline-flex">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`${COMPACT_BTN} ${warn ? "bg-nb-peach-soft text-nb-peach-ink hover:bg-nb-peach-soft/80" : "bg-nb-ink/[0.08] text-nb-ink hover:bg-nb-ink/[0.12]"}`}
        >
          <FiClock size={11} aria-hidden className={warn ? "" : "text-nb-ink-soft"} />
          {stateOf(agent)}
          <FiChevronDown size={10} aria-hidden className={cn(warn ? "" : "text-nb-ink-soft", open && "rotate-180")} />
        </button>
        {open && (
          <CadenceMenu
            agent={agent}
            onSave={async (schedule) => {
              onProblem(null);
              try {
                await save(agent.agent, { schedule });
                close();
              } catch (e) {
                if (e instanceof api.ApiError && e.status === 400) return c.cadence.badCadence;
                close();
                onProblem(c.cadence.saveFailed(problemOf(e)));
              }
              return null;
            }}
          />
        )}
      </span>
      <button type="button" disabled={running} onClick={() => void start()} className={`${COMPACT_BTN} bg-nb-accent-soft text-nb-accent-deep hover:bg-nb-accent/28`}>
        {RUN_ICON[agent.agent] ?? <FiPlay size={11} aria-hidden />}
        {running ? c.running : runLabel}
      </button>
    </div>
  );
}

/** 下次运行 first, the presets, 自定义, then 停用 or 启用. `onSave` answers a refusal to show. */
function CadenceMenu({ agent, onSave }: { agent: Item; onSave: (s: { on: boolean; cadence: string }) => Promise<string | null> }) {
  const c = T.agents.cadence;
  const s = agent.schedule!;
  const auto = isAuto(s);
  const saved = parseCadence(s.cadence);
  const preset = PRESETS.find((p) => saved && parseCadence(p)?.n === saved.n && parseCadence(p)?.unit === saved.unit && !saved.at);
  const picked = !s.on ? null : auto ? "auto" : (preset ?? "custom");
  const [custom, setCustom] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const next = nextRunLine(s);
  const noteKey = AUTO_NOTE[agent.agent];
  const rows = [
    { id: "auto", label: c.auto, note: noteKey ? c.autoNote[noteKey] : "" },
    { id: "6h", label: c.label(6, "h", "") },
    { id: "1d", label: c.label(1, "d", "") },
    { id: "7d", label: c.label(7, "d", "") },
    { id: "custom", label: c.custom },
  ];
  const submit = async () => {
    const text = custom?.trim() ?? "";
    if (!parseCadence(text)) return setRefused(c.badCadence);
    setRefused(await onSave({ on: true, cadence: text }));
  };
  return (
    <div role="dialog" className={cn(POPUP_PANEL, "absolute right-0 top-[calc(100%+6px)] z-30 w-[232px] p-1 text-left max-sm:left-0 max-sm:right-auto")}>
      {next && (
        <>
          <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] leading-[16px] text-nb-ink-soft">{next}</p>
          <hr className="my-1 border-nb-ink/10" />
        </>
      )}
      <div role="listbox" className="flex flex-col">
        {rows.map((r) => {
          const on = r.id === picked;
          return (
            <Fragment key={r.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  if (r.id === "custom") return setCustom(custom === null ? (picked === "custom" ? s.cadence : "") : null);
                  void onSave({ on: true, cadence: r.id });
                }}
                className={cn(POPUP_ROW, "gap-3 pr-8 font-[500]", on && "font-[800]")}
              >
                {r.note ? (
                  <span className="flex min-w-0 flex-col">
                    {r.label}
                    <span className="text-[11px] font-[400] leading-[15px] text-nb-ink-soft">{r.note}</span>
                  </span>
                ) : (
                  r.label
                )}
                {r.id === "custom" && <FiChevronDown size={11} aria-hidden className={cn("-ml-2 shrink-0 opacity-45", custom !== null && "rotate-180")} />}
                {r.id === "custom" && on && saved && <span className="ml-auto truncate text-[11px] font-[500] text-nb-ink-soft">{c.label(saved.n, saved.unit, saved.at)}</span>}
                {on && (
                  <span className="absolute right-2.5 flex items-center text-nb-accent-deep">
                    <FiCheck size={13} aria-hidden />
                  </span>
                )}
              </button>
              {r.id === "custom" && custom !== null && (
                <div className="px-1.5 pb-1.5 pt-0.5">
                  <input
                    autoFocus
                    value={custom}
                    onChange={(e) => {
                      setCustom(e.target.value);
                      setRefused(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && void submit()}
                    aria-label={c.custom}
                    placeholder={c.customPlaceholder}
                    spellCheck={false}
                    autoCapitalize="off"
                    className="w-full rounded-[8px] bg-nb-wash px-2.5 py-1.5 font-mono text-[12px] text-nb-ink placeholder:font-sans placeholder:text-nb-ink-soft/60 nb-field max-md:text-[16px]"
                  />
                  {refused && <p className="mt-1 text-[11px] leading-[15px] text-nb-peach-ink">{refused}</p>}
                </div>
              )}
            </Fragment>
          );
        })}
        <hr className="my-1 border-nb-ink/10" />
        <button
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => void onSave({ on: !s.on, cadence: s.cadence })}
          className={cn(POPUP_ROW, "pr-8 font-[500]", s.on && "text-nb-peach-ink")}
        >
          {s.on ? c.disable : c.enable}
        </button>
      </div>
    </div>
  );
}

export function Character({ name, size = 48 }: { name: string; size?: number }) {
  const art = Object.hasOwn(AGENT_ART, name) ? AGENT_ART[name] : null;
  if (!art) return <Lettered name={name} size={size} />;
  return <img src={art} alt="" width={size} height={size} style={{ imageRendering: "pixelated" }} />;
}

function Lettered({ name, size = 48 }: { name: string; size?: number }) {
  const u = size / 48;
  const badge = Math.max(7 * u, 11);
  return (
    <span className="relative block" style={{ height: size, width: size }}>
      <img src={AGENT_ART.base} alt="" width={size} height={size} style={{ imageRendering: "pixelated" }} />
      <span
        aria-hidden
        className="absolute flex items-center justify-center rounded-full font-[800] leading-none"
        style={{
          left: 34.5 * u - badge / 2,
          top: 26.5 * u - badge / 2,
          width: badge,
          height: badge,
          fontSize: badge * 0.7,
          color: "#24231f",
          background: badge > 7 * u ? "#f6f2e6" : undefined,
          boxShadow: badge > 7 * u ? "0 0 0 1px #0b0a09" : undefined,
        }}
      >
        {([...name.trim()][0] ?? "?").toLocaleUpperCase()}
      </span>
    </span>
  );
}
