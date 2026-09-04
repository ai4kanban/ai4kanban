"use client";

// Configuration → Workspace (#317) — the workspace a Cloud board lives in, as its owner
// runs it.
//
// Three captioned groups, the same shape every other pane is built from:
// **This board** — its name, its rename, and the machines allowed to run its work.
// **Your copy** — the export, and leaving Cloud. **Ends the workspace** — the deletion,
// behind a confirmation that names what goes.
//
// The pane is only ever drawn on a Cloud board: a Local one has no workspace, and the
// sidebar leaves the entry out (components/Configuration.tsx).
//
// Two of these moves end the board on screen, so each one finishes on a panel rather than
// on a redraw: a leave says what it wrote back and offers the one commit that puts the cards
// under git again, and only then reopens the checkout; a delete says the workspace is gone
// and takes the window to the launcher, because there is no board left for it to show.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCloud, FiDownload, FiLogOut, FiServer, FiTrash2 } from "react-icons/fi";
import {
  commitCloudChangeAction,
  deleteWorkspaceAction,
  exportWorkspaceAction,
  leaveWorkspaceAction,
  removeWorkspaceNodeAction,
  renameWorkspaceAction,
  renameWorkspaceNodeAction,
  workspaceViewAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { CloudChange, WorkspaceNodeWire, WorkspaceView } from "@/lib/types";
import { ConfirmationPopover } from "./confirm-popover";
import { Alert, CAPTION, CONTROL, DANGER_BTN, Group, Loading, Note, Panel, QUIET_BTN, Row } from "./settings";

/** The app, when this board is in it. Exporting picks a folder and both exits reopen the
 *  window, and neither is something a plain browser tab can do. */
interface AppBridge {
  pickFolder(): Promise<{ path: string } | null>;
  closeProject(): Promise<void>;
}

function bridge(): AppBridge | null {
  if (typeof window === "undefined") return null;
  const app = (window as { ai4kanban?: Partial<AppBridge> }).ai4kanban;
  return app?.pickFolder && app.closeProject ? (app as AppBridge) : null;
}

/** What the pane has finished on, when it has finished on something. */
type Exit = { kind: "left" | "deleted"; cards: number; name: string; change: CloudChange | null };

export function WorkspacePanel({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.workspace;
  const [view, setView] = useState<WorkspaceView | null>(null);
  const [busy, setBusy] = useState(false);
  const [exit, setExit] = useState<Exit | null>(null);

  const load = useCallback(async () => {
    setView(await workspaceViewAction());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** One press at a time: every move here reaches the service, and a second press while one
   *  is in flight would act on a workspace the first has already changed. */
  const run = async <T,>(work: () => Promise<T>): Promise<T | null> => {
    if (busy) return null;
    setBusy(true);
    try {
      return await work();
    } finally {
      setBusy(false);
    }
  };

  if (exit) return <Left exit={exit} onError={onError} />;
  if (!view) return <Loading>{c.checking}</Loading>;

  return (
    <div className="flex flex-col gap-6">
      {view.error && <Alert>{view.error}</Alert>}

      {/* The offer going Cloud made and this checkout has not taken. It comes back here
          every time the pane opens, so declining it in onboarding costs nothing. */}
      {view.change && <Offer change={view.change} kind="go" onError={onError} onDone={load} />}

      <Group title={c.thisBoard}>
        <Panel>
          <Name view={view} busy={busy} onError={onError} onSaved={load} onRun={run} />
          <Row icon={<FiServer size={17} className="text-nb-ink-soft" />} label={c.nodes} hint={c.nodesHint}
            below={<Nodes nodes={view.nodes} busy={busy} onError={onError} onDone={load} onRun={run} />} />
        </Panel>
        <Note>{c.boundary}</Note>
      </Group>

      <Group title={c.yourCopy}>
        <Panel>
          <Export busy={busy} onError={onError} onRun={run} />
          {/* A workspace Cloud says is not this account's has nothing to write back, so
              leaving it is only taking the pointer off — which is one of the two ways out of
              a checkout whose workspace was deleted or was never this account's. A workspace
              that merely could not be reached is not that: leaving it still writes it back,
              and failing is better than dropping the pointer on a network blip. */}
          <Leave busy={busy} stranded={view.stranded} onError={onError} onLeft={setExit} onRun={run} />
        </Panel>
      </Group>

      <Group title={c.ends}>
        <Panel>
          <Delete name={view.name} busy={busy} onError={onError} onDeleted={setExit} onRun={run} />
        </Panel>
      </Group>
    </div>
  );
}

/** What every move on this pane is handed, so a press can stand the others down. */
type Run = <T>(work: () => Promise<T>) => Promise<T | null>;

// --- the board's own name ----------------------------------------------------

function Name({
  view,
  busy,
  onError,
  onSaved,
  onRun,
}: {
  view: WorkspaceView;
  busy: boolean;
  onError?: (msg: string) => void;
  onSaved: () => Promise<void>;
  onRun: Run;
}) {
  const c = useCopy().configuration.workspace;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(view.name);

  const save = async () => {
    const done = await onRun(() => renameWorkspaceAction(draft));
    if (!done) return;
    if (!done.ok) return onError?.(done.error);
    setEditing(false);
    await onSaved();
  };

  return (
    <Row
      icon={<FiCloud size={17} className="text-nb-ink-soft" />}
      label={
        <span className="inline-flex items-center gap-2">
          {view.name}
          <span className={`${CAPTION} rounded-full border border-nb-ink/20 px-2 py-[3px] text-nb-ink-soft`}>
            {c.preview}
          </span>
        </span>
      }
      hint={c.boardHint}
      below={
        editing ? (
          <div className="flex items-center gap-2">
            <input
              className={`${CONTROL} max-w-[280px]`}
              value={draft}
              autoFocus
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button type="button" className={QUIET_BTN} disabled={busy} onClick={() => void save()}>
              {c.save}
            </button>
            <button type="button" className={QUIET_BTN} onClick={() => setEditing(false)}>
              {c.cancel}
            </button>
          </div>
        ) : undefined
      }
    >
      {!editing && (
        <button
          type="button"
          className={QUIET_BTN}
          onClick={() => {
            setDraft(view.name);
            setEditing(true);
          }}
        >
          {c.rename}
        </button>
      )}
    </Row>
  );
}

// --- the machines allowed to run this board's work ---------------------------

function Nodes({
  nodes,
  busy,
  onError,
  onDone,
  onRun,
}: {
  nodes: WorkspaceNodeWire[];
  busy: boolean;
  onError?: (msg: string) => void;
  onDone: () => Promise<void>;
  onRun: Run;
}) {
  const c = useCopy().configuration.workspace;
  if (!nodes.length) return <Note>{c.noNodes}</Note>;
  return (
    <div className="rounded-[10px] border border-nb-ink/12 bg-nb-paper px-3">
      {nodes.map((node) => (
        <NodeRow key={node.id} node={node} busy={busy} onError={onError} onDone={onDone} onRun={onRun} />
      ))}
    </div>
  );
}

function NodeRow({
  node,
  busy,
  onError,
  onDone,
  onRun,
}: {
  node: WorkspaceNodeWire;
  busy: boolean;
  onError?: (msg: string) => void;
  onDone: () => Promise<void>;
  onRun: Run;
}) {
  const c = useCopy().configuration.workspace;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name || node.machineName);
  const [asking, setAsking] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);

  const rename = async () => {
    const done = await onRun(() => renameWorkspaceNodeAction(node.id, draft));
    if (!done) return;
    if (!done.ok) return onError?.(done.error);
    setEditing(false);
    await onDone();
  };

  const remove = async () => {
    const done = await onRun(() => removeWorkspaceNodeAction(node.id));
    if (!done) return;
    setAsking(false);
    if (!done.ok) return onError?.(done.error);
    await onDone();
  };

  const name = node.name || node.machineName;
  return (
    <div className="flex items-center gap-2.5 border-b border-nb-ink/8 py-2 last:border-b-0">
      <span
        className="size-[7px] shrink-0 rounded-full"
        style={{
          background: node.live
            ? "var(--color-nb-mint-ink)"
            : "color-mix(in srgb, var(--color-nb-ink) 25%, transparent)",
        }}
        aria-hidden
      />
      {editing ? (
        <input
          className={`${CONTROL} max-w-[220px] py-1 text-[13px]`}
          value={draft}
          autoFocus
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void rename();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => void rename()}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-[700]">{name}</span>
      )}
      <span className="text-[11.5px] text-nb-ink-soft">{node.live ? c.live : c.idle}</span>
      <button type="button" className={QUIET_BTN} disabled={busy} onClick={() => setEditing(true)}>
        {c.rename}
      </button>
      <span ref={anchor} className="relative">
        <button type="button" className={DANGER_BTN} disabled={busy} onClick={() => setAsking(true)}>
          {c.remove}
        </button>
        <ConfirmationPopover
          open={asking}
          anchorRef={anchor}
          align="right"
          title={c.removeTitle(name)}
          description={c.removeBlurb}
          cancelLabel={c.cancel}
          confirmLabel={c.remove}
          busy={busy}
          onDismiss={() => setAsking(false)}
          onConfirm={() => void remove()}
        />
      </span>
    </div>
  );
}

// --- the copy an owner keeps -------------------------------------------------

function Export({ busy, onError, onRun }: { busy: boolean; onError?: (msg: string) => void; onRun: Run }) {
  const c = useCopy().configuration.workspace;
  const [folder, setFolder] = useState("");
  const [wrote, setWrote] = useState("");

  const write = async (dir: string) => {
    const done = await onRun(() => exportWorkspaceAction(dir));
    if (!done) return;
    if (!done.ok) return onError?.(done.error);
    setWrote(dir);
  };

  const press = async () => {
    // In the app the folder is picked; in a plain browser tab it is typed, because a page
    // has no way to open a native dialog.
    const app = bridge();
    if (app) {
      const picked = await app.pickFolder();
      if (picked) await write(picked.path);
      return;
    }
    if (folder.trim()) await write(folder.trim());
  };

  return (
    <Row
      icon={<FiDownload size={17} className="text-nb-ink-soft" />}
      label={c.export}
      hint={c.exportHint}
      below={
        <>
          {!bridge() && (
            <input
              className={`${CONTROL} max-w-[320px]`}
              value={folder}
              placeholder={c.folderPlaceholder}
              spellCheck={false}
              onChange={(e) => setFolder(e.target.value)}
            />
          )}
          {wrote && <Note>{c.exported(wrote)}</Note>}
        </>
      }
    >
      <button type="button" className={QUIET_BTN} disabled={busy} onClick={() => void press()}>
        {c.exportButton}
      </button>
    </Row>
  );
}

function Leave({
  busy,
  stranded,
  onError,
  onLeft,
  onRun,
}: {
  busy: boolean;
  /** The workspace could not be read at all. */
  stranded: boolean;
  onError?: (msg: string) => void;
  onLeft: (exit: Exit) => void;
  onRun: Run;
}) {
  const c = useCopy().configuration.workspace;
  const [asking, setAsking] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);

  const leave = async () => {
    const done = await onRun(() => leaveWorkspaceAction(stranded));
    if (!done) return;
    setAsking(false);
    if (!done.ok) return onError?.(done.error);
    onLeft({ kind: "left", cards: done.cards, name: "", change: done.change });
  };

  return (
    <Row icon={<FiLogOut size={17} className="text-nb-ink-soft" />} label={c.leave} hint={c.leaveHint}>
      <span ref={anchor} className="relative">
        <button type="button" className={QUIET_BTN} disabled={busy} onClick={() => setAsking(true)}>
          {c.leaveButton}
        </button>
        <ConfirmationPopover
          open={asking}
          anchorRef={anchor}
          align="right"
          title={c.leaveTitle}
          description={c.leaveBlurb}
          cancelLabel={c.cancel}
          confirmLabel={c.leave}
          busy={busy}
          onDismiss={() => setAsking(false)}
          onConfirm={() => void leave()}
        />
      </span>
    </Row>
  );
}

// --- the one move that ends the workspace ------------------------------------

function Delete({
  name,
  busy,
  onError,
  onDeleted,
  onRun,
}: {
  name: string;
  busy: boolean;
  onError?: (msg: string) => void;
  onDeleted: (exit: Exit) => void;
  onRun: Run;
}) {
  const c = useCopy().configuration.workspace;
  const [asking, setAsking] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);

  const remove = async () => {
    const done = await onRun(() => deleteWorkspaceAction());
    if (!done) return;
    setAsking(false);
    if (!done.ok) return onError?.(done.error);
    onDeleted({ kind: "deleted", cards: 0, name, change: done.change });
  };

  return (
    <Row icon={<FiTrash2 size={17} className="text-nb-peach-ink" />} label={c.delete} hint={c.deleteHint}>
      <span ref={anchor} className="relative">
        <button type="button" className={DANGER_BTN} disabled={busy} onClick={() => setAsking(true)}>
          {c.deleteButton}
        </button>
        <ConfirmationPopover
          open={asking}
          anchorRef={anchor}
          align="right"
          confirm="filled"
          title={c.deleteTitle(name)}
          description={c.deleteBlurb}
          cancelLabel={c.cancel}
          confirmLabel={c.delete}
          busy={busy}
          onDismiss={() => setAsking(false)}
          onConfirm={() => void remove()}
        />
      </span>
    </Row>
  );
}

// --- the one commit each move offers -----------------------------------------

/** What going Cloud, or leaving it, left in the repository — said before it is taken, and
 *  taken as one commit carrying those three paths and nothing else the working tree holds. */
function Offer({
  change,
  kind,
  onError,
  onDone,
}: {
  change: CloudChange;
  kind: "go" | "leave";
  onError?: (msg: string) => void;
  onDone?: () => Promise<void>;
}) {
  const c = useCopy().configuration.workspace;
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const commit = async () => {
    setBusy(true);
    try {
      const done = await commitCloudChangeAction(kind);
      if (!done.ok) return onError?.(done.error);
      setTaken(true);
      await onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-nb-ink/12 bg-nb-paper px-4 py-3">
      <p className="text-[13px] font-[700]">{c.offerTitle}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
        {taken ? c.committed : kind === "go" ? c.offerBlurb(change.cards) : c.leftBlurb(change.cards)}
      </p>
      {!taken && (
        <>
          <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">{c.offerSafe}</p>
          <div className="mt-3 flex gap-2.5">
            <button type="button" className={QUIET_BTN} disabled={busy} onClick={() => void commit()}>
              {c.commit}
            </button>
            {/* Declining leaves a working checkout with a dirty git status, and the offer is
                here again the next time this pane opens. */}
            <button type="button" className={QUIET_BTN} onClick={() => setHidden(true)}>
              {c.keep}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- what the pane finishes on -----------------------------------------------

/**
 * A leave or a delete has landed, so there is no workspace left to draw.
 *
 * The two end differently, because the repository now names different things. A LEAVE has
 * written the board back, so the panel says what came back, offers the one commit that puts
 * the cards under git again, and reopens the checkout on the press after — the offer is a
 * change the user reads first, and reopening over it would take it away. A DELETE leaves
 * nothing to open, so the window goes straight to the launcher.
 */
function Left({ exit, onError }: { exit: Exit; onError?: (msg: string) => void }) {
  const c = useCopy().configuration.workspace;

  // The launcher, on the spot. Outside the app there is nothing to close to, so that case
  // falls through to the panel and its reload.
  useEffect(() => {
    if (exit.kind === "deleted") void bridge()?.closeProject();
  }, [exit.kind]);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-[10px] bg-nb-mint-soft px-3.5 py-3 text-[12.5px] font-[700] text-nb-mint-ink">
        {exit.kind === "left" ? c.left(exit.cards) : c.deleted(exit.name)}
      </p>
      {exit.kind === "left" && exit.change && (
        <Offer change={exit.change} kind="leave" onError={onError} />
      )}
      <div>
        <button type="button" className={QUIET_BTN} onClick={() => window.location.reload()}>
          {c.reopen}
        </button>
      </div>
    </div>
  );
}
