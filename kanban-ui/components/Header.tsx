import Link from "next/link";
import { FiColumns, FiFolder, FiList } from "react-icons/fi";
import type { AgentInfo, SessionView } from "@/lib/types";
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
// you can tell at a glance which board this is. `autoRefine` seeds the
// Configuration dialog's switch and `sessions` is the page's polled registry
// list, which tells that dialog whether a background refine is running and on
// which card (#51); `onError` lets a save failure surface where the page already
// shows errors, across its top.
//
// The view switch (#70) is the one thing that isn't on both pages: pass `view`
// and `onViewChange` and it appears, leave them off and it doesn't. Only the
// board has two layouts to switch between — on a card page the switch would
// either do nothing or jump you off the card.
//
// On a narrow screen the row has to stay one line, so the text that is only
// context gives way first: the path badge drops to the folder name, the view
// switch and Create task go icon-only. Nothing is removed — every control is
// still there at the same 36px tap size, just without its label.
export function Header({
  agent,
  projectRoot,
  autoRefine,
  sessions,
  onError,
  view,
  onViewChange,
}: {
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
  sessions: SessionView[];
  onError?: (msg: string) => void;
  view?: BoardViewMode;
  onViewChange?: (v: BoardViewMode) => void;
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
        {view && onViewChange && <ViewSwitch view={view} onChange={onViewChange} />}
        <Progress />
        <Sessions />
        <Configuration
          agent={agent}
          autoRefine={autoRefine}
          sessions={sessions}
          onError={onError}
        />
        <CreateTask />
      </div>
    </header>
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
