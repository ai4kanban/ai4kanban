// 工作空间设置 (#2045, #2201): the name, the members, a team workspace's Runners with their
// owners (#2134) and your own shared with its members (#2196), and for an owner inviting by email, roles, removing and deleting the workspace;
// a member reads and may leave. A personal workspace takes no members. A refusal is one line
// where it happened.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiBookOpen, FiChevronDown, FiClock, FiExternalLink, FiInbox, FiMonitor, FiTrash2, FiUserPlus, FiUsers } from "react-icons/fi";
import { Button } from "@review/components/button";
import { Avatar } from "@review/components/chat";
import { HAIRLINE } from "@review/components/chrome";
import { Menu, POPUP_PANEL } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T } from "../i18n";
import { navigate } from "../router";
import { useStore } from "../store";
import { useAway } from "./Agents";
import { wsName } from "./Header";

const RUNNER_SETUP = "https://github.com/ai4kanban/ai4kanban/tree/main/runner#readme";
const FIELD = "nb-field flex h-9 rounded-[8px] border bg-nb-paper px-3 text-[14px] focus:outline-none max-md:text-[16px]";
const DANGER = { color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" };

function say(e: unknown, fallback = T.errors.generic) {
  const code = e instanceof api.ApiError ? e.code : "";
  return code === "offline" ? T.errors.offline : code === "last_owner" ? T.ws.lastOwner : code === "owner_only" ? T.ws.ownerOnly : fallback;
}

/** `at` scrolls to that section once it is drawn. */
export function WorkspacePanel({ at }: { at?: "runners" }) {
  const store = useStore();
  const ws = store.ws;
  const owner = ws.role === "owner";
  const team = !ws.personal;
  const [members, setMembers] = useState<api.Member[]>([]);
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<{ at: string; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => void api.listMembers(ws.id).then(setMembers, () => {});
  useEffect(load, [ws.id]);

  const run = async (at: string, work: () => Promise<unknown>, fallback?: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } catch (e) {
      setProblem({ at, text: say(e, fallback) });
    } finally {
      setBusy(false);
    }
  };
  const leaveTo = async () => {
    const list = await store.reloadWorkspaces();
    store.setWorkspace(list.find((w) => w.personal)?.id ?? list[0]!.id);
    navigate("/");
  };

  const invite = (phone: boolean) => (
    <form
      className={cn("items-center gap-2", phone ? "mb-2 hidden max-md:flex" : "ml-auto flex max-md:hidden")}
      onSubmit={(e) => {
        e.preventDefault();
        const to = email.trim();
        if (!to) return;
        void run(
          "invite",
          async () => {
            await api.addMember(ws.id, to);
            setEmail("");
            load();
          },
          T.ws.noAccount,
        );
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={phone ? T.ws.invitePhone : T.ws.invitePlaceholder}
        aria-label={T.ws.invitePlaceholder}
        className={cn(FIELD, phone ? "min-w-0 flex-1" : "w-[260px] text-[13px]")}
        style={{ borderColor: HAIRLINE }}
      />
      <Button size="sm" type="submit" disabled={busy || !email.trim()}>
        <FiUserPlus aria-hidden />
        {T.ws.invite}
      </Button>
    </form>
  );

  const meId = store.me.accountId;
  return (
    <div className="flex flex-col gap-6">
      <NameRow value={wsName(ws)} readOnly={!team || !owner} onSave={async (name) => (await api.renameWorkspace(ws.id, name), await store.reloadWorkspaces())} />

      <div className="nb-section flex flex-col bg-nb-sheet px-4 py-3.5">
        <div className="mb-2 flex min-h-9 items-center gap-2">
          <FiUsers size={13} className="text-nb-ink-soft" aria-hidden />
          <span className="text-[13px] font-[700]">{T.ws.members}</span>
          <span className="text-[12px] text-nb-ink-soft">{members.length}</span>
          {team && owner && invite(false)}
        </div>
        {team && owner && invite(true)}
        {problem?.at === "invite" && <p className="mb-2 text-[12px] text-nb-peach-ink">{problem.text}</p>}
        {ws.personal && <p className="mb-2 text-[12.5px] text-nb-ink-soft">{T.ws.personal}</p>}
        {members.map((m, i) => {
          const you = m.account === meId;
          const who = m.email ?? `@${m.handle}`;
          return (
            <div key={m.account} className="flex min-h-[52px] flex-wrap items-center gap-3 py-1" style={i ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}>
              <Avatar who={who} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-[700]">
                  {m.name || m.handle}
                  {you && <span className="font-[500] text-nb-ink-soft">{T.ws.you}</span>}
                </div>
                <div className="truncate text-[12px] text-nb-ink-soft">{who}</div>
              </div>
              {owner && !you && team ? (
                <>
                  <Menu
                    align="end"
                    trigger={({ open, onClick }) => (
                      <button type="button" onClick={onClick} aria-expanded={open} className="flex h-7 cursor-pointer items-center gap-1 rounded-[8px] bg-nb-wash px-2 text-[12px]">
                        {T.ws.roles[m.role]}
                        <FiChevronDown size={12} className="text-nb-ink-soft" aria-hidden />
                      </button>
                    )}
                    items={(["owner", "member"] as const).map((r) => ({
                      key: r,
                      onSelect: () => r !== m.role && void run(m.account, async () => (await api.setMemberRole(ws.id, m.account, r), load())),
                      body: T.ws.roles[r],
                    }))}
                  />
                  <button type="button" disabled={busy} onClick={() => void run(m.account, async () => (await api.removeMember(ws.id, m.account), load()))} className="w-[44px] cursor-pointer text-right text-[12px] font-[600] text-nb-accent-deep">
                    {T.ws.remove}
                  </button>
                </>
              ) : (
                <span className="px-2 text-[12px] text-nb-ink-soft">{T.ws.roles[m.role]}</span>
              )}
              {problem?.at === m.account && <p className="w-full text-[12px] text-nb-peach-ink">{problem.text}</p>}
            </div>
          );
        })}
      </div>

      {team && <Runners owner={owner} at={at} members={members} />}

      {team && !owner && (
        <div className="flex flex-col gap-2 rounded-[12px] border px-4 py-3.5" style={{ borderColor: HAIRLINE }}>
          <div className="flex items-center gap-4">
            <span className="flex-1 text-[12.5px] text-nb-ink-soft">{T.ws.leaveBody}</span>
            <Button variant="ghost" size="sm" disabled={busy || !meId} onClick={() => void run("leave", async () => (await api.removeMember(ws.id, meId!), await leaveTo()))}>
              {T.ws.leave}
            </Button>
          </div>
          {problem?.at === "leave" && <p className="text-[12px] text-nb-peach-ink">{problem.text}</p>}
        </div>
      )}

      {team && owner && (
        <div className="flex flex-col gap-2 rounded-[12px] border px-4 py-3.5" style={{ borderColor: "color-mix(in srgb, var(--color-nb-accent-deep) 35%, transparent)" }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1 text-[12.5px] text-nb-ink-soft">{asking ? T.ws.dangerAsk : T.ws.dangerBody}</span>
            {asking && (
              <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
                {T.ws.cancel}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              style={DANGER}
              onClick={() => (asking ? void run("delete", async () => (await api.deleteWorkspace(ws.id), await leaveTo())) : setAsking(true))}
            >
              {asking ? T.ws.confirm : T.ws.danger}
            </Button>
          </div>
          {problem?.at === "delete" && <p className="text-[12px] text-nb-peach-ink">{problem.text}</p>}
        </div>
      )}
    </div>
  );
}

/** Both settings pages open with the name: a field and 保存, live once it changes and is not empty; plain text where it can't be renamed. */
export function NameRow({ value, readOnly, onSave }: { value: string; readOnly?: boolean; onSave: (name: string) => Promise<unknown> }) {
  const [typed, setTyped] = useState(value);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setTyped(value), [value]);
  const name = typed.trim();
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onSave(name);
    } catch (e) {
      setProblem(say(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-[700]">{T.ws.name}</span>
      {readOnly ? (
        <span className="flex h-9 items-center text-[14px]">{value}</span>
      ) : (
        <span className="flex items-center gap-2">
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label={T.ws.name}
            maxLength={80}
            spellCheck={false}
            className={cn(FIELD, "w-[320px] min-w-0 max-w-full max-md:flex-1")}
            style={{ borderColor: HAIRLINE }}
          />
          <Button size="sm" className="shrink-0" disabled={busy || !name || name === value} onClick={() => void save()}>
            {T.save}
          </Button>
        </span>
      )}
      {problem && <p className="text-[12px] text-nb-peach-ink">{problem}</p>}
    </div>
  );
}

/** A project's danger zone (#2192): its owner deletes it after reading what goes with it and typing its name. */
export function DeleteProject({ project }: { project: api.Project }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border px-4 py-3.5" style={{ borderColor: "color-mix(in srgb, var(--color-nb-accent-deep) 35%, transparent)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-[200px] flex-1 text-[12.5px] leading-[1.6] text-nb-ink-soft">{T.deleteProject.body}</span>
        <Button variant="ghost" size="sm" style={DANGER} onClick={() => setOpen(true)}>
          {T.deleteProject.open}
        </Button>
      </div>
      {open && <ConfirmDelete project={project} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ConfirmDelete({ project, onClose }: { project: api.Project; onClose: () => void }) {
  const store = useStore();
  const [counts, setCounts] = useState<api.ProjectCounts | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => void api.readProject(project.id).then((p) => setCounts(p.counts), (e) => setProblem(say(e))), [project.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, onClose]);

  const named = typed.trim() === project.name;
  const remove = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api.deleteProject(project.id);
      navigate("/");
      store.reload();
    } catch (e) {
      setProblem(say(e));
      setBusy(false);
    }
  };
  const D = T.deleteProject;
  const loss = counts
    ? [
        { n: counts.tasks, icon: FiTrash2, text: D.tasks(counts.tasks, counts.others_tasks, counts.others) },
        { n: counts.triage, icon: FiInbox, text: D.triage(counts.triage) },
        { n: counts.scheduled_agents, icon: FiClock, text: D.agents(counts.scheduled_agents) },
        { n: counts.folders, icon: FiMonitor, text: D.folders(counts.folders) },
      ].filter((l) => l.n > 0)
    : [];
  return (
    <div className="nb-scrim z-50" style={{ alignItems: "center" }} onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        role="dialog"
        aria-modal
        aria-label={D.open}
        onSubmit={(e) => {
          e.preventDefault();
          if (named && !busy) void remove();
        }}
        className="nb-panel nb-pop flex w-[420px] max-w-[calc(100%-2rem)] flex-col gap-4 p-5 max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:px-5 max-md:pb-[max(2rem,env(safe-area-inset-bottom))]"
      >
        <p className="text-[15px] font-[800] leading-[1.5] tracking-[-0.01em] [overflow-wrap:anywhere]">{D.ask(project.name)}</p>
        {loss.length > 0 && (
          <ul className="flex flex-col gap-2">
            {loss.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-[13px] leading-[1.5] text-nb-ink-soft">
                <Icon size={13} aria-hidden className="mt-[3px] shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] leading-[1.5] text-nb-ink-soft [overflow-wrap:anywhere]">
            {D.type[0]}
            <b className="font-[700] text-nb-ink">{project.name}</b>
            {D.type[1]}
          </span>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className={FIELD}
            style={{ borderColor: HAIRLINE }}
          />
        </label>
        {problem && <p className="text-[12px] text-nb-peach-ink">{problem}</p>}
        <div className="flex justify-end gap-2 max-md:flex-col-reverse">
          <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={onClose}>
            {T.ws.cancel}
          </Button>
          <Button variant="ghost" size="sm" type="submit" disabled={!named || busy} style={DANGER}>
            {D.confirm}
          </Button>
        </div>
      </form>
    </div>
  );
}

const since = (iso: string) => T.runners.ago(Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)));

/** 给成员使用 on your own computer (#2196). */
const Switch = ({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={cn("relative inline-flex h-[18px] w-[30px] shrink-0 cursor-pointer rounded-full transition-colors nb-focus disabled:cursor-default", on ? "bg-nb-mint" : "bg-nb-ink/20")}
  >
    <span aria-hidden className={cn("absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[left]", on ? "left-[14px]" : "left-[2px]")} />
  </button>
);

/** A team workspace's computers, each with its owner; an owner stops sending tasks to one after a small ask under its button.
 *  Your own takes 给成员使用, asking first when members run on it; a teammate's shared one reads 已共享. */
function Runners({ owner, at, members }: { owner: boolean; at?: "runners"; members: api.Member[] }) {
  const store = useStore();
  const ws = store.ws;
  const me = store.me.accountId;
  const [runners, setRunners] = useState<api.WorkspaceRunner[] | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [unsharing, setUnsharing] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ at: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => (setAsking(null), setUnsharing(null)), []);
  const box = useRef<HTMLSpanElement>(null);
  useAway(box, asking !== null || unsharing !== null, close);
  const section = useRef<HTMLDivElement>(null);

  const load = () => void api.listRunners(ws.id).then(setRunners, () => setRunners([]));
  useEffect(load, [ws.id]);
  useEffect(() => {
    const el = section.current;
    // Only the page's own scroller moves; scrollIntoView would shift the window around it too.
    if (runners && el && at === "runners") el.closest(".overflow-y-auto")?.scrollTo({ top: el.offsetTop - 16 });
  }, [runners !== null, at]);

  const run = async (machine: string, work: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      await work();
      close();
      load();
    } catch (e) {
      setProblem({ at: machine, text: say(e) });
    } finally {
      setBusy(false);
    }
  };
  const share = (r: api.WorkspaceRunner) => {
    if (r.shared && r.runs?.count) return setUnsharing(unsharing === r.machine ? null : r.machine);
    void run(r.machine, () => api.shareRunner(ws.id, r.machine, !r.shared));
  };
  const whoOf = (account: string, fallback: string) => {
    const m = members.find((x) => x.account === account);
    return m ? (m.email ?? `@${m.handle}`) : fallback;
  };

  return (
    <div ref={section} className="nb-section flex flex-col bg-nb-sheet px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <FiMonitor size={13} className="text-nb-ink-soft" aria-hidden />
        <span className="text-[13px] font-[700]">{T.runners.title}</span>
        {!!runners?.length && <span className="text-[12px] text-nb-ink-soft">{runners.length}</span>}
        <a href={RUNNER_SETUP} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] font-[600] text-nb-ink-soft no-underline hover:text-nb-ink">
          <FiBookOpen size={12} aria-hidden />
          {T.runners.setup}
          <FiExternalLink size={11} className="opacity-60" aria-hidden />
        </a>
      </div>
      {runners?.length === 0 && <p className="py-2 text-[12.5px] text-nb-ink-soft">{T.runners.empty}</p>}
      {runners?.map((r, i) => {
        const name = r.name || T.runners.unnamed;
        const yours = r.owner_account === me;
        const whose = yours ? T.runners.yours : r.owner ? T.runners.ownedBy(r.owner) : "";
        return (
          <div key={r.machine} className="flex flex-wrap items-center gap-3.5 py-4" style={i ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}>
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-nb-wash text-nb-ink-soft">
              <FiMonitor size={14} aria-hidden />
            </span>
            <div className={cn("min-w-0 flex-1", yours && "max-md:basis-[calc(100%-46px)]")}>
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-[700]">{name}</span>
                <span className={cn("inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-[700]", r.connected ? "bg-nb-mint-soft text-nb-mint-ink" : "bg-nb-wash text-nb-ink-soft")}>
                  <span aria-hidden className={cn("size-1.5 rounded-full", r.connected ? "bg-nb-mint" : "bg-nb-ink-soft/50")} />
                  {r.connected ? T.runners.online : T.runners.offline}
                </span>
                {!yours && r.shared && <span className="inline-flex h-[18px] shrink-0 items-center rounded-[5px] bg-nb-sky-soft px-1.5 text-[11px] font-[700] text-nb-sky-ink">{T.runners.shared}</span>}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-nb-ink-soft">
                <Avatar who={whoOf(r.owner_account, r.owner)} size={16} />
                <span className="truncate">{[whose, r.last_active && T.runners.active(since(r.last_active))].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            {yours && (
              <span ref={unsharing === r.machine ? box : undefined} className="relative shrink-0 max-md:ml-[46px] max-md:mr-auto">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] font-[600]">
                  {T.runners.share}
                  <Switch on={r.shared && unsharing !== r.machine} label={T.runners.share} disabled={busy} onChange={() => share(r)} />
                </label>
                {unsharing === r.machine && r.runs && (
                  <div role="dialog" className={cn(POPUP_PANEL, "nb-pop origin-top-right absolute right-0 max-md:left-0 max-md:right-auto max-md:origin-top-left top-[calc(100%+8px)] z-10 flex w-[280px] max-w-[calc(100vw-3rem)] flex-col gap-3 p-3")}>
                    <div className="flex flex-col gap-1">
                      <p className="text-[13px] font-[700] leading-[1.5]">{T.runners.unshareAsk(name)}</p>
                      <p className="text-[12px] leading-[1.5] text-nb-ink-soft">{T.runners.unshareBody(r.runs.by, r.runs.count)}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="xs" onClick={close}>
                        {T.ws.cancel}
                      </Button>
                      <Button variant="ghost" size="xs" disabled={busy} style={DANGER} onClick={() => void run(r.machine, () => api.shareRunner(ws.id, r.machine, false))}>
                        {T.runners.unshare}
                      </Button>
                    </div>
                  </div>
                )}
              </span>
            )}
            {owner && (
              <span ref={asking === r.machine ? box : undefined} className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={asking === r.machine}
                  onClick={() => setAsking(asking === r.machine ? null : r.machine)}
                  className={cn("cursor-pointer text-right text-[12px] font-[600] text-nb-accent-deep", asking === r.machine && "underline")}
                >
                  {T.runners.stop}
                </button>
                {asking === r.machine && (
                  <div role="dialog" className={cn(POPUP_PANEL, "nb-pop origin-top-right absolute right-0 top-[calc(100%+8px)] z-10 flex w-[280px] max-w-[calc(100vw-3rem)] flex-col gap-3 p-3")}>
                    <div className="flex flex-col gap-1">
                      <p className="text-[13px] font-[700] leading-[1.5]">{T.runners.stopAsk(wsName(ws), name)}</p>
                      <p className="text-[12px] leading-[1.5] text-nb-ink-soft">{T.runners.stopBody(yours ? null : r.owner)}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="xs" onClick={close}>
                        {T.ws.cancel}
                      </Button>
                      <Button variant="ghost" size="xs" disabled={busy} style={DANGER} onClick={() => void run(r.machine, () => api.removeRunner(ws.id, r.machine))}>
                        {T.runners.confirm}
                      </Button>
                    </div>
                  </div>
                )}
              </span>
            )}
            {problem?.at === r.machine && <p className="w-full text-[12px] text-nb-peach-ink">{problem.text}</p>}
          </div>
        );
      })}
    </div>
  );
}
