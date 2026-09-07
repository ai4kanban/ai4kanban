"use client";

// Configuration → Runtimes (#468).
//
// The runtimes this board owns, as one list you add to: **Global default** first, which no
// board can rename or delete, then every row the user named, then **+ Add runtime**. It is
// not a catalogue of the CLIs we ship — that catalogue is the card grid inside a row.
//
// One row is the whole answer to what a run runs as (#467): its CLI, how to reach it, its
// key and its model, with nothing inherited from anywhere. So the row's SHAPE is the board's,
// in docs/kanban/ui.config.json, and travels in git; what is this computer's is its key, in
// docs/kanban/.env under the row's own id, and the verdict beside it — whether that CLI is
// here, and whether anybody is logged into it.
//
// The default is a POSITION, not a badge: the first row is it, so there is no control
// anywhere that moves it.

import { useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiEdit3,
  FiPlus,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  addRuntimeAction,
  deleteRuntimeAction,
  loggedOutAgentsAction,
  renameRuntimeAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { AgentInfo, RuntimeView } from "@/lib/types";
import { AgentMark, Field, HarnessCards, HarnessPicker, useRuntimeName } from "./Configuration";
import { ConfirmationPopover } from "./confirm-popover";
import { CONTROL, QUIET_BTN } from "./settings";

export function RuntimesPanel({
  agent,
  onError,
}: {
  agent: AgentInfo;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  // The whole setting as it now reads. Seeded from the page's first paint and replaced by
  // every save, so a row renamed or added a moment ago is on the list without a read of its
  // own.
  const [info, setInfo] = useState(agent);
  // The one row that is open; every other is folded to a line. None when the pane opens —
  // the list itself is the answer most people are here for.
  const [open, setOpen] = useState<string | null>(null);
  // The row being added, before it has a name. It exists nowhere but here: the first name
  // saved creates it, and leaving the box empty drops it.
  const [adding, setAdding] = useState(false);
  // Which rows their own CLI says nobody is logged into (#392), by runtime id. It costs a
  // spawn per CLI, so it arrives after the list is already on screen and never holds it up.
  const [loggedOut, setLoggedOut] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    void loggedOutAgentsAction()
      .then((out) => {
        if (live) setLoggedOut(Object.fromEntries(out.map((one) => [one.runtime, one.login])));
      })
      .catch(() => {
        // A row nobody could ask about is one this pane says nothing about.
      });
    return () => {
      live = false;
    };
  }, []);

  // A new row starts on Global default's harness: it is the board's own answer to what a run
  // spawns, so the common case needs no pick before the name.
  const startHarness = info.runtimes[0]?.harness ?? info.options[0]?.name ?? "";

  const added = (fresh: AgentInfo, id: string) => {
    setInfo(fresh);
    setAdding(false);
    setOpen(id);
  };

  // Whether another row already answers to this name, which is the one refusal the row itself
  // says. It is read off the list the board handed down and matched the way the board matches
  // it, so the pane and the command never disagree about which names are free.
  const taken = (name: string, self?: string) =>
    info.runtimes.some(
      (r) => r.id !== self && r.name.toLowerCase() === name.trim().toLowerCase(),
    );

  return (
    <div className="flex flex-col">
      <div className="rounded-[12px] bg-nb-sheet">
        {info.runtimes.map((row) => (
          <Row
            key={row.id}
            info={info}
            row={row}
            open={row.id === open}
            loggedOut={loggedOut[row.id]}
            onToggle={() => setOpen(row.id === open ? null : row.id)}
            taken={taken}
            onChanged={setInfo}
            onError={onError}
          />
        ))}
        {adding && (
          <NewRow
            options={info.options}
            harness={startHarness}
            taken={taken}
            onAdded={added}
            onDrop={() => setAdding(false)}
            onError={onError}
          />
        )}
      </div>

      {/* The control names its own noun. A bare **+** beside the heading reads as adding a
          machine, which is a different question this pane does not ask. */}
      <div className="mt-2.5">
        <button
          type="button"
          className={QUIET_BTN}
          onClick={() => setAdding(true)}
          // Nothing to put a row on: a board with no copy of the rules offers no CLIs, and a
          // row with no harness is not a row the command would take.
          disabled={adding || info.options.length === 0}
        >
          <FiPlus className="text-[13px]" aria-hidden />
          {c.add}
        </button>
      </div>

      <p className="mt-2.5 max-w-[62ch] text-[12px] leading-relaxed text-nb-ink-soft">{c.footer}</p>
    </div>
  );
}

/** One of a row's own moves, as a mark rather than a word: three rows of two labelled
 *  buttons read as six controls, and the list's own answer — which runtimes this board has —
 *  is what has to be read first. The word is still there for a pointer and for a reader.
 *
 *  No frame until the pointer is on it, so the marks stay quiet down a column. The ink is the
 *  whole of what tells them apart at a glance: peach takes something away, accent commits, and
 *  the pane's own grey is everything else. */
function RowAction({
  label,
  tone = "soft",
  disabled,
  onClick,
  children,
}: {
  label: string;
  tone?: "soft" | "accent" | "danger";
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const ink = {
    soft: "text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink",
    accent: "text-nb-accent-deep hover:bg-[color-mix(in_srgb,var(--color-nb-accent-deep)_14%,transparent)]",
    danger: "text-nb-peach-ink hover:bg-nb-peach-soft",
  }[tone];
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-[7px] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-not-allowed disabled:opacity-40 ${ink}`}
    >
      {children}
    </button>
  );
}

/** What a folded row says on its right: this computer's verdict on the CLI it runs. A state,
 *  never a button — the command that answers it is inside the row. Only one can apply: a row
 *  whose binary isn't here is never probed for a login. */
function Verdict({ row, loggedOut }: { row: RuntimeView; loggedOut?: string }) {
  const c = useCopy().configuration.runtimes;
  const word = !row.installed ? c.notInstalled : loggedOut ? c.signedOut : "";
  if (!word) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-[700] text-nb-peach-ink">
      <FiAlertCircle className="shrink-0" aria-hidden />
      {word}
    </span>
  );
}

function Row({
  info,
  row,
  open,
  loggedOut,
  onToggle,
  taken,
  onChanged,
  onError,
}: {
  info: AgentInfo;
  row: RuntimeView;
  open: boolean;
  loggedOut?: string;
  onToggle: () => void;
  taken: (name: string, self?: string) => boolean;
  onChanged: (agent: AgentInfo) => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const nameOf = useRuntimeName();
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  // The name, being typed over where it is read (#468). A row's name is the one thing about
  // it that is on the folded line, so it is changed there rather than in a box the user has
  // to open the row to find. Null when nobody is renaming, which is nearly always.
  const [typed, setTyped] = useState<string | null>(null);
  const [refusal, setRefusal] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const renaming = typed !== null;

  useEffect(() => {
    box.current?.select();
  }, [renaming]);

  const startRename = () => {
    setRefusal("");
    setTyped(row.name);
  };

  const stopRename = () => {
    setRefusal("");
    setTyped(null);
  };

  /** Save the typed name. The two refusals are said under the row, where the box that has to
   *  change is; anything else goes where the pane already reports failures. */
  const rename = async () => {
    const next = (typed ?? "").trim();
    if (busy) return;
    if (next === row.name) {
      stopRename();
      return;
    }
    if (!next) {
      setRefusal(c.nameEmpty);
      return;
    }
    if (taken(next, row.id)) {
      setRefusal(c.nameTaken);
      return;
    }
    setBusy(true);
    setRefusal("");
    try {
      const res = await renameRuntimeAction(row.id, next);
      if (!res.ok || !res.agent) {
        onError?.(res.error || c.renameFailed);
        return;
      }
      setTyped(null);
      onChanged(res.agent);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await deleteRuntimeAction(row.id);
      if (!res.ok || !res.agent) {
        onError?.(res.error || c.removeFailed);
        return;
      }
      setRemoving(false);
      onChanged(res.agent);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-nb-ink/10 first:border-t-0">
      <div className={`flex items-center gap-2 px-3.5 ${open ? "pb-2 pt-3" : "py-3"}`}>
        {renaming ? (
          // The name being typed where the name is read: same line, same left edge, same face
          // and same weight, so nothing on the row moves under the press that started the
          // edit. Enter saves it and Escape puts it back.
          //
          // No filled box. The title is what is being changed, so what marks it as live is the
          // focus ring around it and nothing else — a slab of grey the width of a search bar
          // over a name this short was the loudest thing on the pane.
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {/* The chevron holds its place and nothing else: the row does not fold while its
                name is being typed. */}
            {open ? (
              <FiChevronDown className="shrink-0 text-[13px] text-nb-ink-soft/40" aria-hidden />
            ) : (
              <FiChevronRight className="shrink-0 text-[13px] text-nb-ink-soft/40" aria-hidden />
            )}
            <input
              ref={box}
              type="text"
              value={typed ?? ""}
              disabled={busy}
              spellCheck={false}
              aria-label={c.name}
              autoFocus
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void rename();
                if (e.key === "Escape") stopRename();
              }}
              className="-ml-1.5 w-[220px] shrink-0 rounded-[8px] bg-transparent px-1.5 py-0.5 text-[13.5px] font-[700] text-nb-ink outline-2 outline-offset-1 outline-nb-accent focus:outline-2 disabled:cursor-wait"
            />

            {/* Where the pencil and the bin were, so the marks do not jump across the row when
                the edit opens: the same two positions, now confirming and calling it off. */}
            <span className="flex shrink-0 items-center gap-0.5">
              <RowAction label={c.save} tone="accent" disabled={busy} onClick={() => void rename()}>
                <FiCheck className="text-[14px]" aria-hidden />
              </RowAction>
              <RowAction label={c.cancel} disabled={busy} onClick={stopRename}>
                <FiX className="text-[14px]" aria-hidden />
              </RowAction>
            </span>

            {/* What the row runs, held where it sits the rest of the time. A rename changes the
                name, and a line that rearranged itself to say so would be saying something
                else. */}
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {!open && (
                <>
                  <AgentMark src={row.icon} size={15} name={row.label} />
                  <span className="truncate font-mono text-[12.5px] text-nb-ink-soft">
                    {row.model}
                  </span>
                </>
              )}
            </span>
          </span>
        ) : (
          // Rename and Delete sit hard against the name they change, so the row says what they
          // would act on without the eye travelling to the far edge and back. The name takes
          // the width of the name — a column of them padded to one width put the buttons a
          // gap away from the short ones, which is the distance this was moved to close.
          //
          // That splits the toggle in two: the folded line still opens the row wherever it is
          // pressed, but the buttons between the halves are their own move and must not open
          // it.
          <>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="flex min-w-0 shrink cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
            >
              {open ? (
                <FiChevronDown className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
              ) : (
                <FiChevronRight className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
              )}
              <span className={`truncate text-[13.5px] ${open ? "font-[800]" : "font-[700]"}`}>
                {nameOf(row)}
              </span>
            </button>

            {/* Global default is renamed and deleted by nobody: it is what an agent naming no
                runtime runs, and the command refuses both moves anyway. */}
            {!row.fixed && (
              <span className="flex shrink-0 items-center gap-0.5">
                <RowAction label={c.rename} disabled={busy} onClick={startRename}>
                  <FiEdit3 className="text-[13px]" aria-hidden />
                </RowAction>
                <span ref={anchor} className="relative shrink-0">
                  <RowAction
                    label={c.remove}
                    tone="danger"
                    disabled={busy}
                    onClick={() => setRemoving((was) => !was)}
                  >
                    <FiTrash2 className="text-[13px]" aria-hidden />
                  </RowAction>
                  <ConfirmationPopover
                    open={removing}
                    anchorRef={anchor}
                    title={c.removeTitle(nameOf(row))}
                    description={row.agents ? c.removeBlurb(row.agents) : c.removeKeyOnly}
                    cancelLabel={c.cancel}
                    confirmLabel={c.remove}
                    busy={busy}
                    onDismiss={() => setRemoving(false)}
                    onConfirm={() => void remove()}
                  />
                </span>
              </span>
            )}

            {/* The rest of the line, and the same toggle: what this row runs, in the smallest
                words there are — and only while it is folded. It sits at the far end, away
                from the moves: what the row IS reads down one edge and what can be done to it
                down the other, so neither is read looking for the other.

                Open, the grid under it is the same answer drawn in full and drawn live, so a
                second copy up here is one more thing to read and one more thing to disagree
                with the pick below.

                The mark alone, never the CLI's name in words: the same three words down a
                column of rows says nothing. The name is on the mark, for a pointer and for a
                reader. */}
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={nameOf(row)}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-end gap-2 self-stretch text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
            >
              {!open && (
                <>
                  <AgentMark src={row.icon} size={15} name={row.label} />
                  <span className="truncate font-mono text-[12.5px] text-nb-ink-soft">
                    {row.model}
                  </span>
                </>
              )}
            </button>
          </>
        )}
        <span className="flex shrink-0 items-center gap-2">
          <Verdict row={row} loggedOut={loggedOut} />
        </span>
      </div>

      {refusal && (
        <div className="px-3.5 pb-2.5 pl-[35px]">
          <Refusal>{refusal}</Refusal>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-4 px-3.5 pb-3.5">
          {/* The CLI it runs, how to reach it and the Test — the pane's own picker, drawn
              against this row. Folding the row unmounts it, so opening one always seeds its
              fields from the row as the command reads it right then. */}
          <HarnessPicker
            agent={info}
            onError={onError}
            bind={{ runtime: row, onSaved: onChanged }}
          />
        </div>
      )}
    </div>
  );
}

/** The row **+ Add runtime** opens: a name box and the card grid, and nothing else. It is a
 *  runtime only once it is named — an id is minted from the name and never moves again, so a
 *  row created as "New runtime" would keep `…__NEW_RUNTIME` as its key line for good.
 *
 *  Leaving the row with the name still empty drops it; pressing Enter on an empty box asks
 *  for a name. */
function NewRow({
  options,
  harness,
  taken,
  onAdded,
  onDrop,
  onError,
}: {
  options: AgentInfo["options"];
  harness: string;
  taken: (name: string, self?: string) => boolean;
  onAdded: (agent: AgentInfo, id: string) => void;
  onDrop: () => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState(harness);
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  // Picking a card blurs the name box without leaving the row. Read as leaving it, an empty
  // box would drop the row before the press it was aimed at ever landed, and a filled one
  // would create the runtime on the harness picked a moment ago.
  const within = useRef(false);

  useEffect(() => {
    box.current?.focus();
  }, []);

  const create = async () => {
    const name = typed.trim();
    if (busy) return;
    if (!name) {
      setRefusal(c.nameEmpty);
      return;
    }
    if (taken(name)) {
      setRefusal(c.nameTaken);
      return;
    }
    setBusy(true);
    setRefusal("");
    try {
      const res = await addRuntimeAction(name, picked);
      if (!res.ok || !res.agent || !res.id) {
        onError?.(res.error || c.addFailed);
        return;
      }
      onAdded(res.agent, res.id);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      // A pointer press lands before the blur it causes, and is forgotten right after it.
      onPointerDownCapture={() => {
        within.current = true;
        setTimeout(() => {
          within.current = false;
        }, 0);
      }}
      // Leaving the ROW is the answer, not leaving the name box: a named row is created and
      // an unnamed one is dropped, however the focus got out. Moving between the box and the
      // cards is not leaving it — a press on unfocusable padding names nothing to compare
      // against, which is what the flag above is for.
      onBlur={(e) => {
        if (within.current || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (typed.trim()) void create();
        else onDrop();
      }}
      className="flex flex-col gap-4 border-t border-nb-ink/10 px-3.5 pb-3.5 pt-3 first:border-t-0"
    >
      <Field
        id="runtime-name-new"
        label={c.name}
        help={refusal ? <Refusal>{refusal}</Refusal> : <p>{c.newNameHelp}</p>}
      >
        <input
          ref={box}
          id="runtime-name-new"
          type="text"
          value={typed}
          disabled={busy}
          spellCheck={false}
          placeholder={c.namePlaceholder}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
            if (e.key === "Escape") onDrop();
          }}
          className={CONTROL}
        />
      </Field>

      <div className="flex flex-col gap-2.5">
        <HarnessCards
          options={options}
          picked={picked}
          disabled={busy}
          compact
          caption={c.connector}
          onPick={(option) => setPicked(option.name)}
        />
      </div>

      <p className="text-[12px] leading-relaxed text-nb-ink-soft">{c.newRowBlurb}</p>
    </div>
  );
}

/** Why a name was refused, where the box that has to change is. */
function Refusal({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-nb-peach-ink">
      <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
      {children}
    </p>
  );
}
