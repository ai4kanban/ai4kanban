// English copy for the board screen — the source of truth a second language
// mirrors key for key. Writing rules: `i18n/index.ts`.
import type { BoardCopy } from "./types";

const en: BoardCopy = {
  reading: "Reading the board…",
  notice: {
    planning: (release) =>
      `**${release}** is being planned — the agent is moving in the cards that ship its goal and writing the ones the board hasn't got. They appear here as it goes.`,
    watchRun: "Watch the run",
    planNotStarted: (release, why) =>
      `${release} was made, but filling it from its goal didn't start: ${why}`,
    changelogMissing: (release, why) =>
      `**${release}** is closed, but its changelog was not written — ${why}.`,
    changelogStopped: "the run was stopped",
    changelogUnfinished: "the run didn't finish",
    changelogWriteIt: (command) => `Write it with \`${command}\`.`,
    dismiss: "Dismiss",
    allPlanned:
      "Every open card is in a release — nothing is waiting to be planned. Pick a version above to see it.",
    releaseEmpty: (release) => `**${release}** has no open cards.`,
    showNoRelease: "Show the cards in no release",
  },
  queue: {
    ready: "Ready to build",
    readyCount: (ready, implementing) => `${ready} ready · ${implementing} implementing`,
    notReady: "Not ready",
    recurring: "Recurring",
    empty: "no open cards",
  },
  card: {
    tick: (id, title) => `Tick #${id} ${title}`,
    untick: (id, title) => `Untick #${id} ${title}`,
    tickHint: "Tick to move this card into a release",
    questionsOne: "1 open question",
    questionsMany: (n) => `${n} open questions`,
    needsYouOne: "1 needs you",
    needsYouMany: (n) => `${n} need you`,
    verify: (n) => `${n} to check by hand`,
  },
  create: {
    button: "Create task",
    startFailed: "could not start the agent",
  },
  bulk: {
    tickedOne: "1 card ticked",
    tickedMany: (n) => `${n} cards ticked`,
    move: "Move into…",
    moving: "Moving…",
    noRelease: "No release",
    untickAll: "Untick all",
    failedOne: "This card did not move — the rest went through:",
    failedMany: (n) => `These ${n} cards did not move — the rest went through:`,
  },
  release: {
    which: "Which release to show",
    whichHint:
      "Show one release at a time, or the cards in none — blockers always stay on screen",
    none: (count) => `No release (${count})`,
    noneHint: "Not promised to a version yet",
    new: "New release…",
    menu: (release) => `What to do with ${release}`,
    whatItIsFor: "What it is for",
    fillFromGoal: "Fill from its goal",
    close: "Close release",
    drop: "Drop release",
    goal: {
      title: (release) => `What ${release} is for`,
      blurb:
        "A sentence or two, in your own words — what this version is trying to ship. It sits on the release's line in `docs/kanban/releases.md`, and it is what filling the release plans against. Empty is fine.",
      placeholder:
        "The first version worth showing someone: a board you can run end to end.",
      saveFailed: "could not save the goal",
    },
    plan: {
      title: (release) => `Fill ${release} from its goal`,
      blurb: (release) =>
        `The agent reads what **${release}** is for, moves the open cards that ship it into the release, and writes the cards the goal needs that the board hasn't got. It decides on its own — nothing waits on you.`,
      background:
        "It runs in the background — watch it, and read what it moved and wrote, in the runs panel. A card already in another release stays there, so filling again only ever adds.",
      start: "Fill release",
      starting: "Starting…",
      startFailed: "could not start the run",
    },
    closing: {
      title: (release) => `Close ${release}`,
      blurb: (release) =>
        `**${release}** shipped. What it shipped is written down in its summary file, and it comes off the list for good — a closed release can't be reopened.`,
      reading: "Reading what this close records…",
      shippedNone: "No card was archived under it — the summary will say nothing shipped.",
      shippedOne: "1 archived card goes down as shipped.",
      shippedMany: (n) => `${n} archived cards go down as shipped.`,
      changelogNone: "No changelog is written — there is nothing to write it from.",
      changelog:
        "An agent then writes a short changelog at the top of the summary, saying what the version changed. It runs in the background; watch it in the runs panel.",
      unarchivedOne:
        "This open card has every todo ticked but was never archived, so it counts as not shipped. Cancel and archive it first if it really shipped.",
      unarchivedMany: (n) =>
        `These ${n} open cards have every todo ticked but were never archived, so they count as not shipped. Cancel and archive them first if they really shipped.`,
      leftNone: "No open cards are in it — nothing moves.",
      leftOne: "This open card loses its release — still wanted, no longer promised to a version:",
      leftMany: (n) =>
        `These ${n} open cards lose their release — still wanted, no longer promised to a version:`,
      confirm: "Close release",
      closing: "Closing…",
      failed: "could not close the release",
    },
    dropping: {
      title: (release) => `Drop ${release}`,
      blurb: (release) =>
        `**${release}** will not ship. It comes off the list with no shipped record — its open cards return to no release, and no summary file is written. Cards already archived under it stay archived.`,
      reading: "Reading what this drop moves…",
      archivedNone: "No card was archived under it.",
      archivedOne: "This archived card stays archived under it:",
      archivedMany: (n) => `These ${n} archived cards stay archived under it:`,
      leftNone: "No open cards are in it — nothing returns to no release.",
      leftOne: "This open card loses its release — still wanted, no longer promised to a version:",
      leftMany: (n) =>
        `These ${n} open cards lose their release — still wanted, no longer promised to a version:`,
      confirm: "Drop release",
      dropping: "Dropping…",
      failed: "could not drop the release",
    },
    make: {
      title: "New release",
      fromGoal: "From a goal",
      noGoal: "No goal",
      blurb:
        "A version id, in your own words — `v1`, `0.5.0`, `august`. It joins the end of the list in `docs/kanban/releases.md`, and the board switches to it so what you write next lands in it.",
      idPlaceholder: "v1",
      goalAsk:
        "What is this version for? A sentence or two, in your own words — the agent plans the release against them.",
      goalPlaceholder:
        "The first version worth showing someone: a board you can run end to end.",
      goalReady:
        "The agent moves in the open cards that ship the goal and writes the ones the board hasn't got. The release is made at once; the run carries on behind it, in the runs panel.",
      goalMissing:
        "Say what the version is for, or make it on the No goal tab — there is nothing to plan a release against until this box says something.",
      confirm: "Make release",
      making: "Making…",
      failed: "could not make the release",
    },
    autoFill: {
      reading: "Reading the unplanned high-priority cards…",
      on: "Put every unplanned high-priority card in",
      nothingToMove: "No unplanned card is high priority — the release starts empty",
      goesInOne: "1 card goes in",
      goesInMany: (n) => `${n} cards go in`,
      skippedOne: " — 1 more stays unplanned, blocked or a group root",
      skippedMany: (n) => ` — ${n} more stay unplanned, blocked or a group root`,
    },
  },
};

export default en;
