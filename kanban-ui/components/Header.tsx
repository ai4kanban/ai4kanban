import Link from "next/link";
import { FiChevronDown, FiColumns, FiFolder, FiList, FiTag } from "react-icons/fi";
import type { ReleasePick } from "@/lib/release-pick";
import { type AgentInfo, DEFAULT_RELEASE, type SessionView } from "@/lib/types";
import type { BoardViewMode } from "@/lib/view";
import { Configuration } from "./Configuration";
import { CreateTask } from "./CreateTask";
import { Progress } from "./Progress";
import { Sessions } from "./sessions";

// Shared header for the board and the card detail page — identical on both: the
// brand links home (the board), and the Create-task action, the daily-progress
// chart and the Configuration gear sit on the right. Create task is
// self-contained (see CreateTask) so both pages
// get it without threading any session state through the header. `projectRoot` is
// the repo the server is driving (holds docs/kanban/) — shown as a small badge so
// you can tell at a glance which board this is. `autoRefine` and
// `autoRefineParallelism` seed the Configuration dialog's auto-refine controls
// and `sessions` is the page's polled registry
// list, which tells that dialog whether a background refine is running and on
// which card (#51); `onError` lets a save failure surface where the page already
// shows errors, across its top.
//
// The view switch (#70) is the one thing that isn't on both pages: pass `view`
// and `onViewChange` and it appears, leave them off and it doesn't. Only the
// board has two layouts to switch between — on a card page the switch would
// either do nothing or jump you off the card.
//
// The release dropdown (#104) rides beside it under the same rule, and on the
// same board-only terms: it says which version the columns and the queue are
// showing, and a card page shows one card whatever is picked. It also decides
// where a card made from here lands — a card written while `v1` is on screen
// ships in `v1`, so it doesn't vanish the moment it is written.
//
// On a narrow screen the row has to stay one line, so the text that is only
// context gives way first: the path badge drops to the folder name, the view
// switch and Create task go icon-only. Nothing is removed — every control is
// still there at the same 36px tap size, just without its label.
export function Header({
  agent,
  projectRoot,
  autoRefine,
  autoRefineParallelism,
  sessions,
  onError,
  view,
  onViewChange,
  releases = [],
  releaseCounts = {},
  release = null,
  onReleaseChange,
  createRelease = null,
}: {
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
  autoRefineParallelism: number;
  sessions: SessionView[];
  onError?: (msg: string) => void;
  view?: BoardViewMode;
  onViewChange?: (v: BoardViewMode) => void;
  /** The open releases in ship order. Empty — a board that plans no versions —
   *  means no dropdown at all: nothing should make a user who never plans a
   *  release meet the word. */
  releases?: string[];
  /** How many open cards each release holds, `next` included. */
  releaseCounts?: Record<string, number>;
  release?: ReleasePick;
  onReleaseChange?: (r: ReleasePick) => void;
  /** The version a card made from here ships in — the release on screen, or null
   *  when the whole board is showing and the new card lands wherever the agent
   *  puts it. A card page passes nothing: it shows one card, not a release. */
  createRelease?: string | null;
}) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between gap-2 px-3 py-2.5 backdrop-blur-sm sm:gap-3 sm:px-6 sm:py-3.5"
      style={{
        background: "color-mix(in srgb, var(--color-nb-cream) 90%, transparent)",
        borderBottom: "1.5px solid color-mix(in srgb, var(--color-nb-ink) 14%, transparent)",
      }}
    >
      <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <Link
          href="/"
          className="whitespace-nowrap text-[17px] font-[800] tracking-[-0.02em] hover:text-nb-accent-deep"
        >
          🗂️ Kanban
        </Link>
        <span
          title={`${projectRoot}/docs/kanban`}
          className="hidden min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] text-nb-ink-soft sm:flex"
          style={{
            background: "color-mix(in srgb, var(--color-nb-ink) 5%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)",
          }}
        >
          <FiFolder className="shrink-0 opacity-70" size={12} />
          <span className="truncate lg:hidden">{projectRoot.split("/").pop()}</span>
          <span className="hidden truncate lg:inline">{projectRoot}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {onReleaseChange && releases.length > 0 && (
          <ReleasePicker
            releases={releases}
            counts={releaseCounts}
            value={release}
            onChange={onReleaseChange}
          />
        )}
        {view && onViewChange && <ViewSwitch view={view} onChange={onViewChange} />}
        <Progress />
        <Sessions />
        <Configuration
          agent={agent}
          autoRefine={autoRefine}
          autoRefineParallelism={autoRefineParallelism}
          sessions={sessions}
          onError={onError}
        />
        <CreateTask release={createRelease} />
      </div>
    </header>
  );
}

// The value the All-releases option carries. A version id is free text, but it
// can never be empty (`release new` refuses one), so the empty string is the one
// value no release can take.
const ALL = "";

// Which release the board is showing (#104). A select, not a row of chips: a
// board can plan several versions and the entries carry counts, so the list
// belongs behind one control that says what you are looking at — the header row
// has to stay one line. It wears the same 36px sticker frame as the view switch
// beside it, and the sky fill the release chip on a card already uses, so picking
// a version reads as the same thing in both places.
//
// The counts are the open cards naming each release — the numbers `release list`
// prints — so a nearly-empty version is visible without opening it. All releases
// counts the whole board.
function ReleasePicker({
  releases,
  counts,
  value,
  onChange,
}: {
  releases: string[];
  counts: Record<string, number>;
  value: ReleasePick;
  onChange: (r: ReleasePick) => void;
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const entry = (id: string) => `${id} (${counts[id] ?? 0})`;
  const filtering = value !== null;
  return (
    <span
      className="relative inline-flex h-9 items-center rounded-[9px] border-[1.5px] border-nb-ink pl-2 shadow-[2px_2px_0_0_var(--color-nb-ink)]"
      style={{
        background: filtering ? "var(--color-nb-sky-soft)" : "var(--color-nb-paper)",
        color: filtering ? "var(--color-nb-sky-ink)" : "var(--color-nb-ink-soft)",
      }}
    >
      <FiTag aria-hidden style={{ width: 13, height: 13, flex: "0 0 auto" }} />
      <select
        aria-label="Which release to show"
        title="Show one release at a time — blockers always stay on screen"
        value={value ?? ALL}
        onChange={(e) => onChange(e.target.value === ALL ? null : e.target.value)}
        // A native select, sized to the header's other controls: appearance-none
        // so the sticker frame is the only chrome, and right padding to clear the
        // chevron sitting on top of it.
        // The frame is sized to the longest entry, so it is capped: a long
        // version id truncates instead of pushing the header's other controls
        // off a narrow screen.
        className="h-full max-w-[112px] cursor-pointer appearance-none border-none bg-transparent pl-1.5 pr-[22px] text-[12px] font-[700] leading-none text-inherit focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent sm:max-w-[176px]"
      >
        <option value={ALL}>All releases ({total})</option>
        {releases.map((r) => (
          <option key={r} value={r}>
            {entry(r)}
          </option>
        ))}
        {/* `next` is always last: it is where a card with no release sits, not a
            version, so it never joins the ship order above it. */}
        <option value={DEFAULT_RELEASE}>{entry(DEFAULT_RELEASE)}</option>
      </select>
      <FiChevronDown aria-hidden className="pointer-events-none absolute right-2" style={{ width: 11, height: 11 }} />
    </span>
  );
}

// Which layout the board draws. A two-segment control rather than two separate
// sticker buttons: the views are one choice with two answers, and the filled
// segment says which one you are looking at without a second mark. It shares the
// 36px frame of the header's other buttons so the row still reads as one strip.
// Below `sm` the labels go screen-reader-only and the two icons carry it — the
// filled segment still says which view is on, and `title` still names both.
const VIEWS: { key: BoardViewMode; label: string; icon: typeof FiColumns }[] = [
  { key: "kanban", label: "Board", icon: FiColumns },
  { key: "queue", label: "Queue", icon: FiList },
];

function ViewSwitch({
  view,
  onChange,
}: {
  view: BoardViewMode;
  onChange: (v: BoardViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Board layout"
      className="inline-flex h-9 items-center gap-0.5 rounded-[9px] border-[1.5px] border-nb-ink bg-nb-paper p-0.5 shadow-[2px_2px_0_0_var(--color-nb-ink)]"
    >
      {VIEWS.map(({ key, label, icon: Icon }) => {
        const on = view === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            title={
              key === "kanban"
                ? "Board — one column per track"
                : "Queue — what you can start now"
            }
            onClick={() => onChange(key)}
            className="inline-flex h-full cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-[700] transition-colors sm:px-2.5"
            style={{
              background: on ? "var(--color-nb-accent-soft)" : "transparent",
              color: on ? "var(--color-nb-accent-deep)" : "var(--color-nb-ink-soft)",
            }}
          >
            <Icon aria-hidden style={{ width: 13, height: 13, flex: "0 0 auto" }} />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
