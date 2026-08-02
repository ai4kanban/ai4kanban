"use client";

// Which release the board is showing, and where a release is started (#104, #115).
//
// A select, not a row of chips: a board can plan several versions and the entries
// carry counts, so the list belongs behind one control that says what you are
// looking at — the header row has to stay one line. It wears the same 36px sticker
// frame as the view switch beside it, and the sky fill the release chip on a card
// already uses, so picking a version reads as the same thing in both places.
//
// While the board is on one release the frame carries a second segment: a ⋯
// menu holding the two verbs that end that version — close it because it
// shipped (#136), or drop it because it won't (#131). They started as entries in
// the picker's own menu, but a select that does things on pick reads wrong, and
// the menu reshaped itself with the board. Now the menu always has one shape —
// what to look at, plus New release — and the verbs sit on the version they act
// on, shown only while it is unambiguous which one that is.
//
// It is on every board, including one that has never planned a version. #104 hid
// it there so a user who never plans a release is never shown one, but hiding the
// only place the feature lives means the UI can never teach it — and that is the
// state where the user most needs telling it is there. One quiet select in the
// header costs that user nothing: it says All releases and offers New release,
// and nothing asks them for a version.
//
// The last entry is always New release, on a board with none and on one with
// five: a second release is made the same way as the first. Picking it asks for
// the version id and nothing else — where a release sits in the order is the
// order it was made in, and the note beside it in the board file is free text
// nothing reads.

import { useEffect, useState } from "react";
import { FiCheckCircle, FiMoreHorizontal, FiTag, FiTrash2 } from "react-icons/fi";
import { closePlanAction, dropPlanAction, fillPlanAction } from "@/app/actions";
import type { ClosePlan } from "@/lib/close";
import type { DropPlan } from "@/lib/drop";
import type { FillPlan } from "@/lib/fill";
import type { ReleasePick } from "@/lib/release-pick";
import { Button } from "./button";
import { Dialog } from "./Dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";

// The values the entries that aren't releases carry. `readReleases` cuts a
// line at the em dash, so a release id can never hold one — not even from a
// hand edit — which makes these the values no entry can collide with. (Radix
// refuses an empty-string value, so All can't just be "".)
const ALL = "—all—";
const NEW = "—new—";

export function ReleasePicker({
  releases,
  counts,
  value,
  onChange,
  onCreate,
  onDrop,
  onCloseRelease,
}: {
  /** The open releases in ship order. Empty is a board that plans no versions. */
  releases: string[];
  /** How many open cards each release holds. The unplanned (no-release) cards
   *  get no entry of their own — they only count toward the All-releases total. */
  counts: Record<string, number>;
  value: ReleasePick;
  onChange: (r: ReleasePick) => void;
  /** Write the release (filling it with the high-priority cards with no release
   *  when `fill` says so), then put the board on it. Returns why it couldn't. */
  onCreate: (id: string, fill: boolean) => Promise<{ ok: boolean; error?: string }>;
  /** Give up on the release: no shipped record, its open cards' release
   *  cleared, its line off the list (#131). Returns why it couldn't. */
  onDrop: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** The version shipped: what it shipped written down, its open cards' release
   *  cleared, its line off the list (#136). Returns why it couldn't. */
  onCloseRelease: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [making, setMaking] = useState(false);
  // The release a confirm dialog is about — pinned when Drop or Close is picked,
  // so a board that switches under the open dialog can't move the verb onto
  // another version.
  const [dropping, setDropping] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const entry = (id: string) => `${id} (${counts[id] ?? 0})`;
  const filtering = value !== null;
  return (
    <>
      {/* The 36px sticker frame the view switch beside it wears, holding the
          picker segment — and, while the board is on one release, a divider
          and the ⋯ segment. The frame carries the fill and the ink so both
          segments read as one control going sky together. */}
      <div
        className="inline-flex h-9 items-center rounded-[9px] border-[1.5px] border-nb-ink p-0.5 shadow-[2px_2px_0_0_var(--color-nb-ink)]"
        style={{
          background: filtering ? "var(--color-nb-sky-soft)" : "var(--color-nb-paper)",
          color: filtering ? "var(--color-nb-sky-ink)" : "var(--color-nb-ink-soft)",
        }}
      >
        <Select
          value={value ?? ALL}
          onValueChange={(v) => {
            // New release is an action, not a thing to be showing. The pick
            // isn't passed on, and the select is controlled, so it stays on the
            // release the board is on — even if the user closes the dialog
            // without making one.
            if (v === NEW) {
              setMaking(true);
              return;
            }
            onChange(v === ALL ? null : v);
          }}
        >
          {/* The entry span is capped: a long version id truncates instead of
              pushing the header's other controls off a narrow screen. On a
              phone it goes icon-only like the header's other controls — but
              only while it says All releases, which is the resting state the
              sky fill already distinguishes; a picked version id stays on
              screen, since which release is filtering is the one thing the
              control has to say.

              Both segments trade the accent focus ring for the same ink wash
              they take on hover: focus comes back to the trigger when the list
              closes, and a ring the width of the sticker frame reads as the
              control shouting at you rather than as where the keyboard is. */}
          <SelectTrigger
            aria-label="Which release to show"
            title="Show one release at a time — blockers always stay on screen"
            className={`h-full w-auto gap-1.5 rounded-[6px] border-0 bg-transparent px-1.5 py-0 text-[12px] font-[700] leading-none text-inherit shadow-none focus-visible:outline-0 focus-visible:bg-nb-ink/10 [&>span]:max-w-[104px] sm:[&>span]:max-w-[168px] ${
              filtering ? "" : "max-sm:[&>span]:sr-only"
            }`}
          >
            <FiTag aria-hidden style={{ width: 13, height: 13, flex: "0 0 auto" }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All releases ({total})</SelectItem>
            {releases.map((r) => (
              <SelectItem key={r} value={r}>
                {entry(r)}
              </SelectItem>
            ))}
            {/* No entry for the cards in no release: that isn't a version, so
                it has no place in a list of versions. The unplanned cards are
                seen under All releases. */}
            {/* New release is a command in a menu of answers, and stays
                anyway: on a board that has never planned a version this menu
                is the only place the feature can teach itself. The verbs that
                end a version get no such pass — they live in the ⋯ segment. */}
            <SelectSeparator />
            <SelectItem value={NEW}>New release…</SelectItem>
          </SelectContent>
        </Select>
        {/* The verbs that end the version on screen — only there, since they
            act on what is being looked at. Close leads: shipping is how a
            version is meant to end, and giving up on it is the other answer. */}
        {filtering && (
          <>
            <span aria-hidden className="mx-0.5 h-[18px] w-px shrink-0 bg-current opacity-30" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`What to do with ${value}`}
                  title={`What to do with ${value}`}
                  className="inline-flex h-full cursor-pointer items-center rounded-[6px] px-1 text-inherit hover:bg-nb-ink/10 focus-visible:bg-nb-ink/10 focus-visible:outline-0 data-[state=open]:bg-nb-ink/10"
                >
                  <FiMoreHorizontal aria-hidden style={{ width: 14, height: 14, flex: "0 0 auto" }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* The rows don't name the version: the menu hangs off the
                    segment showing it, so saying it again is the same word
                    twice on one line. */}
                <DropdownMenuItem className="gap-2" onSelect={() => setClosing(value)}>
                  <FiCheckCircle aria-hidden className="size-[1em] shrink-0" />
                  Close release
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => setDropping(value)}>
                  <FiTrash2 aria-hidden className="size-[1em] shrink-0" />
                  Drop release
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {making && <NewReleaseDialog onCreate={onCreate} onClose={() => setMaking(false)} />}
      {dropping !== null && (
        <DropReleaseDialog id={dropping} onDrop={onDrop} onClose={() => setDropping(null)} />
      )}
      {closing !== null && (
        <CloseReleaseDialog
          id={closing}
          onCloseRelease={onCloseRelease}
          onClose={() => setClosing(null)}
        />
      )}
    </>
  );
}

// Confirm that a version shipped (#136). A close ends a plan and runs once — the
// release is off the list after it, and no second close can fix a card that was
// left out — so it never fires on one click: the dialog says what is written
// down, lists the open cards losing their release, and marks the ones with every
// todo ticked that were never archived. Those count as not shipped, and the only
// way to count them is to cancel here, archive them, and close after — so they
// are named before anything is written, where the terminal names them after.
// Only the Close button writes, and what it writes is exactly what `release
// close` writes.
function CloseReleaseDialog({
  id,
  onCloseRelease,
  onClose,
}: {
  id: string;
  onCloseRelease: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the close would record and move, read from the server as it opens. Null
  // while the answer is on its way — the Close button waits, so nothing is
  // written before the user has seen it.
  const [plan, setPlan] = useState<ClosePlan | null>(null);

  useEffect(() => {
    let gone = false;
    closePlanAction(id).then((p) => {
      if (!gone) setPlan(p);
    });
    return () => {
      gone = true;
    };
  }, [id]);

  const unarchived = plan ? plan.left.filter((c) => c.done) : [];

  const close = async () => {
    setBusy(true);
    setError(null);
    const res = await onCloseRelease(id);
    if (res.ok) {
      onClose();
      return;
    }
    setBusy(false);
    setError(res.error || "could not close the release");
  };

  return (
    <Dialog title={`Close ${id}`} width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        <strong>{id}</strong> shipped. What it shipped is written down in its summary file, and it
        comes off the list for good — a closed release can&apos;t be reopened.
      </p>
      <div className="text-[13px] leading-relaxed">
        {!plan && <p className="text-nb-ink-soft">Reading what this close records…</p>}
        {plan && (
          <p>
            {plan.shipped === 0
              ? "No card was archived under it — the summary will say nothing shipped."
              : plan.shipped === 1
                ? "1 archived card goes down as shipped."
                : `${plan.shipped} archived cards go down as shipped.`}
          </p>
        )}
        {/* The cards that look finished but were never archived, first and on
            their own: a close counts them as not shipped, and this dialog is the
            last moment they can be archived instead. */}
        {unarchived.length > 0 && (
          <div
            className="nb-panel-sm mt-3 p-2.5"
            style={{ background: "var(--color-nb-peach-soft)" }}
          >
            <p>
              {unarchived.length === 1
                ? "This open card has every todo ticked but was never archived, so it counts as not shipped."
                : `These ${unarchived.length} open cards have every todo ticked but were never archived, so they count as not shipped.`}{" "}
              Cancel and archive {unarchived.length === 1 ? "it" : "them"} first if{" "}
              {unarchived.length === 1 ? "it" : "they"} really shipped.
            </p>
            <ul className="mt-1.5 max-h-[120px] overflow-y-auto">
              {unarchived.map((c) => (
                <li key={c.id}>
                  #{c.id} {c.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan && plan.left.length === 0 && (
          <p className="mt-2">No open cards are in it — nothing moves.</p>
        )}
        {plan && plan.left.length > 0 && (
          <>
            <p className="mt-2">
              {plan.left.length === 1
                ? "This open card loses its release"
                : `These ${plan.left.length} open cards lose their release`}{" "}
              — still wanted, no longer promised to a version:
            </p>
            {/* The list scrolls in its own box rather than growing the dialog,
                like the drop's: a release with fifty cards in it would otherwise
                push Cancel and Close below the fold. */}
            <ul className="mt-1.5 max-h-[180px] overflow-y-auto text-nb-ink-soft">
              {plan.left.map((c) => (
                <li key={c.id}>
                  #{c.id} {c.title}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {error && (
        <div
          className="nb-panel-sm mt-3 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy || !plan} onClick={close}>
          {busy ? "Closing…" : "Close release"}
        </Button>
      </div>
    </Dialog>
  );
}

// Confirm giving up on a version (#131). A drop deletes a plan, so it never
// fires on one click: the dialog says what happens and lists the open cards
// losing their release — read from the server as it opens — and only the Drop
// button writes anything. The result is exactly what `release drop` does.
function DropReleaseDialog({
  id,
  onDrop,
  onClose,
}: {
  id: string;
  onDrop: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The open cards the drop sends back. Null while the answer is on its way —
  // the Drop button waits, so nothing is written before the user has seen the
  // move.
  const [plan, setPlan] = useState<DropPlan | null>(null);

  useEffect(() => {
    let gone = false;
    dropPlanAction(id).then((p) => {
      if (!gone) setPlan(p);
    });
    return () => {
      gone = true;
    };
  }, [id]);

  const drop = async () => {
    setBusy(true);
    setError(null);
    const res = await onDrop(id);
    if (res.ok) {
      onClose();
      return;
    }
    setBusy(false);
    setError(res.error || "could not drop the release");
  };

  return (
    <Dialog title={`Drop ${id}`} width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        <strong>{id}</strong> will not ship. It comes off the list with no shipped record — its
        summary file says it was dropped. Cards already archived under it stay archived.
      </p>
      <div className="text-[13px] leading-relaxed">
        {!plan && <p className="text-nb-ink-soft">Reading which cards lose their release…</p>}
        {plan && plan.left.length === 0 && (
          <p>No open cards are in it — nothing moves.</p>
        )}
        {plan && plan.left.length > 0 && (
          <>
            <p>
              {plan.left.length === 1
                ? "This open card loses its release"
                : `These ${plan.left.length} open cards lose their release`}{" "}
              — still wanted, no longer promised to a version:
            </p>
            {/* The list scrolls in its own box rather than growing the dialog:
                a release with fifty cards in it would otherwise push Cancel and
                Drop below the fold, and the sentence above already says how
                many there are. */}
            <ul className="mt-1.5 max-h-[220px] overflow-y-auto text-nb-ink-soft">
              {plan.left.map((c) => (
                <li key={c.id}>
                  #{c.id} {c.title}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {error && (
        <div
          className="nb-panel-sm mt-3 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy || !plan} onClick={drop}>
          {busy ? "Dropping…" : "Drop release"}
        </Button>
      </div>
    </Dialog>
  );
}

// Ask for the version id, and nothing else. A name the board can't take — empty,
// one it already has, or one that can't be a filename — keeps the dialog
// open with the reason under the box, so the name is fixed where it was typed
// rather than retyped from scratch. The check is the server's: it reads the
// release file as it writes, so a release a second tab added is caught too.
//
// Under the name box sits the fill toggle (#106): put the high-priority cards
// with no release in as the release is made. It is on, and how many cards it
// would move is counted under it, so the user sees the size of the move before
// making the release. Turned off — or with nothing to move — the release is made
// empty, exactly as before.
function NewReleaseDialog({
  onCreate,
  onClose,
}: {
  onCreate: (id: string, fill: boolean) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [id, setId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fill, setFill] = useState(true);
  // What the fill would do right now, read as the dialog opens. Null while the
  // answer is on its way — the toggle waits rather than showing a number that
  // could change under the user.
  const [plan, setPlan] = useState<FillPlan | null>(null);

  useEffect(() => {
    let gone = false;
    fillPlanAction().then((p) => {
      if (!gone) setPlan(p);
    });
    return () => {
      gone = true;
    };
  }, []);

  const movable = plan ? plan.fill.length : 0;

  const create = async () => {
    setSaving(true);
    setError(null);
    const res = await onCreate(id.trim(), fill && movable > 0);
    if (res.ok) {
      onClose();
      return;
    }
    setSaving(false);
    setError(res.error || "could not make the release");
  };

  return (
    <Dialog title="New release" width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        A version id, in your own words — <code>v1</code>, <code>0.5.0</code>, <code>august</code>. It
        joins the end of the list in <code>docs/kanban/releases.md</code>, and the board switches to
        it so what you write next lands in it.
      </p>
      <input
        type="text"
        value={id}
        placeholder="v1"
        spellCheck={false}
        autoComplete="off"
        autoFocus
        disabled={saving}
        onChange={(e) => setId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !saving) create();
        }}
        className="w-full rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2 font-mono text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait"
      />
      <FillToggle plan={plan} on={fill} disabled={saving} onFlip={() => setFill((v) => !v)} />
      {error && (
        <div
          className="nb-panel-sm mt-3 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={create}>
          {saving ? "Making…" : "Make release"}
        </Button>
      </div>
    </Dialog>
  );
}

// The fill toggle. The switch says the rule — every unplanned high-priority card
// goes in — and one line under it says what the rule comes to on this board:
// how many cards go in, and how many high-priority ones stay out. Counts, not
// names: a board can have fifty of these, and a list that long buries the name
// box and the buttons under cards the user isn't deciding about. The rule
// decides which ones; the only thing the user needs before making the release is
// how big the move is.
//
// With nothing unplanned to move it says so and stays off-limits — the release
// is made empty, and a board that marks nothing high priority is never told it
// did something wrong. The switch is the Configuration dialog's, at the
// dialog's text size.
function FillToggle({
  plan,
  on,
  disabled,
  onFlip,
}: {
  plan: FillPlan | null;
  on: boolean;
  disabled: boolean;
  onFlip: () => void;
}) {
  const movable = plan ? plan.fill.length : 0;
  const active = movable > 0;
  const line = !plan
    ? "Reading the unplanned high-priority cards…"
    : active
      ? "Put every unplanned high-priority card in"
      : "No unplanned card is high priority — the release starts empty";
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] leading-relaxed">{line}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on && active}
          aria-label="Put every unplanned high-priority card in"
          disabled={disabled || !active}
          onClick={onFlip}
          className={`relative cursor-pointer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-[1.5px] border-nb-ink transition-colors duration-150 disabled:cursor-default disabled:opacity-60 ${
            on && active ? "bg-nb-accent" : "bg-nb-wash"
          }`}
        >
          <span
            className={`inline-block size-[16px] rounded-full border border-nb-ink bg-nb-paper transition-transform duration-150 ${
              on && active ? "translate-x-[22px]" : "translate-x-[3px]"
            }`}
            aria-hidden
          />
        </button>
      </div>
      {/* What the rule comes to on this board, in one line. The cards left out
          are counted with the reason they share — blocked, or a group root whose
          subtasks go in on their own — so a card missing from the release is
          never a surprise, without naming any of them. */}
      {plan && (plan.fill.length > 0 || plan.skipped.length > 0) && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          {plan.fill.length === 1 ? "1 card goes in" : `${plan.fill.length} cards go in`}
          {plan.skipped.length > 0 &&
            ` — ${plan.skipped.length} more stay${plan.skipped.length === 1 ? "s" : ""} unplanned, blocked or a group root`}
          .
        </p>
      )}
    </div>
  );
}
