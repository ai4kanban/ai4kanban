// `/settings/workspace` (#2045): the name, the members, the Runners (#2134), and for an owner
// inviting by email, roles, removing and deleting the workspace; a member reads and may leave.
// A personal workspace takes no members. A refusal is one line where it happened.

import { useCallback, useEffect, useState } from "react";
import { FiBookOpen, FiChevronDown, FiExternalLink, FiMonitor, FiUserPlus, FiUsers } from "react-icons/fi";
import { Button } from "@review/components/button";
import { Avatar } from "@review/components/chat";
import { HAIRLINE } from "@review/components/chrome";
import { Menu, POPUP_PANEL } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T } from "../i18n";
import { navigate, useLocation } from "../router";
import { useStore } from "../store";
import { useDismiss, WsMark, wsName } from "../components/Header";
import { Window } from "../components/Window";

const RUNNER_SETUP = "https://github.com/ai4kanban/ai4kanban/tree/main/runner#readme";
const FIELD = "nb-field flex h-9 rounded-[8px] border bg-nb-paper px-3 text-[14px] focus:outline-none max-md:text-[16px]";

function say(e: unknown, fallback = T.errors.generic) {
  const code = e instanceof api.ApiError ? e.code : "";
  return code === "offline" ? T.errors.offline : code === "last_owner" ? T.ws.lastOwner : code === "owner_only" ? T.ws.ownerOnly : fallback;
}

export function WorkspaceSettings() {
  const store = useStore();
  const ws = store.ws;
  const owner = ws.role === "owner";
  const [members, setMembers] = useState<api.Member[]>([]);
  const [name, setName] = useState(wsName(ws));
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<{ at: string; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => void api.listMembers(ws.id).then(setMembers, () => {});
  useEffect(() => {
    setName(wsName(ws));
    load();
    document.title = `${T.ws.title} · WildCrane`;
  }, [ws.id]);

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

  const meId = store.me.accountId;
  return (
    <Window>
      <div className="h-full overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-6 py-8 max-md:px-4 max-md:py-5">
          <div className="flex items-center gap-3">
            <WsMark ws={ws} size={32} />
            <h1 className="text-[20px] font-[800] tracking-[-0.02em]">{T.ws.title}</h1>
          </div>

          <div className="nb-section flex flex-col gap-1.5 bg-nb-sheet px-4 py-3.5">
            <span className="text-[10px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">{T.ws.name}</span>
            {owner && !ws.personal ? (
              <div className="flex items-center gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} aria-label={T.ws.name} className={`${FIELD} min-w-0 flex-1`} style={{ borderColor: HAIRLINE }} />
                {name.trim() && name.trim() !== ws.name && (
                  <Button size="sm" disabled={busy} onClick={() => void run("name", async () => (await api.renameWorkspace(ws.id, name.trim()), store.reloadWorkspaces()))}>
                    {T.ws.save}
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-[14px]">{wsName(ws)}</span>
            )}
            {problem?.at === "name" && <p className="text-[12px] text-nb-peach-ink">{problem.text}</p>}
          </div>

          <div className="nb-section flex flex-col bg-nb-sheet px-4 py-3.5">
            <div className="mb-3 flex items-center gap-2">
              <FiUsers size={13} className="text-nb-ink-soft" aria-hidden />
              <span className="text-[13px] font-[700]">{T.ws.members}</span>
              <span className="text-[12px] text-nb-ink-soft">{members.length}</span>
            </div>
            {ws.personal ? (
              <p className="mb-3 text-[12.5px] text-nb-ink-soft">{T.ws.personal}</p>
            ) : (
              owner && (
                <div className="mb-3 flex flex-col gap-1.5">
                  <form
                    className="flex items-center gap-2"
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
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={T.ws.invitePlaceholder} aria-label={T.ws.invitePlaceholder} className={`${FIELD} min-w-0 flex-1 text-[13px]`} style={{ borderColor: HAIRLINE }} />
                    <Button size="sm" type="submit" disabled={busy || !email.trim()}>
                      <FiUserPlus aria-hidden />
                      {T.ws.invite}
                    </Button>
                  </form>
                  {problem?.at === "invite" && <p className="text-[12px] text-nb-peach-ink">{problem.text}</p>}
                </div>
              )
            )}
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
                  {owner && !you && !ws.personal ? (
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

          <Runners owner={owner} />

          {!owner && !ws.personal && (
            <div className="flex flex-col gap-2 rounded-[12px] border px-4 py-3.5" style={{ borderColor: HAIRLINE }}>
              <div className="flex items-center gap-4">
                <span className="flex-1 text-[12.5px] text-nb-ink-soft">{T.ws.leaveBody}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || !meId}
                  onClick={() =>
                    void run("leave", async () => {
                      await api.removeMember(ws.id, meId!);
                      const list = await store.reloadWorkspaces();
                      store.setWorkspace(list.find((w) => w.personal)?.id ?? list[0]!.id);
                      navigate("/");
                    })
                  }
                >
                  {T.ws.leave}
                </Button>
              </div>
              {problem?.at === "leave" && <p className="text-[12px] text-nb-peach-ink">{problem.text}</p>}
            </div>
          )}

          {owner && !ws.personal && (
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
                  style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}
                  onClick={() =>
                    asking
                      ? void run("delete", async () => {
                          await api.deleteWorkspace(ws.id);
                          const list = await store.reloadWorkspaces();
                          store.setWorkspace(list.find((w) => w.personal)?.id ?? list[0]!.id);
                          navigate("/");
                        })
                      : setAsking(true)
                  }
                >
                  {asking ? T.ws.confirm : T.ws.danger}
                </Button>
              </div>
              {problem?.at === "delete" && <p className="text-[12px] text-nb-peach-ink">{problem.text}</p>}
            </div>
          )}
        </main>
      </div>
    </Window>
  );
}

const since = (iso: string) => T.runners.ago(Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)));

/** The computers holding this workspace's projects; an owner removes one after a small ask under its button. */
function Runners({ owner }: { owner: boolean }) {
  const ws = useStore().ws;
  const { path } = useLocation();
  const [runners, setRunners] = useState<api.WorkspaceRunner[] | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ at: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setAsking(null), []);
  const box = useDismiss<HTMLSpanElement>(asking !== null, close);

  const load = () => void api.listRunners(ws.id).then(setRunners, () => setRunners([]));
  useEffect(load, [ws.id]);
  useEffect(() => {
    const at = document.getElementById("runners");
    // Only the page's own scroller moves; scrollIntoView would shift the clipped frame around it too.
    if (runners && at && location.hash === "#runners") at.closest(".overflow-y-auto")?.scrollTo({ top: at.offsetTop - 16 });
  }, [runners !== null, path, location.hash]);

  const remove = async (machine: string) => {
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
    <div id="runners" className="nb-section flex flex-col bg-nb-sheet px-4 py-3.5">
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
              {r.last_active && <div className="mt-1 truncate text-[12px] text-nb-ink-soft">{T.runners.active(since(r.last_active))}</div>}
            </div>
            {owner && (
              <span ref={asking === r.machine ? box : undefined} className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={asking === r.machine}
                  onClick={() => setAsking(asking === r.machine ? null : r.machine)}
                  className={cn("w-[44px] cursor-pointer text-right text-[12px] font-[600] text-nb-accent-deep", asking === r.machine && "underline")}
                >
                  {T.ws.remove}
                </button>
                {asking === r.machine && (
                  <div role="dialog" className={cn(POPUP_PANEL, "nb-pop origin-top-right absolute right-0 top-[calc(100%+8px)] z-10 flex w-[248px] flex-col gap-3 p-3")}>
                    <p className="text-[12.5px] leading-[1.5]">{T.runners.removeAsk(name)}</p>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="xs" onClick={close}>
                        {T.ws.cancel}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busy}
                        style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}
                        onClick={() => void remove(r.machine)}
                      >
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
