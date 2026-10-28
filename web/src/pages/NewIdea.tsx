// `/new`, after legacy CreateSheet.tsx's empty screen and composer.tsx, made a page the way
// ChatGPT draws one: a headline, a box holding only the words and a round send, and a tray
// tucked under it with the workflow and the runtime. The first message opens an idea conversation
// (#2073) in the workspace's current project, the top bar's, where the agent picks each idea's
// workflow; a workflow picked here, or a new or changed one (#2004), starts the task at once.
// `?triage=` fills it from a triage item, in its project, and needs a workflow picked (#2069) — the
// item's own, picked already (#2139).

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FiAlertCircle, FiArrowUp, FiCheck, FiChevronDown, FiEdit2, FiLayout, FiPlus, FiSettings, FiTrash2, FiWifiOff } from "react-icons/fi";
import { AgentMark } from "@review/components/agent-mark";
import { Button } from "@review/components/button";
import { ITEM, Menu, POPUP_PANEL } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { REVIEW, T, workflowName } from "../i18n";
import { navigate, useLocation } from "../router";
import { useStore } from "../store";
import { useDismiss } from "../components/Header";
import { Window } from "../components/Window";
import { LABEL, MARK, notReady, openSettings, runnerGone, RUNTIMES_CHANGED, runtimeName } from "../components/Settings";

// Menu has no separator: the item draws a hairline above itself.
const RULED = "relative mt-[9px] text-nb-ink-soft before:absolute before:inset-x-0 before:-top-[5px] before:h-px before:bg-[color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)]";

/** Left to the idea conversation, one workflow, or a workflow to write or change. */
type Pick = { kind: "auto" } | { kind: "flow"; id: string } | { kind: "new" } | { kind: "edit"; id: string };
const AUTO: Pick = { kind: "auto" };

/** `home`: it is `/`, with nowhere to leave for; `first`: the workspace has no task yet. */
export function NewIdea({ home, first }: { home?: boolean; first?: boolean }) {
  const store = useStore();
  const { query } = useLocation();
  const [text, setText] = useState("");
  const asked = query.get("project");
  useEffect(() => {
    if (asked && store.projects.some((p) => p.id === asked)) store.setCurrent(asked);
  }, [asked, store.projects.length]);
  // The item stays the one asked for, even once it is carded and leaves the open list.
  const [triage, setTriage] = useState<api.TriageItem | null>(null);
  const wantedTriage = query.get("triage");
  useEffect(() => {
    const item = store.triage?.find((i) => i.id === wantedTriage && i.state === "open");
    if (!item || triage?.id === item.id) return;
    setTriage(item);
    setText(item.text.trim() ? `${item.title}\n\n${item.text.trim()}` : item.title);
    if (store.projects.some((p) => p.id === item.project)) store.setCurrent(item.project);
  }, [wantedTriage, store.triage, store.projects.length]);
  const current = store.current;
  const [workflows, setWorkflows] = useState<api.Workflow[]>([]);
  const [pick, setPick] = useState<Pick>(AUTO);
  const [runtimes, setRuntimes] = useState<api.RuntimeList | null>(null);
  const [runtime, setRuntime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.title = `${T.newIdea} · WildCrane`;
    box.current?.focus();
  }, []);
  const loadWorkflows = () => api.listWorkflows(store.ws.id).then(setWorkflows, () => {});
  useEffect(() => {
    void loadWorkflows();
  }, [store.ws.id]);
  // `?workflow=`: a card's "Start a task with it"; a triage item's own workflow.
  const wanted = query.get("workflow") ?? triage?.workflow;
  useEffect(() => {
    if (wanted && workflows.some((w) => w.id === wanted)) setPick({ kind: "flow", id: wanted });
  }, [wanted, workflows.length]);
  useEffect(() => {
    const load = () => api.listRuntimes().then(setRuntimes, () => {});
    void load();
    window.addEventListener(RUNTIMES_CHANGED, load);
    return () => window.removeEventListener(RUNTIMES_CHANGED, load);
  }, []);
  // Global default until another is picked, and again once the picked one is deleted.
  useEffect(() => {
    if (runtimes && !runtimes.data.some((r) => r.id === runtime)) setRuntime(runtimes.data[0]?.id ?? null);
  }, [runtimes]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Esc leaves for where the reader came from.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || home) return;
      if ((e.target as HTMLElement | null)?.closest("[role=menu]")) return;
      if (history.length > 1) history.back();
      else navigate("/");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [home]);

  const ready = !!text.trim() && !busy && (!triage || pick.kind === "flow");

  const send = async () => {
    if (!ready) return;
    const request = text.trim();
    setBusy(true);
    setTrouble(null);
    try {
      if (pick.kind === "auto") {
        const d = await api.createDiscussion({ workspace: store.ws.id, body: request, ...(current ? { project: current.id } : {}), ...(runtime ? { runtime } : {}) });
        store.reload();
        navigate(`/discussions/${encodeURIComponent(d.id)}`);
        return;
      }
      const line = request.split("\n")[0]!.trim();
      const changed = pick.kind === "edit" ? workflows.find((w) => w.id === pick.id) : undefined;
      const task = await api.createTask({
        title: (changed ? T.builder.editTitle(workflowName(changed), line) : line).slice(0, 200),
        request,
        ...(current ? { project: current.id } : {}),
        workspace: store.ws.id,
        workflow: pick.kind === "flow" ? pick.id : api.BUILDER,
        ...(runtime ? { runtime } : {}),
        ...(pick.kind === "edit" ? { context: { workflow: pick.id } } : {}),
        ...(triage ? { triage: triage.id } : {}),
      });
      if (triage) store.patchTriage({ ...triage, state: "carded", task: task.id, updated_at: new Date().toISOString() });
      store.patchTask(task);
      store.markSeen(task.id);
      navigate(`/tasks/${encodeURIComponent(task.key)}?chat=1`);
    } catch (e) {
      setTrouble(refusal(e) ?? T.idea.sendFailed);
      setBusy(false);
    }
  };

  const rt = runtimes?.data.find((r) => r.id === runtime);
  const offline = store.runnerOnline === false;
  const placeholder = pick.kind === "new" ? T.builder.newPlaceholder : pick.kind === "edit" ? T.builder.editPlaceholder : T.placeholder;

  return (
    <Window noPhoneBar={first}>
      <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-8 pb-24 max-md:px-4 max-md:pb-10">
        <div className="flex w-full max-w-[720px] flex-col items-center">
          <h1 className="text-center text-[27px] font-[800] leading-[1.2] tracking-[-0.025em] max-md:text-[22px]">{T.headline}</h1>
          <div className="mt-7 w-full">
            {trouble ? (
              <Note icon={<FiAlertCircle size={13} className="shrink-0" aria-hidden />}>
                <span className="flex-1">{trouble}</span>
              </Note>
            ) : offline ? (
              <Note icon={<FiWifiOff size={13} className="shrink-0" aria-hidden />}>
                <span className="flex-1">{T.idea.offline}</span>
              </Note>
            ) : null}
            <div className="nb-panel relative z-[1] flex flex-col gap-3 px-5 pb-3 pt-4 max-md:px-4">
              <textarea
                ref={box}
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={placeholder}
                aria-label={placeholder}
                className="max-h-[320px] min-h-[56px] w-full resize-none overflow-y-auto bg-transparent text-[15px] leading-relaxed text-nb-ink placeholder:text-nb-ink-soft focus:outline-none max-md:max-h-[40dvh] max-md:min-h-[104px] max-md:text-[16px]"
              />
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!ready}
                  aria-label={REVIEW.ai.send}
                  title={REVIEW.ai.send}
                  className={cn("inline-flex size-9 items-center justify-center rounded-full", ready ? "cursor-pointer bg-nb-accent text-white hover:bg-nb-accent-deep" : "bg-nb-wash text-nb-ink-soft")}
                >
                  <FiArrowUp size={17} aria-hidden />
                </button>
              </div>
            </div>
            <div className="mx-4 -mt-3 flex flex-wrap items-center gap-2 rounded-b-[14px] bg-nb-wash px-3 pb-2 pt-5 max-md:mx-2">
              <WorkflowPick
                workflows={workflows}
                pick={pick}
                flowsOnly={!!triage}
                onPick={(next) => {
                  setPick(next);
                  box.current?.focus();
                }}
                onDeleted={(id) => {
                  setWorkflows((list) => list.filter((w) => w.id !== id));
                  if ("id" in pick && pick.id === id) setPick(AUTO);
                  void loadWorkflows();
                }}
              />
              {rt && (
                <Menu
                  trigger={({ open, onClick }) => (
                    <TrayPick open={open} onClick={onClick} title={T.runtimeLabel} icon={<AgentMark harness={MARK[rt.connector]} size={14} />}>
                      {runtimeName(rt)}
                    </TrayPick>
                  )}
                  items={[
                    ...runtimes!.data.map((r) => ({
                      key: r.id,
                      onSelect: () => setRuntime(r.id),
                      body: <PickRow icon={<AgentMark harness={MARK[r.connector]} size={13} />} label={runtimeName(r)} on={r.id === runtime} note={runnerGone(runtimes!, r) ? T.runtimes.runnerRemoved : notReady(runtimes, r.connector)} />,
                    })),
                    { key: "manage", onSelect: () => openSettings("runtimes"), body: <PickRow icon={<FiSettings size={13} aria-hidden />} label={T.manageRuntimes} on={false} />, className: RULED },
                  ]}
                />
              )}
              {rt && runnerGone(runtimes!, rt) && <span className="text-[12px] text-nb-peach-ink">{T.runtimes.goneHere}</span>}
              {current?.placed === false && !current.general && <span className="text-[12px] text-nb-ink-soft">{T.notPlaced}</span>}
            </div>
          </div>
        </div>
      </div>
    </Window>
  );
}

/** A send the cloud refused, said as the card page's chat says it; null for anything else. */
export function refusal(e: unknown): string | null {
  const code = e instanceof api.ApiError ? e.code : "";
  if (code === "runtime_unavailable") {
    const { connector, reason } = ((e as api.ApiError).info ?? {}) as { connector?: api.Connector; reason?: string };
    const name = (connector && LABEL[connector]) ?? "";
    return reason === "signed_out" ? T.idea.signedOutHere(name) : T.idea.notInstalledHere(name);
  }
  if (code === "runner_offline") return T.idea.offline;
  if (code === "runner_removed") return REVIEW.ai.removed;
  if (code === "quota_exceeded") return T.limitPro;
  if (code === "chat_busy") return REVIEW.ai.busy;
  if (code === "offline") return T.errors.offline;
  return null;
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p role="status" className="mb-2 flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[12px] leading-snug" style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}>
      {icon}
      {children}
    </p>
  );
}

const RULE = <span aria-hidden className="mx-2.5 my-1 h-px shrink-0 bg-[color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)]" />;
const ICON = "nb-tip nb-tip-below inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-ink";

/** The built-ins, then the workspace's own with 修改 and 删除 on hover, then 新建工作流 once
 *  the Workflow builder is installed. It opens upward, over the box. */
/** `flowsOnly`: a task must be started on a workflow, so 自动选择 and the builder's rows are left out. */
function WorkflowPick({ workflows, pick, flowsOnly, onPick, onDeleted }: { workflows: api.Workflow[]; pick: Pick; flowsOnly?: boolean; onPick: (p: Pick) => void; onDeleted: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<api.Workflow | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useDismiss<HTMLSpanElement>(open || !!asking, () => {
    setOpen(false);
    setAsking(null);
  });
  const builtins = workflows.filter((w) => w.builtin && w.id !== api.BUILDER);
  const own = workflows.filter((w) => !w.builtin);
  const named = "id" in pick ? workflows.find((w) => w.id === pick.id) : undefined;
  const choose = (next: Pick) => {
    setOpen(false);
    onPick(next);
  };
  const remove = async () => {
    if (!asking) return;
    setBusy(true);
    setFailed(false);
    try {
      await api.deleteWorkflow(asking.id);
      onDeleted(asking.id);
      setAsking(null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const icon = pick.kind === "new" ? <FiPlus size={14} className="text-nb-ink-soft" aria-hidden /> : pick.kind === "edit" ? <FiEdit2 size={13} className="text-nb-ink-soft" aria-hidden /> : <FiLayout size={14} className="text-nb-ink-soft" aria-hidden />;
  const label = pick.kind === "new" ? T.builder.newWorkflow : pick.kind === "edit" ? T.builder.editing(named ? workflowName(named) : "") : named ? workflowName(named) : flowsOnly ? T.triage.pickWorkflow : T.builder.auto;
  const row = (key: string, label: string, on: boolean, next: Pick) => (
    <button key={key} type="button" role="menuitem" className={cn(ITEM, "py-1 leading-6")} onClick={() => choose(next)}>
      <PickRow icon={<FiLayout size={13} aria-hidden />} label={label} on={on} />
    </button>
  );
  return (
    <span ref={box} className="relative inline-flex min-w-0">
      <TrayPick open={open || !!asking} onClick={() => (setAsking(null), setOpen((v) => !v))} title={T.flows.title} icon={icon}>
        {label}
      </TrayPick>
      {open && (
        <span role="menu" className={cn(POPUP_PANEL, "absolute bottom-[calc(100%+4px)] left-0 z-30 flex max-h-[min(420px,60vh)] w-[230px] flex-col overflow-y-auto p-1")}>
          {!flowsOnly && row("auto", T.builder.auto, pick.kind === "auto", AUTO)}
          {builtins.map((w) => row(w.id, workflowName(w), pick.kind === "flow" && pick.id === w.id, { kind: "flow", id: w.id }))}
          {own.length > 0 && RULE}
          {own.map((w) => (
            <span key={w.id} className={cn(ITEM, "group py-1")}>
              <button type="button" role="menuitem" className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left leading-6" onClick={() => choose({ kind: "flow", id: w.id })}>
                <PickRow icon={<FiLayout size={13} aria-hidden />} label={w.name} on={pick.kind === "flow" && pick.id === w.id} />
              </button>
              <span className="-my-0.5 -mr-1 hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex max-md:flex">
                <button type="button" className={ICON} data-tip={T.builder.edit} aria-label={T.builder.edit} onClick={() => choose({ kind: "edit", id: w.id })}>
                  <FiEdit2 size={12} aria-hidden />
                </button>
                <button type="button" className={ICON} data-tip={T.builder.remove} aria-label={T.builder.remove} onClick={() => (setOpen(false), setFailed(false), setAsking(w))}>
                  <FiTrash2 size={12} aria-hidden />
                </button>
              </span>
            </span>
          ))}
          {!flowsOnly && workflows.some((w) => w.id === api.BUILDER) && (
            <>
              {RULE}
              <button type="button" role="menuitem" className={cn(ITEM, "py-1 leading-6 text-nb-ink-soft")} onClick={() => choose({ kind: "new" })}>
                <FiPlus size={13} aria-hidden />
                {T.builder.newWorkflow}
              </button>
            </>
          )}
        </span>
      )}
      {asking && (
        <div role="dialog" className="nb-panel absolute left-0 top-[calc(100%+6px)] z-20 w-[280px] bg-nb-paper p-3 max-md:w-[min(280px,calc(100vw-48px))]">
          <p className="text-[13px] font-[700]">{T.builder.deleteAsk(asking.name)}</p>
          <p className="mt-1 text-[12px] leading-snug text-nb-ink-soft">{failed ? T.builder.deleteFailed : T.builder.deleteBody}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={() => setAsking(null)}>
              {T.builder.keep}
            </Button>
            <Button size="xs" disabled={busy} onClick={() => void remove()}>
              {T.builder.deleteYes}
            </Button>
          </div>
        </div>
      )}
    </span>
  );
}

function TrayPick({ icon, open, onClick, title, children }: { icon: ReactNode; open: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-expanded={open} className={cn("flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-nb-ink hover:bg-nb-paper/70", open && "bg-nb-paper/70")}>
      {icon}
      <span className="max-w-[180px] truncate">{children}</span>
      <FiChevronDown size={12} className="text-nb-ink-soft" aria-hidden />
    </button>
  );
}

const PickRow = ({ icon, label, on, note }: { icon: ReactNode; label: string; on: boolean; note?: string }) => (
  <>
    <span className="text-nb-ink-soft">{icon}</span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {note && <span className="shrink-0 text-[11px] font-[700] text-nb-peach-ink">{note}</span>}
    {on && <FiCheck size={12} aria-hidden />}
  </>
);
