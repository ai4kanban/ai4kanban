// 设置 (#2074, #2080, #2106), after legacy kanban-ui/components/Configuration.tsx and Runtimes.tsx: a
// dialog of the account's sections, each mounted only while shown: 通用 (#2132), 运行时 and 账单, then 工作流,
// a link to the current project's workflow settings in a new tab (#21); the
// workspace and the project have their own settings pages (#2201). The runtime list is the
// account's own, Global default first. Each runtime is bound to one Runner (#2135); an open row is
// a list of settings — Runner, connector, model, then what that connector declares. The API key
// lives only on the Runner: the page can replace or clear it, never read it.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FiAlertCircle, FiCheck, FiChevronDown, FiChevronRight, FiCopy, FiCreditCard, FiEdit3, FiExternalLink, FiGitCommit, FiKey, FiPlus, FiRefreshCw, FiSettings, FiSliders, FiTerminal, FiTrash2, FiX, FiZap } from "react-icons/fi";
import { AgentMark, type Harness } from "@review/components/agent-mark";
import { Button } from "@review/components/button";
import { Menu, POPUP_PANEL, type MenuEntry } from "@review/components/menu";
import { useShown } from "@review/lib/motion";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { F } from "../first-run-i18n";
import { settingText, T } from "../i18n";
import { projectSettingsHref } from "../lib/settings";
import { useStore } from "../store";
import { BillingPanel } from "./Billing";
import { GeneralPanel, replayTour } from "./Welcome";

const OPEN = "wc:settings";
/** Sent whenever the list changes, so a runtime pick reads it again. */
export const RUNTIMES_CHANGED = "wc:runtimes";

export type Section = "general" | "runtimes" | "billing";
const ACCOUNT = [
  { id: "general" as const, label: () => F.general.section, icon: FiSliders },
  { id: "runtimes" as const, label: () => T.runtimes.section, icon: FiTerminal },
  { id: "billing" as const, label: () => T.billing.section, icon: FiCreditCard },
];

export const openSettings = (section: Section = "general") => window.dispatchEvent(new CustomEvent<Section>(OPEN, { detail: section }));
const changed = () => window.dispatchEvent(new Event(RUNTIMES_CHANGED));

export const MARK: Record<api.Connector, Harness> = { "claude-code": "claude", codex: "codex", cursor: "cursor", opencode: "opencode", kimi: "kimi", dsh: "dsh", zcode: "zcode", grok: "grok" };
export const LABEL: Record<api.Connector, string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor", opencode: "OpenCode", kimi: "Kimi Code", dsh: "DSH", zcode: "ZCode", grok: "Grok Build" };
export const LOGIN: Record<api.Connector, string> = {
  "claude-code": "claude /login",
  codex: "codex login",
  cursor: "cursor-agent login",
  opencode: "opencode auth login",
  kimi: "kimi login",
  dsh: "dsh login",
  zcode: "zcode login",
  grok: "grok login",
};
export const INSTALL: Record<api.Connector, string> = {
  "claude-code": "npm install -g @anthropic-ai/claude-code",
  codex: "npm install -g @openai/codex",
  cursor: "curl https://cursor.com/install -fsS | bash",
  opencode: "curl -fsSL https://opencode.ai/install | bash",
  kimi: "curl -LsSf https://code.kimi.com/install.sh | bash",
  dsh: "npm install -g @deepseek-ai/dsh && npm install -g @openma/deepseek-harness-acp",
  zcode: "npm install -g zcode-app-cli",
  grok: "curl -fsSL https://x.ai/cli/install.sh | bash",
};
export const CONNECTORS = Object.keys(LABEL) as api.Connector[];
const MODEL = /^[^\s"'`\\$;|&<>]{1,200}$/;

export const runtimeName = (r: api.Runtime) => (r.default ? T.runtimes.globalDefault : r.name);
/** 未安装 / 未登录 for a connector the Runner reports not ready. */
export const notReady = (list: api.RuntimeList | null, c: api.Connector) => {
  const s = list?.connectors[c];
  return s === "not_installed" ? T.runtimes.notInstalled : s === "signed_out" ? T.runtimes.signedOut : "";
};

const CAPTION = "text-[11px] font-[700] uppercase leading-[14px] tracking-[0.1em]";
const QUIET_BTN =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-nb-wash px-2.5 py-1.5 text-[12px] font-[700] text-nb-ink transition-[background-color,transform] duration-100 hover:bg-nb-canvas active:scale-[0.97] nb-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
const ACCENT_BTN =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-nb-accent-soft px-2.5 py-1.5 text-[12px] font-[700] text-nb-accent-deep transition-[background-color,transform] duration-100 hover:bg-nb-accent/28 active:scale-[0.97] nb-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
const CONTROL = "w-full rounded-[10px] bg-nb-wash px-3 py-2 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 nb-field max-md:text-[16px]";
const EDITING = { outline: "1.5px solid var(--color-nb-ink)", outlineOffset: "-1.5px" };

/** The top bar's 设置. */
export function SettingsButton() {
  return (
    <span className="nb-tip nb-tip-below inline-flex" data-tip={T.settings}>
      <Button variant="ghost" size="xs" className="w-7 shrink-0 px-0" aria-label={T.settings} onClick={() => openSettings()}>
        <FiSettings className="text-[14px]" aria-hidden />
      </Button>
    </span>
  );
}

/** Mounted once, in the window: shows the dialog whenever something opens it. */
export function SettingsHost() {
  const [open, setOpen] = useState<Section | null>(null);
  useEffect(() => {
    const show = (e: Event) => setOpen((e as CustomEvent<Section>).detail);
    window.addEventListener(OPEN, show);
    return () => window.removeEventListener(OPEN, show);
  }, []);
  const [last, setLast] = useState<Section>("general");
  if (open && open !== last) setLast(open);
  const shown = useShown(!!open, 150);
  return shown ? <SettingsDialog section={open ?? last} closing={!open} onPick={setOpen} onClose={() => setOpen(null)} /> : null;
}

const NAV_ITEM =
  "relative flex w-full cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-[700] nb-focus max-md:w-auto max-md:shrink-0 max-md:whitespace-nowrap max-md:rounded-none max-md:px-0 max-md:py-2.5";

function SettingsDialog({ section, closing, onPick, onClose }: { section: Section; closing: boolean; onPick: (s: Section) => void; onClose: () => void }) {
  const project = useStore().current;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="nb-scrim z-50" data-closing={closing || undefined} style={{ alignItems: "center" }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label={T.settings} className="nb-panel nb-pop relative flex flex-col" style={{ width: 1040, maxWidth: "100%", height: "min(760px, calc(100dvh - 2rem))" }}>
        <div className="flex shrink-0 items-center justify-between border-b border-nb-ink/12 px-5 py-3">
          <h2 className="min-w-0 truncate text-[15px] font-[800] tracking-[-0.02em]">{T.settings}</h2>
          <button type="button" aria-label={T.close} onClick={onClose} className="-mr-1 grid size-7 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink">
            <FiX className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-b-[14px] max-md:flex-col">
          <nav aria-label={T.settings} className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-nb-ink/10 bg-nb-cream p-3 max-md:w-auto max-md:flex-row max-md:items-center max-md:gap-5 max-md:border-b max-md:border-r-0 max-md:bg-transparent max-md:px-4 max-md:py-0">
            {ACCOUNT.map(({ id, label, icon: Icon }) => {
              const on = id === section;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={on || undefined}
                  onClick={() => onPick(id)}
                  className={cn(
                    NAV_ITEM,
                    on ? "bg-nb-accent-soft text-nb-accent-deep max-md:bg-transparent max-md:text-nb-ink" : "text-nb-ink-soft hover:bg-nb-ink/5 hover:text-nb-ink max-md:hover:bg-transparent",
                  )}
                >
                  <Icon className="shrink-0 text-[15px] max-md:hidden" aria-hidden />
                  {label()}
                  {on && <span aria-hidden className="absolute inset-x-0 bottom-[-1px] hidden h-[2px] rounded-full bg-nb-ink max-md:block" />}
                </button>
              );
            })}
            {project && (
              <a href={projectSettingsHref(project.id, "workflows")} target="_blank" rel="noreferrer" className={cn(NAV_ITEM, "text-nb-ink-soft no-underline hover:bg-nb-ink/5 hover:text-nb-ink max-md:hover:bg-transparent")}>
                <FiGitCommit className="shrink-0 text-[15px] max-md:hidden" aria-hidden />
                {T.agents.workflows}
                <FiExternalLink className="ml-auto shrink-0 text-[12px] opacity-60 max-md:ml-0" aria-hidden />
              </a>
            )}
          </nav>
          <div key={section} className="a4k-reveal min-h-0 flex-1 overflow-y-auto p-6 pb-12 max-md:px-4 max-md:pt-5">
            {section === "general" && (
              <GeneralPanel
                onReplay={() => {
                  onClose();
                  replayTour();
                }}
              />
            )}
            {section === "runtimes" && <RuntimesPanel />}
            {section === "billing" && <BillingPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

type Test = { kind: "idle" } | { kind: "running" } | { kind: "passed"; s: string } | { kind: "failed"; text: string; detail?: string };

const problemOf = (e: unknown) => {
  const code = e instanceof api.ApiError ? e.code : "";
  return code === "offline" ? T.errors.offline : code === "runner_offline" ? T.runtimes.keyOffline : code === "runner_outdated" ? T.runtimes.keyOutdated : T.errors.generic;
};

/** What the Runner reported `c` offers, and the saved model's name among them. */
const modelsOf = (list: api.RuntimeList, c: api.Connector) => list.models?.[c] ?? [];
const modelName = (list: api.RuntimeList, c: api.Connector, model: string | null) =>
  model ? (modelsOf(list, c).find((m) => m.id === model)?.name ?? model) : T.runtimes.defaultModel;
const runnerOf = (list: api.RuntimeList, r: api.Runtime) => list.runners?.find((x) => x.id === r.runner) ?? null;
/** True when the runtime has no Runner, or its Runner is no longer the account's: it can't run. */
export const runnerGone = (list: api.RuntimeList, r: api.Runtime) => !runnerOf(list, r);

/** The ids of the runtimes that can't run because their Runner was removed. */
export function useGoneRuntimes(): string[] {
  const [gone, setGone] = useState<string[]>([]);
  useEffect(() => {
    const load = () => api.listRuntimes().then((l) => setGone(l.data.filter((r) => runnerGone(l, r)).map((r) => r.id)), () => {});
    void load();
    window.addEventListener(RUNTIMES_CHANGED, load);
    return () => window.removeEventListener(RUNTIMES_CHANGED, load);
  }, []);
  return gone;
}

function RuntimesPanel() {
  const [list, setList] = useState<api.RuntimeList | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tests, setTests] = useState<Record<string, Test>>({});

  const load = useCallback(() => api.listRuntimes().then(setList, (e) => setProblem(problemOf(e))), []);
  useEffect(() => void load(), [load]);

  const save = async (work: () => Promise<unknown>) => {
    setProblem(null);
    let ok = true;
    try {
      await work();
      changed();
    } catch (e) {
      setProblem(problemOf(e));
      ok = false;
    }
    await load();
    return ok;
  };

  // A test is also 重新检测: the Runner looks for every connector again before it answers.
  const test = async (r: api.Runtime) => {
    setTests((t) => ({ ...t, [r.id]: { kind: "running" } }));
    let next: Test;
    try {
      const res = await api.testRuntime(r.id);
      const h = LABEL[res.connector];
      const s = ((res.elapsed_ms ?? 0) / 1000).toFixed(res.result === "timeout" ? 0 : 1);
      next =
        res.result === "passed" ? { kind: "passed", s }
        : res.result === "signed_out" ? { kind: "failed", text: T.test.signedOut(h) }
        : res.result === "not_installed" ? { kind: "failed", text: T.test.notInstalled(h) }
        : res.result === "timeout" ? { kind: "failed", text: T.test.timedOut(s) }
        : { kind: "failed", text: T.test.failed(h), detail: res.message ?? "" };
    } catch (e) {
      next = { kind: "failed", text: e instanceof api.ApiError && e.code === "runner_offline" ? T.test.offline : problemOf(e) };
    }
    await load();
    changed();
    setTests((t) => ({ ...t, [r.id]: next }));
  };

  if (!list) return problem ? <p className="text-[13px] text-nb-peach-ink">{problem}</p> : null;
  const taken = (name: string, except?: string) => list.data.some((r) => r.id !== except && r.name.toLowerCase() === name.trim().toLowerCase());
  return (
    <div className="flex flex-col">
      <div className="rounded-[12px] bg-nb-sheet">
        {list.data.map((r) => (
          <Row
            key={r.id}
            row={r}
            list={list}
            open={open === r.id}
            onToggle={() => setOpen(open === r.id ? null : r.id)}
            test={tests[r.id] ?? { kind: "idle" }}
            onTest={() => void test(r)}
            taken={(name) => taken(name, r.id)}
            onChange={(body) => save(() => api.updateRuntime(r.id, body))}
            onDelete={() => save(() => api.deleteRuntime(r.id))}
          />
        ))}
        {adding && (
          <NewRow
            list={list}
            taken={taken}
            tests={tests}
            onTest={(r) => void test(r)}
            onDone={(body) => {
              setAdding(false);
              if (body) void save(async () => setOpen((await api.createRuntime(body)).id));
            }}
          />
        )}
      </div>
      {problem && <p className="mt-2 text-[12px] text-nb-peach-ink">{problem}</p>}
      <div className="mt-2.5">
        <button type="button" className={QUIET_BTN} disabled={adding} onClick={() => setAdding(true)}>
          <FiPlus className="text-[13px]" aria-hidden />
          {T.runtimes.add}
        </button>
      </div>
    </div>
  );
}

function RowAction({ label, tone = "soft", onClick, children }: { label: string; tone?: "soft" | "accent" | "danger"; onClick: () => void; children: ReactNode }) {
  const ink = {
    soft: "text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink",
    accent: "text-nb-accent-deep hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_14%,transparent)]",
    danger: "text-nb-peach-ink hover:bg-nb-peach-soft",
  }[tone];
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-[7px] transition-colors duration-100 nb-focus ${ink}`}>
      {children}
    </button>
  );
}

const Runs = ({ row, list }: { row: api.Runtime; list: api.RuntimeList }) => (
  <span className="truncate text-[12.5px] text-nb-ink-soft">
    {[runnerOf(list, row)?.name, LABEL[row.connector], modelName(list, row.connector, row.model)].filter(Boolean).join(" · ")}
  </span>
);

function Chip({ peach, children }: { peach?: boolean; children: ReactNode }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-[700]", peach ? "bg-nb-peach-soft text-nb-peach-ink" : "bg-nb-wash text-nb-ink-soft")}>
      {peach ? <FiAlertCircle className="shrink-0 text-[11px]" aria-hidden /> : <span className="size-[6px] shrink-0 rounded-full bg-nb-ink-soft/50" aria-hidden />}
      {children}
    </span>
  );
}

function Row({
  row, list, open, onToggle, test, onTest, taken, onChange, onDelete,
}: {
  row: api.Runtime;
  list: api.RuntimeList;
  open: boolean;
  onToggle: () => void;
  test: Test;
  onTest: () => void;
  taken: (name: string) => boolean;
  onChange: (body: api.RuntimePatch) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const c = T.runtimes;
  const [typed, setTyped] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const runner = runnerOf(list, row);
  const word = notReady(list, row.connector);
  const nameTaken = typed !== null && !!typed.trim() && taken(typed);
  const rename = () => {
    const name = typed?.trim() ?? "";
    if (nameTaken) return;
    setTyped(null);
    if (name && name !== row.name) void onChange({ name });
  };
  return (
    <div className="border-t border-nb-ink/10 first:border-t-0">
      <div className={`flex items-center gap-2 px-3.5 ${open ? "pb-2 pt-3" : "py-3"}`}>
        {typed !== null ? (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <FiChevronRight className="shrink-0 text-[13px] text-nb-ink-soft/40" aria-hidden />
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) rename();
                if (e.key === "Escape") {
                  e.preventDefault();
                  setTyped(null);
                }
              }}
              aria-label={c.name}
              maxLength={60}
              autoFocus
              className="-ml-1.5 w-[220px] max-w-full shrink-0 rounded-[8px] bg-transparent px-1.5 py-0.5 text-[13.5px] font-[700] text-nb-ink nb-field max-md:text-[16px]"
              style={EDITING}
            />
            <span className="flex shrink-0 items-center gap-0.5">
              <RowAction label={c.save} tone="accent" onClick={rename}>
                <FiCheck className="text-[14px]" aria-hidden />
              </RowAction>
              <RowAction label={c.cancel} onClick={() => setTyped(null)}>
                <FiX className="text-[14px]" aria-hidden />
              </RowAction>
            </span>
            {nameTaken ? <span className="text-[12px] text-nb-peach-ink">{c.nameTaken}</span> : (
              <span className="flex min-w-0 flex-1 items-center justify-end">
                <Runs row={row} list={list} />
              </span>
            )}
          </span>
        ) : (
          <>
            <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 shrink cursor-pointer items-center gap-2 text-left nb-focus">
              {open ? <FiChevronDown className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden /> : <FiChevronRight className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />}
              <AgentMark harness={MARK[row.connector]} size={16} />
              <span className={`truncate text-[13.5px] ${open ? "font-[800]" : "font-[700]"}`}>{runtimeName(row)}</span>
            </button>
            {!row.default && (
              <span className="flex shrink-0 items-center gap-0.5">
                <RowAction label={c.rename} onClick={() => setTyped(row.name)}>
                  <FiEdit3 className="text-[13px]" aria-hidden />
                </RowAction>
                <span className="relative shrink-0">
                  <RowAction label={c.remove} tone="danger" onClick={() => setRemoving((v) => !v)}>
                    <FiTrash2 className="text-[13px]" aria-hidden />
                  </RowAction>
                  {removing && <ConfirmDelete name={row.name} onCancel={() => setRemoving(false)} onConfirm={() => void onDelete()} />}
                </span>
              </span>
            )}
            <button type="button" aria-expanded={open} aria-label={runtimeName(row)} onClick={onToggle} className="flex min-w-0 flex-1 cursor-pointer items-center justify-end gap-2 self-stretch text-left nb-focus">
              {!open && <Runs row={row} list={list} />}
            </button>
          </>
        )}
        {open && <Tester test={test} runner={runner} onTest={onTest} />}
        {!open && (!runner ? <Chip peach>{c.runnerRemoved}</Chip> : !runner.online ? <Chip>{c.runnerOffline}</Chip> : word && <Chip peach>{word}</Chip>)}
      </div>
      {open && (
        <div className="flex flex-col gap-4 px-3.5 pb-3.5">
          {test.kind === "failed" && (
            <p aria-live="polite" className="ml-[21px] flex min-w-0 items-start gap-1.5 break-words text-[12px] font-[700] text-nb-peach-ink">
              <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
              <span className="min-w-0">
                {test.text}
                {test.detail && <span className="font-mono font-[500]"> {test.detail}</span>}
              </span>
            </p>
          )}
          {runner && word && <NotReady list={list} connector={row.connector} online={runner.online} test={test} onRecheck={onTest} />}
          <SettingList row={row} list={list} runner={runner} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function ConfirmDelete({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => !box.current?.parentElement?.contains(e.target as Node) && onCancel();
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [onCancel]);
  return (
    <div ref={box} role="alertdialog" className={`${POPUP_PANEL} nb-pop origin-top-left absolute left-0 top-[calc(100%+8px)] z-30 w-[320px] max-w-[calc(100vw-4rem)] rounded-[13px] p-3 text-left`}>
      <p className="text-[13px] font-[700] text-nb-ink">{T.runtimes.removeTitle(name)}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">{T.runtimes.removeBlurb}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={onCancel}>
          {T.runtimes.cancel}
        </Button>
        <Button variant="ghost" size="xs" onClick={onConfirm} style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}>
          {T.runtimes.remove}
        </Button>
      </div>
    </div>
  );
}

function Field({ id, label, help, children }: { id: string; label: string; help: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,17rem)] gap-x-5 max-md:grid-cols-1">
      <label className={`col-start-1 row-start-1 mb-1.5 block ${CAPTION} text-nb-ink-soft`} htmlFor={id}>
        {label}
      </label>
      <div className="col-start-1 row-start-2">{children}</div>
      <div className="col-start-2 row-start-2 flex flex-col justify-center gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft max-md:col-start-1 max-md:row-start-3 max-md:mt-1.5">{help}</div>
    </div>
  );
}

const TRIGGER = "flex w-full cursor-pointer items-center gap-2 rounded-[10px] bg-nb-wash px-3 py-2 text-left text-[13.5px] font-[700] text-nb-ink nb-field";
const LABEL_SM = "mb-1 text-[12px] font-[600] text-nb-ink-soft";
const LINK = "shrink-0 cursor-pointer text-[12.5px] font-[700] text-nb-accent-deep hover:underline nb-focus disabled:cursor-not-allowed disabled:text-nb-ink-soft/50 disabled:no-underline";
const LINE = "flex min-h-[46px] w-full items-center gap-4 px-4";
const LINE_LABEL = "shrink-0 text-[13.5px] font-[600] text-nb-ink";
/** A setting row's menu: under the row, on its right. */
const ROW_MENU = "w-[280px] max-w-[calc(100vw-4rem)]";
const Picked = ({ on }: { on: boolean }) => <FiCheck className={cn("ml-auto shrink-0 text-[14px]", on ? "text-nb-accent-deep" : "invisible")} aria-hidden />;
const Dot = ({ on }: { on: boolean }) => <span className={cn("size-[7px] shrink-0 rounded-full", on ? "bg-nb-mint-ink" : "bg-nb-ink-soft/40")} aria-hidden />;

const runnerItems = (list: api.RuntimeList, picked: string | null, onPick: (id: string) => void): MenuEntry[] =>
  list.runners.map((x) => ({
    key: x.id,
    onSelect: () => x.id !== picked && onPick(x.id),
    body: (
      <>
        <Dot on={x.online} />
        <span className="truncate font-[700]">{x.name}</span>
        {!x.online && <span className="shrink-0 text-[11.5px] text-nb-ink-soft">{T.runtimes.offline}</span>}
        <Picked on={x.id === picked} />
      </>
    ),
  }));

const connectorItems = (list: api.RuntimeList, picked: api.Connector, onPick: (c: api.Connector) => void): MenuEntry[] =>
  CONNECTORS.map((h) => ({
    key: h,
    onSelect: () => h !== picked && onPick(h),
    body: (
      <>
        <AgentMark harness={MARK[h]} size={15} />
        <span className="font-[700]">{LABEL[h]}</span>
        {notReady(list, h) && <span className="text-[11.5px] font-[700] text-nb-peach-ink">{notReady(list, h)}</span>}
        <Picked on={h === picked} />
      </>
    ),
  }));

const modelItems = (list: api.RuntimeList, connector: api.Connector, model: string | null, onModel: (m: string | null) => void, onOther: () => void): MenuEntry[] => {
  const reported = modelsOf(list, connector);
  const known = !model || reported.some((m) => m.id === model);
  return [
    { key: "default", onSelect: () => model && onModel(null), body: <><span className="text-nb-ink-soft">{T.runtimes.defaultModel}</span><Picked on={!model} /></> },
    ...reported.map((m) => ({ key: m.id, onSelect: () => m.id !== model && onModel(m.id), body: <><span className="font-[700]">{m.name}</span><Picked on={m.id === model} /></> })),
    ...(known ? [] : [{ key: model!, onSelect: () => {}, body: <><span className="font-mono font-[700]">{model}</span><Picked on /></> }]),
    { key: "other", onSelect: onOther, body: <span className="text-nb-ink-soft">{T.runtimes.otherModel}</span>, className: "mt-1 rounded-none border-t border-nb-ink/10 pt-2" },
  ];
};

/** A model typed by hand: saved on Enter or leaving the box. */
function ModelInput({ start, onDone, className }: { start: string; onDone: (m: string | null | undefined) => void; className?: string }) {
  const c = T.runtimes;
  const [typed, setTyped] = useState(start);
  const bad = !!typed.trim() && !MODEL.test(typed.trim());
  const commit = () => !bad && onDone(typed.trim() || null);
  return (
    <div className={className}>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) commit();
          if (e.key === "Escape") {
            e.preventDefault();
            onDone(undefined);
          }
        }}
        aria-label={c.model}
        placeholder={c.modelPlaceholder}
        autoFocus
        spellCheck={false}
        autoCapitalize="off"
        maxLength={200}
        className={`${CONTROL} font-mono text-[13px]`}
        style={EDITING}
      />
      {bad && <p className="mt-1.5 text-[12px] text-nb-peach-ink">{c.badModel}</p>}
    </div>
  );
}

/** One setting: its name on the left, its value on the right; the whole row opens it. */
function Setting({ label, title, onClick, disabled, children }: { label: string; title?: string; onClick?: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className="flex min-h-[46px] w-full cursor-pointer items-center gap-4 px-4 text-left hover:bg-nb-wash/60 nb-focus disabled:cursor-default disabled:hover:bg-transparent">
      <span className={LINE_LABEL}>{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-[13.5px] text-nb-ink-soft">{children}</span>
      <FiChevronRight className={cn("shrink-0 text-[14px] text-nb-ink-soft/70", disabled && "opacity-40")} aria-hidden />
    </button>
  );
}

/** The provider in effect: the saved one when it is listed, else the declared default, else the first. */
const providerOf = (pick: api.SettingDecl, settings: Record<string, string>) => {
  const all = pick.providers ?? [];
  return all.find((p) => p.id === settings[pick.key]) ?? all.find((p) => p.id === pick.defaultProvider) ?? all[0];
};

/** The open runtime's settings, one list: its Runner, connector and model, then what the connector declares. */
function SettingList({ row, list, runner, onChange }: { row: api.Runtime; list: api.RuntimeList; runner: api.RunnerInfo | null; onChange: (body: api.RuntimePatch) => Promise<boolean> }) {
  const c = T.runtimes;
  const [other, setOther] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const decls = (list.connector_settings?.[row.connector] ?? []).filter((d) => d.key !== "model");
  const pick = decls.find((d) => d.kind === "provider");
  const secret = decls.find((d) => d.kind === "secret");
  const owned = (key: string) => !!pick?.providers?.some((p) => p.needs.includes(key));
  const usable = !!runner?.online;
  const set = (key: string, value: string) => onChange({ settings: { ...row.settings, [key]: value } });
  const provider = pick && providerOf(pick, row.settings);
  const needs = (key: string) => !owned(key) || !!provider?.needs.includes(key);
  const keySet = !!secret && row.secretsSet.includes(secret.key);
  const where = provider?.needs.map((k) => decls.find((d) => d.key === k && d.kind === "text")).find((d) => d && row.settings[d.key]);
  return (
    <div className="ml-[21px] divide-y divide-nb-ink/8 rounded-[12px] bg-nb-paper max-md:ml-0 [&>*:first-child>button]:rounded-t-[12px] [&>button:last-child]:rounded-b-[12px]">
      <Menu
        full
        align="end"
        panel={ROW_MENU}
        trigger={({ onClick }) => (
          <Setting label={c.runner} onClick={onClick}>
            {runner ? (
              <>
                <Dot on={runner.online} />
                <span className="truncate text-nb-ink">{runner.name}</span>
                {!runner.online && <span className="shrink-0 text-[12.5px]">{c.offline}</span>}
              </>
            ) : (
              <span className="font-[700] text-nb-peach-ink">{c.runnerRemoved}</span>
            )}
          </Setting>
        )}
        items={runnerItems(list, row.runner, (runner) => void onChange({ runner }))}
      />
      {!runner && <p className="px-4 py-2.5 text-[12px] text-nb-peach-ink">{list.runners.length ? c.runnerGone : c.noRunner}</p>}
      <Menu
        full
        align="end"
        panel={ROW_MENU}
        trigger={({ onClick }) => (
          <Setting label={c.connector} onClick={onClick}>
            <AgentMark harness={MARK[row.connector]} size={15} />
            <span className="text-nb-ink">{LABEL[row.connector]}</span>
            {list.connector_versions?.[row.connector] && <span className="text-nb-ink-soft">{list.connector_versions[row.connector]}</span>}
          </Setting>
        )}
        items={connectorItems(list, row.connector, (connector) => void onChange({ connector, model: null, settings: {} }))}
      />
      <Menu
        full
        align="end"
        panel={ROW_MENU}
        trigger={({ onClick }) => (
          <Setting label={c.model} onClick={onClick}>
            <span className={cn("truncate", row.model && "font-mono text-[13px] text-nb-ink")}>{modelName(list, row.connector, row.model)}</span>
          </Setting>
        )}
        items={modelItems(list, row.connector, row.model, (model) => void onChange({ model }), () => setOther(row.model ?? ""))}
      />
      {other !== null && (
        <ModelInput
          start={other}
          className="px-4 py-2.5"
          onDone={(model) => {
            setOther(null);
            if (model !== undefined && model !== row.model) void onChange({ model });
          }}
        />
      )}
      {decls.filter((d) => d.kind === "select" && !owned(d.key)).map((d) => (
        <div key={d.key} className={LINE}>
          <span className={LINE_LABEL} title={d.help && settingText(d.help)}>{settingText(d.label)}</span>
          <span className="ml-auto flex min-w-0 items-center">
            <Level decl={d} value={row.settings[d.key] ?? ""} onPick={(v) => set(d.key, v)} />
          </span>
        </div>
      ))}
      {(pick || secret) && (
        <Setting label={c.api} disabled={!usable} onClick={() => setEditing((v) => !v)}>
          {provider && (
            <span className="truncate">
              {provider.needs.length ? settingText(provider.label) : c.viaDefault}
              {where && <> · <span className="font-mono text-[12.5px]">{row.settings[where.key]!.replace(/^https?:\/\//, "")}</span></>}
            </span>
          )}
          {secret && needs(secret.key) && (keySet ? (
            <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-[700] text-nb-mint-ink">
              <FiKey className="text-[12px]" aria-hidden />
              {c.keySet}
            </span>
          ) : !pick && <span>{c.none}</span>)}
        </Setting>
      )}
      {editing && usable && <ApiEdit row={row} decls={decls} pick={pick} secret={secret} owned={owned} onSave={onChange} onClose={() => setEditing(false)} />}
      {runner && !runner.online && (pick || secret) && <p className="px-4 py-2.5 text-[12px] text-nb-ink-soft">{c.offlineEdit}</p>}
      {decls.filter((d) => d.kind === "text" && !owned(d.key)).map((d) => (
        <TextSetting key={`${row.id}:${d.key}`} decl={d} value={row.settings[d.key] ?? ""} disabled={!usable} onSave={(v) => set(d.key, v)} />
      ))}
    </div>
  );
}

/** A `select` setting as a stepped slider: one stop per declared choice, filled up to the pick. */
function Level({ decl, value, onPick }: { decl: api.SettingDecl; value: string; onPick: (v: string) => Promise<boolean> }) {
  const choices = decl.choices ?? [];
  const [held, setHeld] = useState<number | null>(null);
  const track = useRef<HTMLSpanElement>(null);
  if (choices.length < 2) return null;
  const at = held ?? Math.max(0, choices.findIndex((ch) => ch.value === value));
  const last = choices.length - 1;
  const PAD = 8;
  const x = (i: number) => `calc(${PAD}px + (100% - ${2 * PAD}px) * ${i / last})`;
  const near = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(last, Math.max(0, Math.round(((clientX - r.left - PAD) / (r.width - 2 * PAD)) * last)));
  };
  const commit = (i: number) => {
    setHeld(i);
    if (choices[i]!.value === value) return setHeld(null);
    void onPick(choices[i]!.value).then(() => setHeld(null));
  };
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={settingText(decl.label)}
        aria-valuemin={1}
        aria-valuemax={choices.length}
        aria-valuenow={at + 1}
        aria-valuetext={settingText(choices[at]!.label)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setHeld(near(e.clientX));
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && setHeld(near(e.clientX))}
        onPointerUp={(e) => commit(near(e.clientX))}
        onKeyDown={(e) => {
          const to = { ArrowLeft: at - 1, ArrowDown: at - 1, ArrowRight: at + 1, ArrowUp: at + 1, Home: 0, End: last }[e.key];
          if (to === undefined) return;
          e.preventDefault();
          commit(Math.min(last, Math.max(0, to)));
        }}
        className="relative h-[14px] w-[196px] shrink-0 cursor-pointer touch-none rounded-full bg-nb-ink/8 nb-focus max-md:w-[120px]"
      >
        <span className="absolute inset-y-0 left-0 rounded-full bg-nb-accent" style={{ width: `calc(${x(at)} + ${PAD}px)` }} />
        {choices.map((ch, i) =>
          i === at ? null : (
            <span key={ch.value} className={cn("absolute top-1/2 size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full", i < at ? "bg-white/40" : "bg-nb-ink/12")} style={{ left: x(i) }} />
          ),
        )}
        <span className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22)]" style={{ left: x(at) }} />
      </span>
      <span className="min-w-0 truncate text-[13.5px] font-[600] text-nb-ink">{settingText(choices[at]!.label)}</span>
    </span>
  );
}

/** A text setting typed straight into its row, saved on Enter or leaving the box. */
function TextSetting({ decl, value, disabled, onSave }: { decl: api.SettingDecl; value: string; disabled: boolean; onSave: (v: string) => Promise<boolean> }) {
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);
  const commit = () => typed.trim() !== value && void onSave(typed.trim());
  const label = settingText(decl.label);
  return (
    <div className={LINE}>
      <span className={LINE_LABEL} title={decl.help && settingText(decl.help)}>{label}</span>
      <input
        type="text"
        value={typed}
        disabled={disabled}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) commit();
          if (e.key === "Escape") {
            e.preventDefault();
            setTyped(value);
          }
        }}
        aria-label={label}
        placeholder={decl.placeholder}
        spellCheck={false}
        autoCapitalize="off"
        className="ml-auto w-[300px] min-w-0 rounded-[8px] bg-nb-wash px-2.5 py-1.5 font-mono text-[12.5px] text-nb-ink placeholder:text-nb-ink-soft/60 nb-field disabled:opacity-50 max-md:flex-1 max-md:text-[16px]"
      />
    </div>
  );
}

/** The API row opened in place: provider, what that provider needs, and the key, saved together. */
function ApiEdit({
  row, decls, pick, secret, owned, onSave, onClose,
}: {
  row: api.Runtime;
  decls: api.SettingDecl[];
  pick?: api.SettingDecl;
  secret?: api.SettingDecl;
  owned: (key: string) => boolean;
  onSave: (body: api.RuntimePatch) => Promise<boolean>;
  onClose: () => void;
}) {
  const c = T.runtimes;
  const [pid, setPid] = useState(pick ? (providerOf(pick, row.settings)?.id ?? "") : "");
  const [values, setValues] = useState(row.settings);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const provider = pick?.providers?.find((p) => p.id === pid);
  const fields = decls.filter((d) => (d.kind === "text" || d.kind === "select") && owned(d.key) && provider?.needs.includes(d.key));
  const keyShown = !!secret && (!owned(secret.key) || !!provider?.needs.includes(secret.key));
  const keySet = !!secret && row.secretsSet.includes(secret.key);
  const run = async (body: api.RuntimePatch) => {
    setSaving(true);
    const ok = await onSave(body);
    setSaving(false);
    if (ok) onClose();
  };
  const save = () => {
    const settings = { ...row.settings, ...Object.fromEntries(fields.map((d) => [d.key, values[d.key]?.trim() ?? ""])), ...(pick ? { [pick.key]: pid } : {}) };
    void run({ settings, ...(keyShown && key.trim() ? { secrets: { apiKey: key.trim() } } : {}) });
  };
  const set = (k: string, v: string) => setValues((was) => ({ ...was, [k]: v }));
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      {(pick || fields.length > 0) && (
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          {pick && provider && (
            <div>
              <p className={LABEL_SM}>{settingText(pick.label)}</p>
              <Menu
                full
                trigger={({ onClick }) => (
                  <button type="button" aria-label={settingText(pick.label)} onClick={onClick} className={TRIGGER}>
                    <span className="truncate">{settingText(provider.label)}</span>
                    <FiChevronDown className="ml-auto shrink-0 text-[14px] text-nb-ink-soft" aria-hidden />
                  </button>
                )}
                panel="w-[320px] max-w-[calc(100vw-4rem)]"
                items={(pick.providers ?? []).map((p) => ({
                  key: p.id,
                  onSelect: () => setPid(p.id),
                  body: (
                    <>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-[700]">{settingText(p.label)}</span>
                        <span className="text-[11.5px] font-[500] leading-snug text-nb-ink-soft">{settingText(p.blurb)}</span>
                      </span>
                      <Picked on={p.id === pid} />
                    </>
                  ),
                }))}
              />
            </div>
          )}
          {fields.map((d) => (
            <div key={d.key}>
              <p className={LABEL_SM} title={d.help && settingText(d.help)}>{settingText(d.label)}</p>
              {d.kind === "select" ? (
                <Menu
                  full
                  trigger={({ onClick }) => (
                    <button type="button" aria-label={settingText(d.label)} onClick={onClick} className={TRIGGER}>
                      <span className="truncate">{settingText((d.choices ?? []).find((ch) => ch.value === (values[d.key] ?? ""))?.label ?? values[d.key] ?? "")}</span>
                      <FiChevronDown className="ml-auto shrink-0 text-[14px] text-nb-ink-soft" aria-hidden />
                    </button>
                  )}
                  items={(d.choices ?? []).map((ch) => ({
                    key: ch.value,
                    onSelect: () => set(d.key, ch.value),
                    body: <><span className="font-[700]">{settingText(ch.label)}</span><Picked on={ch.value === (values[d.key] ?? "")} /></>,
                  }))}
                />
              ) : (
                <input
                  type="text"
                  value={values[d.key] ?? ""}
                  onChange={(e) => set(d.key, e.target.value)}
                  aria-label={settingText(d.label)}
                  placeholder={d.placeholder}
                  spellCheck={false}
                  autoCapitalize="off"
                  className={cn(CONTROL, "font-mono text-[13px]")}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {secret && keyShown && (
        <div>
          <p className={LABEL_SM}>{settingText(secret.label)}</p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && save()}
            aria-label={settingText(secret.label)}
            placeholder={keySet ? c.keyPaste : secret.placeholder}
            autoComplete="off"
            spellCheck={false}
            className={CONTROL}
          />
          <p className="mt-1.5 text-[12px] text-nb-ink-soft">{c.keyHint}</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        {keySet && keyShown && (
          <button type="button" disabled={saving} onClick={() => void run({ secrets: { apiKey: null } })} className={cn(LINK, "text-nb-peach-ink")}>
            {c.clearKey}
          </button>
        )}
        <span className="ml-auto flex gap-2">
          <button type="button" disabled={saving} onClick={onClose} className={QUIET_BTN}>
            {c.cancel}
          </button>
          <button type="button" disabled={saving} onClick={save} className={ACCENT_BTN}>
            {saving ? c.saving : c.save}
          </button>
        </span>
      </div>
    </div>
  );
}

/** The one place a connector that is not ready says so: why, the command to copy, and 重新检测. */
function NotReady({ list, connector, online, test, onRecheck }: { list: api.RuntimeList; connector: api.Connector; online: boolean; test?: Test; onRecheck?: () => void }) {
  const c = T.runtimes;
  const [copied, setCopied] = useState(false);
  const out = list.connectors[connector] === "signed_out";
  const command = out ? LOGIN[connector] : INSTALL[connector];
  const copy = () =>
    void navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, () => {});
  const running = test?.kind === "running";
  return (
    <div className="ml-[21px] rounded-[10px] bg-nb-peach-soft px-3 py-2.5 max-md:ml-0">
      <p className="flex items-center gap-2 text-[13px] font-[700] text-nb-peach-ink">
        <FiAlertCircle className="shrink-0" aria-hidden />
        {out ? c.signedOutHint(LABEL[connector]) : c.notInstalledHint(LABEL[connector])}
      </p>
      <div className="mt-2 flex items-center gap-2 max-md:flex-wrap">
        <code className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-nb-paper py-1 pl-2.5 pr-1 font-mono text-[12.5px] text-nb-ink">
          <span className="min-w-0 flex-1 truncate">{command}</span>
          <button type="button" title={copied ? c.copied : c.copy} aria-label={copied ? c.copied : c.copy} onClick={copy} className="grid size-[24px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink nb-focus">
            {copied ? <FiCheck className="text-[13px] text-nb-mint-ink" aria-hidden /> : <FiCopy className="text-[13px]" aria-hidden />}
          </button>
        </code>
        {onRecheck && (
          <button type="button" disabled={!online || running} title={online ? undefined : T.test.offline} onClick={onRecheck} className={ACCENT_BTN}>
            <FiRefreshCw className={cn("text-[13px]", running && "animate-spin")} aria-hidden />
            {running ? c.rechecking : c.recheck}
          </button>
        )}
      </div>
      {onRecheck && !online && <p className="mt-1.5 text-[12px] text-nb-ink-soft">{T.test.offline}</p>}
    </div>
  );
}

type NewRuntime = { name: string; runner: string; connector: api.Connector; model: string | null };

function NewRow({
  list, taken, tests, onTest, onDone,
}: {
  list: api.RuntimeList;
  taken: (name: string) => boolean;
  tests: Record<string, Test>;
  onTest: (r: api.Runtime) => void;
  onDone: (body: NewRuntime | null) => void;
}) {
  const c = T.runtimes;
  const [name, setName] = useState("");
  const [runner, setRunner] = useState<string | null>((list.runners.find((x) => x.online) ?? list.runners[0])?.id ?? null);
  const [connector, setConnector] = useState<api.Connector>(list.data[0]?.connector ?? "claude-code");
  const [model, setModel] = useState<string | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const isTaken = !!name.trim() && taken(name);
  const picked = list.runners.find((x) => x.id === runner);
  // 重新检测 needs a saved runtime on this connector to test.
  const sibling = list.data.find((r) => r.connector === connector && r.runner === runner);
  const finish = () => {
    if (isTaken) return;
    onDone(name.trim() && runner ? { name: name.trim(), runner, connector, model } : null);
  };
  // Leaving the new row creates it, or drops it when it has no name.
  useEffect(() => {
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && finish();
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  });
  const trigger = (label: string, body: ReactNode) =>
    ({ onClick }: { onClick: () => void }) => (
      <button type="button" aria-label={label} onClick={onClick} className={TRIGGER}>
        {body}
        <FiChevronDown className="ml-auto shrink-0 text-[14px] text-nb-ink-soft" aria-hidden />
      </button>
    );
  return (
    <div ref={box} className="flex flex-col gap-4 border-t border-nb-ink/10 px-3.5 pb-3.5 pt-3 first:border-t-0">
      <Field id="runtime-name-new" label={c.name} help={<p className={isTaken ? "text-nb-peach-ink" : undefined}>{isTaken ? c.nameTaken : c.newNameHelp}</p>}>
        <input
          id="runtime-name-new"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) finish();
            if (e.key === "Escape") {
              e.preventDefault();
              onDone(null);
            }
          }}
          autoFocus
          spellCheck={false}
          maxLength={60}
          placeholder={c.namePlaceholder}
          className={CONTROL}
          style={EDITING}
        />
      </Field>
      {list.runners.length === 0 ? (
        <p className="text-[12.5px] text-nb-peach-ink">{c.noRunner}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <div>
            <p className={`mb-1.5 ${CAPTION} text-nb-ink-soft`}>{c.runner}</p>
            <Menu
              full
              trigger={trigger(c.runner, picked ? <><Dot on={picked.online} /><span className="truncate">{picked.name}</span></> : <span className="font-[600] text-nb-ink-soft">{c.pickRunner}</span>)}
              items={runnerItems(list, runner, setRunner)}
            />
          </div>
          <div>
            <p className={`mb-1.5 ${CAPTION} text-nb-ink-soft`}>{c.connector}</p>
            <Menu
              full
              trigger={trigger(c.connector, <><AgentMark harness={MARK[connector]} size={16} />{LABEL[connector]}</>)}
              items={connectorItems(list, connector, (h) => {
                setConnector(h);
                setModel(null);
              })}
            />
          </div>
          <div>
            <p className={`mb-1.5 ${CAPTION} text-nb-ink-soft`}>{c.model}</p>
            {other !== null ? (
              <ModelInput
                start={other}
                onDone={(m) => {
                  setOther(null);
                  if (m !== undefined) setModel(m);
                }}
              />
            ) : (
              <Menu
                full
                trigger={trigger(c.model, <span className={cn("truncate", !model && "font-[600] text-nb-ink-soft")}>{modelName(list, connector, model)}</span>)}
                items={modelItems(list, connector, model, setModel, () => setOther(model ?? ""))}
              />
            )}
          </div>
        </div>
      )}
      {picked && notReady(list, connector) && (
        <NotReady list={list} connector={connector} online={picked.online} test={sibling && tests[sibling.id]} onRecheck={sibling && (() => onTest(sibling))} />
      )}
    </div>
  );
}

/** 测试连接 on the open row's header line, with a pass beside it; a failure shows under the line. */
function Tester({ test, runner, onTest }: { test: Test; runner: api.RunnerInfo | null; onTest: () => void }) {
  const online = !!runner?.online;
  const running = test.kind === "running";
  return (
    <span className="flex shrink-0 items-center gap-3">
      {runner && !online && <span className="text-[12px] text-nb-ink-soft max-md:hidden">{T.test.offline}</span>}
      {online && test.kind === "passed" && (
        <span aria-live="polite" className="flex items-center gap-1 text-[12px] font-[700] text-nb-mint-ink">
          <FiCheck className="shrink-0" aria-hidden />
          {T.test.passed(test.s)}
        </span>
      )}
      <button type="button" disabled={!online || running} onClick={onTest} className={LINK}>
        <span className="inline-flex items-center gap-1">
          <FiZap className={cn("text-[12px]", running && "animate-pulse")} aria-hidden />
          {running ? T.test.running : T.test.run}
        </span>
      </button>
    </span>
  );
}
