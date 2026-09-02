"use client";

// The chat rail down the right of the window (#242) — the mirror of the card rail on the
// left, and the board's own conversation with its agent.
//
// It is folded away by default: the board and the card being read are what the app is for,
// and a chat is a second way in you ask for. The Chat button in the top row is what asks;
// the rail follows what you are reading, so the board and a memory file get the board's
// conversation and a card's page gets that card's own. One chat on screen, ever.
//
// The rail is the same cream as the left one, with no surface of its own, so the window
// still reads as one frame with the body's paper in the middle of it. On a window too
// narrow to hold the board between two rails it stops being a panel and covers the body
// instead (components/Window.tsx).
//
// Nothing here holds the conversation: the transcript is a file on this machine and the
// reply is written on the server (lib/chat.ts, lib/chat-rail.ts), so folding the rail or
// walking to another card never cuts a reply off, and closing the app never loses one.

import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FiArrowDown,
  FiCheck,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiMessageSquare,
  FiRefreshCw,
  FiSend,
  FiSquare,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import type { ChatCopy } from "@/i18n/chat/types";
import { useCopy } from "@/i18n/use-copy";
import type { ChatRail } from "@/lib/chat-rail";
import type { ChatMessage, TokenUsage } from "@/lib/types";
import { formatCost, formatDuration, formatTokens } from "./agent-shared";
import { Button } from "./button";
import { HAIRLINE, PULSE_DOT } from "./chrome";
import { Copied, useCopyText } from "./copy";
import { Markdown } from "./Markdown";

/** How long the clear button waits for its second click before going back to being a
 *  trash can. One click never throws a conversation away. */
const CONFIRM_MS = 4000;

/** Near enough to the bottom that a new line should follow it down. Further up and the
 *  user is reading something older, which a jump would take them away from. */
const STICK_PX = 72;

/** How tall the box grows with what is typed, and what it opens at. */
const MAX_ROWS = 8;
const MIN_ROWS = 3;

/** What the rest of the window keeps whatever is typed — the top row, the rail's head, the
 *  hint line, and a few lines of the conversation above the box. */
const KEEP_PX = 260;

// The rail's state belongs to the window, and the button that folds it is in the top row —
// which the page builds and hands the window as a prop. Context is what puts the two on the
// same state without every page threading it through its header.
const RailContext = createContext<ChatRail | null>(null);

export function ChatProvider({ rail, children }: { rail: ChatRail; children: React.ReactNode }) {
  return <RailContext.Provider value={rail}>{children}</RailContext.Provider>;
}

/** The top row's Chat button, beside Create task. It carries the mark that says a reply
 *  arrived while the rail was folded — an ember dot, and the same thing in words for a
 *  reader who isn't looking at colour. */
export function ChatButton() {
  const c = useCopy().chat;
  const rail = useContext(RailContext);
  if (!rail) return null;
  return (
    <div className="relative flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="xs"
        // The top row's 28px box; a narrow window keeps the button and drops the label.
        className="shrink-0 max-sm:w-7 max-sm:px-0"
        aria-label={c.label}
        aria-pressed={rail.open}
        onClick={rail.toggle}
        style={rail.open ? { background: "var(--color-nb-accent-soft)" } : undefined}
      >
        <FiMessageSquare className="text-[14px]" aria-hidden />
        <span className="sr-only sm:not-sr-only">{c.label}</span>
      </Button>
      {rail.unread && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-[3px] -top-[3px] size-[9px] rounded-full border-[1.5px] border-nb-ink bg-nb-accent"
          />
          <span className="sr-only">{c.unread}</span>
        </>
      )}
    </div>
  );
}

/** The rail itself. Drawn by the window in whichever shape fits — a panel beside the body,
 *  or a cover over it — with the same contents either way. */
export function ChatPane({ rail }: { rail: ChatRail }) {
  const c = useCopy().chat;
  const read = rail.read;
  const messages = read?.chat?.messages ?? [];
  // A reply is coming, and whether it is this board's server's — the one Stop and Esc can
  // reach. A terminal's reply is followed just the same, but only its own Ctrl-C ends it.
  const answering = rail.answering;
  const ours = rail.live !== null;
  // `blocked` is what shuts the box for good: no agent that can hold a conversation, or one
  // held with an agent this board no longer runs. A reply in flight is not one of them
  // (#268) — the box stays live and only sending waits.
  const blocked = read?.blocked;
  // Nothing on this board can hold a conversation at all. Its own block says so, since
  // there is nothing else to put in an empty rail.
  const hopeless = !!blocked && read?.canChat === false;
  // The agent's CLI isn't on this board's PATH. Said, not enforced: someone whose agent
  // lives outside the PATH the board was started on can still send, the same way the
  // Configuration dialog still lets them pick it.
  const missing = read?.missing ? c.agentMissing(read.agent) : undefined;
  const trouble = rail.error ?? read?.failed ?? blocked ?? missing;

  return (
    <section aria-label={c.label} className="flex h-full flex-col py-2 pl-1 pr-3">
      <Head rail={rail} />
      <Transcript
        messages={messages}
        live={rail.live}
        liveSince={read?.liveSince ?? null}
        stopped={rail.stopped}
        canSend={!!read && !blocked && !answering}
        onResend={rail.resend}
        onReword={rail.reword}
        // Only once this conversation has actually been read. Landing on a card drops the
        // last one's messages on the spot, and the invitation before the read would be a
        // beat of "nothing has been said" on a card that has plenty.
        empty={read ? <Empty cardId={rail.cardId} hopeless={hopeless ? blocked : undefined} /> : null}
      />
      {trouble && !(hopeless && messages.length === 0) && (
        <p
          className="mb-1.5 shrink-0 rounded-[8px] px-2.5 py-2 text-[12px] leading-snug"
          style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
        >
          {trouble}
        </p>
      )}
      <Composer rail={rail} disabled={!read || !!blocked} answering={answering} ours={ours} />
    </section>
  );
}

/** The rail's own top line: what this conversation is about, and the two things you can do
 *  to the rail — throw the conversation away, or fold it. */
function Head({ rail }: { rail: ChatRail }) {
  const c = useCopy().chat;
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);
  const messages = rail.read?.chat?.messages ?? [];
  const has = messages.length > 0;
  const about = rail.cardId === null ? c.aboutBoard : c.aboutCard(rail.cardId);

  return (
    <div className="mb-1.5 flex h-[30px] shrink-0 items-center gap-2 px-2.5">
      <FiMessageSquare size={13} className="shrink-0" aria-hidden />
      <span className="shrink-0 text-[12.5px] font-[700]">{c.label}</span>
      <span
        className="truncate text-[12px] text-nb-ink-soft"
        title={rail.cardId === null ? c.aboutBoardHint : c.aboutCardHint(rail.cardId, rail.cardTitle)}
      >
        {about}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {has && <CopyChat messages={messages} />}
        {has &&
          (confirming ? (
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                void rail.clear();
              }}
              className="cursor-pointer rounded-[6px] px-1.5 py-1 text-[11px] font-[700] uppercase tracking-[0.04em]"
              style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
            >
              {c.clearConfirm}
            </button>
          ) : (
            <IconButton label={c.clear} onClick={() => setConfirming(true)}>
              <FiTrash2 size={13} aria-hidden />
            </IconButton>
          ))}
        <IconButton label={c.fold} onClick={rail.fold}>
          <FiX size={14} aria-hidden />
        </IconButton>
      </span>
    </div>
  );
}

/** Getting the whole exchange out of the rail, as markdown to paste. Hidden until
 *  something has been said — there is nothing to copy off an empty rail. */
function CopyChat({ messages }: { messages: ChatMessage[] }) {
  const c = useCopy().chat;
  const { copied, copy } = useCopyText();
  return (
    <>
      <IconButton label={c.copyChat} onClick={() => copy(transcriptOf(messages, c))}>
        {copied ? <FiCheck size={13} aria-hidden /> : <FiCopy size={13} aria-hidden />}
      </IconButton>
      <Copied on={copied} />
    </>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-6 cursor-pointer place-items-center rounded-[6px] text-nb-ink opacity-60 hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] hover:opacity-100"
    >
      {children}
    </button>
  );
}

/** What has been said, oldest first, with the reply being written at the foot of it. It
 *  follows the newest line down only while the reader is already there — a jump would take
 *  someone reading an older answer away from it mid-sentence. */
function Transcript({
  messages,
  live,
  liveSince,
  stopped,
  canSend,
  onResend,
  onReword,
  empty,
}: {
  messages: ChatMessage[];
  live: string | null;
  /** When the reply in flight was sent, so its fold can count the seconds up. */
  liveSince: number | null;
  /** A stopped reply's words, held here until the transcript has them (#267). */
  stopped: string | null;
  /** A message can leave the box right now — what "send again" waits for (#269). */
  canSend: boolean;
  /** Both held steady by the rail: a message is drawn once and held across the polls,
   *  and a fresh callback every render would draw every one of them again. */
  onResend(text: string): void;
  onReword(text: string, force?: boolean): boolean;
  empty: React.ReactNode;
}) {
  const c = useCopy().chat;
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  // What is on screen, counted in messages: the pill says how many of them arrived while
  // the reader was up here reading something older.
  const lines = messages.length + (live === null ? 0 : 1);
  const [away, setAway] = useState(false);
  const wasAt = useRef(lines);
  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const atFoot = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    stick.current = atFoot;
    if (atFoot) setAway(false);
    else if (!away) {
      wasAt.current = lines;
      setAway(true);
    }
  };
  const toFoot = () => {
    const el = box.current;
    if (!el) return;
    stick.current = true;
    setAway(false);
    el.scrollTop = el.scrollHeight;
  };
  // Before the browser paints, so a growing reply never shows a frame of the old scroll.
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, live, stopped]);

  const behind = away ? Math.max(0, lines - wasAt.current) : 0;
  const nothing = messages.length === 0 && live === null && stopped === null;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div ref={box} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-2.5">
      {nothing ? (
        empty
      ) : (
        <div className="flex flex-col gap-2 pb-2">
          {messages.map((m, i) => (
            <Said
              key={i}
              message={m}
              sent={m.role === "agent" ? sentBefore(messages, i) : null}
              canSend={canSend}
              onResend={onResend}
              onReword={onReword}
            />
          ))}
          {live !== null && <Writing text={live} since={liveSince} />}
          {/* A stopped reply reads as a finished one from the click: no pulse, no
              "writing", and the peach note the transcript will carry a moment later. */}
          {stopped !== null && (
            <Said
              message={{ role: "agent", text: stopped, at: 0, stoppedWhy: c.youStopped }}
              sent={sentBefore(messages, messages.length)}
              canSend={canSend}
              onResend={onResend}
              onReword={onReword}
            />
          )}
        </div>
      )}
    </div>
      {behind > 0 && <Jump count={behind} onClick={toFoot} />}
    </div>
  );
}

/** The way back to the newest line, for a reader who has scrolled up to an older answer
 *  while replies kept arriving. It says how many are below rather than only pointing down,
 *  and it goes away the moment the foot is reached. */
function Jump({ count, onClick }: { count: number; onClick(): void }) {
  const c = useCopy().chat;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        title={c.toFoot}
        className="nb-outline pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-nb-paper px-2.5 py-[5px] text-[11px] font-[700]"
      >
        <FiArrowDown size={12} aria-hidden />
        {c.newLines(count)}
      </button>
    </div>
  );
}

/** One message. The user's words sit in a block of their own — paper with an ink hairline,
 *  the surface of the box they were typed in, and inset from the left so they are narrower
 *  than the reply — while the agent's are prose on the rail's own ground, where a `#12` is a
 *  link to that card (components/Markdown.tsx). Two surfaces rather than two tints: a wash a
 *  shade off the rail's own cream read as nothing at all.
 *
 *  The space above a message you sent is what groups an exchange: a reply sits close under
 *  the message it answers, and the next question starts a turn.
 *
 *  Held across renders by what it says rather than by the object it arrives in: the rail
 *  re-reads the conversation on a timer and gets a fresh array every time, and re-rendering
 *  a long exchange means parsing every message's markdown again. */
const Said = memo(
  function Said({
    message,
    sent,
    canSend,
    onResend,
    onReword,
  }: {
    message: ChatMessage;
    /** The message this reply answered — what "send again" sends again (#269). */
    sent: string | null;
    canSend: boolean;
    onResend(text: string): void;
    onReword(text: string, force?: boolean): boolean;
  }) {
    const c = useCopy().chat;
    if (message.role === "you") {
      return (
        <div className="group ml-6 mt-3 first:mt-0">
          <div className="whitespace-pre-wrap rounded-[10px] bg-nb-paper px-2.5 py-2 text-[13px] leading-[1.5] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]">
            {message.text}
          </div>
          <div className={ACTIONS}>
            <Reword text={message.text} onReword={onReword} />
          </div>
        </div>
      );
    }
    // A reply that stopped part way, or came back with no words of its own, is one worth
    // asking again. A reply that finished is not: the agent carries its own session on, so
    // sending the same words after it would be asking twice.
    const said = saidOf(message.text);
    const again = sent !== null && (message.stoppedWhy !== undefined || said === "");
    return (
      <div className="group">
        {message.text ? (
          <Reply text={message.text} copyCode ms={message.ms} />
        ) : (
          <p className="text-[13px] italic text-nb-ink-soft">{c.nothingCameBack}</p>
        )}
        <Cost usage={message.usage} costUsd={message.costUsd} />
        {message.stoppedWhy && <Stopped why={message.stoppedWhy} />}
        {(said !== "" || again) && (
          <div className={ACTIONS}>
            {said !== "" && <CopyReply text={said} />}
            {again && (
              <button
                type="button"
                className={ACTION}
                disabled={!canSend}
                title={c.againHint}
                aria-label={c.againHint}
                onClick={() => onResend(sent)}
              >
                <FiRefreshCw size={11} aria-hidden />
                {c.again}
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
  (before, now) =>
    before.message.text === now.message.text &&
    before.message.role === now.message.role &&
    before.message.at === now.message.at &&
    before.message.stoppedWhy === now.message.stoppedWhy &&
    before.message.ms === now.message.ms &&
    before.message.costUsd === now.message.costUsd &&
    before.message.usage === now.message.usage &&
    before.sent === now.sent &&
    before.canSend === now.canSend &&
    before.onResend === now.onResend &&
    before.onReword === now.onReword,
);

/** The row of things you can do with a message. Not there at rest, so a long exchange reads
 *  as a conversation rather than a wall of buttons; hovering the message brings it up, and
 *  so does tabbing into it (#269). */
const ACTIONS =
  "mt-0.5 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100";

const ACTION =
  "inline-flex cursor-pointer items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] hover:text-nb-ink disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-nb-ink-soft";

/** The reply's own words on the clipboard. Its name never changes, so a reader hears
 *  "copied" once — from the live region — rather than twice. */
function CopyReply({ text }: { text: string }) {
  const c = useCopy();
  const { copied, copy } = useCopyText();
  return (
    <>
      <button
        type="button"
        className={ACTION}
        title={c.chat.copyReply}
        aria-label={c.chat.copyReply}
        onClick={() => copy(text)}
      >
        {copied ? <FiCheck size={11} aria-hidden /> : <FiCopy size={11} aria-hidden />}
        {copied ? c.shared.copied : c.shared.copy}
      </button>
      <Copied on={copied} />
    </>
  );
}

/** A message you sent, back in the box to edit. What is already typed there is never
 *  overwritten: the button asks once first, the way the header's bin does. */
function Reword({ text, onReword }: { text: string; onReword(text: string, force?: boolean): boolean }) {
  const c = useCopy().chat;
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  if (confirming) {
    return (
      <button
        type="button"
        className={ACTION}
        style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
        onClick={() => {
          setConfirming(false);
          onReword(text, true);
        }}
      >
        {c.rewordConfirm}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={ACTION}
      title={c.rewordHint}
      aria-label={c.rewordHint}
      onClick={() => {
        if (!onReword(text)) setConfirming(true);
      }}
    >
      <FiEdit3 size={11} aria-hidden />
      {c.reword}
    </button>
  );
}

/** The message this one answered: the nearest thing said before it. */
function sentBefore(messages: ChatMessage[], at: number): string | null {
  for (let i = at - 1; i >= 0; i--) if (messages[i].role === "you") return messages[i].text;
  return null;
}

/** The reply as it is being written. The dot is the board's own mark for an agent at work,
 *  and the fold above counts the seconds up from the moment the message was sent. */
function Writing({ text, since }: { text: string; since: number | null }) {
  const c = useCopy().chat;
  const ms = useElapsed(since);
  return (
    <div>
      {text ? <Reply text={text} ms={ms} live /> : <p className="text-[13px] text-nb-ink-soft">{c.thinking}</p>}
      <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft">
        <span className={PULSE_DOT} aria-hidden />
        {c.writing}
      </span>
    </div>
  );
}

/** What the agent wrote: the work it did, and the answer that came out of it. Everything up
 *  to the last step it took — its notes as it went and each step — folds into one line above
 *  the answer, so a long hunt through the board is one line of grey and never the reply.
 *
 *  One fold for the whole reply, not one per run of steps: the time on it is the turn's, and
 *  a fold per run would have to name a share of it that nothing measures. */
function Reply({ text, copyCode, ms, live }: { text: string; copyCode?: boolean; ms?: number; live?: boolean }) {
  const blocks = blocksOf(text);
  let last = -1;
  blocks.forEach((block, i) => {
    if (block.kind === "looked") last = i;
  });
  const work = blocks.slice(0, last + 1);
  const answer = blocks.slice(last + 1);
  return (
    <div className="flex flex-col gap-2">
      {work.length > 0 && <Work blocks={work} ms={ms} live={live} />}
      {answer.map((block, i) =>
        block.kind === "said" ? (
          <Markdown key={i} body={block.text} className="nb-sessionlog-md" copyCode={copyCode} />
        ) : null,
      )}
    </div>
  );
}

/** The fold over what the agent did before it answered: "Worked for 1m 5s" shut, and the
 *  steps and its own notes in order when opened. While the reply is still coming the line
 *  counts up and the newest step stays under it, so the rail never goes quiet mid-answer. */
function Work({ blocks, ms, live }: { blocks: Block[]; ms?: number; live?: boolean }) {
  const c = useCopy().chat;
  const log = useCopy().runs.log;
  const [open, setOpen] = useState(false);
  const time = ms === undefined ? undefined : formatDuration(ms, log);
  const doing = live ? lastStep(blocks) : undefined;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={c.workHint}
        className="flex w-full cursor-pointer items-center gap-1.5 py-[3px] text-left"
      >
        <FiChevronRight
          size={11}
          aria-hidden
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className={`truncate text-[11.5px] ${open ? "font-[700]" : "font-[600] text-nb-ink-soft"}`}>
          {time === undefined ? c.workHint : live ? c.working(time) : c.worked(time)}
        </span>
      </button>
      {open && (
        <div
          className="ml-[5px] flex flex-col gap-1.5 pl-[9px]"
          style={{ borderLeft: `1.5px solid color-mix(in srgb, var(--color-nb-ink) 14%, transparent)` }}
        >
          {blocks.map((block, i) =>
            block.kind === "looked" ? (
              <ul key={i} className="flex flex-col gap-0.5">
                {block.lines.map((line, k) => (
                  <li key={k} className="truncate font-mono text-[11px] text-nb-ink-soft" title={line}>
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <Markdown key={i} body={block.text} className="nb-sessionlog-md" />
            ),
          )}
        </div>
      )}
      {!open && doing && (
        <div className="flex items-center gap-1.5 py-[3px]">
          <span className={PULSE_DOT} aria-hidden />
          <span className="truncate font-mono text-[11px]" title={doing}>
            {doing}
          </span>
        </div>
      )}
    </div>
  );
}

/** The step the agent is on right now — the last one it named. */
function lastStep(blocks: Block[]): string | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.kind === "looked") return block.lines[block.lines.length - 1];
  }
  return undefined;
}

/** What the reply cost, under it: the tokens the turn consumed and the price the connector
 *  put on them, in the run log's own words. Only what was actually reported — a connector
 *  that counts neither leaves the line out rather than showing a zero. The time is not here:
 *  the fold above already carries it. */
function Cost({ usage, costUsd }: { usage?: TokenUsage; costUsd?: number }) {
  const c = useCopy().chat;
  const log = useCopy().runs.log;
  const said: string[] = [];
  if (usage) said.push(c.tokens(totalTokens(usage).toLocaleString("en-US")));
  if (costUsd !== undefined) said.push(formatCost(costUsd, log));
  if (said.length === 0) return null;
  return (
    <p
      className="mt-1 truncate text-[11px] tabular-nums text-nb-ink-soft"
      title={usage ? formatTokens(usage, log) : undefined}
    >
      {said.join(" · ")}
    </p>
  );
}

const totalTokens = (u: TokenUsage): number => u.input + u.cacheCreation + u.cacheRead + u.output;

/** How long the reply in flight has been coming, to the second. Nothing to count from — a
 *  reply a terminal started — counts nothing. */
function useElapsed(since: number | null): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since === null ? undefined : Math.max(0, now - since);
}

/** The mark every connector's stream puts in front of a tool call (cli/src/lib/agent/). */
const LOOKED = "⏺ ";

type Block = { kind: "looked"; lines: string[] } | { kind: "said"; text: string };

/** Split what the agent wrote into what it said and what it looked at, keeping the order it
 *  came in. */
function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const looked = line.startsWith(LOOKED);
    const last = blocks[blocks.length - 1];
    if (looked) {
      if (last?.kind === "looked") last.lines.push(line);
      else blocks.push({ kind: "looked", lines: [line] });
    } else {
      if (last?.kind === "said") last.text += `\n${line}`;
      else blocks.push({ kind: "said", text: line });
    }
  }
  return blocks.filter((b) => (b.kind === "looked" ? b.lines.length > 0 : b.text.trim() !== ""));
}

/** What the agent said, with the lookup lines taken out — what a copy of a reply takes.
 *  Empty where the reply had no words of its own. */
function saidOf(text: string): string {
  return blocksOf(text)
    .flatMap((block) => (block.kind === "said" ? [block.text.trim()] : []))
    .join("\n\n");
}

/** The whole conversation as markdown: who said what, in order. The lookup lines are left
 *  out here too, and so are the app's own notes — "you stopped the reply" is the app
 *  talking, not the agent. */
function transcriptOf(messages: ChatMessage[], c: ChatCopy): string {
  const said: string[] = [];
  for (const m of messages) {
    const words = m.role === "you" ? m.text.trim() : saidOf(m.text);
    if (words === "") continue;
    said.push(`**${m.role === "you" ? c.youSaid : c.agentSaid}**\n\n${words}`);
  }
  return said.join("\n\n");
}

/** A reply that stopped part way. What arrived is kept above it — this only says so. */
function Stopped({ why }: { why: string }) {
  const c = useCopy().chat;
  return (
    <p
      className="mt-1.5 rounded-[8px] px-2 py-1.5 text-[12px] leading-snug"
      style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
    >
      {why} {c.stopped}
    </p>
  );
}

/** The rail with nothing in it yet: what this chat is for, or the one thing standing in the
 *  way of having one at all. A card's page says what a card's chat is for, and offers the
 *  three questions worth asking about any card before it is built. */
function Empty({ cardId, hopeless }: { cardId: number | null; hopeless?: string }) {
  const c = useCopy().chat;
  if (hopeless) {
    return (
      <div className="nb-outline bg-nb-paper px-3 py-2.5 text-[12.5px] leading-relaxed">
        <p className="font-[700]">{c.noAgent}</p>
        <p className="mt-1 text-nb-ink-soft">{hopeless}</p>
        <p className="mt-1.5 text-nb-ink-soft">{c.noAgentFix}</p>
      </div>
    );
  }
  const [about, asks] =
    cardId === null
      ? [c.emptyBoard, c.emptyBoardAsks]
      : [c.emptyCard(cardId), c.emptyCardAsks];
  return (
    <div className="px-0.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
      <p>{about}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {asks.map((line) => (
          <li key={line} className="flex gap-1.5">
            <span aria-hidden>·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The box at the foot. Enter sends and Shift-Enter starts a line, which is what anyone who
 *  has used a chat expects; the button is there for anyone who hasn't.
 *
 *  It stays live while a reply is coming (#268), so a thought that arrives mid-reply goes
 *  into the box instead of being held in the user's head. Only sending waits — nothing
 *  leaves the box until the user presses send. */
function Composer({
  rail,
  disabled,
  answering,
  ours,
}: {
  rail: ChatRail;
  /** Shut for good — no agent that can hold a conversation, or one held with another. */
  disabled: boolean;
  answering: boolean;
  /** The reply coming is this board's server's, so the corner button can end it. */
  ours: boolean;
}) {
  const c = useCopy().chat;
  const empty = !rail.draft.trim();
  const sends = !disabled && !answering && !empty;
  const box = useGrow(rail.draft);
  // On a card's page the box asks about that card, so the words in it never read as an
  // invitation to talk about the whole board.
  const ask = rail.cardId === null ? c.ask : c.askCard(rail.cardId);
  return (
    <div className="shrink-0 px-2.5 pt-1.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <textarea
        ref={box}
        // The one text box Esc is not taken in: it is where the hand is while a reply is
        // coming, and Esc there ends the reply (lib/chat-rail.ts).
        data-chat-box=""
        value={rail.draft}
        onChange={(e) => rail.setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (sends) void rail.send();
            return;
          }
          // An empty box walks back through what this conversation has sent; a typed one
          // leaves the arrows to the caret (lib/chat-rail.ts).
          const arrow = e.key === "ArrowUp" || e.key === "ArrowDown";
          if (arrow && rail.recall(e.key === "ArrowUp")) e.preventDefault();
        }}
        rows={MIN_ROWS}
        disabled={disabled}
        placeholder={ask}
        aria-label={c.message}
        className="w-full resize-none rounded-[8px] bg-nb-paper px-2.5 py-2 text-[13px] leading-[1.5] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-none disabled:opacity-60 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-nb-ink-soft">
          {/* One short line: the one thing that matters right then. Esc only where it
              reaches — a terminal's reply is ended in that terminal. */}
          {answering ? (ours ? c.sendingWaitsEsc : c.sendingWaits) : c.keys}
        </span>
        {/* One button in this corner, not two: on a reply this server owns it IS Stop, and
            on one a terminal is writing it is a Send that has to wait for it. */}
        <Button
          size="xs"
          disabled={ours ? false : answering || disabled || empty}
          onClick={() => void (ours ? rail.stop() : rail.send())}
          aria-label={ours ? c.stop : c.send}
        >
          {ours ? (
            <FiSquare className="text-[13px]" aria-hidden />
          ) : (
            <FiSend className="text-[13px]" aria-hidden />
          )}
          <span className="sr-only">{ours ? c.stop : c.send}</span>
        </Button>
      </div>
    </div>
  );
}

/** Grow the box with what is typed, and scroll past the ceiling rather than pushing the
 *  conversation off the screen. */
function useGrow(text: string) {
  const box = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 20;
    const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    // Eight rows where the window has room for them, fewer where it hasn't, never under
    // the three the box has always opened at.
    const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.floor((window.innerHeight - KEEP_PX) / line)));
    const ceiling = rows * line + pad;
    el.style.height = "auto";
    const wanted = el.scrollHeight;
    el.style.height = `${Math.min(wanted, ceiling)}px`;
    el.style.overflowY = wanted > ceiling ? "auto" : "hidden";
  }, []);

  useLayoutEffect(fit, [text, fit]);

  // The rail dragged wider takes the same words in fewer lines, and a shorter window brings
  // the ceiling down. Width only from the box itself: its own height is what `fit` changes.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let wide = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === wide) return;
      wide = el.clientWidth;
      fit();
    });
    watch.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [fit]);

  return box;
}
