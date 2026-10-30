// Copied from legacy kanban-ui/components/CardPage.tsx inside Window.tsx's frame: the header and
// the comments rail on the window's cream, the page on a paper sheet rounded where it turns from
// them. The sheet is card-sheet.tsx, as on WildCrane Web's card page (#2062). The rail holds the
// comments, opens from the top row's button and starts closed; at phone width it covers the page.
// A guest comments; the link alone reads.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiGlobe, FiLogOut } from "react-icons/fi";
import { ApiError, postComment, readComponent, type Shared } from "../api";
import { signOut } from "../auth";
import { LANG, useCopy } from "../i18n";
import { Previews } from "../lib/artifacts";
import { cardMeta, withoutTitle } from "../lib/card-info";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { humanise } from "./CardBody";
import { CardSheet, type Info } from "./card-sheet";
import { Avatar, ChatButton, ChatPane, useEscape } from "./chat";
import { HAIRLINE } from "./chrome";
import { LangSelect } from "./lang-select";
import { Logo } from "./Logo";
import { Menu } from "./menu";
import { useThread } from "./thread";

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

export function CardPage({ shared, token, reload, onSignIn }: { shared: Shared; token: string; reload: () => Promise<void>; onSignIn: () => void }) {
  const c = useCopy();
  const card = shared.card;
  const viewer = shared.role === null;
  const narrow = useNarrow();
  const [railOpen, setRailOpen] = useState(false);
  const [trouble, setTrouble] = useState<Trouble>(null);
  // Rebuilt only when what is under review changes, so a poll never reloads a preview.
  const contentKey = JSON.stringify([card?.version, shared.review.revision, shared.artifacts.map((a) => [a.id, a.latest_version])]);
  const previews = useMemo(
    () => new Previews(shared, { component: (_, v) => readComponent(token, v.component!.name, v.component!.version), canSave: false, saved: () => {} }),
    [contentKey],
  );

  const { thread, unread, opening } = useThread({
    key: shared.link.id,
    comments: shared.comments ?? [],
    decisions: shared.decisions ?? [],
    revisions: shared.revisions ?? [],
    owner: shared.owner.handle,
    me: shared.me,
    open: railOpen,
  });
  const toggleRail = () => {
    if (!railOpen) opening();
    setRailOpen((v) => !v);
  };
  const closeRail = useCallback(() => setRailOpen(false), []);
  useEscape(railOpen && narrow, closeRail);
  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : "";
    setTrouble(code === "offline" ? { text: c.errors.offline } : code === "card_missing" ? { text: c.errors.cardMissing, reload: true } : { text: c.errors.generic });
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
  const rail = !viewer && <ChatPane c={c.comments} thread={thread} phone={narrow} canWrite onSend={comment} draftKey={`shared.task.${shared.task.id}.comment`} onClose={closeRail} />;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-cream font-sans max-md:bg-nb-paper">
      <header className="flex h-12 shrink-0 items-center gap-3 px-5 max-md:h-14 max-md:border-b max-md:px-4" style={narrow ? { borderColor: HAIRLINE } : undefined}>
        <Logo size="md" />
        <span className="ml-auto flex items-center gap-3">
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
            <>
              <LangSelect phone={narrow} />
              <Button variant="ghost" size="xs" onClick={onSignIn} className="max-md:h-9">
                {c.signIn.fromLink.open}
              </Button>
            </>
          )}
        </span>
      </header>
      {narrow && railOpen && rail ? (
        <div className="min-h-0 flex-1">{rail}</div>
      ) : (
        <div className={cn("flex min-h-0 flex-1 pl-3 max-md:pl-0", !(railOpen && rail) && "pr-3 max-md:pr-0")}>
          <div className="relative min-w-0 flex-1 rounded-t-[14px] bg-nb-paper max-md:rounded-none">
            <div className="h-full overflow-y-auto">
              <CardSheet
                title={shared.task.title}
                info={info}
                below={trouble && <TroubleLine trouble={trouble} reloadLabel={c.errors.reload} />}
                body={card ? withoutTitle(card.body) : null}
                nameOf={(a) => shared.names?.[a]?.[LANG] || shared.names?.[a]?.en || humanise(a)}
                previews={previews}
                empty={
                  <div className="nb-section bg-nb-sheet px-5 py-6 max-md:px-4">
                    <p className="text-[14.5px] font-[700] text-nb-ink">{c.noCard.title}</p>
                    <p className="mt-1 text-[13px] text-nb-ink-soft">{c.noCard.body}</p>
                  </div>
                }
              />
            </div>
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
