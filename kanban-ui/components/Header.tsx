import Link from "next/link";
import type { ReleasePick } from "@/lib/release-pick";
import type { AgentInfo, SessionView } from "@/lib/types";
import { ToolCluster } from "./chrome";
import { Configuration } from "./Configuration";
import { CreateTask } from "./CreateTask";
import { ProjectPath } from "./desktop";
import { Goal } from "./Goal";
import { LogoMark } from "./Logo";
import { Progress } from "./Progress";
import { ReleasePicker } from "./ReleasePicker";
import { Sessions } from "./sessions";

// The window's top row (components/Window.tsx draws the rest of it), shared by
// the board and the card detail page and identical on both: the mark leads home,
// and the Create-task action, the daily-progress chart and the Configuration
// gear sit on the right. Create task is
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
// There was a view switch here (#70) — kanban columns or the queue. It is gone:
// the board draws one layout now, so there is nothing to switch between and a
// control offering the choice would be offering a board that no longer exists.
//
// The release dropdown (#104) is the one thing that isn't on both pages, on
// board-only terms: it says which version the columns are
// showing, and a card page shows one card whatever is picked. It also decides
// where a card made from here lands — a card written while `v1` is on screen
// ships in `v1`, so it doesn't vanish the moment it is written. It is on every
// board now, a board with no releases included (#115): its last entry is how a
// release is started, so hiding it on an empty board hid the feature from the
// only user who hadn't met it.
//
// On a narrow screen the row has to stay one line, so the text that is only
// context gives way first: the path badge drops to the folder name and Create
// task goes icon-only. Nothing is removed — every control is still there, just
// without its label.
//
// The row is drawn at IDE weight (see app/design/layouts): 44px against the 60
// it used to be, every control a 28px box, and the saving taken out of the
// padding rather than out of the controls. It pays for the rail beside it. Two
// things follow from that:
//
//   - The wordmark is gone. The mark says the product and the badge says the
//     board, and a third label saying the product again is the width the rail
//     needs. The mark still leads home, which is the whole of the way back on a
//     window too narrow for the rail.
//   - Runs, progress and settings share one frame with hairlines between them.
//     They are all "look at the board's machinery" and none of them is a primary
//     action, so they get one sticker between them instead of three hard shadows
//     sitting a few pixels apart.
//
// The left is identity and nothing else — the mark, then the board it names — so
// everything pressable is on the right and the eye has one place to go. The goal
// button (#128) moved over with them: it is read rather than pressed, but it is
// still a thing you open, and a lone control on the identity side would need a
// divider to say so.
//
// Padding is 7 above and 8 below: a sticker's shadow falls 2px past its box
// while the badge has none, so the odd pixel splits the difference and both
// kinds land within half a pixel of the row's centre.
export function Header({
  agent,
  projectRoot,
  autoRefine,
  autoRefineParallelism,
  sessions,
  onError,
  releases = [],
  releaseGoals = {},
  releaseCounts = {},
  release = null,
  onReleaseChange,
  onCreateRelease,
  onPlanRelease,
  onDropRelease,
  onCloseRelease,
  onSetReleaseGoal,
  createRelease = null,
  goalWritten = false,
  desktop = false,
}: {
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
  autoRefineParallelism: number;
  sessions: SessionView[];
  onError?: (msg: string) => void;
  /** The open releases in ship order. Empty is a board that plans no versions —
   *  the dropdown still shows, saying All releases and offering New release, so
   *  the first release can be started from here. */
  releases?: string[];
  /** What each release is for (#164), keyed by version id — shown under the
   *  version in the dropdown. A release with no goal is absent. */
  releaseGoals?: Record<string, string>;
  /** How many open cards each release holds, the unplanned (no-release) ones
   *  included — those only feed the All-releases total. */
  releaseCounts?: Record<string, number>;
  release?: ReleasePick;
  onReleaseChange?: (r: ReleasePick) => void;
  /** Make a release and put the board on it (#115). `fill` is what the dialog's
   *  tab asked for: from a goal, an agent run planned against it (#165); with no
   *  goal, the plain high-priority rule (#106).
   *  Passed with `onReleaseChange` or not at all — a card page has neither. */
  onCreateRelease?: (id: string, fill: boolean, goal: string) => Promise<{ ok: boolean; error?: string }>;
  /** Fill a release that already exists from its goal (#165) — the ⋯ menu's
   *  entry. The board starts the run so it can take it on: the runs panel has it
   *  from the moment it starts. Board-only, like the other release handlers. */
  onPlanRelease?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Give up on the release the board is showing (#131): no shipped record, its
   *  open cards' release cleared, its line off the list. Board-only, like the
   *  other release handlers. */
  onDropRelease?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Close the release the board is showing (#136): what shipped written down,
   *  its open cards' release cleared, its line off the list. Board-only, like the
   *  other release handlers. */
  onCloseRelease?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Change what the release on screen is for (#164). Board-only, like the other
   *  release handlers. */
  onSetReleaseGoal?: (id: string, goal: string) => Promise<{ ok: boolean; error?: string }>;
  /** The version a card made from here ships in — the release on screen, or null
   *  when the whole board is showing and the new card lands wherever the agent
   *  puts it. A card page passes nothing: it shows one card, not a release. */
  createRelease?: string | null;
  /** Whether `memory/goal.md` holds the user's own words. False — the file is
   *  missing or empty — means there is nothing to open and the button stays
   *  away; the setup bar is what asks for the goal then. */
  goalWritten?: boolean;
  /** Whether this board is running inside the desktop app (#175). All it changes
   *  here is the folder badge: in the app it opens another project, since there
   *  is no terminal to restart the board from. */
  desktop?: boolean;
}) {
  return (
    <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[7px]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* The mark is the way to the board on a window too narrow for the rail;
            where the rail is up, All cards is the row that leads here and this
            is simply which product you are in. */}
        <Link href="/" title="All cards" aria-label="All cards">
          <LogoMark className="size-[22px] rounded-[6px]" />
        </Link>
        <ProjectPath projectRoot={projectRoot} desktop={desktop} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Goal written={goalWritten} />
        {onReleaseChange && onCreateRelease && onPlanRelease && onDropRelease && onCloseRelease && onSetReleaseGoal && (
          <ReleasePicker
            releases={releases}
            goals={releaseGoals}
            counts={releaseCounts}
            value={release}
            onChange={onReleaseChange}
            onCreate={onCreateRelease}
            onPlan={onPlanRelease}
            onDrop={onDropRelease}
            onCloseRelease={onCloseRelease}
            onSetGoal={onSetReleaseGoal}
          />
        )}
        <ToolCluster>
          <Progress />
          <Sessions />
          <Configuration
            agent={agent}
            autoRefine={autoRefine}
            autoRefineParallelism={autoRefineParallelism}
            sessions={sessions}
            onError={onError}
          />
        </ToolCluster>
        <CreateTask release={createRelease} />
      </div>
    </header>
  );
}
