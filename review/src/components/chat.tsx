// The comments rail. It takes the place legacy Window.tsx gives the chat rail — one rail on
// the right, a cover at phone width — and Chat.tsx's frame, head and composer; the thread is
// drawn for people talking to people. Every comment reads the same way: avatar, name, time,
// words. A send-back keeps its answer as a quote; an update is a quiet event line; a rule
// marks where the unread start. The composer follows Linear's: one line at rest, growing with
// what is typed, the send button inside it.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiArrowUp, FiCornerUpLeft, FiEdit3, FiMessageSquare, FiX } from "react-icons/fi";
import type { Copy } from "../i18n";
import { useArrived } from "../lib/motion";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { HAIRLINE, QUIET } from "./chrome";

/** `phase`: the phase it was made in, named only on a card with more than one approval. */
export type Entry = { key: string; who: string; at: string; when: string; text?: string; mark?: "rejected" | "updated"; phase?: string; fresh?: boolean };

const SKINS = ["bg-nb-sky-soft text-nb-sky-ink", "bg-nb-lilac-soft text-nb-lilac-ink", "bg-nb-mint-soft text-nb-mint-ink", "bg-nb-peach-soft text-nb-peach-ink"];

const skinOf = (who: string) => SKINS[[...who].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % SKINS.length]!;

export function Avatar({ who, size = 28 }: { who: string; size?: number }) {
  const initial = (who.replace(/^@/, "").match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-[700]", skinOf(who))}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}

export function ChatPane({
  c,
  thread,
  phone,
  canWrite,
  onSend,
  onClose,
}: {
  c: Copy["comments"];
  thread: Entry[];
  phone?: boolean;
  canWrite: boolean;
  onSend: (body: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const firstFresh = thread.findIndex((e) => e.fresh);
  const arrived = useArrived(thread.length ? thread.map((e) => e.key) : null);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const fresh = el.querySelector<HTMLElement>("[data-fresh]");
    if (fresh) el.scrollTop = fresh.offsetTop - 16;
    else el.scrollTop = el.scrollHeight;
  }, [thread.length]);
  return (
    <section aria-label={c.heading} className={cn("flex h-full flex-col bg-nb-paper", !phone && "rounded-t-[14px]")}>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4" style={{ borderColor: HAIRLINE }}>
        <span className="text-[13.5px] font-[800]">{c.heading}</span>
        <span className="nb-chip bg-nb-ink/[0.06] text-nb-ink-soft">{thread.length}</span>
        {!phone && (
        <button
          type="button"
          onClick={onClose}
          aria-label={c.close}
          title={c.close}
          className="ml-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-[8px] text-nb-ink-soft hover:bg-nb-ink/[0.06] hover:text-nb-ink"
        >
          <FiX className="text-[15px]" aria-hidden />
        </button>
        )}
      </div>
      <div ref={list} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {thread.length === 0 ? (
          <p className="text-[13px] text-nb-ink-soft">{c.empty}</p>
        ) : (
          <ol className="flex flex-col gap-5">
            {thread.map((e, i) => (
              <li key={e.key} data-fresh={i === firstFresh || undefined} className={arrived(e.key) ? "nb-rise" : undefined}>
                {i === firstFresh && <Fresh label={c.fresh} />}
                <Said c={c} e={e} />
              </li>
            ))}
          </ol>
        )}
      </div>
      {canWrite && <Composer c={c} onSend={onSend} />}
    </section>
  );
}

function Composer({ c, onSend }: { c: Copy["comments"]; onSend: (body: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const tall = focused || !!draft;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft, tall]);
  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    if (await onSend(body)) setDraft("");
    setBusy(false);
  };
  const ready = !!draft.trim() && !busy;
  return (
    <div className="shrink-0 px-3 pb-3 pt-1 max-md:pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className={cn("nb-field flex rounded-[12px] border bg-nb-paper", tall ? "flex-col gap-1 border-nb-ink/40 px-3 pb-2 pt-2.5" : "items-center gap-2 border-nb-ink/15 py-1.5 pl-3 pr-1.5")}>
        <textarea
          ref={box}
          rows={tall ? 3 : 1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={c.placeholder}
          aria-label={c.placeholder}
          className="min-h-[19.5px] min-w-0 flex-1 resize-none bg-transparent text-[13px] leading-[1.5] text-nb-ink placeholder:text-nb-ink-soft/70 focus:outline-none max-md:text-[16px]"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void send()}
          aria-label={c.send}
          disabled={!ready}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center self-end rounded-full",
            ready ? "cursor-pointer bg-nb-accent text-white hover:bg-nb-accent-deep" : "bg-nb-ink/[0.06] text-nb-ink-soft/60",
          )}
        >
          <FiArrowUp className="text-[14px]" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Fresh({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-2 text-[11px] font-[700] text-nb-accent-deep">
      <span className="h-px flex-1 bg-nb-accent/40" />
      {label}
      <span className="h-px flex-1 bg-nb-accent/40" />
    </div>
  );
}

function PhaseTag({ name }: { name: string }) {
  return <span className="inline-block max-w-[140px] shrink-0 truncate rounded-[4px] bg-nb-ink/[0.06] px-1.5 align-baseline text-[11px] text-nb-ink-soft">{name}</span>;
}

function Said({ c, e }: { c: Copy["comments"]; e: Entry }) {
  if (e.mark === "updated") {
    return (
      <div className="flex gap-2.5">
        <span className="flex w-7 shrink-0 justify-center">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-nb-sky-soft text-nb-sky-ink">
            <FiEdit3 size={11} aria-hidden />
          </span>
        </span>
        <div className="min-w-0 pt-[3px]">
          <div className="text-[12px] text-nb-ink-soft">
            <span className="font-[700] text-nb-ink">{e.who}</span> {c.updated} · <time dateTime={e.at}>{e.when}</time>
            {e.phase && <> · <PhaseTag name={e.phase} /></>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <Avatar who={e.who} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-[13px] font-[700] text-nb-ink">{e.who}</span>
          <time dateTime={e.at} className="shrink-0 text-[11.5px] text-nb-ink-soft">
            {e.when}
          </time>
          {e.phase && <PhaseTag name={e.phase} />}
        </div>
        {e.mark === "rejected" ? (
          <div className="mt-1.5 rounded-r-[8px] border-l-2 border-nb-peach-ink/50 bg-nb-peach-soft/50 px-3 py-2">
            <div className="mb-0.5 flex items-center gap-1 text-[11px] font-[700] text-nb-peach-ink">
              <FiCornerUpLeft size={11} aria-hidden />
              {c.rejected}
            </div>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-nb-ink">{e.text}</p>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-nb-ink">{e.text}</p>
        )}
      </div>
    </div>
  );
}

// The top row's way to the rail, on every width: the count says how much is there, the dot
// that something new is waiting.
// `quiet`: borderless in the card page's title row, the label dropped at phone width.
export function ChatButton({ label, count, open, unread, onClick, quiet }: { label: string; count: number; open?: boolean; unread?: boolean; onClick: () => void; quiet?: boolean }) {
  const lit = open ? { background: "var(--color-nb-accent-soft)" } : undefined;
  return (
    <div className="relative flex shrink-0 items-center">
      {quiet ? (
        <button type="button" onClick={onClick} aria-pressed={open} aria-label={label} title={label} className={QUIET} style={lit}>
          <FiMessageSquare className="text-[14px]" aria-hidden />
          <span className="max-md:hidden">{label}</span>
          <span className="text-nb-ink-soft">{count}</span>
        </button>
      ) : (
        <Button variant="ghost" size="xs" onClick={onClick} aria-pressed={open} className="max-md:h-9" style={lit}>
          <FiMessageSquare className="text-[14px]" aria-hidden />
          {label}
          <span className="text-nb-ink-soft">{count}</span>
        </Button>
      )}
      {unread &&
        (quiet ? (
          <span aria-hidden className="pointer-events-none absolute left-[17px] top-[3px] size-[7px] rounded-full bg-nb-accent" />
        ) : (
          <span aria-hidden className="pointer-events-none absolute -right-[3px] -top-[3px] size-[9px] rounded-full border-[1.5px] border-nb-ink bg-nb-accent" />
        ))}
    </div>
  );
}

/** Esc closes what `on` opened. */
export function useEscape(on: boolean, close: () => void) {
  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [on, close]);
}
