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
    offline: (lastRead) =>
      `Cloud is out of reach. This is the copy read ${lastRead} — you can read the board, and nothing can be saved until Cloud answers.`,
    offlineNeverRead:
      "Cloud is out of reach and this checkout has never read its workspace, so there is no copy of the board to show.",
  },
  queue: {
    ready: "Ready to build",
    readyCount: (ready, implementing) => `${ready} ready · ${implementing} implementing`,
    notReady: "Not ready",
    topics: "Topics",
    topicsCount: (total, writing) => `${total} · ${writing} implementing`,
    recurring: "Recurring",
    empty: "no open cards",
    emptyBoard: {
      title: "The board is empty",
      blurb: "Write down what you want to do next. The agent takes it from there.",
      create: "Create the first card",
      topicTitle: "No topics yet",
      topicBlurb: "Start with whatever you have — an idea, a note, a link, some rough copy.",
      topicCreate: "New topic",
    },
    columns: "Columns",
    goToColumn: (title) => `Show ${title}`,
  },
  card: {
    questionsOne: "1 open question",
    questionsMany: (n) => `${n} open questions`,
    needsYouOne: "1 needs you",
    needsYouMany: (n) => `${n} need you`,
    verify: (n) => `${n} to check by hand`,
    decided: (n) => `Decider answered ${n} for you`,
    creating: {
      mark: "creating",
      markHint: "Being created — it opens once its creator finishes",
      unfinished: "unfinished",
      unfinishedHint: "Its creator stopped short, so this card was never finished",
      resume: "Resume creating",
      resuming: "Resuming…",
      resumeFailed: "could not pick that run back up",
      stopped: "the last run stopped short",
    },
  },
  create: {
    button: "Create task",
    topicButton: "New topic",
    topicFailed: "could not write the topic",
    startFailed: "could not start the agent",
    sheet: {
      headlines: [
        "What do you want to achieve?",
        "What problems are users facing?",
        "What could be improved?",
        "What market trends do you want to follow?",
      ],
      slogan: "Share your idea, even if it’s still rough. Let your agent help clarify it and turn it into actionable tasks.",
      placeholder: "A goal, user feedback, or an idea to validate…",
      modes: "What sending does",
      answer: "Answer, or say what is still wrong",
      discuss: "Discuss",
      addTask: "Add task",
      buildNow: "Build now",
      send: "Send",
      keys: "Esc closes",
      keysDiscuss: "Esc closes and keeps the discussion",
      shipsIn: (release) => `Ships in ${release}`,
      builds: "no review before your branch",
      runtime: {
        label: "The runtime this run uses",
        hint: (runtime) => `Running ${runtime}`,
        agentsOwn: "the agent's",
        notInstalled: "not installed",
        cost: "This run only — Configuration → Agents is untouched.",
      },
      guard: {
        title: "Write a card and build it now?",
        writes: "It writes a card first — a generated title, your words as its whole summary.",
        skips: ["No questions back, and the card gets no plan", "Nothing reviews it before it reaches your branch"],
        cancel: "Cancel",
        confirm: "Build now",
      },
      plan: {
        label: "Plan",
        enlarge: "Enlarge the plan",
        shrink: "Shrink the plan",
        copyPath: "Copy the path",
        rewriting: "Rewriting",
        start: "Start planning",
        build: "Build now",
        notYet: "Not yet",
        startHint:
          "Start planning breaks the plan into cards and refines each one first; Build now writes a single card and builds it.",
        tryAgain: "The last run wrote no cards. The plan is as you left it.",
        buildAgain: "The last build wrote no card. The plan is as you left it.",
        planning: "Writing the cards from this plan…",
        building: "Building from this plan…",
      },
    },
  },
  feedback: {
    button: "Feedback",
    sheet: {
      title: "Tell the AI4Kanban team",
      blurb:
        "Goes to t.ai4kanban.dev, this submission only. No card, no conversation and no run log is sent with it, and there is no box for an address — we cannot write back.",
      placeholder: "What went wrong, or what would make this better…",
      send: "Send feedback",
      sending: "Sending…",
      sent: "Sent. It reaches the team one way — no reply comes back.",
      noReply: "One way. You will not get a reply.",
    },
    link: {
      expand: "Link a landed task",
      cancel: "Cancel linking and feedback",
      search: "Search archived cards by number or title",
      empty: "No archived card matches.",
      failed: "The archive could not be read.",
      retry: "Try again",
      clear: "Unlink this task",
      share: "Share this description with the AI4Kanban team",
      shareNote:
        "This submission only, to t.ai4kanban.dev. No card, conversation or run log goes with it.",
      diagnostics: "Attach diagnostics · this submission only",
      diagnosticsNote: "Open one to read exactly what would be sent, or take it out.",
      parts: {
        card: "Card body",
        chat: "Conversation",
        trace: "Run log",
        environment: "Environment",
      },
      size: (bytes) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} kB`),
      partCut: "shortened",
      drop: "Remove",
      restore: "Put back",
    },
    taskSent: "Your task was created, and the feedback went. It reaches the team one way — no reply comes back.",
    failed: {
      task: "Your task was created. The feedback did not go:",
      standing: "The feedback did not go:",
      tooLarge: "it is too large — take an attachment out and try again.",
      refused: "the endpoint refused it.",
      unreachable: "the endpoint could not be reached.",
    },
  },
  partner: {
    expand: "Link a previous task",
    cancel: "Cancel linking and feedback",
    search: "Search by number or title",
    onBoard: "on the board",
    empty: "No card matches.",
    failed: "The board could not be read.",
    retry: "Try again",
    clear: "Unlink this task",
    share: "Share this description with the AI4Kanban team",
    shareNote: "Partner feedback is on, so the related conversation and code go with it.",
    off: "Turn partner feedback on to share this problem with the team.",
    turnOn: "Turn it on",
    terms: "See what is shared",
    working: "Gathering the material…",
    sent: {
      title: "Sent — thank you for pointing this out.",
      number: "Feedback number",
      copy: "Copy",
      copied: "Copied",
      erase: (email) => `To have what you shared deleted, send the feedback number to ${email}.`,
    },
    notSent: {
      title: "It did not go. Try again in a moment.",
      retry: "Try again",
      textOnly: "Send the description only",
    },
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
        "A sentence or two, in your own words — what this version is trying to ship. It is what filling the release plans against. Empty is fine.",
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
        `**${release}** shipped. What it shipped is recorded, and it comes off the list for good — a closed release can't be reopened.`,
      reading: "Reading what this close records…",
      shippedNone: "No card was archived under it — it goes down as having shipped nothing.",
      shippedOne: "1 archived card goes down as shipped.",
      shippedMany: (n) => `${n} archived cards go down as shipped.`,
      changelogNone: "No changelog is written — there is nothing to write it from.",
      changelog:
        "An agent then writes a short changelog saying what the version changed. It runs in the background; watch it in the runs panel.",
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
        `**${release}** will not ship. It comes off the list with no shipped record — its open cards return to no release. Cards already archived under it stay archived.`,
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
        "A version id, in your own words — `v1`, `0.5.0`, `august`. The board switches to it, so what you write next lands in it.",
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
