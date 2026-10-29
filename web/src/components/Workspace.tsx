// 设置's 工作空间 (#2045, #2191): a switcher on top, the members, a team workspace's Runners with their
// owners (#2134), and for an owner inviting by email, roles, removing and deleting the workspace;
// a member reads and may leave. A personal workspace takes no members. A refusal is one line
// where it happened.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiBookOpen, FiChevronDown, FiExternalLink, FiMonitor, FiUserPlus, FiUsers } from "react-icons/fi";
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
import { WsMark, wsName } from "./Header";
import { SwitcherMenu } from "./Switcher";

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
  const team = !ws.personal;
  return (
    <div className="flex flex-col gap-6">
      <WorkspacePick />

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

      {team && <Runners owner={owner} at={at} />}

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

/** The page's title: the current workspace, switched as from the top bar. */
function WorkspacePick() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <span ref={box} className="relative flex self-start">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("-ml-2 flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-[9px] px-2 text-[16px] font-[800] tracking-[-0.02em] text-nb-ink hover:bg-nb-wash nb-focus", open && "bg-nb-wash")}
      >
        <WsMark ws={store.ws} size={24} />
        <span className="truncate">{wsName(store.ws)}</span>
        <FiChevronDown size={14} aria-hidden className={cn("shrink-0 opacity-60", open && "rotate-180")} />
      </button>
      {open && (
        <SwitcherMenu
          box={box}
          label={T.ws.pick}
          className="origin-top-left absolute left-[-8px] top-[calc(100%+6px)] z-30 w-[260px]"
          row="h-10 gap-2.5"
          current={store.ws.id}
          items={store.workspaces.map((w) => ({
            id: w.id,
            name: wsName(w),
            mark: () => <WsMark ws={w} size={20} />,
            side: <span className="text-[11px] font-[500] text-nb-ink-soft">{T.ws.roles[w.role]}</span>,
            renamable: w.role === "owner" && !w.personal,
          }))}
          onPick={(id) => {
            close();
            if (id === store.ws.id) return;
            store.setWorkspace(id);
            navigate("/");
          }}
          onRename={async (id, name) => (await api.renameWorkspace(id, name), await store.reloadWorkspaces())}
          onClose={close}
        />
      )}
    </span>
  );
}

const since = (iso: string) => T.runners.ago(Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)));

/** A team workspace's computers, each with its owner; an owner stops sending tasks to one after a small ask under its button. */
function Runners({ owner, at }: { owner: boolean; at?: "runners" }) {
  const ws = useStore().ws;
  const [runners, setRunners] = useState<api.WorkspaceRunner[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ at: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setAsking(null), []);
  const box = useRef<HTMLSpanElement>(null);
  useAway(box, asking !== null, close);
  const section = useRef<HTMLDivElement>(null);

  const load = () => void api.listRunners(ws.id).then(setRunners, () => setRunners([]));
  useEffect(load, [ws.id]);
  useEffect(() => void api.listRuntimes().then((l) => setMine(new Set(l.runners.map((r) => r.id))), () => {}), []);
  useEffect(() => {
    const el = section.current;
    // Only the panel's own scroller moves; scrollIntoView would shift the dialog around it too.
    if (runners && el && at === "runners") el.closest(".overflow-y-auto")?.scrollTo({ top: el.offsetTop - 16 });
  }, [runners !== null, at]);

  const stop = async (machine: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await api.removeRunner(ws.id, machine);
      setAsking(null);
      load();
    } catch (e) {
      setProblem({ at: machine, text: say(e) });
    } finally {
      setBusy(false);
    }
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
        const yours = mine.has(r.machine);
        const whose = yours ? T.runners.yours : r.owner ? T.runners.ownedBy(r.owner) : "";
        return (
          <div key={r.machine} className="flex flex-wrap items-center gap-3.5 py-4" style={i ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}>
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-nb-wash text-nb-ink-soft">
              <FiMonitor size={14} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-[700]">{name}</span>
                <span className={cn("inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-[700]", r.connected ? "bg-nb-mint-soft text-nb-mint-ink" : "bg-nb-wash text-nb-ink-soft")}>
                  <span aria-hidden className={cn("size-1.5 rounded-full", r.connected ? "bg-nb-mint" : "bg-nb-ink-soft/50")} />
                  {r.connected ? T.runners.online : T.runners.offline}
                </span>
              </div>
              <div className="mt-1 truncate text-[12px] text-nb-ink-soft">{[whose, r.last_active && T.runners.active(since(r.last_active))].filter(Boolean).join(" · ")}</div>
            </div>
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
                      <Button variant="ghost" size="xs" disabled={busy} style={DANGER} onClick={() => void stop(r.machine)}>
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
