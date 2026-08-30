"use client";

// Configuration → Runtimes (#344).
//
// Two answers, kept visibly apart. THE BOARD names its runtimes and says which one is
// global — that travels with the repository, and everyone on the board reads it. THIS
// COMPUTER says which coding tool each of those names runs as here — that lives in
// `~/.ai4kanban/runtimes.json`, outside every project, and is never shared.
//
// The list sets nothing: a row per runtime carrying the board's name for it and what this
// computer runs it as, each half labelled with who reads it. Pressing a row opens that
// runtime over the whole pane, and there the binding is the one thing that can be pressed —
// the same square harness cards and the same declared settings the board's own harness has
// always used (Configuration.tsx), only saving somewhere else.
//
// A board that names no runtimes has no list at all: the pane is today's Harness pane, said
// to be the board's, with **Add runtime** on it. `readRuntimes` answers `named: false`
// there, so a row called `default` would put a name on screen that neither the board nor
// Cloud holds.
//
// Which runtime a flow or spec agent uses is NOT set here — `akb agent runtime for` is where
// that lives (#343), and a removal says so where it names the flows it moves.

import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiChevronRight,
  FiCloud,
  FiMonitor,
  FiPlus,
} from "react-icons/fi";
import {
  addRuntimeAction,
  boardNotificationsAction,
  removeRuntimeAction,
  renameRuntimeAction,
  runtimeUsersAction,
  setGlobalRuntimeAction,
  unbindRuntimeAction,
} from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { BoardServer } from "@/lib/notifications";
import type { AgentInfo, RuntimeView } from "@/lib/types";
import { HarnessPicker } from "./Configuration";
import { Alert, CAPTION, CONTROL, Group, Note, Panel, QUIET_BTN } from "./settings";

// One runtime's name, wherever it is shown: the board holds it, so it reads as the word it
// is rather than as a sentence.
const NAME = "font-mono text-[13px] font-[800] text-nb-ink";

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
  // The runtime whose view is up, over the list. Null is the list itself.
  const [open, setOpen] = useState<string | null>(null);
  // What the board's server runs each runtime as (#345). Read once when the dialog opens,
  // and again when a runtime's view closes — on the machine that IS the server that read is
  // also what sends this computer's own resolution to Cloud, so a rebinding here reaches it
  // without waiting for the next tick. Nothing waits for it: the pane draws first.
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

  // Rules older than runtimes answer nothing about this machine, and a board with no rules
  // at all has no agents to offer. Both draw today's Harness pane and stop there.
  const manageable = typeof info.machine === "string" && info.options.length > 0;
  const view = open ? info.runtimes.find((r) => r.name === open) : undefined;

  if (view) {
    return (
      <RuntimePane
        info={info}
        view={view}
        server={server}
        onChanged={setInfo}
        onRenamed={setOpen}
        onBack={() => {
          setOpen(null);
          readServer();
        }}
        onError={onError}
      />
    );
  }

  // The board's own harness, on a board that names no runtimes — and on one whose command is
  // too old to answer, where **Add runtime** is not offered either.
  if (!manageable || !info.namedRuntimes) {
    return (
      <Group title={c.title}>
        <HarnessPicker agent={info} onError={onError} />
        <Note>{c.boardsOwn}</Note>
        {manageable && (
          <div className="mt-3">
            <AddRuntime onAdded={setInfo} onError={onError} />
          </div>
        )}
      </Group>
    );
  }

  return (
    <Group title={c.title}>
      {/* Who reads which half. The board's names go with the repository; what they run as
          stops at this machine — said once, over the column it is true of. */}
      <div className="mb-1.5 flex items-end gap-3 px-4">
        <div className="w-[150px] shrink-0">
          <p className={`${CAPTION} text-nb-ink`}>{c.boardHalf}</p>
          <p className="text-[11px] leading-[14px] text-nb-ink-soft">{c.boardHalfNote}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`${CAPTION} flex items-center gap-1.5 text-nb-ink`}>
            <FiMonitor className="shrink-0 text-[12px]" aria-hidden />
            {c.computerHalf(info.machine)}
          </p>
          <p className="text-[11px] leading-[14px] text-nb-ink-soft">{c.computerHalfNote}</p>
        </div>
      </div>

      {/* One row per runtime, and the whole row opens it — so the card is a list of names
          rather than a list of names with a button beside each. */}
      <Panel>
        {info.runtimes.map((runtime) => (
          <button
            key={runtime.name}
            type="button"
            onClick={() => setOpen(runtime.name)}
            className="flex w-full cursor-pointer items-center gap-3 border-b border-nb-ink/10 py-3 text-left last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nb-accent"
          >
            <span className="flex w-[150px] shrink-0 items-center gap-2">
              <span className={NAME}>{runtime.name}</span>
              {runtime.global && (
                <span className="rounded-[5px] bg-nb-accent-soft px-1.5 py-0.5 text-[9px] font-[800] uppercase leading-none tracking-[0.06em] text-nb-accent-deep">
                  {c.global}
                </span>
              )}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-[12.5px] ${
                runtime.binding ? "text-nb-ink" : "text-nb-ink-soft"
              }`}
            >
              {runsAs(runtime, info, c)}
            </span>
            <FiChevronRight className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
          </button>
        ))}
      </Panel>

      <Note>{c.blurb(info.machine)}</Note>

      <div className="mt-3">
        <AddRuntime onAdded={setInfo} onError={onError} />
      </div>
    </Group>
  );
}

type RuntimesCopy = ReturnType<typeof useCopy>["configuration"]["runtimes"];

// The label the harness cards wear, for whatever a runtime resolved to. The board hands the
// list down, so nothing here knows a harness by name.
const labelOf = (info: AgentInfo, harness: string): string =>
  info.options.find((o) => o.name === harness)?.label ?? harness;

// What this computer runs one runtime as, in one line, and null when the answer is simply
// its own binding. Two halves: why it isn't running its own, and what ran instead — this
// computer's binding for the global runtime, or the board's own harness where this computer
// has bound nothing at all.
function fellBackTo(runtime: RuntimeView, info: AgentInfo, c: RuntimesCopy): string {
  const label = labelOf(info, runtime.harness);
  return runtime.fallback?.ran === "global"
    ? c.ranAsGlobal(info.globalRuntime, label)
    : c.ranAsBoard(label);
}

// Why it isn't running its own — nothing bound here, or bound to a harness this build doesn't
// ship. The row and the runtime's own view say it in the same words.
function notBound(runtime: RuntimeView, c: RuntimesCopy): string {
  return runtime.fallback?.was === "unknown-harness"
    ? c.boundUnknown(runtime.fallback.bound ?? "")
    : c.notBound;
}

function runsAs(runtime: RuntimeView, info: AgentInfo, c: RuntimesCopy): string {
  if (runtime.binding) return c.runs(labelOf(info, runtime.harness), runtime.model ?? "");
  return `${notBound(runtime, c)} — ${fellBackTo(runtime, info, c)}`;
}

// --- one runtime -------------------------------------------------------------
// The binding is the only thing here that can be pressed. Above it the board's three moves —
// rename, make global, remove — each of which changes what the repository holds and nothing
// about this machine; below it the board's server, read-only.

function RuntimePane({
  info,
  view,
  server,
  onChanged,
  onRenamed,
  onBack,
  onError,
}: {
  info: AgentInfo;
  view: RuntimeView;
  server: BoardServer | null;
  onChanged: (agent: AgentInfo) => void;
  /** A rename moves the view with it — the runtime on screen is the same one, under the
   *  name the board now holds, so it stays open rather than dropping back to the list. */
  onRenamed: (to: string) => void;
  onBack: () => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const [busy, setBusy] = useState(false);
  // Which of the board's three moves is being confirmed, if any. One at a time: they are
  // three answers about the same runtime, and two open at once would ask two questions.
  const [asking, setAsking] = useState<"rename" | "remove" | null>(null);

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

  // What the board's server runs this same runtime as. Absent on the machine that IS the
  // server, on a board nobody holds, and on one whose server reported nothing for it.
  const theirs =
    server && server.attached && !server.here
      ? server.runtimes.find((r) => r.name === view.name)
      : undefined;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft transition-colors duration-100 hover:text-nb-ink"
      >
        <FiArrowLeft className="text-[13px]" aria-hidden />
        {c.back}
      </button>

      <div className="mb-2 flex min-h-[30px] items-center justify-between gap-3">
        <h4 className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-[800] text-nb-ink">{view.name}</span>
          {view.global && (
            <span className="rounded-[5px] bg-nb-accent-soft px-1.5 py-0.5 text-[9px] font-[800] uppercase leading-none tracking-[0.06em] text-nb-accent-deep">
              {c.global}
            </span>
          )}
        </h4>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsking(asking === "rename" ? null : "rename")}
            className={QUIET_BTN}
          >
            {c.rename}
          </button>
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
            disabled={busy}
            onClick={() => setAsking(asking === "remove" ? null : "remove")}
            className={QUIET_BTN}
          >
            {c.remove}
          </button>
        </span>
      </div>

      {asking === "rename" && (
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
      )}
      {asking === "remove" && (
        <RemoveRuntime
          runtime={view.name}
          global={view.global}
          globalRuntime={info.globalRuntime}
          busy={busy}
          onCancel={() => setAsking(null)}
          onRemove={() =>
            void run(() => removeRuntimeAction(view.name), c.removeFailed(view.name), onBack)
          }
        />
      )}

      {/* This computer's binding. The card names the machine it is true of, because every
          other board on it shares the same entry. */}
      <div className="rounded-[12px] border border-nb-ink/12 bg-nb-sheet px-4 py-3">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <FiMonitor className="shrink-0 text-[14px] text-nb-ink" aria-hidden />
            <span className={NAME}>{info.machine}</span>
            <span className="rounded-[5px] bg-nb-wash px-1.5 py-0.5 text-[9px] font-[800] uppercase leading-none tracking-[0.06em] text-nb-ink-soft">
              {c.thisComputer}
            </span>
          </span>
          {view.binding && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => unbindRuntimeAction(view.name), c.unbindFailed(view.name))}
              className={QUIET_BTN}
            >
              {c.unbind}
            </button>
          )}
        </div>

        {/* Nothing bound here, so nothing on the grid is pressed — and the runtime still
            runs something, which the list already says. */}
        {!view.binding && (
          <Note icon={<FiAlertCircle />}>
            {c.pickHarness(notBound(view, c), fellBackTo(view, info, c))}
          </Note>
        )}

        {/* Keyed by what is bound, not just by the runtime: Unbind above is a change the
            picker did not make, and every field in it is seeded once at mount. */}
        <HarnessPicker
          key={`${view.name}|${view.binding?.harness ?? ""}`}
          agent={info}
          onError={onError}
          bind={{ runtime: view.name, view, onSaved: onChanged }}
        />
      </div>

      {/* What the board names this runtime, and whether every flow that names none runs on
          it — under the card it is true of. */}
      <Note>
        <Rich>{c.bindingBlurb(view.name) + (view.global ? ` ${c.isGlobal}` : "")}</Rich>
      </Note>

      {/* The machine that runs this board's work, and what IT runs this runtime as (#345).
          Read-only: a binding belongs to the computer that holds it, and nothing here can
          reach that one. */}
      {theirs && (
        <div className="mt-2.5 flex items-center gap-3 rounded-[12px] border border-nb-ink/12 bg-nb-wash px-4 py-2.5">
          <span className="flex w-[150px] shrink-0 items-center gap-2">
            <FiMonitor className="shrink-0 text-[12px] text-nb-ink-soft" aria-hidden />
            <span className="truncate font-mono text-[12px] font-[700] text-nb-ink-soft">
              {server?.machineName}
            </span>
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-nb-ink-soft">
            {theirs.fallback
              ? c.server.notBound
              : c.runs(labelOf(info, theirs.harness), theirs.model ?? "")}
          </span>
          <span className={`${CAPTION} flex shrink-0 items-center gap-1 text-nb-ink-soft`}>
            <FiCloud className="text-[12px]" aria-hidden />
            {c.server.label}
          </span>
        </div>
      )}
    </>
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
          className={`${CONTROL} font-mono`}
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
    <div className="mb-3 flex items-start gap-3 rounded-[12px] border border-nb-ink/12 bg-nb-wash px-4 py-2.5">
      <div className="flex w-[260px] shrink-0 items-center gap-2">
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
          className={`${CONTROL} font-mono`}
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
      </div>
      <p className="min-w-0 flex-1 self-center text-[12px] leading-relaxed text-nb-ink-soft">
        {c.renameBlurb}
      </p>
    </div>
  );
}

// What a removal costs, before it is made: the flows and spec agents that named this runtime
// fall back to the board's global one, and their pointers are cleared — so re-adding the
// name never quietly puts them back on it. Where that assignment is changed is a typed
// command, and the line says so.
function RemoveRuntime({
  runtime,
  global: isGlobal,
  globalRuntime,
  busy,
  onCancel,
  onRemove,
}: {
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
    if (isGlobal) return;
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
  }, [runtime, isGlobal]);

  const moved = [...(users?.flows ?? []), ...(users?.specAgents ?? [])];

  return (
    <div className="mb-3">
      <Alert>
        <Rich>{isGlobal ? c.removeGlobal(runtime) : c.removeBlurb(runtime)}</Rich>
        {!isGlobal && users && (
          <>
            {" "}
            <Rich>
              {moved.length ? c.removeMoves(moved.join(", "), globalRuntime) : c.removeNothing}
            </Rich>
          </>
        )}
      </Alert>
      <div className="mt-2 flex items-center gap-2">
        {!isGlobal && (
          <button type="button" disabled={busy} onClick={onRemove} className={QUIET_BTN}>
            {c.confirmRemove}
          </button>
        )}
        <button type="button" disabled={busy} onClick={onCancel} className={QUIET_BTN}>
          {c.cancel}
        </button>
      </div>
    </div>
  );
}
