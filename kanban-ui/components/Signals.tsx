"use client";

// The inbox (#453, #499) — anything that might become work, in
// `docs/kanban/triage/inbox/`, newest collected first.
//
// Two ways in, one folder: `akb signals fetch` pulls from the endpoint the board is pointed
// at, and **Add to inbox** at the top of this page takes a dropped file, a pasted link or
// pasted text. Both write the same Markdown file, so nothing below the box knows which way
// something came in.
//
// It is drawn in the archive page's frame, for the same reason that page is: these are whole
// documents, and a rail row is a couple of hundred pixels wide. A page rather than a pane, so
// Back, Forward and a reload keep you where you were.
//
// Nothing here is a card: nothing on this page creates one, ranks one, or touches the board's
// counts. Turning one into a card is #454's.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight, FiExternalLink, FiGlobe, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  SiReddit,
  SiSinaweibo,
  SiX,
  SiXiaohongshu,
  SiYoutube,
  SiZhihu,
} from "react-icons/si";
import { useRouter } from "next/navigation";
import { addToInboxAction, dismissSignalAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { useLanguage } from "@/components/language";
import { LANGUAGE_TAGS, type AgentInfo, type Language, type MemoryModule, type Signal, type SignalInbox } from "@/lib/types";
import { Button, PanelAction } from "./button";
import { HAIRLINE } from "./chrome";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";
import { reloadSignalsRow } from "./signals-row";
import { Window } from "./Window";

// --- the marks a source is known by ------------------------------------------
// A small table, matched on the `source` field as it was written. Nothing below knows a
// source at all — it is free text, so any endpoint connects and a dropped file names itself —
// and the price of that is a generic mark for anything not in this table.

const MARKS: { match: RegExp; Icon: typeof SiReddit; color: string }[] = [
  { match: /reddit/i, Icon: SiReddit, color: "#ff4500" },
  { match: /(^|\W)(x|twitter)(\W|$)/i, Icon: SiX, color: "#0f0f0f" },
  { match: /xiaohongshu|小红书|rednote/i, Icon: SiXiaohongshu, color: "#ff2442" },
  { match: /weibo|微博/i, Icon: SiSinaweibo, color: "#e6162d" },
  { match: /zhihu|知乎/i, Icon: SiZhihu, color: "#0084ff" },
  { match: /youtube/i, Icon: SiYoutube, color: "#ff0000" },
];

function SourceMark({ source }: { source: string }) {
  const known = MARKS.find((mark) => mark.match.test(source));
  if (!known) return <FiGlobe size={13} className="shrink-0 text-nb-ink-soft" aria-hidden />;
  const { Icon, color } = known;
  return <Icon size={13} color={color} className="shrink-0" aria-hidden />;
}

// A collected stamp is `YYYY-MM-DD HH:MM` in the board's own local time, so it is read back
// as local time and drawn in the language the app is set to — an English date under a Chinese
// heading is the one thing on the row that didn't follow the setting.
function when(stamp: string, language: Language): string {
  const at = new Date(stamp.replace(" ", "T"));
  if (Number.isNaN(at.getTime())) return stamp;
  return at.toLocaleString(LANGUAGE_TAGS[language], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// --- the page ---------------------------------------------------------------

/** What the page is drawn in. It keeps up on the two triggers the archive page uses — a run
 *  finishing, and the window being focused again — because the recurring pull is a run like
 *  any other, and it writes the files this page lists. */
function SignalsFrame({
  projectRoot,
  openIds,
  agent,
  goalWritten,
  memoryModules,
  desktop,
  children,
}: {
  projectRoot: string;
  openIds: number[];
  agent: AgentInfo;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const noRunsOfOurOwn = useCallback(() => {}, []);
  const { sessions } = useAgentSessions(noRunsOfOurOwn);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);
  useOnTabFocus(refresh);

  return (
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentSignals
        memoryModules={memoryModules}
        goalWritten={goalWritten}
        running={runningCardIds(sessions)}
        header={
          <Header agent={agent} projectRoot={projectRoot} goalWritten={goalWritten} desktop={desktop} />
        }
      >
        <div className="h-full overflow-y-auto">
          <RunningNotice desktop={desktop} />
          <main className="mx-auto w-full max-w-[840px] px-6 py-6 max-md:px-4 max-md:py-4">{children}</main>
        </div>
      </Window>
    </OpenIdsProvider>
  );
}

export function SignalsPage({
  inbox,
  openIds,
  agent,
  projectRoot,
  goalWritten,
  memoryModules,
  desktop,
}: {
  inbox: SignalInbox;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
}) {
  const c = useCopy().rail.signals;
  const router = useRouter();
  // Dismissing is a write, so the list is redrawn from the server rather than from what this
  // page had. Held here only so the row goes the instant it is pressed.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState("");

  const dismiss = async (sourceId: string) => {
    setGone((held) => new Set(held).add(sourceId));
    const done = await dismissSignalAction(sourceId);
    if (!done.ok) {
      setGone((held) => {
        const next = new Set(held);
        next.delete(sourceId);
        return next;
      });
      setFailed(done.error ?? c.dismissFailed);
      return;
    }
    setFailed("");
    reloadSignalsRow();
    router.refresh();
  };

  // An add is a write too, and what it wrote is a file this page reads from the server.
  const added = useCallback(() => {
    setFailed("");
    reloadSignalsRow();
    router.refresh();
  }, [router]);

  const signals = inbox.signals.filter((signal) => !gone.has(signal.sourceId));
  // No endpoint is not an empty inbox: one is a board nothing has been pulled into, the other
  // is a board that was never pointed anywhere. They read differently or the second one looks
  // like the first and nobody goes looking for the setting. It is drawn UNDER the add box and
  // never instead of it — a board with no endpoint still takes what is dropped in (#499).
  const unconfigured = inbox.missing.length > 0 && signals.length === 0;

  return (
    <SignalsFrame
      projectRoot={projectRoot}
      openIds={openIds}
      agent={agent}
      goalWritten={goalWritten}
      memoryModules={memoryModules}
      desktop={desktop}
    >
      <h1 className="text-[20px] font-[800] leading-tight tracking-[-0.02em]">{c.title}</h1>
      <p className="mt-1 break-all font-mono text-[11.5px] text-nb-ink-soft">
        {c.meta(inbox.relPath, signals.length)}
        {inbox.latestImport && ` · ${c.latestImport(inbox.latestImport)}`}
      </p>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-nb-ink-soft">{c.lead}</p>

      {failed && (
        <p className="mt-3 rounded-[9px] bg-nb-peach-soft px-3.5 py-2 text-[12px] leading-[16px] text-nb-ink">
          {failed}
        </p>
      )}

      <AddToInbox onFailed={setFailed} onAdded={added} />

      {signals.length === 0 ? (
        <div className="nb-panel-sm mt-4 p-5 max-md:p-4">
          <p className="text-[13px] leading-relaxed text-nb-ink-soft">{c.empty}</p>
        </div>
      ) : (
        <ul aria-label={c.list} className="mt-4 flex flex-col gap-2.5">
          {signals.map((signal) => (
            <SignalRow key={signal.sourceId} signal={signal} onDismiss={() => dismiss(signal.sourceId)} />
          ))}
        </ul>
      )}

      {unconfigured && (
        <div className="nb-panel-sm mt-2.5 p-5 max-md:p-4">
          <p className="text-[13px] font-[700]">{c.connect}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {inbox.missing.map((gap) => (
              <li key={gap.what} className="text-[13px] leading-relaxed text-nb-ink-soft">
                {gap.what === "endpoint" ? c.needEndpoint(gap.file) : c.needToken(gap.file)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SignalsFrame>
  );
}

/** Add to inbox (#499): one box that takes all three ways in.
 *
 *  Paste a link or type a line and press Add; or drop a file anywhere on the box, which adds
 *  it the moment it lands — a drop is already a decision, and asking for a second press after
 *  one would be a step for nothing. Whatever is typed goes along with a dropped file as a note.
 *
 *  What it could not take is said in the page's one error line, in the board's own words: what
 *  was dropped is the reader's, so the reason has to be the real one. */
function AddToInbox({ onFailed, onAdded }: { onFailed: (why: string) => void; onAdded: () => void }) {
  const c = useCopy().rail.signals;
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (file?: File) => {
    if (busy) return;
    setBusy(true);
    const form = new FormData();
    if (text.trim()) form.set("text", text.trim());
    if (file) {
      form.set("file", file);
      form.set("name", file.name);
    }
    const done = await addToInboxAction(form).catch(() => ({ ok: false, error: c.add.failed }));
    setBusy(false);
    if (!done.ok) {
      onFailed(done.error ?? c.add.failed);
      return;
    }
    setText("");
    onAdded();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      // Leaving for a child of the box is not leaving the box — without this the highlight
      // flickers as the pointer crosses the text area.
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        // One at a time: each file is its own item, and a batch that half-failed would have
        // no honest single answer.
        const [first] = Array.from(e.dataTransfer.files);
        if (first) void send(first);
      }}
      className="nb-panel-sm mt-4 p-4 transition-colors max-md:p-3.5"
      style={over ? { backgroundColor: "color-mix(in srgb, var(--color-nb-accent) 10%, transparent)" } : undefined}
    >
      <p className="text-[13px] font-[700]">{over ? c.add.dropping : c.add.title}</p>
      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          disabled={busy}
          placeholder={c.add.placeholder}
          aria-label={c.add.title}
          className="min-w-0 flex-1 resize-none rounded-[10px] bg-nb-paper px-2.5 py-2 text-[13px] leading-[1.5] text-nb-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] placeholder:text-nb-ink-soft/70 focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)] focus:outline-none disabled:opacity-60"
        />
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => void send()}>
          <FiPlus size={13} aria-hidden />
          {c.add.button}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-nb-ink-soft">{c.add.drop}</p>
    </div>
  );
}

/** One item: what it says, where it came from, and what you may do with it.
 *
 *  The body is folded by default — a page of whole documents is a page nobody scans — and
 *  **Read** is what opens this one. Open is left off something with no address to open, which
 *  a dropped file has none of. Dismissing takes no confirmation and offers no undo: the page
 *  says so once at the top, and nothing in the inbox is worth a dialog. */
function SignalRow({ signal, onDismiss }: { signal: Signal; onDismiss: () => void }) {
  const c = useCopy().rail.signals;
  const language = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-[12px] bg-nb-sheet px-4 py-3.5" style={{ border: `1px solid ${HAIRLINE}` }}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[13px] font-[700] leading-[19px]">{signal.title}</p>
        <span className="shrink-0 font-mono text-[11px] leading-[19px] tabular-nums text-nb-ink-soft">
          {when(signal.collectedAt, language)}
        </span>
      </div>
      {open && (
        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-[18px]">{signal.summary}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="flex min-w-0 items-center gap-2 text-[11.5px] text-nb-ink-soft">
          {signal.source && (
            <>
              <SourceMark source={signal.source} />
              <span className="truncate">{signal.source}</span>
            </>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <PanelAction
            icon={open ? <FiChevronDown size={12} aria-hidden /> : <FiChevronRight size={12} aria-hidden />}
            label={open ? c.hideSummary : c.viewSummary}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          />
          {signal.url && (
            <a
              href={signal.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-0.5 text-[12px] font-[700] text-nb-accent-deep transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_16%,transparent)] max-md:h-11 max-md:px-3"
            >
              <FiExternalLink size={12} aria-hidden />
              {c.viewOriginal}
            </a>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-0.5 text-[12px] font-[700] text-nb-ink-soft transition-colors hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] hover:text-nb-ink max-md:h-11 max-md:px-3"
          >
            <FiTrash2 size={12} aria-hidden />
            {c.dismiss}
          </button>
        </span>
      </div>
    </li>
  );
}
