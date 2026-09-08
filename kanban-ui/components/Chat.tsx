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

import {
  createContext,
  Fragment,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  FiArrowDown,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiImage,
  FiMessageSquare,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import type { ChatCopy } from "@/i18n/chat/types";
import type { RunsCopy } from "@/i18n/runs/types";
import { useCopy } from "@/i18n/use-copy";
import type { ChatRail } from "@/lib/chat-rail";
import type { ChatMessage, ChatPick, ModelChange } from "@/lib/types";
import { formatCost, formatDuration, formatTokens } from "./agent-shared";
import { Button } from "./button";
import { HAIRLINE, PULSE_DOT } from "./chrome";
import { MessageBox } from "./composer";
import { AgentMark } from "./Configuration";
import { Copied, useCopyText } from "./copy";
import { Markdown } from "./Markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/** The card this rail is on, or null for anything that isn't one. The rail draws the board's
 *  conversation and each card's; a discussion (#496) is the Create sheet's, never this. */
const cardOf = (rail: ChatRail): number | null => (typeof rail.cardId === "number" ? rail.cardId : null);

/** How long the clear button waits for its second click before going back to being a
 *  trash can. One click never throws a conversation away. */
const CONFIRM_MS = 4000;

/** Near enough to the bottom that a new line should follow it down. Further up and the
 *  user is reading something older, which a jump would take them away from. */
const STICK_PX = 72;

// The rail's state belongs to the window, and the button that folds it is in the top row —
// which the page builds and hands the window as a prop. Context is what puts the two on the
// same state without every page threading it through its header.
const RailContext = createContext<ChatRail | null>(null);

export function ChatProvider({ rail, children }: { rail: ChatRail; children: React.ReactNode }) {
  return <RailContext.Provider value={rail}>{children}</RailContext.Provider>;
}

/** The conversation this window is showing, for a screen that draws it somewhere other than
 *  the rail — the Discuss screen (#427). Null outside the window's frame. */
export function useChatRailHere(): ChatRail | null {
  return useContext(RailContext);
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
  // Sending a message again sends the pictures it carried, by the same names (#441). Held
  // steady, because every message in the exchange is drawn against it.
  const say = rail.say;
  const resend = useCallback((text: string, images?: string[]) => say(text, { images }), [say]);
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
        changes={read?.chat?.modelChanges}
        live={rail.live}
        liveSince={read?.liveSince ?? null}
        stopped={rail.stopped}
        canSend={!!read && !blocked && !answering}
        onResend={resend}
        imageSrc={rail.imageSrc}
        // Only once this conversation has actually been read. Landing on a card drops the
        // last one's messages on the spot, and the invitation before the read would be a
        // beat of "nothing has been said" on a card that has plenty.
        empty={read ? <Empty cardId={cardOf(rail)} hopeless={hopeless ? blocked : undefined} /> : null}
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
  const card = cardOf(rail);
  const about = card === null ? c.aboutBoard : c.aboutCard(card);

  return (
    <div className="mb-1.5 flex h-[30px] shrink-0 items-center gap-2 px-2.5">
      <FiMessageSquare size={13} className="shrink-0" aria-hidden />
      <span className="shrink-0 text-[12.5px] font-[700]">{c.label}</span>
      <span
        className="truncate text-[12px] text-nb-ink-soft"
        title={card === null ? c.aboutBoardHint : c.aboutCardHint(card, rail.cardTitle)}
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
 *  someone reading an older answer away from it mid-sentence.
 *
 *  Exported for the Discuss screen (#427), which shows this same conversation down the
 *  middle of a sheet rather than in the rail. */
export function Transcript({
  messages,
  changes,
  live,
  liveSince,
  stopped,
  canSend,
  onResend,
  imageSrc,
  empty,
  after,
}: {
  messages: ChatMessage[];
  /** Where the model changed (#272), woven in by when it happened. */
  changes?: ModelChange[];
  live: string | null;
  /** When the reply in flight was sent, so its fold can count the seconds up. */
  liveSince: number | null;
  /** A stopped reply's words, held here until the transcript has them (#267). */
  stopped: string | null;
  /** A message can leave the box right now — what "send again" waits for (#269). */
  canSend: boolean;
  /** Both held steady by the rail: a message is drawn once and held across the polls,
   *  and a fresh callback every render would draw every one of them again. `images` are
   *  the pictures that message carried, sent again as the same files (#441). */
  onResend(text: string, images?: string[]): void;
  /** Where one of this conversation's pictures is served from (#441). */
  imageSrc(name: string): string;
  empty: React.ReactNode;
  /** Drawn under the newest line, inside the scroller — the Discuss screen's two answers
   *  (#427), which stand under the message that asked. */
  after?: React.ReactNode;
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
  }, [messages, live, stopped, after]);

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
            <Fragment key={i}>
              {marksBefore(changes, messages, i).map((mark) => (
                <Changed key={`m${mark.at}`} model={mark.model} />
              ))}
              <Said
                message={m}
                sent={m.role === "agent" ? sentBefore(messages, i) : null}
                canSend={canSend}
                onResend={onResend}
                imageSrc={imageSrc}
              />
            </Fragment>
          ))}
          {marksBefore(changes, messages, messages.length).map((mark) => (
            <Changed key={`m${mark.at}`} model={mark.model} />
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
              imageSrc={imageSrc}
            />
          )}
          {after}
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
    imageSrc,
  }: {
    message: ChatMessage;
    /** The message this reply answered — what "send again" sends again (#269), pictures
     *  and all (#441). */
    sent: SentAgain | null;
    canSend: boolean;
    onResend(text: string, images?: string[]): void;
    imageSrc(name: string): string;
  }) {
    const c = useCopy().chat;
    const log = useCopy().runs.log;
    const [editing, setEditing] = useState(false);
    if (message.role === "you") {
      const shots = message.images ?? [];
      if (editing) {
        return (
          <EditSent
            text={message.text}
            canSend={canSend}
            onSend={(words) => {
              setEditing(false);
              // Reworded words, the same pictures: they were pasted once and are sent
              // again rather than saved again.
              onResend(words, shots);
            }}
            onCancel={() => setEditing(false)}
          />
        );
      }
      return (
        <div className="group ml-6 mt-3 first:mt-0">
          <div className="rounded-[10px] bg-nb-paper p-2.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]">
            {/* Above the words, in the order they went into the box. With no words the
                pictures are the whole message and nothing is held open for text. */}
            {shots.length > 0 && <Pictures names={shots} imageSrc={imageSrc} />}
            {message.text && (
              <p
                className={`whitespace-pre-wrap text-[13px] leading-[1.5] ${shots.length ? "mt-2" : ""}`}
              >
                {message.text}
              </p>
            )}
          </div>
          <div className={`mt-0.5 ${ACTIONS}`}>
            <button
              type="button"
              className={ACTION}
              title={c.rewordHint}
              aria-label={c.rewordHint}
              onClick={() => setEditing(true)}
            >
              <FiEdit3 size={11} aria-hidden />
              {c.reword}
            </button>
          </div>
        </div>
      );
    }
    // A reply that stopped part way, or came back with no words of its own, is one worth
    // asking again. A reply that finished is not: the agent carries its own session on, so
    // sending the same words after it would be asking twice.
    const said = saidOf(message.text);
    const again = sent !== null && (message.stoppedWhy !== undefined || said === "");
    const spent = spentOn(message, log);
    return (
      <div className="group">
        {message.text ? (
          <Reply text={message.text} copyCode ms={message.ms} />
        ) : (
          <p className="text-[13px] italic text-nb-ink-soft">{c.nothingCameBack}</p>
        )}
        {message.stoppedWhy && <Stopped why={message.stoppedWhy} />}
        {(spent !== "" || said !== "" || again) && (
          <div className="mt-1 flex items-center gap-1">
            {/* What the turn cost, at rest; the buttons come up with the message. */}
            {spent !== "" && (
              <span
                className="truncate text-[11px] tabular-nums text-nb-ink-soft"
                title={message.usage ? formatTokens(message.usage, log) : undefined}
              >
                {spent}
              </span>
            )}
            <span className={ACTIONS}>
              {said !== "" && <CopyReply text={said} />}
              {again && (
                <button
                  type="button"
                  className={ACTION}
                  disabled={!canSend}
                  title={c.againHint}
                  aria-label={c.againHint}
                  onClick={() => onResend(sent.text, sent.images)}
                >
                  <FiRefreshCw size={11} aria-hidden />
                  {c.again}
                </button>
              )}
            </span>
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
    // The names, not the array: the rail re-reads the transcript on a timer and hands a
    // fresh one every poll, and a picture is drawn off its name alone.
    sameNames(before.message.images, now.message.images) &&
    before.sent?.text === now.sent?.text &&
    sameNames(before.sent?.images, now.sent?.images) &&
    before.canSend === now.canSend &&
    before.onResend === now.onResend &&
    before.imageSrc === now.imageSrc,
);

const sameNames = (a: string[] | undefined, b: string[] | undefined): boolean =>
  (a ?? []).length === (b ?? []).length && (a ?? []).every((name, i) => name === b![i]);

/** The row of things you can do with a message. Not there at rest, so a long exchange reads
 *  as a conversation rather than a wall of buttons; hovering the message brings it up, and
 *  so does tabbing into it (#269). */
const ACTIONS =
  "flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100";

const ACTION =
  "inline-flex cursor-pointer items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] hover:text-nb-ink disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-nb-ink-soft";

/** The reply's own words on the clipboard — the icon alone, since the row it shares with the
 *  turn's tokens has no room for a word everyone already knows. Its name never changes, so a
 *  reader hears "copied" once, from the live region, rather than twice. */
function CopyReply({ text }: { text: string }) {
  const c = useCopy();
  const { copied, copy } = useCopyText();
  return (
    <>
      <button
        type="button"
        className={`${ACTION} px-1`}
        title={c.chat.copyReply}
        aria-label={c.chat.copyReply}
        onClick={() => copy(text)}
      >
        {copied ? <FiCheck size={12} aria-hidden /> : <FiCopy size={12} aria-hidden />}
      </button>
      <Copied on={copied} />
    </>
  );
}

/** A message you sent, edited where it stands. The bubble becomes the box; Send puts the
 *  new words at the foot as a message, Esc puts the bubble back. Nothing typed in the
 *  composer is touched. */
function EditSent({
  text,
  canSend,
  onSend,
  onCancel,
}: {
  text: string;
  canSend: boolean;
  onSend(text: string): void;
  onCancel(): void;
}) {
  const c = useCopy();
  const [draft, setDraft] = useState(text);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  // As tall as the words, the way the bubble was.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);
  const words = draft.trim();
  const ready = words !== "" && canSend;
  return (
    <div className="ml-6 mt-3 first:mt-0">
      <textarea
        ref={box}
        value={draft}
        rows={1}
        aria-label={c.chat.rewordHint}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Esc is this box's alone: the rail and the sheet both listen for it on the window.
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        className="block w-full resize-none overflow-hidden rounded-[10px] bg-nb-paper px-2.5 py-2 text-[13px] leading-[1.5] text-nb-ink shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-end gap-1">
        <Button variant="ghost" size="xs" onClick={onCancel}>
          {c.shared.cancel}
        </Button>
        <Button size="xs" disabled={!ready} onClick={() => onSend(words)}>
          {c.chat.send}
        </Button>
      </div>
    </div>
  );
}

/** What "send again" sends again (#269): the words of the message this reply answered, and
 *  the pictures that came with them (#441). */
interface SentAgain {
  text: string;
  images?: string[];
}

/** The message this one answered: the nearest thing said before it. */
function sentBefore(messages: ChatMessage[], at: number): SentAgain | null {
  for (let i = at - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "you") return { text: m.text, images: m.images };
  }
  return null;
}

/** The pictures one message carried, at a size where a screenshot is still recognisable —
 *  wrapping onto a second row rather than shrinking, so two are as legible as one.
 *
 *  A file deleted by hand keeps its slot: the message reads the way it was sent, and the
 *  slot is where it says the picture is no longer here. The browser is what notices, since
 *  nothing else reads these files between one poll and the next. */
function Pictures({ names, imageSrc }: { names: string[]; imageSrc(name: string): string }) {
  return (
    <div className="flex flex-wrap gap-[5px]">
      {names.map((name) => (
        <Shot key={name} src={imageSrc(name)} />
      ))}
    </div>
  );
}

function Shot({ src }: { src: string }) {
  const c = useCopy().chat;
  const [gone, setGone] = useState(false);
  if (gone) {
    return (
      <span
        className="flex h-[88px] w-[118px] flex-col items-center justify-center gap-1 rounded-[8px] bg-nb-wash text-[10.5px] text-nb-ink-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]"
      >
        <FiImage size={18} aria-hidden />
        {c.pictureGone}
      </span>
    );
  }
  return (
    // A file on this machine, served by app/chat-image/: next/image would optimise a
    // screenshot nobody is loading over a network.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={c.picture}
      onError={() => setGone(true)}
      className="h-[88px] w-auto max-w-full rounded-[8px] object-cover shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]"
    />
  );
}

/** The reply as it arrives. One live line at a time, and it says what the agent is actually
 *  doing: the step it is on, drawn by the fold below, or — before the first step and while
 *  the answer itself comes in — this line. "Writing" over a run of tool calls said the one
 *  thing that wasn't happening. */
function Writing({ text, since }: { text: string; since: number | null }) {
  const c = useCopy().chat;
  const ms = useElapsed(since);
  // What has come back so far, which is what says where the turn is: nothing, a step, words.
  const blocks = blocksOf(text);
  const onStep = blocks.at(-1)?.kind === "looked";
  // A line its CLI printed is not the agent answering, so it doesn't turn THINKING into
  // WRITING — a run that has only traced something so far has said nothing yet.
  const started = blocks.some((block) => block.kind !== "note");
  return (
    <div>
      {blocks.length > 0 && <Reply text={text} ms={ms} live onStep={onStep} />}
      {!onStep && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft">
          <span className={PULSE_DOT} aria-hidden />
          {started ? c.writing : c.thinking}
        </span>
      )}
    </div>
  );
}

/** What the agent wrote: the work it did, and the answer that came out of it. Everything up
 *  to the last step it took — its notes as it went and each step — folds into one line above
 *  the answer, so a long hunt through the board is one line of grey and never the reply.
 *
 *  One fold for the whole reply, not one per run of steps: the time on it is the turn's, and
 *  a fold per run would have to name a share of it that nothing measures. */
function Reply({
  text,
  copyCode,
  ms,
  live,
  onStep,
}: {
  text: string;
  copyCode?: boolean;
  ms?: number;
  live?: boolean;
  /** The agent is on a step right now, so the fold pulses the one it named last. */
  onStep?: boolean;
}) {
  const blocks = blocksOf(text);
  let last = -1;
  blocks.forEach((block, i) => {
    if (block.kind === "looked") last = i;
  });
  // Everything up to the last step, plus the CLI's own notes wherever they landed — one
  // printed after the answer must not take the answer down with it.
  const work = blocks.filter((block, i) => i <= last || block.kind === "note");
  const answer = blocks.filter((block, i) => i > last && block.kind === "said");
  return (
    <div className="flex flex-col gap-2">
      {work.length > 0 && <Work blocks={work} ms={ms} live={live} onStep={onStep} />}
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
function Work({
  blocks,
  ms,
  live,
  onStep,
}: {
  blocks: Block[];
  ms?: number;
  live?: boolean;
  onStep?: boolean;
}) {
  const c = useCopy().chat;
  const log = useCopy().runs.log;
  const [open, setOpen] = useState(false);
  const time = ms === undefined ? undefined : formatDuration(ms, log);
  // Only while that step is what the agent is on. Once the answer starts coming the step is
  // over, and a pulse under it would be the app inventing work.
  const doing = onStep ? lastStep(blocks) : undefined;
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
            block.kind === "said" ? (
              <Markdown key={i} body={block.text} className="nb-sessionlog-md" />
            ) : (
              <ul key={i} className="flex flex-col gap-0.5">
                {block.lines.map((line, k) => (
                  <li
                    key={k}
                    className={`truncate font-mono text-[11px] ${
                      block.kind === "note" ? "text-nb-peach-ink" : "text-nb-ink-soft"
                    }`}
                    title={line}
                  >
                    {line}
                  </li>
                ))}
              </ul>
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

/** The step the agent is on right now — the last one it named, without its mark: the pulse
 *  in front of the line is already the bullet, and two of them read as two things. */
function lastStep(blocks: Block[]): string | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.kind === "looked") {
      const line = block.lines[block.lines.length - 1];
      return line.startsWith(LOOKED) ? line.slice(LOOKED.length) : line;
    }
  }
  return undefined;
}

/** What the reply cost, in the row under it: the price the connector put on the turn, and
 *  nothing else. The token count is deliberately not here — a turn re-reads the prompt cache
 *  at every step, so the total is billed volume rather than anything the reader can picture,
 *  and six figures under a short answer reads as a warning it isn't. The four numbers are
 *  still on the hover. Only what was actually reported: a connector that prices nothing says
 *  nothing rather than showing a zero. The time is not here — the fold above already carries
 *  it. */
function spentOn(message: ChatMessage, log: RunsCopy["log"]): string {
  return message.costUsd === undefined ? "" : formatCost(message.costUsd, log);
}

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

/** The mark every connector's stream puts in front of a tool call, and the one the board
 *  puts in front of a line the CLI itself printed (cli/src/lib/agent/chat.ts). */
const LOOKED = "⏺ ";
const NOTE = "⚠ ";

type Block = { kind: "looked" | "note"; lines: string[] } | { kind: "said"; text: string };

/** Split what the agent wrote into what it said, what it looked at, and what its CLI had to
 *  say for itself, keeping the order it came in. */
function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const kind = line.startsWith(LOOKED) ? "looked" : line.startsWith(NOTE) ? "note" : "said";
    const last = blocks[blocks.length - 1];
    if (kind === "said") {
      if (last?.kind === "said") last.text += `\n${line}`;
      else blocks.push({ kind, text: line });
    } else if (last?.kind === kind) last.lines.push(line);
    else blocks.push({ kind, lines: [line] });
  }
  return blocks.filter((b) => (b.kind === "said" ? b.text.trim() !== "" : b.lines.length > 0));
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
    // The pictures cannot be pasted anywhere as pictures, so they are counted instead —
    // which is also what keeps a message that was nothing but pictures from vanishing
    // out of the copy (#441).
    const shots = m.images?.length ? c.picturesSaid(m.images.length) : "";
    if (words === "" && shots === "") continue;
    said.push(
      `**${m.role === "you" ? c.youSaid : c.agentSaid}**\n\n${[shots, words].filter(Boolean).join("\n\n")}`,
    );
  }
  return said.join("\n\n");
}

/** Where the model changed, drawn in the conversation so a reply is read against what
 *  wrote it. Empty is the agent's own default — the board never invents an id, and neither
 *  does this line. */
function Changed({ model }: { model: string }) {
  const c = useCopy().chat;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-px flex-1" style={{ background: HAIRLINE }} />
      <span className="shrink-0 font-mono text-[10.5px] text-nb-ink-soft">
        {c.modelChanged(model || c.modelDefault)}
      </span>
      <span className="h-px flex-1" style={{ background: HAIRLINE }} />
    </div>
  );
}

/** The marks that belong just above message `i` — the ones made after the message before it
 *  and no later than this one. `i` past the end takes whatever is left, which is a model
 *  changed since the last reply and not yet sent anything. */
function marksBefore(changes: ModelChange[] | undefined, messages: ChatMessage[], i: number): ModelChange[] {
  if (!changes?.length) return [];
  const after = i === 0 ? -Infinity : (messages[i - 1]?.at ?? -Infinity);
  const upTo = i < messages.length ? (messages[i]?.at ?? Infinity) : Infinity;
  return changes.filter((m) => m.at > after && m.at <= upTo);
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

/** The box at the foot. Enter starts a line, the same as any text box; nothing leaves until
 *  the send button is pressed.
 *
 *  It stays live while a reply is coming (#268), so a thought that arrives mid-reply goes
 *  into the box instead of being held in the user's head. Only sending waits — nothing
 *  leaves the box until the user presses send.
 *
 *  One surface (#272): what is typed, then the row that says what will answer it and the
 *  button that sends it. Nothing rules it off from the conversation above. */
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
  // A message is what is typed OR what was pasted (#441): pictures on their own are a
  // message, and nothing is held open for words that never came.
  const empty = !rail.draft.trim() && rail.pasted.length === 0;
  const pick = rail.read?.pick ?? null;
  // On a card's page the box asks about that card, so the words in it never read as an
  // invitation to talk about the whole board.
  const card = cardOf(rail);
  const ask = card === null ? c.ask : c.askCard(card);
  return (
    <div className="relative shrink-0 px-2.5 pb-0.5 pt-1.5">
      <MessageBox
        value={rail.draft}
        onChange={rail.setDraft}
        onSend={() => void rail.send()}
        canSend={!disabled && !answering && !empty}
        disabled={disabled}
        // The two boxes on this conversation both take a pasted picture — this one and the
        // Discuss screen's (components/CreateSheet.tsx). Handing the run a document is
        // #252's, and still is.
        onPasteImages={(files) => void rail.paste(files)}
        // And a picture dragged in from Finder, on the same path (#511).
        drop={{ onFiles: (files) => void rail.dropFiles(files), hint: c.dropRelease }}
        head={<Pasted rail={rail} />}
        placeholder={ask}
        label={c.message}
        sendLabel={c.send}
        // The box is where the hand is while a reply is coming, so Esc there ends the
        // reply rather than doing nothing (lib/chat-rail.ts).
        escEndsReply
        // An empty box walks back through what this conversation has sent; a typed one
        // leaves the arrows to the caret (lib/chat-rail.ts).
        onArrow={(up) => rail.recall(up)}
        // On a reply a terminal is writing there is nothing here to stop — that Send just
        // has to wait for it.
        stop={ours ? { label: c.stop, onStop: () => void rail.stop() } : undefined}
        // What will answer it, and the way back to the board's pair — this conversation's
        // alone (#272). Nothing here while the rules are too old to answer.
        foot={pick ? <Pick rail={rail} pick={pick} answering={answering} /> : undefined}
        hint={
          // One short line, and only while a reply is coming — there is nothing to say
          // about an idle box. Esc only where it reaches: a terminal's reply is ended in
          // that terminal.
          answering ? (
            <span className="block truncate">{ours ? c.sendingWaitsEsc : c.sendingWaits}</span>
          ) : undefined
        }
      />
    </div>
  );
}

/** The top of the box: what the last paste or drop had to say for itself (#441, #511), then
 *  the pictures waiting to be sent. Both, because a drop can put pictures in and turn a file
 *  away in the same breath — the note stands above the thumbnails it did not take, one line
 *  above the agent that has to change.
 *
 *  The ✕ is always there rather than on hover: it is the only way back out of a paste.
 *
 *  Both boxes on a conversation draw it, so a paste looks the same in the rail and on the
 *  Discuss screen (components/CreateSheet.tsx). */
export function Pasted({ rail }: { rail: ChatRail }) {
  const c = useCopy().chat;
  const note = rail.pasteNote;
  if (!note && rail.pasted.length === 0) return null;
  return (
    <>
      {note && (
        <div
          className="mx-1 mt-1 rounded-[8px] px-2 py-1.5 text-[12px] leading-[1.45]"
          style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
        >
          {note.kind === "blocked" ? (
            <>
              <p className="font-[700]">{c.noPictures(rail.read?.agent ?? "")}</p>
              <p className="mt-0.5">{c.picturesAble(rail.read?.imagesAble ?? [])}</p>
            </>
          ) : note.kind === "notImage" ? (
            <p>{c.notPicture(note.name)}</p>
          ) : (
            <p>{c.pictureFailed(note.why)}</p>
          )}
        </div>
      )}
      {rail.pasted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1 pt-1.5">
          {rail.pasted.map((name) => (
            <span key={name} className="relative block">
              {/* eslint-disable-next-line @next/next/no-img-element -- a file on this machine,
                  served by app/chat-image/. */}
              <img
                src={rail.imageSrc(name)}
                alt={c.picture}
                className="block size-[44px] rounded-[8px] object-cover shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]"
              />
              <button
                type="button"
                title={c.unpaste}
                aria-label={c.unpaste}
                onClick={() => void rail.unpaste(name)}
                className="absolute -right-[5px] -top-[5px] grid size-[16px] cursor-pointer place-items-center rounded-full border-[1.5px] border-nb-paper bg-nb-ink text-nb-cream"
              >
                <FiX size={9} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/** What this conversation runs on (#272, #467), on the box's own bottom row: one runtime,
 *  as its CLI's mark and a caret. It is this conversation's alone — the board's settings are
 *  untouched and no other chat moves.
 *
 *  Everything offered comes from the command: the rows are the board's runtimes whose CLI can
 *  hold a conversation, and each one already carries its model, so there is nothing beside it
 *  to fill in. */
export function Pick({ rail, pick, answering }: { rail: ChatRail; pick: ChatPick; answering: boolean }) {
  const running = pick.runtimes.find((r) => r.id === pick.runtime);
  return (
    <span className="flex h-[28px] min-w-0 items-center overflow-hidden rounded-[8px]">
      <RuntimePick rail={rail} pick={pick} label={running?.name ?? pick.name} answering={answering} />
    </span>
  );
}

/** The runtime: its CLI's mark and a caret, and that is the whole control. Only the open list
 *  spells the row out, which keeps the message box's row short. */
function RuntimePick({
  rail,
  pick,
  label,
  answering,
}: {
  rail: ChatRail;
  pick: ChatPick;
  label: string;
  answering: boolean;
}) {
  const c = useCopy().chat;
  const [open, setOpen] = useState(false);
  // Which row has been pressed once — the bin's ask-once, per row, because a switch to
  // another CLI throws the conversation away. Forgotten whenever the list closes.
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setConfirming(null);
  }, [open]);
  const has = (rail.read?.chat?.messages.length ?? 0) > 0;
  const running = pick.runtimes.find((r) => r.id === pick.runtime);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={c.agentPickHint(label)}
          aria-label={c.agentPick}
          className="inline-flex h-full shrink-0 cursor-pointer items-center gap-1.5 pl-2 pr-1.5 hover:brightness-[0.97]"
          style={{ background: AGENT_FILL }}
        >
          <AgentMark src={running?.icon ?? ""} size={16} name={label} />
          <span className="max-w-[128px] truncate text-[12px] text-nb-ink">{label}</span>
          <FiChevronDown size={12} className="text-nb-ink-soft" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-[230px]">
        {pick.runtimes.map((row) => (
          <DropdownMenuItem
            key={row.id}
            className="gap-2"
            disabled={answering && row.id !== pick.runtime}
            onSelect={(e) => {
              if (row.id === pick.runtime) return;
              // Only a row on another CLI costs the transcript, so only that one asks twice.
              const costs = has && row.harness !== running?.harness;
              if (costs && confirming !== row.id) {
                // Keep the list open for the second press.
                e.preventDefault();
                setConfirming(row.id);
                return;
              }
              // The board's own row is picked by following the board again, not by pinning
              // the same id — then a board switched later carries this chat too.
              void rail.pickRuntime(row.id === pick.boardRuntime ? null : row.id);
            }}
          >
            <AgentMark src={row.icon} size={15} />
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            {confirming === row.id ? (
              <span className="shrink-0 text-[10.5px] font-[700] uppercase tracking-[0.04em] text-nb-accent">
                {c.switchConfirm}
              </span>
            ) : (
              <span className="shrink-0 truncate text-[10.5px] font-[400] text-nb-ink-soft">
                {!row.installed ? c.notInstalled : row.id === pick.boardRuntime ? c.boardsOwn : row.model}
              </span>
            )}
            <span className="w-[13px] shrink-0">
              {row.id === pick.runtime && <FiCheck size={12} className="text-nb-accent" aria-hidden />}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2.5 py-1 text-[10.5px] leading-[1.4] text-nb-ink-soft">
          {answering ? c.switchWaits : c.switchCost}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The one control's fill, a shade off the box's paper, in the ember family the CLI marks
 *  are already in. */
const AGENT_FILL = "var(--color-nb-accent-wash)";

