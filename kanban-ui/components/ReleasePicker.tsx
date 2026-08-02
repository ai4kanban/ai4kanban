"use client";

// Which release the board is showing, and where a release is started (#104, #115).
//
// A select, not a row of chips: a board can plan several versions and the entries
// carry counts, so the list belongs behind one control that says what you are
// looking at — the header row has to stay one line. It wears the same 36px sticker
// frame as the view switch beside it, and the sky fill the release chip on a card
// already uses, so picking a version reads as the same thing in both places.
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
import { FiTag } from "react-icons/fi";
import { dropPlanAction, fillPlanAction } from "@/app/actions";
import type { DropPlan } from "@/lib/drop";
import type { FillPlan } from "@/lib/fill";
import type { ReleasePick } from "@/lib/release-pick";
import { Button } from "./button";
import { Dialog } from "./Dialog";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";

// The values the action entries carry. `readReleases` cuts a line at the em
// dash, so a release id can never hold one — not even from a hand edit — which
// makes these the values no entry can collide with. (Radix refuses an
// empty-string value, so All can't just be "".)
const ALL = "—all—";
const NEW = "—new—";
const DROP = "—drop—";

export function ReleasePicker({
  releases,
  counts,
  value,
  onChange,
  onCreate,
  onDrop,
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
}) {
  const [making, setMaking] = useState(false);
  // The release the confirm dialog is about — pinned when Drop is picked, so a
  // board that switches under the open dialog can't move the drop onto another
  // version.
  const [dropping, setDropping] = useState<string | null>(null);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const entry = (id: string) => `${id} (${counts[id] ?? 0})`;
  const filtering = value !== null;
  return (
    <>
      <Select
        value={value ?? ALL}
        onValueChange={(v) => {
          // New release and Drop are actions, not things to be showing. The pick
          // isn't passed on, and the select is controlled, so it stays on the
          // release the board is on — even if the user closes the dialog without
          // doing anything.
          if (v === NEW) {
            setMaking(true);
            return;
          }
          if (v === DROP) {
            setDropping(value);
            return;
          }
          onChange(v === ALL ? null : v);
        }}
      >
        {/* The trigger wears the same 36px sticker frame as the view switch
            beside it. The entry span is capped: a long version id truncates
            instead of pushing the header's other controls off a narrow
            screen. On a phone it goes icon-only like the header's other
            controls — but only while it says All releases, which is the resting
            state the sky fill already distinguishes; a picked version id stays
            on screen, since which release is filtering is the one thing the
            control has to say. */}
        <SelectTrigger
          aria-label="Which release to show"
          title="Show one release at a time — blockers always stay on screen"
          className={`h-9 w-auto gap-1.5 rounded-[9px] px-2 py-0 text-[12px] font-[700] leading-none shadow-[2px_2px_0_0_var(--color-nb-ink)] [&>span]:max-w-[104px] sm:[&>span]:max-w-[168px] ${
            filtering ? "" : "max-sm:[&>span]:sr-only"
          }`}
          style={{
            background: filtering ? "var(--color-nb-sky-soft)" : "var(--color-nb-paper)",
            color: filtering ? "var(--color-nb-sky-ink)" : "var(--color-nb-ink-soft)",
          }}
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
          {/* No entry for the cards in no release: that isn't a version, so it
              has no place in a list of versions. The unplanned cards are seen
              under All releases. */}
          {/* Set off from the entries above: they are things to be looking at,
              these do something. Drop shows only while the board is on one
              release — it acts on the version being looked at, and giving up on
              a version is only offered where it is unambiguous which one. */}
          <SelectSeparator />
          <SelectItem value={NEW}>New release…</SelectItem>
          {filtering && <SelectItem value={DROP}>Drop {value}…</SelectItem>}
        </SelectContent>
      </Select>

      {making && <NewReleaseDialog onCreate={onCreate} onClose={() => setMaking(false)} />}
      {dropping !== null && (
        <DropReleaseDialog id={dropping} onDrop={onDrop} onClose={() => setDropping(null)} />
      )}
    </>
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
        {!plan && <p className="text-nb-ink-soft">Reading which cards go back to next…</p>}
        {plan && plan.left.length === 0 && (
          <p>No open cards are in it — nothing moves.</p>
        )}
        {plan && plan.left.length > 0 && (
          <>
            <p>
              {plan.left.length === 1 ? "This open card goes" : `These ${plan.left.length} open cards go`} back
              to <strong>next</strong> — still wanted, no longer promised to a version:
            </p>
            <ul className="mt-1.5 text-nb-ink-soft">
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
// with no release in as the release is made. It is on, and it carries the number of cards
// that is, so the user sees the move before making the release. Turned off — or
// with nothing to move — the release is made empty, exactly as before. The
// high-priority cards the fill would leave behind are listed with the test each
// one failed, so nothing is dropped silently.
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

// The fill toggle, carrying the number of cards it would move. With nothing
// unplanned to move it says so and stays off-limits — the release is made empty,
// and a board that marks nothing high priority is never told it did something
// wrong. The switch is the Configuration dialog's, at the dialog's text size.
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
    ? "Counting the high-priority cards at next…"
    : active
      ? `Put the ${movable === 1 ? "high-priority card" : `${movable} high-priority cards`} at next in`
      : "Nothing at next is high priority — the release starts empty";
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] leading-relaxed">{line}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on && active}
          aria-label="Put the high-priority cards at next in"
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
      {/* The high-priority cards the fill leaves out, each with the test
          it failed — on screen before the release is made, whether the toggle
          is on or off, so nothing is dropped silently. */}
      {plan && plan.skipped.length > 0 && (
        <ul className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          {plan.skipped.map((s) => (
            <li key={s.id}>
              #{s.id} {s.title} stays at next — {s.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
