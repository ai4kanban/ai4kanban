"use client";

// The notification center (#319) — the bell in the top row, and the rail it opens down the
// right of the window.
//
// The bell leads the tool cluster and wears its count INSIDE the segment: the cluster clips
// to its own frame, so a badge on a tool's shoulder would be cut in half. It is the first
// segment because it is the one thing in that cluster that changes on its own.
//
// The rail is the chat rail's own place, and the right side holds one at a time — opening
// this folds that. A row is the card's number and title with the event's name under it, and
// nothing else: opening it opens that card's own page, because a second page drawn for an
// event would only duplicate the card's.
//
// It draws two ends as carefully as the list: nothing waiting, and notifications off for
// this board. Both say what would fill it, and the off state names where to turn it on.

import { createContext, useContext, useEffect, useState } from "react";
import { FiBell, FiBellOff, FiChevronRight, FiSlash, FiX } from "react-icons/fi";
import { boardNotificationsAction, watchReleaseAction } from "@/app/actions";
import type { BellRail } from "@/lib/bell-rail";
import type { NotificationRow } from "@/lib/notifications";
import { ALL_RELEASES } from "@/lib/types";
import { Button } from "./button";
import { HAIRLINE, TOOL_BTN } from "./chrome";

// The rail's state belongs to the window and the button is in the top row, which the page
// builds. Context is what puts the two on one state without every page threading it through
// its header — the same seam the chat rail sits behind.
const BellContext = createContext<BellRail | null>(null);

export function BellProvider({ rail, children }: { rail: BellRail; children: React.ReactNode }) {
  return <BellContext.Provider value={rail}>{children}</BellContext.Provider>;
}

/**
 * The tool cluster's first segment: the bell, and its unread count beside it.
 *
 * With something unread it takes the accent wash and the count in accent ink — the one
 * thing in the row that says "there is something for you". With nothing, it is a tool like
 * the three beside it.
 */
export function BellButton() {
  const rail = useContext(BellContext);
  if (!rail) return null;
  const { unread } = rail.center;
  const lit = unread > 0;
  return (
    <button
      type="button"
      aria-label={lit ? `Notifications — ${unread} unread` : "Notifications"}
      aria-pressed={rail.open}
      onClick={rail.toggle}
      // The count rides inside the segment, so the segment grows rather than the frame
      // being broken by a badge on its edge.
      className={`${TOOL_BTN} ${lit ? "w-auto gap-1 px-2" : ""}`}
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

/** The rail itself. Drawn by the window in whichever shape fits — a panel beside the body,
 *  or a cover over it — with the same contents either way. */
export function BellPane({ rail }: { rail: BellRail }) {
  const { center } = rail;
  return (
    <div className="flex h-full flex-col overflow-hidden py-2 pl-1 pr-3">
      <Head unread={center.unread} silenced={center.silenced} onFold={rail.fold} />
      {center.unavailable ? (
        <Empty
          icon={<FiBellOff size={20} aria-hidden />}
          title="Notifications aren’t available here"
          body={center.unavailable}
        />
      ) : !center.signedIn ? (
        <Empty
          icon={<FiBellOff size={20} aria-hidden />}
          title="Not signed in to Cloud"
          body="Sign in and this board's cards start filling the bell. Nothing leaves this machine until you do."
          hint="Configuration → Cloud"
        />
      ) : !center.enabled && center.rows.length === 0 ? (
        <Empty
          icon={<FiBellOff size={20} aria-hidden />}
          title="No open release"
          body="The bell watches one open release. Start one from the version picker in the header."
        />
      ) : (
        <>
          {/* The watched release closed, so the filling stopped. The prompt is here rather
              than only in Configuration, because here is where it stopped. */}
          {center.enabled && !center.release && <PickRelease onPicked={rail.refresh} />}
          {center.rows.length === 0 ? (
            <Empty
              icon={<FiBell size={20} aria-hidden />}
              title="Nothing waiting"
              body="Cards that need you appear here, and stay 30 days after they finish."
            />
          ) : (
            <>
              <p className="mb-1 px-2 text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft">
                Newest change first
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {center.rows.map((row) => (
                  <Row
                    key={row.eventId}
                    row={row}
                    named={center.namesBoards}
                    onOpen={() => void rail.openRow(row.eventId)}
                  />
                ))}
              </div>
            </>
          )}
          {center.error && (
            <p className="px-2 pt-2 text-[11.5px] leading-[16px] text-nb-ink-soft">
              Cloud could not be reached: {center.error}. These are the rows we last knew about.
            </p>
          )}
          {/* Changes this machine gave up on sending (#329). Said here because this is where
              Cloud's state is already reported, and said plainly: the rows above may be
              behind the board, and the board is the one that is right. */}
          {!!center.unsent && (
            <p className="px-2 pt-2 text-[11.5px] leading-[16px] text-nb-peach-ink">
              Cloud is out of step: {center.unsent} {center.unsent === 1 ? "change" : "changes"} never
              reached it. This board is the one that is right.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Head({
  unread,
  silenced,
  onFold,
}: {
  unread: number;
  silenced: boolean;
  onFold: () => void;
}) {
  return (
    <div className="mb-1 flex h-[30px] shrink-0 items-center gap-2 px-2">
      <FiBell size={13} aria-hidden />
      <span className="text-[12.5px] font-[700] text-nb-ink">Notifications</span>
      {/* The machine's silencing switch is a fact worth stating where its effect is felt:
          the bell keeps filling and nothing interrupts. */}
      {silenced && (
        <span
          className="nb-tip inline-flex items-center gap-1 text-[11px] font-[700] text-nb-ink-soft"
          tabIndex={0}
          data-tip="System notifications are silenced for every board on this machine."
        >
          <FiSlash size={11} aria-hidden />
          silenced
        </span>
      )}
      {unread > 0 && (
        <span className="ml-auto text-[11.5px] font-[700] text-nb-ink-soft">{unread} new</span>
      )}
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onFold}
        className={`${unread > 0 ? "" : "ml-auto"} -mr-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[7px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_7%,transparent)] hover:text-nb-ink`}
      >
        <FiX size={14} aria-hidden />
      </button>
    </div>
  );
}

/** One row: the card's number and title, the event's name under it, and nothing else.
 *  Unread is an accent dot and ink-weight text; read is the soft ink everything settled
 *  wears. */
function Row({
  row,
  named,
  onOpen,
}: {
  row: NotificationRow;
  named: boolean;
  onOpen: () => void;
}) {
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
          {/* The board is named only once a second one is enabled — on one board the name
              is on every row and tells two rows nothing apart. */}
          {named && (
            <>
              <span aria-hidden className="text-nb-ink-soft/50">
                ·
              </span>
              <span className="min-w-0 truncate font-[500] text-nb-ink-soft">{row.boardName}</span>
            </>
          )}
        </span>
        {/* The checkout can come back, so the row stays and says so rather than switching
            to a folder that is not there. */}
        {!row.boardHere && (
          <span className="mt-[3px] block text-[11px] leading-[15px] text-nb-ink-soft">
            {row.boardName} is no longer on this machine.
          </span>
        )}
      </span>
      {row.boardHere && (
        <FiChevronRight className="mt-[3px] shrink-0 text-nb-ink-soft/60" size={13} aria-hidden />
      )}
    </button>
  );
}

/** The watched release closed. One line and what to watch instead, where the filling stopped
 *  — the same choice Configuration offers, so nobody has to remember a version id to type.
 *  **All** leads, and is the one answer a board with no open release left still has. */
function PickRelease({ onPicked }: { onPicked: () => void }) {
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
      if (!done.ok) setError(done.error ?? "that release could not be watched");
      else onPicked();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-1 mb-2 rounded-[9px] bg-nb-peach-soft px-3 py-2.5">
      <p className="text-[12px] font-[800] text-nb-peach-ink">The release you were watching closed.</p>
      <p className="mt-1 text-[11.5px] leading-[16px] text-nb-ink">
        Nothing new fills the bell until you pick what to watch.
      </p>
      {releases && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" disabled={busy} onClick={() => void watch(ALL_RELEASES)}>
            All releases
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
        <span className="mt-1 rounded-[8px] border-[1.5px] border-nb-ink bg-nb-paper px-2.5 py-1 text-[12px] font-[700] text-nb-ink shadow-[2px_2px_0_0_var(--color-nb-ink)]">
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * The live Cloud event on one of THIS board's cards, or null.
 *
 * Matched on the board's own Cloud id as well as the task number: the bell carries every
 * enabled board, and two boards can each hold a card #12.
 */
export function useCardEvent(taskId: number): NotificationRow | null {
  const rail = useContext(BellContext);
  if (!rail) return null;
  const { center } = rail;
  if (!center.boardId) return null;
  return (
    center.rows.find((row) => row.boardId === center.boardId && row.taskId === taskId) ?? null
  );
}
