"use client";

// Configuration → Runtimes (#344, #370).
//
// Two tabs. RUNTIMES is the list: one row per runtime, named by the board, headed with the
// computer it runs on and opening in place onto everything that computer can be told about
// it. COMPUTERS is the machines the board knows, and nothing more — no runtime points at one
// the tab doesn't list.
//
// Three answers, and three places they live. THE BOARD names its runtimes, says which one is
// global, and says which computer each one runs on — all of it travels with the repository.
// THAT COMPUTER says what it runs the name as, in its own `~/.ai4kanban/runtimes.json`, which
// nothing here can write for another machine: a runtime pointed elsewhere shows what that
// machine reported and offers nothing to press.
//
// The pick is intent, not routing: a run still lands where it was started until #371.
//
// A board that names no runtimes has no list at all: the Runtimes tab is today's harness
// pane, said to be the board's and headed with the computer it runs on, with **Add runtime**
// on it. `readRuntimes` answers `named: false` there, so a row called `default` would put a
// name on screen that neither the board nor Cloud holds.
//
// Which runtime a flow or spec agent uses is NOT set here — `akb agent runtime for` is where
// that lives (#343), and a removal says so where it names the flows it moves.

import { useEffect, useRef, useState } from "react";
import {
  FiChevronDown,
  FiChevronRight,
  FiCloud,
  FiMonitor,
  FiPlus,
  FiServer,
} from "react-icons/fi";
import {
  addRuntimeAction,
  boardNotificationsAction,
  removeRuntimeAction,
  renameRuntimeAction,
  runtimeUsersAction,
  setGlobalRuntimeAction,
  setRuntimeComputerAction,
} from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { BoardServer, ServerRuntime } from "@/lib/notifications";
import type { AgentInfo, RuntimeView } from "@/lib/types";
import { AgentMark, HarnessPicker } from "./Configuration";
import { ConfirmationPopover } from "./confirm-popover";
import { CAPTION, CONTROL, DANGER_BTN, Group, Note, Panel, QUIET_BTN } from "./settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type RuntimesCopy = ReturnType<typeof useCopy>["configuration"]["runtimes"];

/** One machine the board knows, as both the picker and the Computers tab draw it. */
interface Computer {
  name: string;
  /** `here` is the computer the app is running on; `server` the machine that holds the
   *  board's work; `named` one the board knows only because a runtime points at it, which
   *  is the same as one it cannot reach. */
  kind: "here" | "server" | "named";
}

export function RuntimesPanel({
  agent,
  onError,
}: {
  agent: AgentInfo;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  // The whole setting as it now reads. Seeded from the page's first paint and replaced by
  // every save, so a runtime added a moment ago is on the list without a read of its own.
  const [info, setInfo] = useState(agent);
  const [tab, setTab] = useState<"runtimes" | "computers">("runtimes");
  // The one runtime that is open; every other is folded to a line. The global one when the
  // tab opens — the answer most boards are here for.
  const [open, setOpen] = useState<string | null>(agent.globalRuntime);
  // What the board's server runs each runtime as (#345). Read once when the dialog opens,
  // and again whenever the open runtime changes — on the machine that IS the server that
  // read is also what sends this computer's own resolution to Cloud, so a rebinding here
  // reaches it without waiting for the next tick. Nothing waits for it: the pane draws first.
  const [server, setServer] = useState<BoardServer | null>(null);

  const readServer = () => {
    void boardNotificationsAction()
      .then((state) => setServer(state.server))
      .catch(() => {
        // Cloud is not reachable, or this project's rules are older than the board's
        // server. Either way there is no second machine to name, and the pane says nothing
        // rather than an error about a line it was only offering to draw.
      });
  };
  useEffect(readServer, []);

  const show = (runtime: string | null) => {
    setOpen(runtime);
    readServer();
  };

  // Rules older than runtimes answer nothing about this machine, and a board with no rules
  // at all has no agents to offer. Both draw today's harness pane and stop there — no tabs
  // either, since every move on them would fail.
  if (!info.machine || !info.options.length) {
    return (
      <Group title={c.title}>
        <HarnessPicker agent={info} onError={onError} />
        <Note>{c.boardsOwn}</Note>
      </Group>
    );
  }

  const computers = knownComputers(info, server);

  return (
    <div>
      <Tabs tab={tab} onTab={setTab} c={c} />
      {tab === "computers" ? (
        <Computers computers={computers} c={c} />
      ) : !info.namedRuntimes ? (
        // The board's own harness, on a board that names no runtimes — the one runtime every
        // flow is on, which IS this setting, on the one computer this app runs on. The tab
        // above already names the pane, so the machine line is its whole heading.
        <section>
          <p className="mb-2.5 flex min-h-[30px] items-center gap-2 text-[12px] text-nb-ink-soft">
            <FiMonitor className="shrink-0 text-[13px]" aria-hidden />
            {c.runsOn(info.machine)}
          </p>
          <HarnessPicker agent={info} onError={onError} />
          <Note>{c.boardsOwn}</Note>
          <div className="mt-3">
            <AddRuntime onAdded={setInfo} onError={onError} />
          </div>
        </section>
      ) : (
        <Group title={c.listCaption}>
          {/* One block, one runtime per row: the open one carries everything that can be
              said about it, and the rest are a name and a line. */}
          <div className="overflow-hidden rounded-[12px] border border-nb-ink/12 bg-nb-paper">
            {info.runtimes.map((runtime) =>
              runtime.name === open ? (
                <OpenRuntime
                  key={runtime.name}
                  info={info}
                  view={runtime}
                  server={server}
                  computers={computers}
                  onChanged={setInfo}
                  onRenamed={setOpen}
                  onFold={() => show(null)}
                  onError={onError}
                />
              ) : (
                <FoldedRuntime
                  key={runtime.name}
                  info={info}
                  view={runtime}
                  server={server}
                  onOpen={() => show(runtime.name)}
                />
              ),
            )}
          </div>
          <div className="mt-3">
            <AddRuntime onAdded={setInfo} onError={onError} />
          </div>
        </Group>
      )}
    </div>
  );
}

// --- the two tabs -------------------------------------------------------------

function Tabs({
  tab,
  onTab,
  c,
}: {
  tab: "runtimes" | "computers";
  onTab: (tab: "runtimes" | "computers") => void;
  c: RuntimesCopy;
}) {
  const tabs = [
    ["runtimes", c.tabs.runtimes],
    ["computers", c.tabs.computers],
  ] as const;
  return (
    <div className="mb-3 flex gap-5 border-b border-nb-ink/12" role="tablist">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() => onTab(key)}
          className={`-mb-px cursor-pointer border-b-2 pb-2 text-[13.5px] font-[800] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent ${
            tab === key
              ? "border-nb-accent text-nb-ink"
              : "border-transparent text-nb-ink-soft hover:text-nb-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Every machine a runtime may be pointed at: this computer, the board's server when it is
 *  another one, and any computer a runtime already names — so a name the board can no longer
 *  place stays on the list rather than reading as a setting that changed itself. */
function knownComputers(info: AgentInfo, server: BoardServer | null): Computer[] {
  const out: Computer[] = [{ name: info.machine, kind: "here" }];
  const held = server?.attached ? server.machineName : "";
  if (held && held !== info.machine) out.push({ name: held, kind: "server" });
  for (const runtime of info.runtimes) {
    if (runtime.computer && !out.some((m) => m.name === runtime.computer)) {
      out.push({ name: runtime.computer, kind: "named" });
    }
  }
  return out;
}

const tagOf = (kind: Computer["kind"], c: RuntimesCopy): string =>
  kind === "here" ? c.thisComputer : kind === "server" ? c.server.label : c.unreachable;

const ComputerMark = ({ kind }: { kind: Computer["kind"] }) =>
  kind === "server" ? (
    <FiServer className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
  ) : (
    <FiMonitor className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
  );

function Computers({ computers, c }: { computers: Computer[]; c: RuntimesCopy }) {
  return (
    <Group title={c.computers.caption}>
      <Panel>
        {computers.map((computer) => (
          <div
            key={computer.name}
            className="flex items-center gap-2.5 border-b border-nb-ink/10 py-3 last:border-b-0"
          >
            <ComputerMark kind={computer.kind} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-[700] text-nb-ink">
              {computer.name}
            </span>
            <span className="shrink-0 text-[11.5px] text-nb-ink-soft">
              {tagOf(computer.kind, c)}
            </span>
          </div>
        ))}
      </Panel>
      <Note>{c.computers.blurb}</Note>
    </Group>
  );
}

// --- what one runtime runs as, wherever it is said ----------------------------

// The label the harness cards wear, for whatever a runtime resolved to. The board hands the
// list down, so nothing here knows a harness by name.
const labelOf = (info: AgentInfo, harness: string): string =>
  info.options.find((o) => o.name === harness)?.label ?? harness;

/** The harness itself, said by its own mark: a row is scanned for which tool it runs, and
 *  the logo is read before a word is. The name rides along as its alt and its tooltip. A
 *  harness this build ships no mark for falls back to the name. */
function HarnessMark({ info, harness }: { info: AgentInfo; harness: string }) {
  const option = info.options.find((o) => o.name === harness);
  const label = option?.label ?? harness;
  if (!option?.icon) return <span className="font-[700]">{label}</span>;
  return <AgentMark src={option.icon} size={15} name={label} />;
}

/** A harness and the model under it — the answer every "runs as" line ends with. */
function RanAs({
  info,
  harness,
  model,
}: {
  info: AgentInfo;
  harness: string;
  model?: string | null;
}) {
  const c = useCopy().configuration.runtimes;
  return (
    <span
      className="flex min-w-0 items-center gap-1.5"
      title={c.runs(labelOf(info, harness), model ?? "")}
    >
      <HarnessMark info={info} harness={harness} />
      {model ? <span className="truncate">{model}</span> : null}
    </span>
  );
}

/** The computer the board says this runtime runs on. Nothing stored is the computer the app
 *  is running on, which is what happens today — and drawing the pane never writes one. */
const computerOf = (view: RuntimeView, info: AgentInfo): string => view.computer || info.machine;

const isHere = (view: RuntimeView, info: AgentInfo): boolean =>
  computerOf(view, info) === info.machine;

/** What the machine holding the board reported about one runtime (#345) — the only answer
 *  this app has about a computer that is not this one. Undefined when that machine is this
 *  one, when nobody holds the board, or when it reported nothing for this runtime. */
function reportedBy(view: RuntimeView, info: AgentInfo, server: BoardServer | null) {
  if (!server?.attached || server.here) return undefined;
  if (computerOf(view, info) !== server.machineName) return undefined;
  return server.runtimes.find((r) => r.name === view.name);
}

/** A row says what runs, and nothing else. Nothing set here for the name is the agent it
 *  falls back to, greyed — the card below is where that is changed. A saved agent this
 *  build can't run is the one case worth words: it is a setting that stopped working. */
function RunsHere({ view, info }: { view: RuntimeView; info: AgentInfo }) {
  const c = useCopy().configuration.runtimes;
  const ran = <RanAs info={info} harness={view.harness} model={view.model} />;
  if (view.binding) return ran;
  return (
    <span className="flex min-w-0 items-center gap-1.5 opacity-55">
      {view.fallback?.was === "unknown-harness" && (
        <span className="truncate">{c.unknownAgent(view.fallback.bound ?? "")} —</span>
      )}
      {ran}
    </span>
  );
}

/** The same answer for a runtime pointed at another computer: what that machine reported,
 *  in the short form a folded row has room for. Reporting nothing is its own line — it is
 *  not the same as reporting that nothing is bound. */
function RunsThere({ reported, info }: { reported: ServerRuntime | undefined; info: AgentInfo }) {
  const c = useCopy().configuration.runtimes;
  if (!reported) return <span className="truncate">{c.server.notSaid}</span>;
  const ran = <RanAs info={info} harness={reported.harness} model={reported.model} />;
  if (!reported.fallback) return ran;
  return <span className="flex min-w-0 items-center opacity-55">{ran}</span>;
}

// --- the list -----------------------------------------------------------------

function FoldedRuntime({
  info,
  view,
  server,
  onOpen,
}: {
  info: AgentInfo;
  view: RuntimeView;
  server: BoardServer | null;
  onOpen: () => void;
}) {
  const here = isHere(view, info);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-2 border-t border-nb-ink/10 px-3.5 py-3 text-left first:border-t-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nb-accent"
    >
      <FiChevronRight className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
      <span className="shrink-0 text-[13.5px] font-[700] text-nb-ink">{view.name}</span>
      {view.global && <GlobalBadge />}
      <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] text-nb-ink-soft">
        <span className="truncate">{computerOf(view, info)}</span>
        <span aria-hidden>·</span>
        {here ? (
          <RunsHere view={view} info={info} />
        ) : (
          <RunsThere reported={reportedBy(view, info, server)} info={info} />
        )}
      </span>
    </button>
  );
}

function GlobalBadge() {
  const c = useCopy().configuration.runtimes;
  return (
    <span className="shrink-0 rounded-[5px] bg-nb-accent-soft px-1.5 py-0.5 text-[9px] font-[800] uppercase leading-none tracking-[0.06em] text-nb-accent-deep">
      {c.global}
    </span>
  );
}

// --- one runtime, open --------------------------------------------------------
// The computer heads the card, and what is under it follows from it: this computer's binding
// is the one thing that can be pressed, and another computer's is read. Above them the
// board's three moves — rename, make global, remove — each of which changes what the
// repository holds and nothing about any machine.

function OpenRuntime({
  info,
  view,
  server,
  computers,
  onChanged,
  onRenamed,
  onFold,
  onError,
}: {
  info: AgentInfo;
  view: RuntimeView;
  server: BoardServer | null;
  computers: Computer[];
  onChanged: (agent: AgentInfo) => void;
  /** A rename moves the view with it — the runtime on screen is the same one, under the
   *  name the board now holds, so it stays open rather than folding. */
  onRenamed: (to: string) => void;
  onFold: () => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const [busy, setBusy] = useState(false);
  // Which move is being confirmed, if any. One at a time: they are answers about the same
  // runtime, and two open at once would ask two questions.
  const [asking, setAsking] = useState<"rename" | "remove" | null>(null);
  const removeRef = useRef<HTMLSpanElement>(null);

  const run = async (
    move: () => Promise<{ ok: boolean; error?: string; agent?: AgentInfo }>,
    failed: string,
    after?: () => void,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await move();
      if (!res.ok || !res.agent) {
        onError?.(res.error || failed);
        return;
      }
      onChanged(res.agent);
      setAsking(null);
      after?.();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const computer = computerOf(view, info);
  const here = isHere(view, info);
  const reported = reportedBy(view, info, server);
  // What the board's server runs this same runtime as, under a runtime that runs HERE — the
  // read-only line #345 added. A runtime pointed at that server says it in the card itself,
  // and saying it twice would read as two answers.
  const theirs =
    here && server?.attached && !server.here
      ? server.runtimes.find((r) => r.name === view.name)
      : undefined;

  return (
    <div className="border-t border-nb-ink/10 px-3.5 pb-3.5 pt-3 first:border-t-0">
      <div className="mb-2 flex min-h-[30px] items-center justify-between gap-3">
        {/* The name is renamed where it is written, so nothing else moves. */}
        <span className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onFold}
            aria-label={view.name}
            className="flex min-w-0 cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
          >
            <FiChevronDown className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
            {asking !== "rename" && (
              <span className="truncate text-[13.5px] font-[800] text-nb-ink">{view.name}</span>
            )}
          </button>
          {asking === "rename" ? (
            <RenameRuntime
              runtime={view.name}
              busy={busy}
              onCancel={() => setAsking(null)}
              onRename={(to) =>
                void run(() => renameRuntimeAction(view.name, to), c.renameFailed(view.name), () =>
                  onRenamed(to),
                )
              }
            />
          ) : (
            view.global && <GlobalBadge />
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {!view.global && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => setGlobalRuntimeAction(view.name), c.globalFailed(view.name))
              }
              className={QUIET_BTN}
            >
              {c.makeGlobal}
            </button>
          )}
          <button
            type="button"
            disabled={busy || asking === "rename"}
            onClick={() => setAsking("rename")}
            className={QUIET_BTN}
          >
            {c.rename}
          </button>
          {/* The confirmation hangs off the button that opens it, so what is about to be
              taken away is read beside the name it belongs to. */}
          <span ref={removeRef} className="relative inline-flex">
            <button
              type="button"
              disabled={busy}
              aria-haspopup="dialog"
              aria-expanded={asking === "remove"}
              onClick={() => setAsking(asking === "remove" ? null : "remove")}
              className={DANGER_BTN}
            >
              {c.remove}
            </button>
            <RemoveRuntime
              open={asking === "remove"}
              anchorRef={removeRef}
              runtime={view.name}
              global={view.global}
              globalRuntime={info.globalRuntime}
              busy={busy}
              onCancel={() => setAsking(null)}
              onRemove={() =>
                void run(() => removeRuntimeAction(view.name), c.removeFailed(view.name), onFold)
              }
            />
          </span>
        </span>
      </div>

      {/* The computer heads the card, because everything on it is that computer's answer. */}
      <div className="rounded-[12px] bg-nb-sheet px-4 py-3">
        <div className="mb-4 flex items-center justify-between gap-2">
          <ComputerPicker
            value={computer}
            computers={computers}
            busy={busy}
            onPick={(to) =>
              void run(
                () => setRuntimeComputerAction(view.name, to),
                c.computerFailed(view.name),
              )
            }
          />
        </div>

        {here ? (
          // Keyed by what is bound, not just by the runtime: every field in the picker is
          // seeded once at mount, so a binding changed elsewhere needs a fresh one.
          <HarnessPicker
            key={`${view.name}|${view.binding?.harness ?? ""}`}
            agent={info}
            onError={onError}
            bind={{ runtime: view.name, view, onSaved: onChanged }}
          />
        ) : reported && !reported.fallback ? (
          // A binding belongs to the file of the machine it is on, and nothing here can write
          // another machine's — so this is what that computer reported, and nothing else.
          <div>
            <p className={`${CAPTION} text-nb-ink-soft`}>{c.thereRuns}</p>
            <div className="mt-1 text-[13px] text-nb-ink">
              <RanAs info={info} harness={reported.harness} model={reported.model} />
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">
            {reported ? c.server.notSet : c.saidNothing(computer)}
          </p>
        )}
      </div>

      {/* Pointed at another computer, the pick is intent and not routing yet (#371). */}
      {!here && <Note>{c.notRouted(computer)}</Note>}

      {/* The machine that runs this board's work, and what IT runs this runtime as (#345).
          Read-only: a binding belongs to the computer that holds it. */}
      {theirs && (
        <div className="mt-2.5 flex items-center gap-3 rounded-[12px] border border-nb-ink/12 bg-nb-wash px-4 py-2.5">
          <span className="flex w-[150px] shrink-0 items-center gap-2">
            <FiServer className="shrink-0 text-[12px] text-nb-ink-soft" aria-hidden />
            <span className="truncate text-[12px] font-[700] text-nb-ink-soft">
              {server?.machineName}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 items-center text-[12px] text-nb-ink-soft">
            {theirs.fallback ? (
              <span className="truncate">{c.server.notSet}</span>
            ) : (
              <RanAs info={info} harness={theirs.harness} model={theirs.model} />
            )}
          </span>
          <span className={`${CAPTION} flex shrink-0 items-center gap-1 text-nb-ink-soft`}>
            <FiCloud className="text-[12px]" aria-hidden />
            {c.server.label}
          </span>
        </div>
      )}
    </div>
  );
}

/** The one thing about the card that changed: a computer, picked here, where the machine
 *  this card was titled with used to be. */
function ComputerPicker({
  value,
  computers,
  busy,
  onPick,
}: {
  value: string;
  computers: Computer[];
  busy: boolean;
  onPick: (computer: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const picked = computers.find((m) => m.name === value);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Select value={value} disabled={busy} onValueChange={onPick}>
        <SelectTrigger
          aria-label={c.computer}
          className="w-[210px] shrink-0 py-1.5 text-[13px] font-[700]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ComputerMark kind={picked?.kind ?? "named"} />
            <SelectValue>{value}</SelectValue>
          </span>
        </SelectTrigger>
        <SelectContent>
          {computers.map((computer) => (
            <SelectItem
              key={computer.name}
              value={computer.name}
              hint={
                <span className="text-[11px] text-nb-ink-soft">{tagOf(computer.kind, c)}</span>
              }
            >
              <span className="flex items-center gap-2">
                <ComputerMark kind={computer.kind} />
                {computer.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}

// --- the board's three moves --------------------------------------------------

function AddRuntime({
  onAdded,
  onError,
}: {
  onAdded: (agent: AgentInfo) => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const next = name.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      const res = await addRuntimeAction(next);
      if (!res.ok || !res.agent) {
        onError?.(res.error || c.addFailed);
        return;
      }
      onAdded(res.agent);
      setName("");
      setNaming(false);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className={`${QUIET_BTN} inline-flex items-center gap-1.5`}
      >
        <FiPlus className="text-[13px]" aria-hidden />
        {c.add}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex w-[260px] shrink-0 items-center gap-2">
        <input
          autoFocus
          type="text"
          value={name}
          disabled={busy}
          placeholder={c.namePlaceholder}
          spellCheck={false}
          autoComplete="off"
          aria-label={c.add}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
            if (e.key === "Escape") setNaming(false);
          }}
          className={CONTROL}
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void add()}
          className={QUIET_BTN}
        >
          {c.save}
        </button>
        <button type="button" disabled={busy} onClick={() => setNaming(false)} className={QUIET_BTN}>
          {c.cancel}
        </button>
      </div>
      <p className="min-w-0 flex-1 self-center text-[12px] leading-relaxed text-nb-ink-soft">
        <Rich>{c.addBlurb}</Rich>
      </p>
    </div>
  );
}

/** The name, editable in place: the input sits where the heading was, with its two answers
 *  beside it. */
function RenameRuntime({
  runtime,
  busy,
  onCancel,
  onRename,
}: {
  runtime: string;
  busy: boolean;
  onCancel: () => void;
  onRename: (to: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const [name, setName] = useState(runtime);

  return (
    <>
      <input
        autoFocus
        type="text"
        value={name}
        disabled={busy}
        spellCheck={false}
        autoComplete="off"
        aria-label={c.rename}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onRename(name.trim());
          if (e.key === "Escape") onCancel();
        }}
        className={`${CONTROL} w-[150px] shrink-0 py-1 font-[700]`}
      />
      <button
        type="button"
        disabled={busy || !name.trim() || name.trim() === runtime}
        onClick={() => onRename(name.trim())}
        className={QUIET_BTN}
      >
        {c.save}
      </button>
      <button type="button" disabled={busy} onClick={onCancel} className={QUIET_BTN}>
        {c.cancel}
      </button>
    </>
  );
}

// What a removal costs, before it is made: the flows and spec agents that named this runtime
// fall back to the board's global one, and their pointers are cleared — so re-adding the
// name never quietly puts them back on it. Where that assignment is changed is a typed
// command, and the line says so.
function RemoveRuntime({
  open,
  anchorRef,
  runtime,
  global: isGlobal,
  globalRuntime,
  busy,
  onCancel,
  onRemove,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  runtime: string;
  global: boolean;
  globalRuntime: string;
  busy: boolean;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const c = useCopy().configuration.runtimes;
  const [users, setUsers] = useState<{ flows: string[]; specAgents: string[] } | null>(null);

  useEffect(() => {
    if (!open || isGlobal) return;
    let live = true;
    void runtimeUsersAction(runtime)
      .then((found) => {
        if (live) setUsers(found);
      })
      .catch(() => {
        // Nothing to build the warning from. The removal itself still says whether it
        // worked, and the line below simply doesn't name what moves.
      });
    return () => {
      live = false;
    };
  }, [runtime, isGlobal, open]);

  const moved = [...(users?.flows ?? []), ...(users?.specAgents ?? [])];

  return (
    <ConfirmationPopover
      open={open}
      anchorRef={anchorRef}
      align="right"
      confirm="filled"
      title={c.removeTitle(runtime)}
      description={
        isGlobal ? (
          <Rich>{c.removeGlobal(runtime)}</Rich>
        ) : (
          <>
            <Rich>{c.removeBlurb}</Rich>
            {users && (
              <>
                {" "}
                <Rich>
                  {moved.length ? c.removeMoves(moved.join(", "), globalRuntime) : c.removeNothing}
                </Rich>
              </>
            )}
          </>
        )
      }
      cancelLabel={c.cancel}
      confirmLabel={c.confirmRemove}
      busy={busy}
      onDismiss={onCancel}
      // The board's global runtime has nowhere to send what names it, so there is nothing
      // to confirm — the line above is the whole answer.
      onConfirm={isGlobal ? undefined : onRemove}
    />
  );
}
