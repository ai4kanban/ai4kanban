// Copied from legacy kanban-ui/components/CardPage.tsx inside Window.tsx's frame: the header
// and the comments rail on the window's cream, the page on a paper sheet rounded where it turns
// from them. The sheet is card-sheet.tsx, as on WildCrane Web's card page (#2062). The rail holds
// the comments, opens from the top row's button and starts closed; at phone width it covers the
// page. Workspace members also get 执行 / 细化, 移除 and the AI bubble in the page's corner
// (ai-corner.tsx), which asks the card's open questions (#2101); owners the Share button. A guest
// only comments. At phone width the AI chat covers the page too, one of the two at a time.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiGlobe, FiLogOut } from "react-icons/fi";
import { ApiError, cancelTask, postComment, postDecision, readChat, readComponent, readTaskWorkflow, type Shared } from "../api";
import { signOut } from "../auth";
import { useCopy } from "../i18n";
import { Previews } from "../lib/artifacts";
import { cardMeta, openQuestions, withoutTitle } from "../lib/card-info";
import { cn } from "../lib/utils";
import { AiChat } from "./ai-chat";
import { AiBackButton, AiCorner, useAiOpen } from "./ai-corner";
import { CardSheet, refining, RemoveButton, RunButton, type Info } from "./card-sheet";
import { Avatar, ChatButton, ChatPane, useEscape } from "./chat";
import { HAIRLINE } from "./chrome";
import { LangSelect } from "./lang-select";
import { Logo } from "./Logo";
import { Menu } from "./menu";
import { answerText, NO_ANSWERS, QuestionPanel } from "./questions";
import { Share } from "./share";
import { useThread } from "./thread";

// The card's one mark: ember for waiting on you, mint for done, peach for sent back.
const PILL_SKIN = {
  live: { bg: "var(--color-nb-accent-soft)", ink: "var(--color-nb-accent-deep)" },
  done: { bg: "var(--color-nb-mint-soft)", ink: "var(--color-nb-mint-ink)" },
  back: { bg: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" },
  quiet: { bg: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)", ink: "var(--color-nb-ink-soft)" },
};

function DeliveryPill({ label, tone }: { label: string; tone: keyof typeof PILL_SKIN }) {
  const skin = PILL_SKIN[tone];
  return (
    <span className="nb-chip" style={{ background: skin.bg, color: skin.ink }}>
      {label}
    </span>
  );
}

const useNarrow = () => {
  const query = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
};

/** A failed write, said once over the page with what to do about it. */
type Trouble = { text: string; reload?: boolean } | null;

export function CardPage({ shared, token, reload }: { shared: Shared; token: string; reload: () => Promise<void> }) {
  const c = useCopy();
  const review = shared.review;
  const card = shared.card;
  const viewer = shared.role === null;
  const owner = shared.role === "owner";
  const member = owner || shared.role === "member";
  const narrow = useNarrow();
  const status = review.status;
  const over = ["done", "failed", "cancelled"].includes(shared.task.status);
  const ready = member && !!card && !over && status === "ready";
  const asking = ready && !!review.card_question && !!review.options?.length;
  const questions = useMemo(() => {
    if (!asking) return [];
    const open = openQuestions(card!.body);
    return open.length ? open : [{ text: review.question.trim(), options: review.options!.map((o) => o.label), recommend: [], multi: false }];
  }, [asking, card?.body, review.question]);
  const [answers, setAnswers] = useState(NO_ANSWERS);
  const [railOpen, setRailOpen] = useState(false);
  const [aiOpen, setAiOpen] = useAiOpen(false, asking ? String(review.phase) : null);
  const [trouble, setTrouble] = useState<Trouble>(null);
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<{ round: number; rounds: number } | null>(null);
  useEffect(() => {
    if (member) readTaskWorkflow(shared.task.id).then(setFlow, () => {});
  }, [member, shared.task.id, review.phase]);

  // Rebuilt only when what is under review changes, so a poll never reloads a preview.
  const contentKey = JSON.stringify([card?.version, review.revision, shared.artifacts.map((a) => [a.id, a.latest_version])]);
  const previews = useMemo(
    () => new Previews(shared, { component: (_, v) => readComponent(token, v.component!.name, v.component!.version), canSave: owner, saved: () => void reload() }),
    [contentKey],
  );

  const { thread, unread, opening } = useThread({
    key: shared.link.id,
    comments: shared.comments ?? [],
    decisions: shared.decisions ?? [],
    revisions: shared.revisions ?? [],
    rounds: flow?.rounds,
    owner: shared.owner.handle,
    me: shared.me,
    open: railOpen,
  });
  const toggleRail = () => {
    if (!railOpen) opening();
    if (narrow) setAiOpen(false);
    setRailOpen((v) => !v);
  };
  const closeRail = useCallback(() => setRailOpen(false), []);
  useEscape(railOpen && narrow, closeRail);
  const toggleAi = () => {
    if (narrow) setRailOpen(false);
    setAiOpen((v) => !v);
  };
  const replied = useCallback(() => void reload(), [reload]);

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : "";
    if (code === "review_outdated") void reload();
    setTrouble(
      code === "offline"
        ? { text: c.errors.offline }
        : code === "review_outdated"
          ? { text: c.errors.outdated }
          : code === "card_missing"
            ? { text: c.errors.cardMissing, reload: true }
            : code === "conflict"
              ? { text: c.errors.conflict, reload: true }
              : code === "chat_busy"
                ? { text: c.ai.busy }
                : code === "runner_offline"
                  ? { text: c.ai.offline }
                  : code === "runner_removed"
                    ? { text: c.ai.removed }
                    : { text: c.errors.generic },
    );
  };
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setTrouble(null);
    try {
      await work();
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const comment = async (body: string) => {
    setTrouble(null);
    try {
      await postComment(token, body);
      await reload();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const approve = review.options ? review.options.findIndex((o) => o.approve) : 0;
  const run = () => void act(() => postDecision(token, { picked: approve, review_revision: review.revision }));
  // The answers go back to planning with the asker's recent chat on this card.
  const submit = () =>
    void act(async () => {
      const recent = (await readChat(token).catch(() => null))?.messages.slice(-10) ?? [];
      await postDecision(token, { text: answerText(c.questions, questions, answers, recent), review_revision: review.revision });
      setAnswers(NO_ANSWERS);
    });
  const remove = (reason?: string) => void act(() => cancelTask(shared.task.id, reason));

  const pill = !member ? null : shared.task.status === "cancelled" ? (
    <DeliveryPill label={c.pill.removed} tone="quiet" />
  ) : status === "approved" ? (
    <DeliveryPill label={c.pill.approved} tone="done" />
  ) : status === "changes_requested" ? (
    <DeliveryPill label={c.pill.changes} tone="back" />
  ) : status === null ? (
    <DeliveryPill label={c.pill.pending} tone="quiet" />
  ) : card ? (
    <DeliveryPill label={c.pill.waiting} tone="live" />
  ) : null;
  const actions = member && !over && (
    <>
      {(shared.task.status === "queued" || shared.task.status === "waiting_review") && <RemoveButton busy={busy} onRemove={remove} />}
      {ready && approve >= 0 && <RunButton refine={refining(flow)} busy={busy} onClick={run} />}
    </>
  );
  const info: Info = {
    ...cardMeta(card?.body ?? "", card?.metadata),
    workflow: shared.task.workflow,
    project: shared.task.project,
    more: [
      { label: c.meta.starter, value: `@${shared.owner.handle}` },
      { label: c.meta.expires, value: c.date(shared.link.expires_at) },
    ],
  };

  const me = shared.me ? (shared.me.handle ? `@${shared.me.handle}` : shared.me.email) : null;
  const rail = !viewer && <ChatPane c={c.comments} thread={thread} phone={narrow} canWrite onSend={comment} onClose={closeRail} />;
  const ai = member && (
    <AiChat
      c={c.ai}
      token={token}
      phone={narrow}
      card={{ question: asking, comments: (shared.comments ?? []).length > 0, previews: shared.artifacts.length > 0 }}
      onReplied={replied}
      ask={questions.length ? c.ai.askPending : undefined}
      aboveBox={
        questions.length > 0 && (
          <QuestionPanel c={c.questions} questions={questions} answers={answers} onChange={setAnswers} busy={busy} phone={narrow} onSubmit={submit} />
        )
      }
    />
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-cream font-sans max-md:bg-nb-paper">
      <header className="flex h-12 shrink-0 items-center gap-3 px-5 max-md:h-14 max-md:border-b max-md:px-4" style={narrow ? { borderColor: HAIRLINE } : undefined}>
        {member && narrow && aiOpen ? <AiBackButton c={c.ai} onClick={toggleAi} /> : <Logo size="md" />}
        <span className="ml-auto flex items-center gap-3">
          {owner && (
            <Share
              c={c.share}
              link={shared.link}
              task={shared.task.id}
              guests={shared.guests ?? []}
              expires={c.date(shared.link.expires_at)}
              onChanged={() => void reload()}
            />
          )}
          {!viewer && <ChatButton label={c.comments.heading} count={thread.length} open={railOpen} unread={unread && !railOpen} onClick={toggleRail} />}
          {me ? (
            <Menu
              align="end"
              trigger={({ open, onClick }) => (
                <button
                  type="button"
                  onClick={onClick}
                  aria-expanded={open}
                  aria-label={me}
                  className="inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-[8px] text-[13px] text-nb-ink-soft hover:text-nb-ink max-md:min-h-[44px]"
                >
                  <Avatar who={me} size={24} />
                  <span className="max-w-[200px] truncate max-md:hidden">{me}</span>
                </button>
              )}
              head={
                <>
                  <span className="flex w-full items-center gap-2 whitespace-nowrap px-2.5 py-1.5 text-[13px] font-[600] text-nb-ink">
                    <FiGlobe size={13} aria-hidden className="text-nb-ink-soft" />
                    <span className="flex-1">{c.user.language}</span>
                    <LangSelect />
                  </span>
                  <span aria-hidden className="mx-1 my-1 h-px" style={{ background: HAIRLINE }} />
                </>
              }
              items={[
                {
                  key: "out",
                  onSelect: signOut,
                  body: (
                    <>
                      <FiLogOut size={13} aria-hidden className="text-nb-ink-soft" />
                      {c.user.signOut}
                    </>
                  ),
                },
              ]}
            />
          ) : (
            <LangSelect phone={narrow} />
          )}
        </span>
      </header>
      {narrow && aiOpen && ai ? (
        <div className="min-h-0 flex-1">{ai}</div>
      ) : narrow && railOpen && rail ? (
        <div className="min-h-0 flex-1">{rail}</div>
      ) : (
        <div className={cn("flex min-h-0 flex-1 pl-3 max-md:pl-0", !(railOpen && rail) && "pr-3 max-md:pr-0")}>
          <div className="relative min-w-0 flex-1 rounded-t-[14px] bg-nb-paper max-md:rounded-none">
            <div className="h-full overflow-y-auto">
              <CardSheet
                title={shared.task.title}
                status={pill}
                actions={actions}
                info={info}
                below={
                  <>
                    {trouble && <TroubleLine trouble={trouble} reloadLabel={c.errors.reload} />}
                  </>
                }
                body={card ? withoutTitle(card.body) : null}
                previews={previews}
                empty={
                  <div className="nb-section bg-nb-sheet px-5 py-6 max-md:px-4">
                    <p className="text-[14.5px] font-[700] text-nb-ink">{c.noCard.title}</p>
                    <p className="mt-1 text-[13px] text-nb-ink-soft">{c.noCard.body}</p>
                  </div>
                }
              />
            </div>
            {ai && (
              <AiCorner c={c.ai} open={aiOpen} phone={narrow} count={questions.length} onToggle={toggleAi}>
                {ai}
              </AiCorner>
            )}
          </div>
          {railOpen && rail && <div className="w-[360px] shrink-0 pl-3 pr-3">{rail}</div>}
        </div>
      )}
    </div>
  );
}

function TroubleLine({ trouble, reloadLabel }: { trouble: NonNullable<Trouble>; reloadLabel: string }) {
  return (
    <div role="alert" className="nb-section flex items-center gap-3 px-4 py-3 text-[13px] text-nb-peach-ink" style={{ background: "var(--color-nb-peach-soft)" }}>
      <FiAlertCircle aria-hidden className="shrink-0" size={14} />
      <span className="min-w-0 flex-1">{trouble.text}</span>
      {trouble.reload && (
        <button type="button" onClick={() => location.reload()} className="shrink-0 cursor-pointer rounded-[6px] px-2 py-1 text-[12.5px] font-[700] text-nb-ink hover:bg-nb-paper/60">
          {reloadLabel}
        </button>
      )}
    </div>
  );
}
