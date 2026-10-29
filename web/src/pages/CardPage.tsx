// `/tasks/<key>`, after legacy kanban-ui/components/CardPage.tsx, drawn with the review page's
// sheet (review/'s card-sheet.tsx, #2062): the title, a row with the status pill and 评论 / 分享 /
// 移除 / 执行, the run log, the meta strip and the body. The comments rail is the card's, every
// phase's, the one its share link shows; the AI bubble sits in the corner (review/'s ai-corner.tsx, its
// chat on `/v1/tasks/{id}/chat`), revises the card and asks its open questions (#2101). A done
// Workflow builder task names the workflow it saved and starts a task with it (#2004); a done
// build names its commit and shows its diff (#2109).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FaRegLightbulb } from "react-icons/fa";
import { FiAlertCircle, FiArrowUpRight, FiCheckCircle, FiPauseCircle, FiPlay, FiRotateCw, FiWifiOff, FiX } from "react-icons/fi";
import type { Artifact, Comment, Decision, Shared } from "@review/api";
import { AiChat } from "@review/components/ai-chat";
import { AiBackButton, AiCorner, useAiOpen } from "@review/components/ai-corner";
import { Button } from "@review/components/button";
import { CardSheet, refining, RemoveButton, RunButton, type Info } from "@review/components/card-sheet";
import { ChatButton, ChatPane } from "@review/components/chat";
import { answerText, NO_ANSWERS, QuestionPanel } from "@review/components/questions";
import { ShareButton, SharePanel } from "@review/components/share";
import { useThread } from "@review/components/thread";
import { Previews } from "@review/lib/artifacts";
import { cardMeta, openQuestions, withoutTitle } from "@review/lib/card-info";
import * as api from "../api";
import { useAlerts } from "../alerts";
import { REVIEW, T, workflowName } from "../i18n";
import { numberOf } from "../lib/card";
import { remember, reviewLink } from "../lib/links";
import { useNarrow } from "../lib/narrow";
import { Link, navigate, useLocation } from "../router";
import { useStore } from "../store";
import { StatusPill, type PillStatus } from "../components/chips";
import { useDismiss } from "../components/Header";
import { LandedCommit, LandedDiff } from "../components/Landed";
import { RunLog, watchDoing } from "../components/RunLog";
import { StageBand, type StageState } from "../components/StageBand";
import { titleOf } from "../components/Agents";
import { Subtasks } from "../components/Subtasks";
import { openSettings, RUNTIMES_CHANGED, useGoneRuntimes } from "../components/Settings";
import { Skeleton } from "../components/Skeleton";
import { Window } from "../components/Window";
import { ComputerMenu, useComputers } from "../components/ComputerMenu";
import { Notice, quotaText } from "../components/Notice";
import { Gone } from "./Gone";

/** A task's key, as a card's `source` names the task it came from (#2063). */
const TASK_KEY = /^[A-Z][A-Z0-9]*-\d+$/;

const GREY = { background: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", color: "var(--color-nb-ink-soft)" };

function Line({ tone, icon, children }: { tone: "peach" | "mint" | "grey"; icon: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] leading-snug" style={tone === "grey" ? GREY : { background: `var(--color-nb-${tone}-soft)`, color: `var(--color-nb-${tone}-ink)` }}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{children}</span>
    </div>
  );
}

/** What went wrong with a write, in one plain line. */
function sayError(e: unknown): string {
  const code = e instanceof api.ApiError ? e.code : "";
  if (code === "offline") return T.errors.offline;
  if (code === "conflict") return T.agentBusy;
  if (code === "review_outdated") return REVIEW.errors.outdated;
  if (code === "task_running") return T.cancelRunning;
  if (code === "quota_exceeded") return quotaText(e)!;
  if (code === "chat_busy") return REVIEW.ai.busy;
  if (code === "runner_offline") return REVIEW.ai.offline;
  if (code === "runner_removed") return REVIEW.ai.removed;
  if (code === "runner_unavailable") return T.unavailable;
  return T.errors.generic;
}

/** `#12` is a card number, which is the task number: same prefix as this task's key. */
const keyOf = (own: string, s: string) => (/^#\d+$/.test(s) ? own.replace(/\d+$/, s.slice(1)) : s);

const NONE: never[] = [];

export function CardPage({ taskKey }: { taskKey: string }) {
  const store = useStore();
  const alerts = useAlerts();
  const narrow = useNarrow();
  const { query } = useLocation();
  const fromList = store.tasks?.find((t) => t.key === taskKey || t.id === taskKey);
  const [own, setOwn] = useState<api.Task | null>(null);
  const [missing, setMissing] = useState(false);
  const task = fromList && own && fromList.id === own.id ? (fromList.updated_at >= own.updated_at ? { ...own, ...fromList } : own) : (fromList ?? own);
  const [railOpen, setRailOpen] = useState(false);
  const [card, setCard] = useState<api.Card | null>(null);
  // A decision or a revision moves the review without the task's `updated_at`, so the list's
  // copy never stands in for it: its own events, else the task as last read here.
  const [heard, setHeard] = useState<api.Review | null>(null);
  useEffect(() => setHeard(null), [own]);
  const review = heard ?? (own && own.id === task?.id ? own.review : task?.review);
  const [answers, setAnswers] = useState(NO_ANSWERS);
  const ready = review?.status === "ready" ? review : undefined;
  const asked = task?.status === "waiting_review" && !!ready?.card_question && !!ready.question && !!ready.options?.length;
  const questions = useMemo(() => {
    if (!asked) return [];
    const open = card ? openQuestions(card.body) : [];
    return open.length ? open : [{ text: ready!.question!.trim(), options: ready!.options!.map((o) => o.label), recommend: [], multi: false }];
  }, [asked, card?.body, ready?.question]);
  const [chat, setChat] = useAiOpen(query.get("chat") === "1", asked ? `${task!.id}:${ready!.phase}` : null);
  const [chatSeen, setChatSeen] = useState(0);
  const gone = useGoneRuntimes();
  useEffect(() => {
    const bump = () => setChatSeen((n) => n + 1);
    window.addEventListener(RUNTIMES_CHANGED, bump);
    return () => window.removeEventListener(RUNTIMES_CHANGED, bump);
  }, []);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [from, setFrom] = useState<api.Discussion | null>(null);
  const [built, setBuilt] = useState<api.Workflow | null>(null);
  // Queued only by the plan's running limit (#2209): its notice names the limit, and offers Free Pro.
  const slot = task?.status === "queued" && !!task.waiting_for_slot;
  const [plan, setPlan] = useState<api.BillingRead | null>(null);
  useEffect(() => {
    if (slot && !plan) api.readBilling().then(setPlan, () => {});
  }, [slot]);

  useEffect(() => {
    setChat(query.get("chat") === "1");
    setAnswers(NO_ANSWERS);
  }, [taskKey]);

  // The task, read on its own too: an old key, another workspace, or the archive.
  useEffect(() => {
    let live = true;
    setMissing(false);
    api.readTask(taskKey).then(
      (t) => live && setOwn(t),
      (e) => live && e instanceof api.ApiError && (e.code === "not_found" || e.status === 404) && setMissing(true),
    );
    return () => {
      live = false;
    };
  }, [taskKey]);

  useEffect(() => {
    if (!task) return;
    if (task.workspace !== store.ws.id && store.workspaces.some((w) => w.id === task.workspace)) store.setWorkspace(task.workspace);
    if (task.key !== taskKey) navigate(`/tasks/${encodeURIComponent(task.key)}${location.search}`, true);
    store.markSeen(task.id);
    document.title = `${task.title} · WildCrane`;
  }, [task?.id, task?.key]);

  // Opening a task reads its alerts.
  useEffect(() => {
    if (!task) return;
    if (alerts.of(task.id)) alerts.read(task.id);
  }, [task?.id, alerts.of(task?.id ?? "")?.alerts.length]);

  const loadCard = useCallback(() => {
    if (!task || task.card_version == null) return setCard(null);
    api.readCard(task.id).then(setCard, () => setCard(null));
  }, [task?.id, task?.card_version]);
  useEffect(loadCard, [loadCard]);

  const loadTask = useCallback(() => {
    if (task) void api.readTask(task.id).then(setOwn, () => {});
  }, [task?.id]);
  // Only the conversation's creator can read it; anyone else sees no link.
  useEffect(() => {
    setFrom(null);
    if (task?.discussion) api.readDiscussion(task.discussion).then(setFrom, () => {});
  }, [task?.discussion]);

  // The approvals the card makes (#2154), each named by its agents.
  const [flow, setFlow] = useState<Awaited<ReturnType<typeof api.readTaskWorkflow>> | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    setFlow(null);
    if (task) api.readTaskWorkflow(task.id).then(setFlow, () => {});
  }, [task?.id, task?.status]);
  useEffect(() => {
    if (!task?.project || !flow || flow.rounds < 2) return;
    api.readProjectAgents(task.project).then((d) => setTitles(new Map(d.data.map((a) => [a.agent, titleOf(a)]))), () => {});
  }, [task?.project, flow?.rounds]);

  const saved = task?.workflow.id === api.BUILDER && task.status === "done" ? task.context?.workflow : undefined;
  useEffect(() => {
    setBuilt(null);
    if (saved) api.readWorkflow(saved).then(setBuilt, () => {});
  }, [saved]);

  // The previews the body names, read as review/ reads them.
  useEffect(() => {
    const assets = card?.assets ?? {};
    const ids = [...new Map(Object.values(assets).map((a) => [a.artifact, a.version])).entries()];
    if (!ids.length) return setArtifacts([]);
    let live = true;
    Promise.all(
      ids.map(async ([id, pinned]) => {
        try {
          const art = await api.readArtifact(id);
          const n = pinned ?? art.latest_version;
          if (n == null) return null;
          const v = await api.readArtifactVersion(id, n);
          return { id, type: art.type, name: art.name ?? id, latest_version: art.latest_version, versions: [v] } as Artifact;
        } catch {
          return null;
        }
      }),
    ).then((list) => live && setArtifacts(list.filter((a): a is Artifact => !!a)));
    return () => {
      live = false;
    };
  }, [card?.version]);

  // Once anything is up for review, the card has its comments rail and its share link.
  const reviewed = !!review?.status;

  // The card's comments, the ones its share link shows.
  const loadComments = useCallback(() => {
    if (!task) return;
    void api.listComments(task.id).then(setComments, () => {});
    void api.listDecisions(task.id).then(setDecisions, () => {});
  }, [task?.id]);
  useEffect(() => {
    setComments([]);
    setDecisions([]);
    loadComments();
  }, [loadComments]);

  useEffect(
    () =>
      store.onEvent((e) => {
        const d = e.data as { id?: string; task?: string };
        if (d.task === task?.id || d.id === task?.id) {
          if (e.type === "task.updated" || e.type === "task.cancelled") setOwn(e.data as unknown as api.Task);
          if (e.type.startsWith("review.")) setHeard(e.data as unknown as api.Review);
          if (e.type === "comment.created" || e.type === "decision.created") loadComments();
        }
      }),
    [task?.id, loadComments],
  );

  const { thread, unread, opening } = useThread({
    key: task?.id ?? "",
    comments,
    decisions,
    revisions: NONE,
    owner: "",
    me: store.me.handle || store.me.email ? { handle: store.me.handle, email: store.me.email ?? null } : null,
    open: railOpen,
  });

  const meta = useMemo(() => (card ? cardMeta(card.body, card.metadata) : null), [card]);
  const previews = useMemo(
    () => new Previews({ card: card ? { ...card, metadata: {} } : null, artifacts } as unknown as Shared, { component: (art, v) => api.readArtifactComponent(art.id, v.version), canSave: false, saved: () => {} }),
    [card, artifacts],
  );

  const ownKey = task?.key;
  const known = useMemo(() => new Set(store.tasks?.map((t) => t.key)), [store.tasks]);
  const cardLink = useCallback(
    (id: number, text: ReactNode) => {
      if (!ownKey) return null;
      const key = keyOf(ownKey, `#${id}`);
      return known.has(key) ? <Link href={`/tasks/${encodeURIComponent(key)}`}>{text}</Link> : null;
    },
    [known, ownKey],
  );

  const [pick, setPick] = useState<string | null>(null);
  const computers = useComputers(task?.project);

  if (missing && !task) return <Gone text={T.notFound} />;
  if (!task)
    return (
      <Window>
        <Skeleton className="max-w-[420px] p-6" />
      </Window>
    );

  const project = store.projects.find((p) => p.id === task.project);
  const waiting = task.status === "waiting_review" && !!ready;
  const owner = store.ws.role === "owner";
  const pill: PillStatus = task.status === "waiting_review" ? "review" : task.status === "done" ? "done" : task.status === "cancelled" ? "cancelled" : task.status;
  const approve = ready ? (ready.options ? ready.options.findIndex((o) => o.approve) : 0) : -1;
  const landing = task.status === "done" ? task.landing : null;
  const reason = task.status === "failed" ? knownFailure(task.failure) : null;
  const stopping = task.run?.state === "running" && task.run.stopping;
  // The computer it ran on is no longer shared (#2196): resuming picks another.
  const unavailable = !task.run && (task.resume ? task.resume.available === false : task.status === "stopped");
  const target = pick ?? computers.def?.machine;
  const staged = !!flow && flow.rounds > 1;
  const stageNames = flow && staged
    ? Array.from({ length: flow.rounds }, (_, i) => flow.stages[i]?.map((a) => titles.get(a) ?? titleOf({ agent: a, title: {} })).join(T.stage.join) || T.agents.approval(i + 1))
    : [];
  const stageState: StageState =
    questions.length > 0
      ? "questions"
      : waiting && approve >= 0
        ? "waiting"
        : task.status === "running" || task.status === "queued"
          ? "running"
          : task.status === "done"
            ? "done"
            : null;

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setTrouble(null);
    try {
      await work();
    } catch (e) {
      setTrouble(sayError(e));
      // A card updated while it was open: read it again, and say so.
      if (e instanceof api.ApiError && e.code === "review_outdated") {
        loadCard();
        loadTask();
      }
    } finally {
      setBusy(false);
    }
  };
  const run = () =>
    act(async () => {
      await api.decide(task.id, { decision: "approve", review_revision: ready!.revision });
      const t = await api.readTask(task.id);
      setOwn(t);
      store.patchTask(t);
    });
  // The answers go back to planning with the asker's recent chat on this task.
  const submit = () =>
    act(async () => {
      const recent = (await api.taskChat(task.id).read().catch(() => null))?.messages.slice(-10) ?? [];
      const comment = answerText(REVIEW.questions, questions, answers, recent);
      await api.decide(task.id, { decision: "request_changes", comment, review_revision: ready!.revision });
      setAnswers(NO_ANSWERS);
      const t = await api.readTask(task.id);
      setOwn(t);
      store.patchTask(t);
    });
  const remove = (reason?: string) =>
    act(async () => {
      const t = await api.cancelTask(task.id, reason);
      setOwn(t);
      store.patchTask(t);
    });
  const stop = () =>
    act(async () => {
      const t = await api.stopTask(task.id);
      setOwn(t);
      store.patchTask(t);
    });
  const resume = (machine?: string) =>
    act(async () => {
      const t = await api.resumeTask(task.id, machine);
      setOwn(t);
      store.patchTask(t);
    });
  const retry = () =>
    act(async () => {
      const t = await api.createTask({ title: task.title, request: task.request, project: task.project, workspace: task.workspace, workflow: task.workflow.id });
      store.patchTask(t);
      navigate(`/tasks/${encodeURIComponent(t.key)}?chat=1`);
    });
  const comment = async (body: string) => {
    setTrouble(null);
    try {
      await api.postComment(task.id, body);
      loadComments();
      return true;
    } catch (e) {
      setTrouble(sayError(e));
      return false;
    }
  };

  const toggleChat = () => {
    if (narrow) setRailOpen(false);
    setChat((v) => !v);
  };
  const toggleRail = () => {
    if (!railOpen) opening();
    if (narrow) setChat(false);
    setRailOpen((v) => !v);
  };
  const ai = (
    <AiChat
      key={task.id}
      c={REVIEW.ai}
      token={task.id}
      draftKey={`${store.ws.id}.task.${task.id}.chat`}
      api={{ ...api.taskChat(task.id), watch: watchDoing }}
      phone={narrow}
      card={{ question: asked, comments: comments.length > 0, previews: artifacts.length > 0 }}
      onReplied={() => void api.readTask(task.id).then(setOwn, () => {})}
      onManage={() => openSettings("runtimes")}
      gone={gone}
      reload={chatSeen}
      ask={questions.length ? REVIEW.ai.askPending : undefined}
      aboveBox={
        questions.length > 0 && (
          <QuestionPanel c={REVIEW.questions} questions={questions} answers={answers} onChange={setAnswers} busy={busy} phone={narrow} onSubmit={() => void submit()} />
        )
      }
    />
  );
  const rail = reviewed && <ChatPane c={REVIEW.comments} thread={thread} phone={narrow} canWrite onSend={comment} draftKey={`${store.ws.id}.task.${task.id}.comment`} onClose={() => setRailOpen(false)} />;

  const actions = (
    <>
      {reviewed && <ChatButton quiet label={REVIEW.comments.heading} count={thread.length} open={railOpen} unread={unread && !railOpen} onClick={toggleRail} />}
      {owner && reviewed && <ShareSlot task={task.id} />}
      {(task.status === "queued" || task.status === "waiting_review") && <RemoveButton busy={busy} draftKey={`${store.ws.id}.task.${task.id}.remove`} onRemove={(reason) => void remove(reason)} />}
      {waiting && approve >= 0 && !asked && !staged && <RunButton refine={refining(flow)} busy={busy} onClick={() => void run()} />}
      {built && (
        <Button size="xs" className="ml-2" onClick={() => navigate(`/new?workflow=${encodeURIComponent(built.id)}`)}>
          <FaRegLightbulb className="text-[14px]" aria-hidden />
          {T.builder.startWith}
        </Button>
      )}
      {task.run?.state === "running" &&
        (!stopping ? (
          <Button size="xs" variant="ghost" className="ml-2" disabled={busy} onClick={() => void stop()}>
            <FiPauseCircle className="text-[14px]" aria-hidden />
            {T.stop}
          </Button>
        ) : task.run.runner_connected ? (
          <Button size="xs" variant="ghost" className="ml-2" disabled>
            {T.stopping}
          </Button>
        ) : (
          <Button size="xs" variant="ghost" className="ml-2 text-nb-ink-soft shadow-none disabled:cursor-default disabled:opacity-100" disabled title={task.run.machine ? T.stopWaitingTip(task.run.machine) : undefined}>
            <FiWifiOff className="text-[13px]" aria-hidden />
            {T.stopWaiting}
          </Button>
        ))}
      {task.status === "failed" && (
        <Button size="xs" variant={task.resume ? "ghost" : "accent"} className="ml-2" disabled={busy} onClick={() => void retry()}>
          <FiRotateCw className="text-[14px]" aria-hidden />
          {T.retry}
        </Button>
      )}
      {unavailable ? (
        <>
          <span className="ml-2 text-[12.5px]">
            <ComputerMenu c={computers} value={pick} onPick={setPick} />
          </span>
          <Button size="xs" className="ml-1" disabled={busy || !target} onClick={() => void resume(target)}>
            <FiPlay className="text-[14px]" aria-hidden />
            {T.resume}
          </Button>
        </>
      ) : task.resume && (
        <Button size="xs" className="ml-2" disabled={busy} onClick={() => void resume()}>
          <FiPlay className="text-[14px]" aria-hidden />
          {T.resume}
        </Button>
      )}
    </>
  );
  const info: Info = {
    ...(meta ?? { modules: [], priority: null, todos: null, source: [], blockedBy: [], related: [] }),
    workflow: workflowName(task.workflow),
    project: project?.name ?? "—",
    chipLink: (s, chip) => {
      const key = keyOf(task.key, s);
      return TASK_KEY.test(key) ? (
        <Link key={s} href={`/tasks/${encodeURIComponent(key)}`} className="no-underline hover:underline">
          {chip}
        </Link>
      ) : null;
    },
    more: [
      { label: REVIEW.meta.started, value: REVIEW.when(task.created_at) },
      ...(from
        ? [
            {
              label: T.fromChat,
              value: (
                <Link href={`/discussions/${encodeURIComponent(from.id)}`} className="inline-flex min-w-0 items-center gap-0.5 no-underline hover:underline" style={{ color: "var(--color-nb-accent-deep)" }}>
                  <span className="max-w-[200px] truncate">{from.title}</span>
                  <FiArrowUpRight size={11} aria-hidden className="shrink-0" />
                </Link>
              ),
            },
          ]
        : []),
      ...(landing ? [{ label: T.landed.commit, value: <LandedCommit landing={landing} /> }] : []),
    ],
  };

  return (
    <Window
      project={project}
      side={!narrow && railOpen && rail}
      activeChat={chat ? task.id : undefined}
      phoneLead={narrow && chat && <AiBackButton c={REVIEW.ai} onClick={toggleChat} />}
      phoneTop={
        narrow &&
        !chat &&
        railOpen && (
          <button type="button" onClick={toggleRail} aria-label={REVIEW.comments.close} title={REVIEW.comments.close} className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-nb-ink text-nb-paper">
            <FiX className="text-[15px]" aria-hidden />
          </button>
        )
      }
    >
      {narrow && chat ? (
        ai
      ) : narrow && railOpen && rail ? (
        rail
      ) : (
        <div className="relative h-full">
          <div className="h-full overflow-y-auto">
            <CardSheet
              number={numberOf(task.key)}
              title={task.title}
              status={<StatusPill status={pill} label={slot ? T.waitingForSlot : undefined} />}
              actions={actions}
              info={info}
              above={
                <>
                  {staged && flow && (
                    <StageBand stages={stageNames} stage={flow.round} state={stageState} questions={questions.length} approve={{ busy, onApprove: () => void run() }} />
                  )}
                  {built && <Line tone="mint" icon={<FiCheckCircle size={14} aria-hidden />}>{task.context?.created ? T.builder.created(built.name) : T.builder.updated(built.name)}</Line>}
                  {task.run?.runner_removed && <Line tone="peach" icon={<FiAlertCircle size={14} aria-hidden />}>{T.removedLine(task.run.machine ?? "")}</Line>}
                  {slot && plan && <Notice trouble={{ text: T.slotsFull(plan.quota.limits.tasks), upgrade: plan.billing.plan !== "pro" }} />}
                  <RunLog task={task} failure={task.status === "failed" && !reason ? task.failure : null} />
                </>
              }
              below={
                <>
                  {trouble && <Line tone="peach" icon={<FiAlertCircle size={14} aria-hidden />}>{trouble}</Line>}
                  {reason && <Line tone="peach" icon={<FiAlertCircle size={14} aria-hidden />}>{reason}</Line>}
                  {unavailable ? (
                    <Line tone="peach" icon={<FiAlertCircle size={14} aria-hidden />}>{task.resume ? T.unavailableLine(task.resume.machine) : T.unavailable}</Line>
                  ) : (
                    task.status === "stopped" && task.resume && <Line tone="grey" icon={<FiPauseCircle size={14} aria-hidden />}>{T.stoppedLine(task.resume.machine)}</Line>
                  )}
                  {landing && <LandedDiff task={task.id} landing={landing} />}
                  {!project?.general && <Subtasks task={task} />}
                </>
              }
              body={card ? withoutTitle(card.body) : null}
              previews={previews}
              cardLink={cardLink}
              empty={<p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-nb-ink">{task.request || task.title}</p>}
            />
          </div>
          <AiCorner c={REVIEW.ai} open={chat} phone={narrow} count={questions.length} onToggle={toggleChat}>
            {ai}
          </AiCorner>
        </div>
      )}
    </Window>
  );
}

/** review/'s Share, its link made the first time it is opened. */
function ShareSlot({ task }: { task: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ link: api.ShareLink; url: string; guests: { email: string; created_at: string }[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const box = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    setFailed(false);
    try {
      const [l, guests] = await Promise.all([reviewLink(task), api.listGuests(task).catch(() => [])]);
      setState({ ...l, guests });
    } catch {
      setFailed(true);
    }
  };
  return (
    <div ref={box} className="relative">
      <ShareButton quiet label={REVIEW.share.button} open={open} onClick={() => void toggle()} />
      {open && (
        <div className="nb-pop origin-top-right absolute right-0 top-[calc(100%+8px)] z-[60] max-md:fixed max-md:inset-x-3 max-md:top-[calc(3.5rem+env(safe-area-inset-top))]">
          {state ? (
            <SharePanel
              key={state.link.id}
              c={REVIEW.share}
              link={state.link}
              task={task}
              guests={state.guests}
              expires={REVIEW.date(state.link.expires_at)}
              url={state.url}
              onChanged={() => {}}
              onRenewed={(next) => {
                remember(task, next);
                setState((s) => s && { ...s, link: next, url: next.url });
              }}
            />
          ) : (
            <div className="rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper p-4 text-[12.5px] text-nb-ink-soft shadow-[3px_3px_0_0_var(--color-nb-ink)]">{failed ? T.reviewFailed : "…"}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** The Runner's reason, in the reader's language, where it is one of ours (#2074); null for the rest. */
const knownFailure = (reason?: string | null) => {
  if (reason?.startsWith("The workflow has a problem:")) return T.builder.checkFailed;
  const missing = reason?.match(/^(Claude Code|Codex) is not (installed|signed in) on this computer\.$/);
  return missing ? (missing[2] === "installed" ? T.runtimes.missingHere(missing[1]!) : T.runtimes.signedOutHere(missing[1]!)) : null;
};
