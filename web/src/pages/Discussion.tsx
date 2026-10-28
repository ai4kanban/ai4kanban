// `/discussions/<id>` (#2073), after legacy kanban-ui's CreateSheet: the conversation on the left,
// the ideas a cream card standing beside it (tabs when several), each started from its own foot.
// At phone width the ideas are rows over the box, and one opened lies over the thread. The thread
// and the box are the card page's chat (review/'s AiChat), drawn as a page. A discussion held in
// a Claude Code or Codex session (#2160) has no thread here: a note sends the user back to it.

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiArrowUpRight, FiCheck, FiChevronDown, FiFileText, FiLayout, FiTerminal, FiTrash2 } from "react-icons/fi";
import type { Chat } from "@review/api";
import { AiChat, type ChatApi } from "@review/components/ai-chat";
import { Button } from "@review/components/button";
import { HAIRLINE } from "@review/components/chrome";
import { Markdown } from "@review/components/Markdown";
import { Menu } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { REVIEW, T, workflowName } from "../i18n";
import { useNarrow } from "../lib/narrow";
import { numberOf } from "../lib/card";
import { Link } from "../router";
import { useStore } from "../store";
import { openSettings, RUNTIMES_CHANGED, useGoneRuntimes } from "../components/Settings";
import { Window } from "../components/Window";
import { Gone } from "./Gone";

const ICON = "nb-tip inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-ink/[0.06] hover:text-nb-ink";
const PAD = 24;
const NO_ASKS = { question: false, comments: false, previews: false };
const COPY = {
  ...REVIEW.ai,
  ask: T.idea.ask,
  clearBody: T.idea.clearBody,
  offline: T.idea.offline,
  notInstalledHere: T.idea.notInstalledHere,
  signedOutHere: T.idea.signedOutHere,
};

type Trouble = { text: string; upgrade?: boolean } | null;

export function DiscussionPage({ id }: { id: string }) {
  const store = useStore();
  const narrow = useNarrow();
  const [d, setD] = useState<api.Discussion | null>(null);
  const [missing, setMissing] = useState(false);
  const [workflows, setWorkflows] = useState<api.Workflow[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<Trouble>(null);
  const [reload, setReload] = useState(0);
  const [tried, setTried] = useState(false);
  const gone = useGoneRuntimes();

  // Every read and write of the chat also brings the ideas.
  const io = useMemo<ChatApi>(() => {
    const take = (next: api.Discussion) => {
      setD(next);
      return next as Chat;
    };
    const chat = api.discussionChat(id);
    return {
      read: () =>
        api.readDiscussion(id).then(take, (e) => {
          if (e instanceof api.ApiError && (e.code === "not_found" || e.status === 404)) setMissing(true);
          throw e;
        }),
      send: (body, runtime, images) => chat.send(body, runtime, images).then(take),
      clear: () => chat.clear().then(take),
      stop: () => chat.stop().then(take),
    };
  }, [id]);
  const replied = useCallback(() => store.reload(), [store.reload]);

  useEffect(() => {
    const bump = () => setReload((n) => n + 1);
    window.addEventListener(RUNTIMES_CHANGED, bump);
    const off = store.onEvent((e) => e.type === "discussion.updated" && (e.data as { discussion?: string }).discussion === id && bump());
    return () => {
      window.removeEventListener(RUNTIMES_CHANGED, bump);
      off();
    };
  }, [id]);
  useEffect(() => {
    if (d && d.workspace !== store.ws.id && store.workspaces.some((w) => w.id === d.workspace)) store.setWorkspace(d.workspace);
  }, [d?.workspace]);
  useEffect(() => {
    if (d) api.listWorkflows(d.workspace).then(setWorkflows, () => {});
  }, [d?.workspace]);
  // AiChat reads a web discussion; an external one has none, so its ideas are read here.
  useEffect(() => {
    if (!d || d.external) io.read().catch(() => {}).finally(() => setTried(true));
  }, [io, reload]);
  useEffect(() => {
    if (d) document.title = `${d.title} · WildCrane`;
  }, [d?.title]);

  if (missing && !d) return <Gone text={T.idea.notFound} />;

  const ideas = d?.ideas ?? [];
  const idea = ideas.find((i) => i.id === shown) ?? ideas.find((i) => !i.task) ?? ideas[0];
  const project = d?.project ? store.projects.find((p) => p.id === d.project) : undefined;

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setTrouble(null);
    try {
      await work();
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      if (code === "quota_exceeded") {
        const pro = await api.readBilling().then((r) => r.billing.plan === "pro", () => false);
        setTrouble({ text: pro ? T.limitPro : T.limit, upgrade: !pro });
      } else setTrouble({ text: code === "offline" ? T.errors.offline : T.errors.generic });
      if (code === "conflict" || code === "not_found") setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  const start = (i: api.Idea) =>
    act(async () => {
      const task = await api.startIdea(id, i.id, store.current?.id, d?.external ? d.version : undefined);
      store.patchTask(task);
      setD((was) => was && { ...was, ideas: was.ideas.map((x) => (x.id === i.id ? { ...x, task: { id: task.id, key: task.key } } : x)) });
    });
  const pick = (i: api.Idea, workflow: string) => act(async () => setD(await api.setIdeaWorkflow(id, i.id, workflow)));
  const discard = (i: api.Idea) => act(async () => setD(await api.deleteIdea(id, i.id)));

  const card = idea && (
    <IdeaCard
      ideas={ideas}
      idea={idea}
      workflows={workflows}
      busy={busy}
      trouble={trouble}
      onShow={(i) => setShown(i.id)}
      onStart={(i) => void start(i)}
      onPick={(i, w) => void pick(i, w)}
      onDiscard={(i) => void discard(i)}
      className={narrow ? "absolute inset-x-3 bottom-1 top-3" : "my-5 mr-5 w-[440px] shrink-0"}
    />
  );
  const rows = ideas.length > 0 && (
    <div className="pb-1.5">
      {open ? (
        <button type="button" onClick={() => setOpen(false)} className="flex h-7 cursor-pointer items-center gap-1 rounded-[6px] px-1.5 text-[12.5px] font-[600] text-nb-ink-soft">
          <FiChevronDown size={14} aria-hidden />
          {T.idea.ideas}
        </button>
      ) : (
        <>
          {trouble && <Note trouble={trouble} className="mb-1" />}
          <Rows
            ideas={ideas}
            busy={busy}
            onOpen={(i) => {
              setShown(i.id);
              setOpen(true);
            }}
            onStart={(i) => void start(i)}
          />
        </>
      )}
    </div>
  );
  const host = d?.external ? api.HOST_NAMES[d.host ?? "claude-code"] : null;
  const chat = !d && !tried ? (
    <div className="h-full" />
  ) : host ? (
    <Elsewhere host={host} below={narrow && rows} over={narrow && open && card} />
  ) : (
    <AiChat
      key={id}
      c={COPY}
      token={id}
      api={io}
      phone={narrow}
      page
      card={NO_ASKS}
      onReplied={replied}
      onManage={() => openSettings("runtimes")}
      gone={gone}
      reload={reload}
      aboveBox={narrow && rows}
      over={narrow && open && card}
    />
  );

  return (
    <Window project={project} activeChat={id}>
      {narrow ? (
        chat
      ) : (
        <div className="flex h-full">
          <div className="min-w-0 flex-1">{chat}</div>
          {card}
        </div>
      )}
    </Window>
  );
}

/** In place of the thread, for a discussion held in a Claude Code or Codex session. */
function Elsewhere({ host, below, over }: { host: string; below?: ReactNode; over?: ReactNode }) {
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="mb-1 inline-flex size-10 items-center justify-center rounded-[12px] bg-nb-wash text-nb-ink-soft">
          <FiTerminal size={18} aria-hidden />
        </span>
        <span className="rounded-[5px] bg-nb-wash px-1.5 text-[11px] font-[600] leading-[18px] text-nb-ink-soft">{T.idea.from(host)}</span>
        <h2 className="text-[16px] font-[800] leading-[1.35]">{T.idea.elsewhere(host)}</h2>
        <p className="max-w-[320px] text-[13px] leading-[1.5] text-nb-ink-soft">{T.idea.elsewhereBody(host)}</p>
      </div>
      {below && <div className="shrink-0 px-3">{below}</div>}
      {over}
    </div>
  );
}

function Note({ trouble, className }: { trouble: NonNullable<Trouble>; className?: string }) {
  return (
    <p role="status" className={cn("flex items-center gap-2 rounded-[8px] bg-nb-peach-soft px-2.5 py-1.5 text-[12px] leading-snug text-nb-peach-ink", className)}>
      <FiAlertCircle size={13} className="shrink-0" aria-hidden />
      <span className="flex-1">{trouble.text}</span>
      {trouble.upgrade && (
        <a href={api.PRICING_URL} target="_blank" rel="noreferrer" className="shrink-0 font-[700] underline underline-offset-2">
          {T.upgrade}
        </a>
      )}
    </p>
  );
}

function Started({ task }: { task: { key: string } }) {
  return (
    <Link
      href={`/tasks/${encodeURIComponent(task.key)}`}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-[12px] font-[600] text-nb-mint-ink no-underline hover:bg-nb-ink/5"
    >
      <FiCheck size={12} aria-hidden />
      {T.idea.started} {numberOf(task.key)}
      <FiArrowUpRight size={12} aria-hidden />
    </Link>
  );
}

const nameOf = (workflows: api.Workflow[], id: string) => workflowName(workflows.find((w) => w.id === id) ?? { id, name: id });

/** The ideas, one tab each, the shown one in full. No border and no shadow: a shade off the paper. */
function IdeaCard({
  ideas,
  idea,
  workflows,
  busy,
  trouble,
  onShow,
  onStart,
  onPick,
  onDiscard,
  className,
}: {
  ideas: api.Idea[];
  idea: api.Idea;
  workflows: api.Workflow[];
  busy: boolean;
  trouble: Trouble;
  onShow: (i: api.Idea) => void;
  onStart: (i: api.Idea) => void;
  onPick: (i: api.Idea, workflow: string) => void;
  onDiscard: (i: api.Idea) => void;
  className?: string;
}) {
  return (
    <section aria-label={T.idea.ideas} className={cn("flex flex-col overflow-hidden rounded-[14px] bg-nb-cream", className)}>
      {ideas.length > 1 && (
        <div role="tablist" className="flex shrink-0 items-end gap-5 overflow-x-auto pt-2" style={{ paddingInline: PAD, borderBottom: `1px solid ${HAIRLINE}` }}>
          {ideas.map((i) => {
            const on = i.id === idea.id;
            return (
              <button
                key={i.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onShow(i)}
                className={cn("relative flex max-w-[180px] shrink-0 cursor-pointer items-center gap-1 pb-2 pt-1.5 text-[12.5px]", on ? "font-[700] text-nb-ink" : "font-[600] text-nb-ink-soft")}
              >
                {i.task && <FiCheck size={12} className="shrink-0 text-nb-mint-ink" aria-hidden />}
                <span className="truncate">{i.title}</span>
                {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-nb-accent" />}
              </button>
            );
          })}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: PAD }}>
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-[16px] font-[800] leading-[1.35] tracking-[-0.01em]">{idea.title}</h2>
          {!idea.task && (
            <button type="button" disabled={busy} onClick={() => onDiscard(idea)} aria-label={T.idea.discard} data-tip={T.idea.discard} className={cn(ICON, "-mr-1.5 -mt-1")}>
              <FiTrash2 className="text-[13px]" aria-hidden />
            </button>
          )}
        </div>
        {!idea.task && (
          <div className="nb-sessionlog-md mt-2">
            <Markdown body={idea.outcome} />
            {idea.acceptance.length > 0 && (
              <>
                <h3>{T.idea.acceptance}</h3>
                <ul className="list-disc">
                  {idea.acceptance.map((a, n) => (
                    <li key={n}>{a}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
      {trouble && <Note trouble={trouble} className="mx-4 mb-2" />}
      <div className="flex h-12 shrink-0 items-center gap-1.5 text-[12.5px]" style={{ paddingInline: PAD, borderTop: `1px solid ${HAIRLINE}` }}>
        {idea.task ? (
          <span className="flex items-center gap-1.5 text-nb-ink-soft">
            <FiLayout size={13} aria-hidden />
            {nameOf(workflows, idea.workflow)}
          </span>
        ) : (
          <Menu
            trigger={({ open, onClick }) => (
              <button
                type="button"
                onClick={onClick}
                aria-expanded={open}
                aria-label={T.workflow}
                className={cn("-ml-2 flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 font-[600] hover:bg-nb-ink/[0.06]", open && "bg-nb-ink/[0.06]")}
              >
                <FiLayout size={13} className="text-nb-ink-soft" aria-hidden />
                {nameOf(workflows, idea.workflow)}
                <FiChevronDown size={12} className="text-nb-ink-soft" aria-hidden />
              </button>
            )}
            items={workflows.map((w) => ({
              key: w.id,
              onSelect: () => w.id !== idea.workflow && onPick(idea, w.id),
              body: (
                <>
                  <span className="min-w-0 flex-1 truncate">{workflowName(w)}</span>
                  {w.id === idea.workflow && <FiCheck size={12} aria-hidden />}
                </>
              ),
            }))}
          />
        )}
        <span className="-mr-1.5 ml-auto flex items-center">
          {idea.task ? (
            <Started task={idea.task} />
          ) : (
            <Button size="xs" disabled={busy} onClick={() => onStart(idea)}>
              {T.idea.start}
            </Button>
          )}
        </span>
      </div>
    </section>
  );
}

/** At phone width, folded: a row per idea over the box, each with its own Start. */
function Rows({ ideas, busy, onOpen, onStart }: { ideas: api.Idea[]; busy: boolean; onOpen: (i: api.Idea) => void; onStart: (i: api.Idea) => void }) {
  return (
    <div className="flex max-h-[30dvh] flex-col overflow-y-auto">
      {ideas.map((i) => (
        <div key={i.id} className="flex h-9 min-w-0 shrink-0 items-center gap-2 px-1">
          <button type="button" onClick={() => onOpen(i)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
            <FiFileText size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
            <span className="min-w-0 truncate text-[12.5px] font-[600]">{i.title}</span>
          </button>
          <span className="flex shrink-0 items-center">
            {i.task ? (
              <Started task={i.task} />
            ) : (
              <Button size="xs" disabled={busy} onClick={() => onStart(i)}>
                {T.idea.start}
              </Button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
