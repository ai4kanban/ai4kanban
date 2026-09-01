"use client";

// Which release the board is showing, and where a release is started (#104, #115).
//
// A select, not a row of chips: a board can plan several versions and the entries
// carry counts, so the list belongs behind one control that says what you are
// looking at — the header row has to stay one line. It wears the same 36px sticker
// frame as the header's other controls, and the sky fill the release chip on a card
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
// The first entry is No release — the open cards not promised to a version — and
// it is where the board rests. It used to be All releases, the whole board, and
// that is the one screen a user never needs: a card already planned into a
// version is reviewed in that version, so the default view was every one of them
// again, mixed in with the cards that still have to be placed. The list is the
// versions plus the pile they are picked from, and nothing shows twice.
//
// It is on every board, including one that has never planned a version. #104 hid
// it there so a user who never plans a release is never shown one, but hiding the
// only place the feature lives means the UI can never teach it — and that is the
// state where the user most needs telling it is there. One quiet select in the
// header costs that user nothing: on that board No release is every card, so the
// entry it rests on is the board itself, and nothing asks them for a version.
//
// The last entry is always New release, on a board with none and on one with
// five: a second release is made the same way as the first. Picking it asks
// which kind of version this is — one with a goal, or one without — and then only
// what that kind needs (#164, #165). Where a release sits in the order is the
// order it was made in, and nothing else is asked.
//
// A release's goal shows under its version id in the list, and the ⋯ menu is
// where the whole goal is read and changed. It is never required: a release made
// before goals existed, and one made on the No goal tab, simply has no second
// line and no goal in the dialog.
//
// The goal is also what a release is filled against (#165): the ⋯ menu offers
// **Fill from its goal** — an agent run that moves in the open cards shipping the
// goal and writes the ones the board is missing. It shows only on a release that
// has a goal, since there is nothing to plan against without one; the New
// release dialog's goal tab starts the same run as a version is made.

import { useEffect, useState } from "react";
import { FiCheckCircle, FiCompass, FiMoreHorizontal, FiTag, FiTarget, FiTrash2 } from "react-icons/fi";
import { closePlanAction, dropPlanAction, fillPlanAction } from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { NO_RELEASE, type ClosePlan, type DropPlan, type FillPlan } from "@/lib/types";
import type { ReleasePick } from "@/lib/release-pick";
import { Button } from "./button";
import { CHROME, SegmentDivider } from "./chrome";
import { Dialog } from "./Dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";

// The values the entries that aren't releases carry. `readReleases` cuts a
// line at the em dash, so a release id can never hold one — not even from a
// hand edit — which makes these the values no entry can collide with. (Radix
// refuses an empty-string value, so No release can't just be `NO_RELEASE`.)
const NONE = "—none—";
const NEW = "—new—";

// The goal box, in both dialogs that hold one (#164) — design.md's input rules:
// paper fill inside a hairline, ember focus ring. Prose, not a version id, so it
// is the dialogs' text size rather than the id box's mono.
const GOAL_INPUT =
  "w-full resize-y rounded-[10px] border border-nb-ink/25 bg-nb-paper px-3 py-2.5 text-[13px] leading-relaxed text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait";

// What both halves of the chip do under the pointer, under the keyboard, and
// while their menu is open: a wash of the chip's own ink (`currentColor`), so a
// sky chip washes sky and a resting one washes charcoal. It used to be a flat
// ink/10 on both, which on a blue chip reads as a grey smudge rather than as the
// chip pressing. The accent focus ring is traded for the same wash — focus comes
// back to the trigger when the list closes, and a ring the width of the sticker
// frame reads as the control shouting rather than as where the keyboard is.
const SEGMENT_WASH =
  "transition-colors duration-100 hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] focus-visible:bg-[color-mix(in_srgb,currentColor_12%,transparent)] focus-visible:outline-0 data-[state=open]:bg-[color-mix(in_srgb,currentColor_12%,transparent)]";

export function ReleasePicker({
  releases,
  goals,
  counts,
  value,
  onChange,
  onCreate,
  onPlan,
  onDrop,
  onCloseRelease,
  onSetGoal,
}: {
  /** The open releases in ship order. Empty is a board that plans no versions. */
  releases: string[];
  /** What each release is for (#164), keyed by version id. A release with no
   *  goal is absent — every screen here works over that. */
  goals: Record<string, string>;
  /** How many open cards each release holds, keyed by version id, with the empty
   *  key for the cards in no release — the count the first entry wears. */
  counts: Record<string, number>;
  value: ReleasePick;
  onChange: (r: ReleasePick) => void;
  /** Write the release with what it is for, then put the board on it. `fill`
   *  says to put cards in as it is made: a release with a goal is planned
   *  against it by an agent run (#165), one without keeps the plain
   *  high-priority rule (#106). Returns why it couldn't. */
  onCreate: (id: string, fill: boolean, goal: string) => Promise<{ ok: boolean; error?: string }>;
  /** Fill a release that already exists from its goal (#165) — the ⋯ menu's
   *  entry. It starts an agent run and returns the moment it is spawned; the
   *  board is what takes the run on, so the runs panel has it from that same
   *  moment. Returns why it couldn't start. */
  onPlan: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Give up on the release: no shipped record, its open cards' release
   *  cleared, its line off the list (#131). Returns why it couldn't. */
  onDrop: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** The version shipped: what it shipped written down, its open cards' release
   *  cleared, its line off the list (#136). Returns why it couldn't. */
  onCloseRelease: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Change what a release is for (#164). An empty goal clears it. */
  onSetGoal: (id: string, goal: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const c = useCopy().board.release;
  const [making, setMaking] = useState(false);
  // The release a confirm dialog is about — pinned when Drop or Close is picked,
  // so a board that switches under the open dialog can't move the verb onto
  // another version.
  const [dropping, setDropping] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [goalOf, setGoalOf] = useState<string | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const entry = (id: string) => `${id} (${counts[id] ?? 0})`;
  // On a version, rather than on the pile versions are picked from. It is what
  // the sky fill says and what the ⋯ segment needs: the verbs there end a
  // version, and No release is not one.
  const filtering = value !== null;
  return (
    <>
      {/* The 28px sticker frame the header's other controls wear
          (components/chrome.tsx), holding the picker segment — and, while the
          board is on one release, a divider and the ⋯ segment. The frame
          carries the fill and the ink so both segments read as one control
          going sky together. */}
      <div
        className={`inline-flex h-7 max-md:h-9 shrink-0 items-center rounded-[8px] p-0.5 ${CHROME}`}
        style={{
          background: filtering ? "var(--color-nb-sky-soft)" : "var(--color-nb-paper)",
          color: filtering ? "var(--color-nb-sky-ink)" : "var(--color-nb-ink-soft)",
        }}
      >
        <Select
          value={value ?? NONE}
          onValueChange={(v) => {
            // New release is an action, not a thing to be showing. The pick
            // isn't passed on, and the select is controlled, so it stays on the
            // release the board is on — even if the user closes the dialog
            // without making one.
            if (v === NEW) {
              setMaking(true);
              return;
            }
            onChange(v === NONE ? null : v);
          }}
        >
          {/* The entry span is capped: a long version id truncates instead of
              pushing the header's other controls off a narrow screen. On a
              phone it goes icon-only like the header's other controls — but
              only while it says No release, the resting state the sky fill
              already distinguishes; a picked version id stays on screen, since
              which release is filtering is the one thing the control has to
              say. */}
          <SelectTrigger
            aria-label={c.which}
            title={c.whichHint}
            className={`h-full w-auto gap-1.5 rounded-[6px] border-0 bg-transparent px-1.5 py-0 text-[12px] font-[700] leading-none text-inherit shadow-none [&>span]:max-w-[104px] sm:[&>span]:max-w-[168px] ${SEGMENT_WASH} ${
              filtering ? "" : "max-sm:[&>span]:sr-only"
            }`}
          >
            <FiTag aria-hidden style={{ width: 13, height: 13, flex: "0 0 auto" }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* The cards nobody has placed yet, first and always — it is the
                board's resting screen, and the pile every version below it is
                picked out of. On a board that plans no versions it is the only
                entry that shows cards, and it shows all of them. */}
            <SelectItem
              value={NONE}
              hint={
                <span className="max-w-[240px] text-[11.5px] font-[500] leading-snug text-nb-ink-soft">
                  {c.noneHint}
                </span>
              }
            >
              {c.none(counts[NO_RELEASE] ?? 0)}
            </SelectItem>
            {/* What the version is for, under its id — the one place the list
                says why these releases exist. Two lines at most: the whole goal
                is a sentence or two, and this is a dropdown, not a document —
                the ⋯ menu opens it whole. A release with no goal keeps the
                single-line entry it always had. */}
            {releases.map((r) => (
              <SelectItem
                key={r}
                value={r}
                hint={
                  goals[r] ? (
                    <span className="line-clamp-2 max-w-[240px] text-[11.5px] font-[500] leading-snug text-nb-ink-soft">
                      {goals[r]}
                    </span>
                  ) : undefined
                }
              >
                {entry(r)}
              </SelectItem>
            ))}
            {/* New release is a command in a menu of answers, and stays
                anyway: on a board that has never planned a version this menu
                is the only place the feature can teach itself. The verbs that
                end a version get no such pass — they live in the ⋯ segment. */}
            <SelectSeparator />
            <SelectItem value={NEW}>{c.new}</SelectItem>
          </SelectContent>
        </Select>
        {/* The verbs that end the version on screen — only there, since they
            act on what is being looked at. Close leads: shipping is how a
            version is meant to end, and giving up on it is the other answer.
            The segment used to break the frame's sky for ember, so the one
            place the board ends a release wouldn't be the thing nobody sees.
            It is the chip's own ink now: ember on a sky wash is the one pairing
            in the palette that fights, and it made a menu of ordinary verbs
            look like a warning. What separates the dots from the label beside
            them is the divider and the wash they light up under, which is what
            separates the two halves of any segmented control. */}
        {filtering && (
          <>
            <SegmentDivider />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={c.menu(value)}
                  title={c.menu(value)}
                  className={`inline-flex h-full cursor-pointer items-center rounded-[6px] px-1 text-inherit ${SEGMENT_WASH}`}
                >
                  <FiMoreHorizontal aria-hidden style={{ width: 14, height: 14, flex: "0 0 auto" }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* The rows don't name the version: the menu hangs off the
                    segment showing it, so saying it again is the same word
                    twice on one line. What it is for leads — it is the one
                    row you may open every day, and the two below it end the
                    version. */}
                <DropdownMenuItem className="gap-2" onSelect={() => setGoalOf(value)}>
                  <FiCompass aria-hidden className="size-[1em] shrink-0" />
                  {c.whatItIsFor}
                </DropdownMenuItem>
                {/* Filling sits right under the goal it plans against, and only
                    while there is one: a version that says nothing about itself
                    has nothing for the run to read, and the row above is where
                    that is fixed. */}
                {goals[value] && (
                  <DropdownMenuItem className="gap-2" onSelect={() => setPlanning(value)}>
                    <FiTarget aria-hidden className="size-[1em] shrink-0" />
                    {c.fillFromGoal}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="gap-2" onSelect={() => setClosing(value)}>
                  <FiCheckCircle aria-hidden className="size-[1em] shrink-0" />
                  {c.close}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => setDropping(value)}>
                  <FiTrash2 aria-hidden className="size-[1em] shrink-0" />
                  {c.drop}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {making && <NewReleaseDialog onCreate={onCreate} onClose={() => setMaking(false)} />}
      {goalOf !== null && (
        <ReleaseGoalDialog
          id={goalOf}
          goal={goals[goalOf] ?? ""}
          onSave={onSetGoal}
          onClose={() => setGoalOf(null)}
        />
      )}
      {planning !== null && (
        <PlanReleaseDialog
          id={planning}
          goal={goals[planning] ?? ""}
          onPlan={onPlan}
          onClose={() => setPlanning(null)}
        />
      )}
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

// What the release on screen is for, whole, and where it is changed (#164). The
// dropdown clamps a goal to two lines and the file keeps it on one, so this is
// the only place the words are all readable at once — which is why reading and
// editing are the same box rather than a view with an Edit button behind it.
//
// It opens on what the board already read, so there is nothing to wait for. An
// empty box clears the goal: a release with no goal is a state the board works
// over, so unsaying it has to be possible too.
function ReleaseGoalDialog({
  id,
  goal,
  onSave,
  onClose,
}: {
  id: string;
  goal: string;
  onSave: (id: string, goal: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const t = useCopy();
  const c = t.board.release.goal;
  const [text, setText] = useState(goal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await onSave(id, text);
    if (res.ok) {
      onClose();
      return;
    }
    setSaving(false);
    setError(res.error || c.saveFailed);
  };

  return (
    <Dialog title={c.title(id)} width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        <Rich>{c.blurb}</Rich>
      </p>
      <textarea
        value={text}
        rows={4}
        autoFocus
        placeholder={c.placeholder}
        disabled={saving}
        onChange={(e) => setText(e.target.value)}
        className={GOAL_INPUT}
      />
      {error && (
        <div
          className="mt-3 rounded-[12px] border border-nb-ink/12 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>
          {t.shared.cancel}
        </Button>
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? t.shared.saving : t.shared.save}
        </Button>
      </div>
    </Dialog>
  );
}

// Fill the release on screen from its goal (#165). It is an agent run, so this
// dialog is where the user reads what the run will do before one starts — the
// goal it plans against, and the two things it does with it.
//
// It starts the run and gets out of the way: the run shows in the runs panel like
// any other, can be stopped there, and its log is where what it moved, wrote and
// left out is read. Nothing here waits for it.
//
// Running it again is safe and is the point of the entry: a goal that changed
// deserves a second pass, and a pass only ever adds.
function PlanReleaseDialog({
  id,
  goal,
  onPlan,
  onClose,
}: {
  id: string;
  goal: string;
  onPlan: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const t = useCopy();
  const c = t.board.release.plan;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await onPlan(id);
    if (res.ok) {
      onClose();
      return;
    }
    setBusy(false);
    setError(res.error || c.startFailed);
  };

  return (
    <Dialog title={c.title(id)} width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        <Rich>{c.blurb(id)}</Rich>
      </p>
      {/* The goal itself, whole: it is what the run plans against, and this is
          the last moment to notice it says the wrong thing. */}
      <div className="rounded-[12px] border border-nb-ink/12 p-2.5 text-[13px] leading-relaxed" style={{ background: "var(--color-nb-sky-soft)" }}>
        {goal}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-nb-ink-soft">{c.background}</p>
      {error && (
        <div
          className="mt-3 rounded-[12px] border border-nb-ink/12 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          {t.shared.cancel}
        </Button>
        <Button size="sm" disabled={busy} onClick={start}>
          {busy ? c.starting : c.start}
        </Button>
      </div>
    </Dialog>
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
  const t = useCopy();
  const c = t.board.release.closing;
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
    setError(res.error || c.failed);
  };

  return (
    <Dialog title={c.title(id)} width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        <Rich>{c.blurb(id)}</Rich>
      </p>
      <div className="text-[13px] leading-relaxed">
        {!plan && <p className="text-nb-ink-soft">{c.reading}</p>}
        {plan && (
          <p>
            {plan.shipped === 0
              ? c.shippedNone
              : plan.shipped === 1
                ? c.shippedOne
                : c.shippedMany(plan.shipped)}
          </p>
        )}
        {/* What comes after the close, said before it (#232): an agent turns the shipped
            cards into a few plain lines at the top of the summary. A version that shipped
            nothing has nothing to write from, so it gets none and this says so. */}
        {plan && (
          <p className="mt-2 text-nb-ink-soft">
            {plan.shipped === 0 ? c.changelogNone : c.changelog}
          </p>
        )}
        {/* The cards that look finished but were never archived, first and on
            their own: a close counts them as not shipped, and this dialog is the
            last moment they can be archived instead. */}
        {unarchived.length > 0 && (
          <div
            className="mt-3 rounded-[12px] border border-nb-ink/12 p-2.5"
            style={{ background: "var(--color-nb-peach-soft)" }}
          >
            <p>
              {unarchived.length === 1 ? c.unarchivedOne : c.unarchivedMany(unarchived.length)}
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
        {plan && plan.left.length === 0 && <p className="mt-2">{c.leftNone}</p>}
        {plan && plan.left.length > 0 && (
          <>
            <p className="mt-2">
              {plan.left.length === 1 ? c.leftOne : c.leftMany(plan.left.length)}
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
          className="mt-3 rounded-[12px] border border-nb-ink/12 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          {t.shared.cancel}
        </Button>
        <Button size="sm" disabled={busy || !plan} onClick={close}>
          {busy ? c.closing : c.confirm}
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
  const t = useCopy();
  const c = t.board.release.dropping;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The archived cards that stay put and the open cards the drop sends back.
  // Null while the answer is on its way — the Drop button waits, so nothing is
  // changed before the user has seen the move.
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
    setError(res.error || c.failed);
  };

  return (
    <Dialog title={c.title(id)} width={440} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        <Rich>{c.blurb(id)}</Rich>
      </p>
      <div className="text-[13px] leading-relaxed">
        {!plan && <p className="text-nb-ink-soft">{c.reading}</p>}
        {plan && plan.archived.length === 0 && <p>{c.archivedNone}</p>}
        {plan && plan.archived.length > 0 && (
          <>
            <p>
              {plan.archived.length === 1
                ? c.archivedOne
                : c.archivedMany(plan.archived.length)}
            </p>
            <ul className="mt-1.5 max-h-[100px] overflow-y-auto text-nb-ink-soft">
              {plan.archived.map((c) => (
                <li key={c.id}>
                  #{c.id} {c.title}
                </li>
              ))}
            </ul>
          </>
        )}
        {plan && plan.left.length === 0 && <p className="mt-2">{c.leftNone}</p>}
        {plan && plan.left.length > 0 && (
          <>
            <p className="mt-2">
              {plan.left.length === 1 ? c.leftOne : c.leftMany(plan.left.length)}
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
          className="mt-3 rounded-[12px] border border-nb-ink/12 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          {t.shared.cancel}
        </Button>
        <Button size="sm" disabled={busy || !plan} onClick={drop}>
          {busy ? c.dropping : c.confirm}
        </Button>
      </div>
    </Dialog>
  );
}

// Ask for the version id, and for whichever else the kind of release being made
// needs. A name the board can't take — empty, one it already has, or one that
// can't be a filename — keeps the dialog open with the reason under the box, so
// the name is fixed where it was typed rather than retyped from scratch. The
// check is the server's: it reads the release file as it writes, so a release a
// second tab added is caught too.
//
// Two tabs over the boxes say which kind this is, because a release has two ways
// of being filled and they are different jobs, not one job with an option
// (#164, #165):
//
//   • **From a goal** — the goal box is the whole choice. Words in it mean the
//     release is planned against them: an agent run moves in the open cards that
//     ship the goal and writes the ones the board is missing. So the release
//     can't be made while the box is empty — an empty goal is not a release of
//     this kind, it is the other tab.
//   • **No goal** — no goal box, and the plain rule instead (#106): put every
//     unplanned high-priority card in, with the count of what that moves under
//     the switch. Turned off — or with nothing to move — the release is made
//     empty.
//
// There is no "Fill it from its goal" switch any more. It sat under a goal box
// that decided what it meant, so the switch and the box were one choice asked
// twice, and a user who typed a goal and left the switch alone could not tell
// which of the two had the last word. The tab says it once.
const TABS = ["goal", "plain"] as const;

type NewReleaseMode = (typeof TABS)[number];

function NewReleaseDialog({
  onCreate,
  onClose,
}: {
  onCreate: (id: string, fill: boolean, goal: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  // A version made against a goal is the one worth teaching, so it is the tab
  // the dialog opens on. Nothing is lost by it: the other tab is one click away
  // and asks for less.
  const t = useCopy();
  const c = t.board.release.make;
  const [mode, setMode] = useState<NewReleaseMode>("goal");
  const [id, setId] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fill, setFill] = useState(true);
  // What the plain rule would do right now, read as the dialog opens. Null while
  // the answer is on its way — the toggle waits rather than showing a number
  // that could change under the user. Read whichever tab is showing, so
  // switching to No goal never waits on a fetch.
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
  const planned = mode === "goal";
  // On the goal tab the goal is what the release IS, so an empty box is not a
  // release to make. On the other tab there is nothing more to ask for.
  const ready = !planned || goal.trim().length > 0;

  const create = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    // From a goal: always planned against it, and the goal goes on the line.
    // No goal: the switch, and only when it has something to move.
    const res = await onCreate(id.trim(), planned || (fill && movable > 0), planned ? goal : "");
    if (res.ok) {
      onClose();
      return;
    }
    setSaving(false);
    setError(res.error || c.failed);
  };

  return (
    <Dialog title={c.title} width={440} onClose={onClose}>
      {/* The kind strip — design.md's tab-strip pattern, the same one the Create
          task dialog wears: hairline under both tabs, bold ink on the active one
          over a short ember underline that laps the hairline. */}
      <div className="mb-4 flex gap-5 border-b border-nb-ink/12" role="tablist">
        {TABS.map((tab) => {
          const active = mode === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={saving}
              onClick={() => setMode(tab)}
              className={`relative cursor-pointer pb-2 text-[13.5px] tracking-[-0.01em] transition-colors ${
                active ? "font-[800] text-nb-ink" : "font-[600] text-nb-ink-soft hover:text-nb-ink"
              }`}
            >
              {tab === "goal" ? c.fromGoal : c.noGoal}
              {active && (
                <span
                  className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-nb-accent"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
        <Rich>{c.blurb}</Rich>
      </p>
      <input
        type="text"
        value={id}
        placeholder={c.idPlaceholder}
        spellCheck={false}
        autoComplete="off"
        autoFocus
        disabled={saving}
        onChange={(e) => setId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !saving) create();
        }}
        className="w-full rounded-[10px] border border-nb-ink/25 bg-nb-paper px-3 py-2 font-mono text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait"
      />
      {/* What the version is for, on the tab that is about it. Enter makes a
          newline here, not the release — this is prose, and the id box above is
          where Enter still submits. */}
      {planned && (
        <>
          <p className="mb-1.5 mt-3 text-[13px] leading-relaxed text-nb-ink-soft">{c.goalAsk}</p>
          <textarea
            value={goal}
            rows={3}
            placeholder={c.goalPlaceholder}
            disabled={saving}
            onChange={(e) => setGoal(e.target.value)}
            className={GOAL_INPUT}
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
            {ready ? c.goalReady : c.goalMissing}
          </p>
        </>
      )}
      {!planned && <FillToggle plan={plan} on={fill} disabled={saving} onFlip={() => setFill((v) => !v)} />}
      {error && (
        <div
          className="mt-3 rounded-[12px] border border-nb-ink/12 break-words p-2.5 text-[12px] leading-relaxed"
          style={{ background: "var(--color-nb-peach-soft)" }}
        >
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>
          {t.shared.cancel}
        </Button>
        <Button size="sm" disabled={saving || !ready} onClick={create}>
          {saving ? c.making : c.confirm}
        </Button>
      </div>
    </Dialog>
  );
}

// The fill toggle, on the No goal tab and only there (#106): every unplanned
// high-priority card goes in as the release is made, and one line under it says
// what that comes to on this board — how many cards go in, how many
// high-priority ones stay out. Counts, not names: a board can have fifty of
// these, and a list that long buries the name box and the buttons under cards
// the user isn't deciding about. With nothing unplanned to move it says so and
// stays off-limits — the release is made empty, and a board that marks nothing
// high priority is never told it did something wrong.
//
// It is a rule, not a judgment: it is all a board can do without a goal to read.
// The goal tab has no switch of its own, because there the goal box already says
// the release is planned.
//
// The switch is the Configuration dialog's, at the dialog's text size.
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
  const t = useCopy();
  const c = t.board.release.autoFill;
  const movable = plan ? plan.fill.length : 0;
  const active = movable > 0;
  const line = !plan ? c.reading : active ? c.on : c.nothingToMove;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] leading-relaxed">{line}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on && active}
          aria-label={line}
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
          {plan.fill.length === 1 ? c.goesInOne : c.goesInMany(plan.fill.length)}
          {plan.skipped.length > 0 &&
            (plan.skipped.length === 1 ? c.skippedOne : c.skippedMany(plan.skipped.length))}
          {t.shared.stop}
        </p>
      )}
    </div>
  );
}
