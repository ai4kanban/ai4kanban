// legacy kanban-ui SessionLog on the card page (#2048), read as progress (#2059): the plan on
// top, the agent's words as the body, the tool calls between two messages folded into one
// line, and one line for what it is doing now. An ended run shows only its result (#2164).
// A log with no typed events stays the mono tail it always was.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiAlertCircle, FiCheck, FiChevronDown, FiChevronRight, FiClock } from "react-icons/fi";
import { Markdown } from "@review/components/Markdown";
import * as api from "../api";
import { T, type ToolKind } from "../i18n";

const RECONNECT_MS = [1000, 2000, 5000, 10000];
const TAIL_CHARS = 64 * 1024;
const PULSE_DOT = "inline-block size-1.5 rounded-full bg-nb-accent animate-pulse";
const MONO_TEXT = { whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: 12 } as const;
const SMALL = "text-[12.5px] leading-5";
const TOOL_KINDS: ToolKind[] = ["read", "edit", "delete", "move", "search", "execute", "fetch", "other"];

const MOTION = `
@keyframes rlShimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@keyframes rlSpin { to { transform: rotate(360deg); } }
.rl-shimmer {
  background: linear-gradient(90deg, var(--color-nb-ink-soft) 0%, var(--color-nb-ink-soft) 40%, var(--color-nb-ink) 50%, var(--color-nb-ink-soft) 60%, var(--color-nb-ink-soft) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: rlShimmer 1.8s linear infinite;
}
.rl-spin { animation: rlSpin 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .rl-shimmer, .rl-spin { animation: none; } .rl-shimmer { color: var(--color-nb-ink-soft); } }
`;

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return T.log.seconds(total);
  const mins = Math.floor(total / 60);
  if (mins < 60) return T.log.minutes(mins, total % 60);
  return T.log.hours(Math.floor(mins / 60), mins % 60);
}

export const formatCost = (usd: number) => (usd < 0.005 ? T.log.costTiny : T.log.cost(usd.toFixed(2)));

export function formatTokens(u: api.Usage): string {
  const n = (v: number) => v.toLocaleString("en-US");
  return T.log.tokens(n(u.input), n(u.cacheCreation), n(u.cacheRead), n(u.output));
}

// ---- the events, as progress -------------------------------------------------

interface PlanEntry {
  content: string;
  status: string;
}
interface Call {
  id: string;
  kind: ToolKind;
  target: string;
  status: string;
  result: string;
}
type Line = { call: Call } | { log: string };
type Item = { type: "message"; key: number; text: string } | { type: "group"; key: number; lines: Line[] };

export interface Progress {
  structured: boolean;
  plan: PlanEntry[] | null;
  items: Item[];
  errors: string[];
  /** The kind of call still in flight, last first. */
  doing: ToolKind | null;
  text: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const settled = (status: string) => status === "completed" || status === "failed";

export function progressOf(events: api.JobEvent[]): Progress {
  const out: Progress = { structured: false, plan: null, items: [], errors: [], doing: null, text: "" };
  const calls = new Map<string, Call>();
  const group = (key: number) => {
    const last = out.items[out.items.length - 1];
    if (last?.type === "group") return last.lines;
    const lines: Line[] = [];
    out.items.push({ type: "group", key, lines });
    return lines;
  };
  for (const e of events) {
    const d = e.data ?? {};
    const kind = e.kind ?? "log";
    if (kind === "log") {
      const text = e.text || str(d.text);
      out.text += text;
      if (text.trim()) group(e.seq).push({ log: text.trimEnd() });
      continue;
    }
    out.structured = true;
    if (kind === "message") out.items.push({ type: "message", key: e.seq, text: str(d.text) });
    else if (kind === "error") out.errors.push(str(d.text));
    else if (kind === "plan") {
      const entries = Array.isArray(d.entries) ? (d.entries as Record<string, unknown>[]) : [];
      out.plan = entries.map((p) => ({ content: str(p.content), status: str(p.status) })).filter((p) => p.content);
    } else if (kind === "tool_call") {
      const call: Call = {
        id: str(d.toolCallId),
        kind: TOOL_KINDS.includes(d.kind as ToolKind) ? (d.kind as ToolKind) : "other",
        target: str(d.target) || str(d.title),
        status: str(d.status),
        result: "",
      };
      calls.set(call.id, call);
      group(e.seq).push({ call });
    } else if (kind === "tool_call_update") {
      const call = calls.get(str(d.toolCallId));
      if (!call) continue;
      if (d.status) call.status = str(d.status);
      if (d.result) call.result = str(d.result);
    }
  }
  for (const call of [...calls.values()].reverse()) {
    if (!settled(call.status)) {
      out.doing = call.kind;
      break;
    }
  }
  return out;
}

function summary(lines: Line[]): string {
  const n = new Map<ToolKind, number>();
  for (const l of lines) if ("call" in l) n.set(l.call.kind, (n.get(l.call.kind) ?? 0) + 1);
  const text = TOOL_KINDS.filter((k) => n.has(k)).map((k) => T.log.count[k](n.get(k)!)).join(T.log.joiner);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Plan({ entries }: { entries: PlanEntry[] }) {
  return (
    <ol className={`m-0 flex list-none flex-col gap-1 p-0 ${SMALL}`}>
      {entries.map((p, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-[3px] flex size-3.5 shrink-0 items-center justify-center">
            {p.status === "completed" ? (
              <span className="flex size-3.5 items-center justify-center rounded-full bg-nb-ink/15 text-nb-ink-soft">
                <FiCheck size={9} strokeWidth={3.5} aria-hidden />
              </span>
            ) : p.status === "in_progress" ? (
              <span className="rl-spin size-3 rounded-full border-[1.5px] border-nb-accent border-t-transparent" aria-hidden />
            ) : (
              <span className="size-3 rounded-full border-[1.5px] border-nb-ink/30" aria-hidden />
            )}
          </span>
          <span className={p.status === "completed" ? "text-nb-ink-soft/80" : p.status === "in_progress" ? "font-[700] text-nb-ink" : "text-nb-ink"}>
            {p.content}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CallLine({ call }: { call: Call }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => call.result && setOpen((v) => !v)}
        aria-expanded={call.result ? open : undefined}
        className={`flex w-full min-w-0 items-center gap-1.5 text-left ${call.result ? "cursor-pointer hover:text-nb-ink" : "cursor-default"}`}
      >
        <span className="shrink-0">{T.log.verb[call.kind]}</span>
        <span className="min-w-0 truncate text-nb-ink">{call.target}</span>
        {call.status === "failed" && <span className="shrink-0 text-[11.5px] text-nb-ink-soft/80">· {T.log.callFailed}</span>}
        {call.result && <FiChevronRight size={11} aria-hidden className={`shrink-0 opacity-60 ${open ? "rotate-90" : ""}`} />}
      </button>
      {open && (
        <pre className="m-0 mt-1 max-h-64 overflow-auto break-words rounded-[6px] bg-nb-sheet px-2 py-1.5 text-nb-ink-soft" style={MONO_TEXT}>
          {call.result}
        </pre>
      )}
    </div>
  );
}

function Group({ lines }: { lines: Line[] }) {
  const [open, setOpen] = useState(false);
  const said = summary(lines);
  // A group of log lines alone is the board talking, not the agent working.
  if (!said) return null;
  return (
    <div className={`${SMALL} text-nb-ink-soft`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-fit cursor-pointer items-center gap-1 text-left hover:text-nb-ink">
        <span>{said}</span>
        <FiChevronRight size={12} aria-hidden className={open ? "shrink-0 rotate-90" : "shrink-0"} />
      </button>
      {open && (
        <div className="mt-1 ml-[2px] flex flex-col gap-0.5 border-l border-nb-ink/12 pl-3">
          {lines.map((l, i) =>
            "log" in l ? (
              <div key={i} className="break-words text-nb-ink-soft/80" style={MONO_TEXT}>
                {l.log}
              </div>
            ) : (
              <CallLine key={l.call.id || i} call={l.call} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Items({ items, doing }: { items: Item[]; doing?: ToolKind | null }) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it) =>
        it.type === "message" ? <Markdown key={it.key} body={it.text} className="nb-sessionlog-md" /> : <Group key={it.key} lines={it.lines} />,
      )}
      {doing && <div className={`rl-shimmer w-fit ${SMALL}`}>{T.log.doing[doing]}</div>}
    </div>
  );
}

function Errors({ errors }: { errors: string[] }) {
  return (
    <>
      {errors.filter(Boolean).map((text, i) => (
        <div key={i} className={`flex items-start gap-1.5 font-[600] text-nb-crimson ${SMALL}`}>
          <FiAlertCircle size={13} className="mt-[3px] shrink-0" aria-hidden />
          <span className="min-w-0 break-words font-mono text-[12px]">{text}</span>
        </div>
      ))}
    </>
  );
}

function Facts({ items }: { items: { text: string; title?: string; dim?: boolean }[] }) {
  return (
    <>
      {items.map((f, i) => (
        <span key={i} className={f.dim ? "tabular-nums opacity-80" : undefined} title={f.title}>
          {i > 0 && (
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
          )}
          {f.text}
        </span>
      ))}
    </>
  );
}

/** A running job's log events past `after`, pushed until the job ends or the returned stop is called. */
export function watchJobLog(job: string, after: number, add: (fresh: api.JobEvent[]) => void): () => void {
  let stop = false;
  let ws: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let tries = 0;
  const connect = async () => {
    const opened = await api.openJobLog(job, after).catch(() => null);
    if (stop) return opened?.close();
    if (!opened) return reconnect();
    ws = opened;
    let ended = false;
    opened.onopen = () => (tries = 0);
    opened.onmessage = (m) => {
      try {
        const said = JSON.parse(String(m.data)) as { type?: string; events?: api.JobEvent[] };
        if (said.type === "events" && Array.isArray(said.events)) {
          const fresh = said.events.filter((e) => e.seq > after);
          if (fresh.length) {
            after = fresh[fresh.length - 1]!.seq;
            add(fresh);
          }
        }
        if (said.type === "ended") ended = true;
      } catch {
        // not ours to read
      }
    };
    opened.onclose = () => {
      if (!stop && !ended) reconnect();
    };
  };
  const reconnect = () => {
    retry = setTimeout(() => void connect(), RECONNECT_MS[Math.min(tries++, RECONNECT_MS.length - 1)]);
  };
  void connect();
  return () => {
    stop = true;
    clearTimeout(retry);
    ws?.close();
  };
}

/** What a running job is doing now, as one line, null while it calls no tool (#2200). */
export function watchDoing(job: string, show: (doing: string | null) => void): () => void {
  const events: api.JobEvent[] = [];
  return watchJobLog(job, -1, (fresh) => {
    events.push(...fresh);
    const kind = progressOf(events).doing;
    show(kind ? T.log.doing[kind] : null);
  });
}

/** `failure`: why the run failed, shown where its own output names no error. */
export function RunLog({ task, failure }: { task: api.Task; failure?: string | null }) {
  const job = task.run?.job ?? task.last_job ?? null;
  const live = task.run?.state === "running";
  const queued = task.run?.state === "queued";
  const shown = live || task.status === "done" || task.status === "failed";
  const [open, setOpen] = useState(shown);
  const [events, setEvents] = useState<api.JobEvent[]>([]);
  const [info, setInfo] = useState<api.JobLog["job"]>(null);
  const [now, setNow] = useState(Date.now());
  const [scrolled, setScrolled] = useState(false);
  const after = useRef(-1);
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => setOpen(shown), [shown]);
  useEffect(() => {
    after.current = -1;
    pinned.current = true;
    setEvents([]);
    setInfo(null);
  }, [job]);
  // An ended run keeps no process, here as on the server (#2164).
  useEffect(() => {
    if (live) return;
    after.current = -1;
    setEvents([]);
  }, [live]);

  useEffect(() => {
    if (!job) return;
    let stop = false;
    const read = async () => {
      try {
        const r = await api.readJob(job);
        if (!stop) setInfo(r.job);
      } catch {
        // the next change reads again
      }
    };
    void read();
    const unwatch = live
      ? watchJobLog(job, after.current, (fresh) => {
          after.current = fresh[fresh.length - 1]!.seq;
          setEvents((was) => [...was, ...fresh]);
        })
      : undefined;
    return () => {
      stop = true;
      unwatch?.();
    };
  }, [job, live]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const p = progressOf(events);
  const reply = live ? "" : (info?.reply ?? "").trim();
  useEffect(() => {
    const el = box.current;
    if (open && live && el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [events, open, live]);

  if (!job && !queued) return null;
  const failed = task.status === "failed";
  const stopped = task.status === "stopped";
  const started = info?.createdAt ? Date.parse(info.createdAt) : null;
  const took = started && info?.finishedAt ? formatDuration(Date.parse(info.finishedAt) - started) : null;
  const usage = live ? null : info?.usage;

  let body: ReactNode;
  if (live) {
    body = p.structured ? (
      <Items items={p.items} doing={p.doing} />
    ) : (
      <pre className="m-0 break-words text-nb-ink-soft" style={MONO_TEXT}>
        {p.text.slice(-TAIL_CHARS).trim() || "…"}
      </pre>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2.5">
        {reply ? <Markdown body={reply} className="nb-sessionlog-md" /> : !failure && <p className="m-0 text-nb-ink-soft">{T.noLog}</p>}
        {failure && <Errors errors={[failure]} />}
        {usage && (
          <p className="m-0 tabular-nums text-nb-ink-soft opacity-80" style={MONO_TEXT} title={T.log.tokensHint}>
            {formatTokens(usage)}
          </p>
        )}
      </div>
    );
  }

  const livePlan = live && p.structured && !!p.plan?.length;
  return (
    <div className="nb-section overflow-hidden bg-nb-sheet">
      {p.structured && <style>{MOTION}</style>}
      <button type="button" onClick={() => job && setOpen((v) => !v)} aria-expanded={open} className="flex h-10 w-full cursor-pointer items-center gap-3 px-4 text-left">
        <span className="text-[12px] font-[700]">{T.runLog}</span>
        <span className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 text-[11px] text-nb-ink-soft">
          {queued ? (
            <>
              <FiClock size={11} aria-hidden />
              <span>{task.run?.runner_connected === false ? T.queuedOffline : T.queued}</span>
            </>
          ) : live ? (
            <>
              <span className={PULSE_DOT} aria-hidden />
              <span>
                {T.running}
                {started ? ` · ${clock(now - started)}` : ""}
              </span>
            </>
          ) : (
            <>
              <span aria-hidden style={{ color: "var(--color-nb-accent-deep)" }}>
                {failed ? "✕" : stopped ? "■" : "✓"}
              </span>
              <span>
                <Facts
                  items={[
                    { text: failed ? T.failedRun : stopped ? T.stoppedRun : T.done },
                    ...(took ? [{ text: took, dim: true }] : []),
                    ...(typeof info?.costUsd === "number" ? [{ text: formatCost(info.costUsd), dim: true, title: T.log.costHint }] : []),
                  ]}
                />
              </span>
            </>
          )}
          {job && <FiChevronDown size={13} aria-hidden className={open ? "rotate-180" : ""} />}
        </span>
      </button>
      {open && job && (
        <div className="flex max-h-[50vh] flex-col border-t border-nb-ink/12 bg-nb-canvas shadow-[inset_0_1px_3px_color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)]">
          {livePlan && (
            <div className="shrink-0 border-b border-nb-ink/12 px-4 py-2.5">
              <Plan entries={p.plan!} />
            </div>
          )}
          <div
            ref={box}
            onScroll={(e) => {
              const el = e.currentTarget;
              pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
              setScrolled(el.scrollTop > 0);
            }}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
            style={{ maskImage: live && scrolled ? "linear-gradient(to bottom, transparent, black 28px)" : undefined }}
          >
            {body}
          </div>
        </div>
      )}
    </div>
  );
}
