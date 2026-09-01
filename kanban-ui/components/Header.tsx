import Link from "next/link";
import { useCopy } from "@/i18n/use-copy";
import type { ReleasePick } from "@/lib/release-pick";
import type { AgentInfo } from "@/lib/types";
import { ChatButton } from "./Chat";
import { ToolCluster } from "./chrome";
import { Configuration } from "./Configuration";
import { CreateTask } from "./CreateTask";
import { ProjectPath, UpdateChip } from "./desktop";
import { GitHubLink } from "./GitHubLink";
import { Goal } from "./Goal";
import { Insights } from "./Insights";
import { LogoMark } from "./Logo";
import { BellButton } from "./Notifications";
import { ReleasePicker } from "./ReleasePicker";
import { Sessions } from "./sessions";

// The window's top row (components/Window.tsx draws the rest of it), shared by
// the board and the card detail page and identical on both: the mark leads home,
// and the Create-task action, the Insights charts and the Configuration
// gear sit on the right. Create task is
// self-contained (see CreateTask) so both pages
// get it without threading any session state through the header. `projectRoot` is
// the repo the server is driving (holds docs/kanban/) — shown as a small badge so
// you can tell at a glance which board this is. `onError` lets a save failure
// surface where the page already shows errors, across its top.
//
// There was a view switch here (#70) — kanban columns or the queue. It is gone:
// the board draws one layout now, so there is nothing to switch between and a
// control offering the choice would be offering a board that no longer exists.
//
// The bell (#319) is the tool cluster's first segment. It opens the notification rail in
// the chat rail's own place — the right side holds one at a time — and wears its unread
// count inside the segment rather than as a badge on the frame, which the cluster would
// clip.
//
// The Chat button (#242) sits beside Create task and folds the chat rail down the right of
// the window. It draws nothing of its own — the rail's state lives in the window
// (components/Window.tsx), which is what keeps one chat on screen whichever page is up.
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
// At phone width (#357) that is no longer enough: nine controls do not fit 375px however
// small their labels get. So the row holds only what the width is worth spending on — the
// mark, the release picker, the bell with its count, and Create task — and everything else
// moves to the More tab (components/Phone.tsx). Which controls those are is said here, in
// CSS, rather than by drawing a second header: the row is the same row, with the parts a
// phone has no room for hidden and every remaining control grown to 36px so a thumb can
// land on it.
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
  onError?: (msg: string) => void;
  /** The open releases in ship order. Empty is a board that plans no versions —
   *  the dropdown still shows, resting on No release (which is then every card)
   *  and offering New release, so the first one can be started from here. */
  releases?: string[];
  /** What each release is for (#164), keyed by version id — shown under the
   *  version in the dropdown. A release with no goal is absent. */
  releaseGoals?: Record<string, string>;
  /** How many open cards each release holds, keyed by version id, with the empty
   *  key for the cards in no release — the count the first entry wears. */
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
   *  away; the guided first run, or the board's goal notice, is what asks for
   *  the goal then. */
  goalWritten?: boolean;
  /** Whether this board is running inside the desktop app (#175). All it changes
   *  here is the folder badge: in the app it opens another project, since there
   *  is no terminal to restart the board from. */
  desktop?: boolean;
}) {
  const c = useCopy();
  return (
    // `data-titlebar` is what the app on macOS hangs the window's own title bar
    // off (app/globals.css): the window is drawn without one, so this row is it
    // — the left gets a gutter for the traffic lights, and the row itself
    // becomes the part of the window you drag it by. Everything pressable in it
    // is marked `a4k-nodrag`, since a drag region takes the click. Elsewhere the
    // attribute means nothing.
    <header
      data-titlebar
      // 43px whichever width it is: 7 + a 28px control + 8 at window width, 3 + a 36px
      // control + 4 at phone width. The row keeps its height so the two rails that lay
      // themselves over the body from `top-[43px]` keep meeting it exactly, and the app's
      // own title bar strip (app/globals.css) stays the height of the row it covers.
      className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[7px] max-md:pb-1 max-md:pt-[3px]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* The mark is the way to the board on a window too narrow for the rail;
            where the rail is up, All cards is the row that leads here and this
            is simply which product you are in. */}
        {/* The mark leads home. At phone width home is the Board tab and the mark is the
            way back to it from a card page, so it is given a thumb's target around a
            block that stays the size it is. */}
        <Link
          href="/"
          title={c.chrome.header.home}
          aria-label={c.chrome.header.home}
          className="a4k-nodrag flex shrink-0 items-center justify-center max-md:size-9 max-md:-ml-1"
        >
          <LogoMark />
        </Link>
        {/* Which board this is. On a phone it is on the More screen instead: the folder
            is context, and context is the first thing a 375px row gives up. */}
        <span className="hidden min-w-0 md:flex">
          <ProjectPath projectRoot={projectRoot} desktop={desktop} />
        </span>
      </div>
      {/* `data-controls`: in the app's title bar these are given 12px between
          them rather than 8, since a row of hard shadows needs more air beside
          the traffic lights than it does on a page. */}
      <div data-controls className="a4k-nodrag flex shrink-0 items-center gap-2">
        {/* A newer version, when there is one (#372) — its own chip rather than a
            segment of the cluster, since it comes and goes and the cluster's shape
            should not. It leads the group beside the repository: those two are the
            controls here that act on nothing on this board. The head is also the one
            place a control can appear without shoving another one sideways — the
            group is right-aligned, so it grows out to the left. Absent entirely the
            rest of the time. */}
        <span className="hidden items-center gap-2 md:flex">
          <UpdateChip />
          {/* The repository leads the group: the same ghost block as Goal and
              Chat, icon-only, since it is the one control here that acts on
              nothing on this board. */}
          <GitHubLink />
          <Goal written={goalWritten} />
        </span>
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
        <span className="hidden items-center gap-2 md:flex">
          <ToolCluster>
            {/* The bell leads the cluster (#319): it is the one control in it that changes
                on its own, and its count rides inside the segment because the cluster clips
                to its own frame. */}
            <BellButton />
            <Insights />
            <Sessions />
            <Configuration agent={agent} onError={onError} />
          </ToolCluster>
          <ChatButton />
        </span>
        {/* The phone keeps the bell and nothing else from that cluster: it is the one
            control there that changes on its own, and the three beside it are all things
            done at the computer. It keeps the cluster's frame rather than becoming a bare
            icon — a lone segment is still the same object. */}
        <span className="md:hidden">
          <ToolCluster>
            <BellButton />
          </ToolCluster>
        </span>
        <CreateTask release={createRelease} />
      </div>
    </header>
  );
}
