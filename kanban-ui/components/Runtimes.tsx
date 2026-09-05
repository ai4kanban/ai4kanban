"use client";

// Configuration → Runtimes (#344).
//
// One list, one row per runtime, opening in place onto everything that can be said about it:
// the agent it runs, that agent's settings, and the board's three moves — rename, make
// global, remove.
//
// All of it is the BOARD's, in docs/kanban/ui.config.json, so every checkout of the
// repository runs the same thing and no computer holds a setting of its own. The global
// runtime's agent is the board's own `harness`; every other runtime keeps its answer beside
// the names.
//
// A board that names no runtimes has no list at all: the Runtimes tab is today's agent pane
// with **Add runtime** on it. `readRuntimes` answers `named: false` there, so a row called
// `default` would put a name on screen the board doesn't hold.
//
// Which runtime a flow or spec agent uses is NOT set here — `akb agent runtime for` is where
// that lives (#343), and a removal says so where it names the flows it moves.

import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight, FiPlus } from "react-icons/fi";
import {
  addRuntimeAction,
  removeRuntimeAction,
  renameRuntimeAction,
  runtimeUsersAction,
  setGlobalRuntimeAction,
} from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { AgentInfo, RuntimeView } from "@/lib/types";
import { AgentMark, HarnessPicker } from "./Configuration";
import { ConfirmationPopover } from "./confirm-popover";
import { CONTROL, DANGER_BTN, Group, Note, QUIET_BTN } from "./settings";

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
  // The one runtime that is open; every other is folded to a line. The global one when the
  // pane opens — the answer most boards are here for.
  const [open, setOpen] = useState<string | null>(agent.globalRuntime);

  // A board with no rules at all has no agents to offer: it draws today's agent pane and
  // stops there, since every move below it would fail.
  if (!info.options.length) {
    return (
      <Group title={c.title}>
        <HarnessPicker agent={info} onError={onError} />
        <Note>{c.boardsOwn}</Note>
      </Group>
    );
  }

  if (!info.namedRuntimes) {
    // The board's own agent, on a board that names no runtimes — the one runtime every flow
    // is on, which IS this setting.
    return (
      <Group title={c.title}>
        <HarnessPicker agent={info} onError={onError} />
        <Note>{c.boardsOwn}</Note>
        <div className="mt-3">
          <AddRuntime onAdded={setInfo} onError={onError} />
        </div>
      </Group>
    );
  }

  return (
    <Group title={c.listCaption}>
      {/* One block, one runtime per row: the open one carries everything that can be said
          about it, and the rest are a name and a line. */}
      <div className="overflow-hidden rounded-[12px] border border-nb-ink/12 bg-nb-paper">
        {info.runtimes.map((runtime) =>
          runtime.name === open ? (
            <OpenRuntime
              key={runtime.name}
              info={info}
              view={runtime}
              onChanged={setInfo}
              onRenamed={setOpen}
              onFold={() => setOpen(null)}
              onError={onError}
            />
          ) : (
            <FoldedRuntime
              key={runtime.name}
              info={info}
              view={runtime}
              onOpen={() => setOpen(runtime.name)}
            />
          ),
        )}
      </div>
      <div className="mt-3">
        <AddRuntime onAdded={setInfo} onError={onError} />
      </div>
      <Note>{c.boardsOwn}</Note>
    </Group>
  );
}

// --- what one runtime runs as -------------------------------------------------

// The label the agent cards wear. The board hands the list down, so nothing here knows an
// agent by name.
const labelOf = (info: AgentInfo, harness: string): string =>
  info.options.find((o) => o.name === harness)?.label ?? harness;

/** The agent itself, said by its own mark: a row is scanned for which tool it runs, and the
 *  logo is read before a word is. The name rides along as its alt and its tooltip. An agent
 *  this build ships no mark for falls back to the name. */
function HarnessMark({ info, harness }: { info: AgentInfo; harness: string }) {
  const option = info.options.find((o) => o.name === harness);
  const label = option?.label ?? harness;
  if (!option?.icon) return <span className="font-[700]">{label}</span>;
  return <AgentMark src={option.icon} size={15} name={label} />;
}

/** An agent and the model under it — the answer every "runs as" line ends with. */
function RanAs({ info, harness, model }: { info: AgentInfo; harness: string; model?: string }) {
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

/** A folded row says what it runs, and nothing else. A saved agent this build can't run is
 *  the one case worth words: it is a setting that stopped working. */
function RunsAs({ view, info }: { view: RuntimeView; info: AgentInfo }) {
  const c = useCopy().configuration.runtimes;
  const ran = <RanAs info={info} harness={view.harness} model={view.model} />;
  if (!view.unknownHarness) return ran;
  return (
    <span className="flex min-w-0 items-center gap-1.5 opacity-55">
      <span className="truncate">{c.unknownAgent(view.unknownHarness)} —</span>
      {ran}
    </span>
  );
}

// --- the list -----------------------------------------------------------------

function FoldedRuntime({
  info,
  view,
  onOpen,
}: {
  info: AgentInfo;
  view: RuntimeView;
  onOpen: () => void;
}) {
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
        <RunsAs view={view} info={info} />
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
// The agent picker is the body of the card; above it the board's three moves — rename, make
// global, remove — each of which changes what the repository holds.

function OpenRuntime({
  info,
  view,
  onChanged,
  onRenamed,
  onFold,
  onError,
}: {
  info: AgentInfo;
  view: RuntimeView;
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

      <div className="rounded-[12px] bg-nb-sheet px-4 py-3">
        {/* Keyed by what it runs, not just by the runtime: every field in the picker is
            seeded once at mount, so an agent changed elsewhere needs a fresh one. */}
        <HarnessPicker
          key={`${view.name}|${view.harness}`}
          agent={info}
          onError={onError}
          bind={{ runtime: view.name, view, onSaved: onChanged }}
        />
      </div>
    </div>
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
