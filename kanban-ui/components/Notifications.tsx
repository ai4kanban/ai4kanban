"use client";

// The notification center (#319) — the bell in the top row, and the rail it opens down the
// right of the window.
//
// The bell stands on its own beside Chat (#807), not inside the tool cluster: it is the one
// control in the row that changes by itself and waits for a hand, and the cluster is where
// the board's machinery is looked at. The two rails share the right side, so the two buttons
// that fold them sit together.
//
// Its weight follows its state rather than a standing colour: empty it is the same ghost
// block as Chat, unread it fills with ember and carries the count in white. New task stays
// the only permanently lit button in the row, so the bell takes a step lighter than its
// orange.
//
// At phone width it keeps the segment shape it had (`tool`): the cluster there holds it
// alone, and the count rides INSIDE the segment because a badge on a tool's shoulder would
// be cut in half by the frame.
//
// The rail is the chat rail's own place, and the right side holds one at a time — opening
// this folds that. A row is the card's number and title with the event's name and how long
// ago it changed under it, and nothing else: opening it opens that card's own page, because
// a second page drawn for an event would only duplicate the card's. The time is also what
// says the list runs newest first, so the order takes no heading of its own.
//
// Every row is the OPEN board's — the rules scope them, so no row needs to name a board and
// none of them leads out of the project. A board you are not looking at reaches you as a
// system notification instead.
//
// What gets a row is what is waiting for a person — a card to decide, how a delivery that
// person approved ended, and a run of this board's own that stopped short (#809). The rules
// decide the first two (`onRail`), so the rail and the system notifications can never
// disagree about what an interruption is; the third is the board's own and needs no account
// behind it, which is why a board that has never touched Cloud still has a rail worth
// opening. A run row leads to the run log rather than to a card page: the row is about one
// run, and a card page cannot say which of its runs went wrong.
//
// It draws two ends as carefully as the list: nothing waiting, and notifications off for
// this board. Both say what would fill it, and the off state names where to turn it on. Every
// one of them is about Cloud, so a rail holding rows of its own draws none of them.
//
// One line sits above the rows when a scope change has just filled them (#451): those cards
// were already waiting, so they arrive read and raise nothing, and the line is the whole of
// what says so. It goes when the rail is folded.
//
// Two small tabs beside the title split the list (#613): **To do** is everything that wants a
// person, **Landed** the record of deliveries that succeeded. A success is worth finding and
// worth nobody's attention, so it neither counts in the bell nor sits in the way of the card
// asking a question. The tab dots itself when it holds something new and switching to it
// clears the dot — the same move as marking that tab read, so there is no second piece of
// state saying which tab has been looked at. The tabs do not remember: the rail opens on
// **To do** every time, rather than on last week's successes.

import { useEffect, useState } from "react";
import { FiBell, FiBellOff, FiCheck, FiChevronRight, FiSlash, FiX } from "react-icons/fi";
import { boardNotificationsAction, watchReleaseAction } from "@/app/actions";
import type { NotificationsCopy } from "@/i18n/notifications/types";
import { useCopy } from "@/i18n/use-copy";
import { useBell } from "@/lib/card-event";
import type { BellRail } from "@/lib/bell-rail";
import type { NotificationRow } from "@/lib/notifications";
import { ALL_RELEASES, notificationGroup, type CloudEventState, type NotificationGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { HAIRLINE, TOOL_BTN } from "./chrome";
import { Loading } from "./settings";

/**
 * The bell, and its unread count beside it.
 *
 * Nothing unread: the ghost block Chat wears, icon-only. Something unread: the whole button
 * fills with ember and the count sits in white beside the bell — the one thing in the row
 * that says "there is something for you". It does not glow when it is empty, so that it
 * still means something when it does.
 *
 * `tool` is the phone's shape (#357): a segment of the cluster, the wash rather than the
 * fill, since a filled segment inside a shared frame is a button trying to leave its box.
 */
export function BellButton({ tool = false }: { tool?: boolean }) {
  const c = useCopy().notifications;
  const rail = useBell();
  if (!rail) return null;
  const { unread } = rail.center;
  const lit = unread > 0;
  const label = lit ? c.bellUnread(unread) : c.bell;
  if (tool) {
    return (
      <button
        type="button"
        aria-label={label}
        data-tip={label}
        aria-pressed={rail.open}
        onClick={rail.toggle}
        // The count rides inside the segment, so the segment grows rather than a badge on
        // the frame's edge breaking it.
        className={cn(TOOL_BTN, lit && "w-auto gap-1 px-2")}
        style={
          lit
            ? { background: "var(--color-nb-accent-soft)", color: "var(--color-nb-accent-deep)" }
            : rail.open
              ? { background: "color-mix(in srgb, var(--color-nb-ink) 8%, transparent)" }
              : undefined
        }
      >
        <FiBell className="text-[14px]" aria-hidden />
        {lit && <span className="text-[11.5px] font-[800] leading-none">{unread}</span>}
      </button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="xs"
      // Icon-only while empty, so the row spends no width on a control with nothing to
      // say; the count is what widens it.
      className={cn("shrink-0", lit ? "gap-1 px-2" : "w-7 px-0")}
      aria-label={label}
      aria-pressed={rail.open}
      onClick={rail.toggle}
      style={
        lit
          ? // A step lighter than New task's ember: the row keeps one button that is always
            // orange, and this one only borrows the colour while it is holding something.
            { background: "color-mix(in srgb, var(--color-nb-accent) 88%, white)", color: "#fff" }
          : rail.open
            ? { background: "var(--color-nb-accent-soft)" }
            : undefined
      }
    >
      <FiBell className="text-[14px]" aria-hidden />
      {lit && <span className="text-[11.5px] font-[800] leading-none">{unread}</span>}
    </Button>
  );
}

/** The rail itself. Drawn by the window in whichever shape fits — a panel beside the body,
 *  or a cover over it — with the same contents either way. */
export function BellPane({ rail }: { rail: BellRail }) {
  const c = useCopy().notifications;
  const { center } = rail;
  const [tab, setTab] = useState<NotificationGroup>("todo");
  // The rail draws what is waiting for a person. `center.rows` carries every live event
  // because the card page reads its own out of the same list.
  const rows = center.rows.filter((row) => row.onRail !== false);
  // The rules' own call, so the tabs and the bell's count can never split a row two ways.
  // Rules older than the tabs still hand back a state, which is all this reads.
  const shown = rows.filter((row) => notificationGroup(row.state as CloudEventState) === tab);
  const landedNew = rows.some(
    (row) => row.unread && notificationGroup(row.state as CloudEventState) === "landed",
  );
  const unread = shown.filter((row) => row.unread).length;
  // Switching to a tab is reading it: the dot and the read marks are one thing.
  const pick = (next: NotificationGroup) => {
    setTab(next);
    if (next === "landed") void rail.readAll("landed");
  };
  // Whether there is a list to split rather than an end to draw. A board with rows has one
  // however it got them: this board's own runs fill the rail with no account behind them
  // (#809), so being signed out is no longer an answer on its own.
  const live =
    rows.length > 0 || (rail.ready && !center.unavailable && center.signedIn && center.enabled);
  return (
    <div className="flex h-full flex-col overflow-hidden py-2 pl-1 pr-3 max-md:pl-3">
      <Head
        c={c}
        silenced={center.silenced}
        onFold={rail.fold}
        tabs={live ? { tab, landedNew, pick } : null}
      />
      {/* Before the first read lands the rail has been told nothing — least of all that
          nobody is signed in. It says it is looking. */}
      {/* Every end below is about Cloud, and none of them is the whole truth once this board
          has rows of its own. So a rail with something on it draws the list, and the ends are
          what is left to say when there is nothing. */}
      {!live && !rail.ready ? (
        <div className="flex flex-1 items-center justify-center">
          <Loading>{c.checking}</Loading>
        </div>
      ) : !live && center.unavailable ? (
        <Empty
          icon={<FiBellOff size={20} aria-hidden />}
          title={c.unavailable}
          body={center.unavailable}
        />
      ) : !live && !center.signedIn ? (
        <Empty
          icon={<FiBellOff size={20} aria-hidden />}
          title={c.signedOut.title}
          body={c.signedOut.body}
          hint={c.signedOut.hint}
        />
      ) : !center.enabled && rows.length === 0 ? (
        <Empty
          icon={<FiBellOff size={20} aria-hidden />}
          title={c.noRelease.title}
          body={c.noRelease.body}
        />
      ) : (
        <>
          {/* The watched release closed, so the filling stopped. The prompt is here rather
              than only in Configuration, because here is where it stopped. */}
          {center.enabled && !center.release && <PickRelease c={c} onPicked={rail.refresh} />}
          {/* The scope just moved and brought cards in (#451). One line above the rows it
              filled, saying why none of them raised anything. */}
          {rail.filled && (
            <div className="mx-1 mb-2 shrink-0 rounded-[9px] bg-nb-sky-soft px-3 py-2">
              <p className="text-[11.5px] font-[700] leading-[16px] text-nb-sky-ink">
                {c.filled(
                  rail.filled.release === ALL_RELEASES ? c.everyRelease : rail.filled.release,
                  rail.filled.cards,
                )}
              </p>
            </div>
          )}
          {shown.length === 0 ? (
            <Empty
              icon={<FiBell size={20} aria-hidden />}
              title={tab === "landed" ? c.emptyLanded.title : c.empty.title}
              body={tab === "landed" ? c.emptyLanded.body : c.empty.body}
            />
          ) : (
            <>
              {/* How many are waiting in THIS tab, and the one move over it: empty its count
                  without opening anything, leaving the other tab where it stands. The two ends of one bar — the state on the left
                  where the rows' own ink starts, the action on the right where the header's
                  buttons are — so the chrome reads as two columns rather than a ragged stack.
                  The list needs no heading of its own: every row wears its time. */}
              {unread > 0 && (
                <div
                  className="flex h-[26px] shrink-0 items-center justify-between px-2"
                  style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                >
                  <span className="text-[11.5px] font-[700] text-nb-ink-soft">
                    {c.newCount(unread)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void rail.readAll(tab)}
                    className="-mr-1.5 inline-flex cursor-pointer items-center gap-1 rounded-[7px] px-1.5 py-0.5 text-[11.5px] font-[700] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_7%,transparent)] hover:text-nb-ink"
                  >
                    <FiCheck size={11} aria-hidden />
                    {c.markAllRead}
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {shown.map((row) => (
                  <Row
                    key={row.eventId}
                    row={row}
                    c={c}
                    onOpen={() => void rail.openRow(row.eventId)}
                  />
                ))}
              </div>
            </>
          )}
          {center.error && (
            <p className="px-2 pt-2 text-[11.5px] leading-[16px] text-nb-ink-soft">
              {c.unreachable(center.error)}
            </p>
          )}
          {/* Changes this machine gave up on sending (#329). Said here because this is where
              Cloud's state is already reported, and said plainly: the rows above may be
              behind the board, and the board is the one that is right. */}
          {!!center.unsent && (
            <p className="px-2 pt-2 text-[11.5px] leading-[16px] text-nb-peach-ink">
              {c.unsent(center.unsent)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** The rail's title row: what this is, which half of it is on screen, and the one way out.
 *  The count is not here — it belongs with the button that empties it, over the list it
 *  counts. The title gives way first when the rail is dragged narrow: the tabs are a control
 *  and the word above them is not. */
function Head({
  c,
  silenced,
  onFold,
  tabs,
}: {
  c: NotificationsCopy;
  silenced: boolean;
  onFold: () => void;
  /** Null while the rail is drawing an end rather than a list — there is nothing to split. */
  tabs: { tab: NotificationGroup; landedNew: boolean; pick: (next: NotificationGroup) => void } | null;
}) {
  return (
    <div className="mb-1 flex h-[30px] shrink-0 items-center gap-2 px-2">
      <FiBell size={13} className="shrink-0" aria-hidden />
      <span className="truncate text-[12.5px] font-[700] text-nb-ink">{c.title}</span>
      {tabs && (
        <div className="flex shrink-0 items-center gap-0.5" role="tablist">
          <Tab label={c.tabs.todo} on={tabs.tab === "todo"} onPick={() => tabs.pick("todo")} />
          <Tab
            label={c.tabs.landed}
            on={tabs.tab === "landed"}
            onPick={() => tabs.pick("landed")}
            dot={tabs.landedNew && tabs.tab !== "landed" ? c.tabNew : undefined}
          />
        </div>
      )}
      {/* Pinned right together, so the silencing note never drifts into the middle of the
          row when both it and the tabs are up. */}
      <div className="-mr-1 ml-auto flex shrink-0 items-center gap-2">
        {/* The machine's silencing switch is a fact worth stating where its effect is felt:
            the bell keeps filling and nothing interrupts. */}
        {silenced && (
          <span
            className="nb-tip inline-flex items-center gap-1 text-[11px] font-[700] text-nb-ink-soft"
            tabIndex={0}
            data-tip={c.silencedTip}
          >
            <FiSlash size={11} aria-hidden />
            {c.silenced}
          </span>
        )}
        <button
          type="button"
          aria-label={c.close}
          onClick={onFold}
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-[7px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_7%,transparent)] hover:text-nb-ink"
        >
          <FiX size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** One tab. Small, quiet, and the same shape as the tool buttons in the top row — the pair
 *  is a switch between two lists, not a heading. The dot is what says the other one holds
 *  something new, and it is read out loud as well as drawn. */
function Tab({
  label,
  on,
  onPick,
  dot,
}: {
  label: string;
  on: boolean;
  onPick: () => void;
  /** What the dot means, said for a reader who cannot see it. Absent draws no dot. */
  dot?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      aria-label={dot ? `${label} · ${dot}` : undefined}
      onClick={onPick}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-[7px] px-1.5 py-[3px] text-[11.5px] font-[700] ${
        on
          ? "text-nb-ink"
          : "text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_7%,transparent)] hover:text-nb-ink"
      }`}
      style={on ? { background: "color-mix(in srgb, var(--color-nb-ink) 8%, transparent)" } : undefined}
    >
      {label}
      {dot && (
        <span
          aria-hidden
          className="size-[5px] shrink-0 rounded-full"
          style={{ background: "var(--color-nb-accent)" }}
        />
      )}
    </button>
  );
}

/** One row of this board's: the card's number and title, the event's name and how long ago it
 *  changed under it, and nothing else. The time is what says the list runs newest first, so
 *  the order needs no heading of its own. Unread is an accent dot and ink-weight text; read is
 *  the soft ink everything settled wears. */
function Row({ row, c, onOpen }: { row: NotificationRow; c: NotificationsCopy; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer items-start gap-2 px-2 py-[9px] text-left hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)]"
      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <span
        aria-hidden
        className="mt-[6px] size-[6px] shrink-0 rounded-full"
        style={{ background: row.unread ? "var(--color-nb-accent)" : "transparent" }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`line-clamp-2 text-[12.5px] leading-[17px] ${row.unread ? "font-[700] text-nb-ink" : "font-[500] text-nb-ink-soft"}`}
        >
          <span
            className={`font-mono text-[11.5px] font-[700] ${row.unread ? "text-nb-accent-deep" : "text-nb-ink-soft"}`}
          >
            #{row.taskId}
          </span>{" "}
          {row.taskTitle}
        </span>
        <span
          className={`mt-[3px] flex items-center gap-1.5 text-[11.5px] font-[700] ${row.unread ? "text-nb-accent-deep" : "text-nb-ink-soft"}`}
        >
          {row.label}
          <span aria-hidden className="text-nb-ink-soft/50">
            ·
          </span>
          <span className="shrink-0 font-[500] text-nb-ink-soft">{ago(row.changedAt, c)}</span>
        </span>
      </span>
      <FiChevronRight className="mt-[3px] shrink-0 text-nb-ink-soft/60" size={13} aria-hidden />
    </button>
  );
}

/** How long ago a row changed. Read off the clock at render, which the poll re-runs every
 *  few seconds while the rail is up. */
function ago(changedAt: string, c: NotificationsCopy): string {
  const at = Date.parse(changedAt);
  if (Number.isNaN(at)) return "";
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 45) return c.justNow;
  const m = Math.round(s / 60);
  if (m < 60) return c.minutesAgo(m);
  const h = Math.round(m / 60);
  if (h < 24) return c.hoursAgo(h);
  return c.daysAgo(Math.round(h / 24));
}

/** The watched release closed. One line and what to watch instead, where the filling stopped
 *  — the same choice Configuration offers, so nobody has to remember a version id to type.
 *  **All** leads, and is the one answer a board with no open release left still has. */
function PickRelease({ c, onPicked }: { c: NotificationsCopy; onPicked: () => void }) {
  const [releases, setReleases] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void boardNotificationsAction().then((state) => setReleases(state.releases));
  }, []);

  const watch = async (release: string) => {
    if (busy || !release) return;
    setBusy(true);
    setError(null);
    try {
      const done = await watchReleaseAction(release);
      if (!done.ok) setError(done.error ?? c.closed.failed);
      else onPicked();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-1 mb-2 rounded-[9px] bg-nb-peach-soft px-3 py-2.5">
      <p className="text-[12px] font-[800] text-nb-peach-ink">{c.closed.title}</p>
      <p className="mt-1 text-[11.5px] leading-[16px] text-nb-ink">{c.closed.body}</p>
      {releases && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" disabled={busy} onClick={() => void watch(ALL_RELEASES)}>
            {c.closed.all}
          </Button>
          {releases.map((release) => (
            <Button key={release} size="sm" disabled={busy} onClick={() => void watch(release)}>
              {release}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="mt-1.5 text-[11px] leading-[15px] text-nb-peach-ink">{error}</p>}
    </div>
  );
}

/** The rail's ends. One mark, one line of what would fill it, and — where there is one — the
 *  place to go. */
function Empty({
  icon,
  title,
  body,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center text-nb-ink-soft">
      {icon}
      <span className="text-[13px] font-[800] text-nb-ink">{title}</span>
      <span className="max-w-[34ch] text-[12px] leading-[17px]">{body}</span>
      {hint && (
        <span className="mt-1 rounded-[8px] bg-nb-ink/8 px-2.5 py-1 text-[12px] font-[700] text-nb-ink">
          {hint}
        </span>
      )}
    </div>
  );
}
