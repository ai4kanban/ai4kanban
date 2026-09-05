// English copy for the Configuration dialog — the source of truth a second
// language mirrors key for key. Writing rules: `i18n/index.ts`.
import type { ConfigurationCopy } from "./types";

const en: ConfigurationCopy = {
  open: "Configuration",
  title: "Configuration",
  sections: "Configuration sections",
  section: {
    general: "General",
    runtimes: "Runtimes",
    agents: "Agents",
    rules: "Rules",
    workspace: "Workspace",
    cloud: "Notifications",
  },
  general: {
    setup: "Setup",
    delivery: "Delivery",
    runs: "Runs",
    privacy: "Privacy",
    language: "Language",
  },
  runtimes: {
    title: "Runtimes",
    listCaption: "The names this board runs its work under",
    boardsOwn:
      "These settings are the board's: they travel with the repository, so every checkout runs the same thing. Add a runtime to run some flows on something else.",
    global: "global",
    runs: (harness, model) => (model ? `${harness} · ${model}` : harness),
    unknownAgent: (agent) => `Unknown agent "${agent}"`,
    add: "Add runtime",
    addBlurb:
      "A name the board holds, with an agent of its own. The board keeps **default** beside it and stays global on it, so every flow goes on running what it runs now.",
    namePlaceholder: "plan",
    save: "Save",
    cancel: "Cancel",
    rename: "Rename",
    makeGlobal: "Make global",
    remove: "Remove",
    removeTitle: (runtime) => `Remove ${runtime}?`,
    removeBlurb: "What it runs as goes with it.",
    removeMoves: (names, globalRuntime) =>
      `${names} move to **${globalRuntime}**. Repoint with \`akb agent\`.`,
    removeNothing: "Nothing names it.",
    removeGlobal: (runtime) =>
      `**${runtime}** is the board's global runtime. Make another one global first.`,
    confirmRemove: "Remove",
    keyIsBoards: "The board's key, in docs/kanban/.env — shared by every runtime on this agent.",
    addFailed: "couldn't add the runtime",
    removeFailed: (runtime) => `couldn't remove ${runtime}`,
    renameFailed: (runtime) => `couldn't rename ${runtime}`,
    globalFailed: (runtime) => `couldn't make ${runtime} the global runtime`,
  },
  harness: {
    notInstalled: "not installed",
    notHere: (binary) => `${binary} isn't on this machine`,
    missingHint: (binary) =>
      `\`${binary}\` isn’t on this machine, so a run would fail to start. Install it:`,
    loggedOut: "logged out",
    loggedOutHere: (binary) => `${binary} is here but nobody is logged in`,
    loggedOutHint: (binary) =>
      `Nobody is logged in to \`${binary}\`, so a run under it would fail. Log in:`,
    gaps: (harness) => `Not supported by ${harness}`,
    override: (command) => `Runs your override: \`${command}\``,
    saveFailed: "couldn't save the agent setting",
    saveSettingFailed: (setting) => `couldn't save the ${setting} setting`,
    saveSecretFailed: (setting) => `couldn't save the ${setting}`,
    unknown: (asked, running) =>
      `Your ui.config.json asks for the agent "${asked}", which this UI doesn't know, so ${running} is running instead.`,
    staleCommand:
      'Your ui.config.json still has the old top-level "command" key. Nothing reads it — the agent above is what runs. You can delete the key; it\'s your file, so nothing here touches it.',
    waitingFor: (boxes) => `Not saved yet — fill in the ${boxes} below and this pick saves itself.`,
    fromConfig: (value) => `${value} (from your ui.config.json)`,
    secret: {
      set: "Set — it’s in docs/kanban/.env",
      save: "Save",
      replace: "Replace",
      clear: "Clear",
      cancel: "Cancel",
    },
    test: {
      run: "Test",
      running: "Testing…",
      blurb: (harness) =>
        `Sends one tiny message through ${harness} as it is saved here. On a paid provider that costs a few tokens.`,
      ran: (harness) => `Ran ${harness}, not the agent above.`,
      unsavedPick: "Save the provider pick above first — Test runs the setup that is saved.",
      trying: "Running one small chat through this setup…",
      passed: (seconds) => `Passed — the agent answered in ${seconds}.`,
      seconds: (s) => `${s}s`,
      failedMissing: (command) => `Failed — the ${command} command isn't on this machine.`,
      failedTimeout: (seconds) => `Failed — no answer after ${seconds}, so the test gave up.`,
      failed: "Failed — the agent didn't answer.",
      install: "Install it, then test again:",
    },
  },
  specAgents: {
    title: "Spec agents",
    blurb:
      "Choose which specialists may add focused recommendations while a card is being planned. They never run while a card is being built. Add your own in docs/kanban/agents/.",
    loading: "Loading spec agents…",
    tooOld:
      "The board's rules in this project are too old to list the spec agents. Update the command and reopen this dialog.",
    enabled: "Enabled",
    paused: "Paused",
    problems: "Problems on this board:",
    switchOn: (agent) => `${agent} — enabled`,
    switchOff: (agent) => `${agent} — paused`,
    contributes: "Contributes",
    runsWhen: "Runs when",
    change: "Change",
    setting: (label, value) => `${label}: **${value}**`,
    settingWithCost: (label, value, cost) => `${label}: **${value}** — ${cost}`,
    flipFailedOn: (agent) => `couldn't switch ${agent} on`,
    flipFailedOff: (agent) => `couldn't switch ${agent} off`,
    saveFailed: (agent) => `couldn't save ${agent}'s setting`,
  },
  delivery: {
    frozen: "A change applies to deliveries started afterwards.",
    commits: {
      title: "Automatic Git commits",
      body: "On, each build gets its own branch and worktree, so several run side by side. Off, it builds in your project folder, one at a time.",
      failedOn: "couldn't switch automatic Git commits on",
      failedOff: "couldn't switch automatic Git commits off",
    },
    approval: {
      title: "Approve diffs before landing",
      body: "A reviewed build waits on the card's Approval tab until you approve the exact tree it would land.",
      failedOn: "couldn't switch diff approval on",
      failedOff: "couldn't switch diff approval off",
    },
    switchOn: (setting) => `${setting} — on`,
    switchOff: (setting) => `${setting} — off`,
  },
  runs: {
    silence: {
      title: "End a silent run after",
      body: "A run whose agent stops producing any output ends as a failure. The card keeps its work, ready to resume.",
      off: "Off — a run whose agent has gone quiet keeps its card until you stop it.",
      unit: "minutes",
    },
    whole: "that limit is a whole number of minutes, or 0 to switch it off",
    failed: "couldn't save the silence limit",
  },
  flowRules: {
    title: "Flow rules",
    blurb:
      "One rule, in your own words, added to the end of a flow's instructions. Every session the board starts from that flow reads it — so a long rule makes every card slower.",
    loading: "Loading flows…",
    tooOld:
      "The board's rules in this project are too old to carry flow rules. Update the command and reopen this dialog.",
    flows: "Flows",
    set: (inUse, total) => `${inUse} of ${total} set`,
    saved: "Saved",
    rule: (flow) => `Rule for the ${flow} flow`,
    placeholder: (flow) => `No rule. Every \`${flow}\` run reads exactly what the board ships.`,
    saveFailed: (flow) => `couldn't save the ${flow} rule`,
  },
  skill: {
    checking: "Checking…",
    checkAgain: "Check again",
    writing: "Writing…",
    writeAgain: "Write the skill again",
    skillRow: "AI4Kanban skill",
    commandRow: "akb command",
    status: {
      unchecked: "Couldn't check",
      notInstalled: "Not installed",
      partial: "In some agents only",
      updateAvailable: "Update available",
      ready: (version) => `Ready · ${version}`,
    },
    commandStatus: {
      unchecked: "Couldn't check",
      notFound: "Not found",
      behind: (version) => `${version} · update available`,
      ready: (version) => `Ready · ${version}`,
    },
    button: { add: "Add the skill", addRest: "Add the rest", update: "Update the skill" },
    addFailed: "couldn't add the skill",
    details: "Technical details",
    writtenBy: (version) => `Skill files written by AI4Kanban ${version}`,
    folder: {
      absent: (agent) => `nothing here (${agent})`,
      linked: "a link into a source checkout — left alone",
      unknown: (agent) => `installed, though it doesn't say which version (${agent})`,
      stale: (version, carries, agent) => `${version}, older than ${carries} (${agent})`,
      ready: (version, agent) => `${version} (${agent})`,
    },
    receipt: {
      ok: "Done — your coding agent can drive this board.",
      nothing: "Nothing was written.",
      wrote: (path, files) => `\`${path}/\` — wrote ${files}`,
      refreshed: (path, files) => `\`${path}/\` — refreshed ${files}`,
    },
    reviewDiff: "Changes project files. Review `git diff` before committing.",
    behind: {
      runThis: "Run this in a terminal to use the current AI4Kanban flows:",
      copy: "Copy",
    },
  },
  privacy: {
    title: "Usage reporting",
    body: "Share anonymous feature use and failures. Never code, card text, project names or file paths.",
    details: "See every event and field",
    on: "On",
    off: "Off",
    switchOn: (name) => `${name} is on`,
    switchOff: (name) => `${name} is off`,
    installId: (id) => `Install id: ${id}`,
    nothingSent: "Nothing has been sent yet, so there is no install id.",
    offNote:
      "Turning this off stops new reports immediately, removes anything waiting to be sent, and forgets the install id.",
    unreadable:
      "The settings file on this machine cannot be read, so nothing is reported and nothing can be saved. Fix or remove it, then reopen this.",
    failedOn: "usage reporting could not be turned on",
    failedOff: "usage reporting could not be turned off",
  },
  language: {
    group: "Language",
    saveFailed: "couldn't save that language",
    comingSoon: "Coming soon",
    note: "Follows you into every board on this machine. What `akb` prints, and what an agent writes onto a card, stay English.",
  },
  workspace: {
    checking: "Reading the workspace…",
    thisBoard: "This board",
    preview: "Invite-only preview",
    boardHint:
      "Cloud holds the cards, memory, releases and history. The repository keeps the pointer.",
    rename: "Rename",
    save: "Save",
    cancel: "Cancel",
    nodes: "Execution nodes",
    nodesHint: "The machines allowed to run this board’s work.",
    noNodes: "No machine has opened this board yet.",
    live: "Working now",
    idle: "Idle",
    remove: "Remove",
    removeTitle: (machine) => `Remove ${machine}?`,
    removeBlurb:
      "Its next write and its next delivery are refused. Opening the board there again registers it back.",
    nodeOf: (handle) => `@${handle}`,
    members: "Members",
    membersHint: "Everyone who can open this board. Owners also run it.",
    owner: "Owner",
    member: "Member",
    handlePlaceholder: "GitHub handle",
    add: "Add",
    addBlurb:
      "They have to be in the Cloud preview already. If they are not, they press Request an invite in the app and you add them once we let them in.",
    makeOwner: "Make owner",
    makeMember: "Make member",
    removeMemberTitle: (handle) => `Remove @${handle}?`,
    removeMemberBlurb:
      "Their next write is refused. A board they already have open stays readable until they change something.",
    ownerOnly: "An owner of this workspace runs these.",
    yourCopy: "Your copy",
    export: "Export to a folder",
    exportHint:
      "The whole board as markdown, archive included. The preview keeps no backups — this is the only copy you can restore from.",
    exportButton: "Export",
    exported: (folder) => `Written to ${folder}. It opens as a Local board.`,
    leave: "Leave Cloud",
    leaveHint:
      "Board back in docs/kanban/, pointer off, folder un-ignored — one commit you review, so git tracks the cards again.",
    leaveButton: "Leave Cloud…",
    leaveTitle: "Leave Cloud?",
    leaveBlurb:
      "The workspace stays where it is and keeps everything in it. This checkout stops reading it and becomes a Local board.",
    ends: "Ends the workspace",
    delete: "Delete workspace",
    deleteHint: "Everything in it goes, for everyone. Export first.",
    deleteButton: "Delete…",
    deleteTitle: (name) => `Delete ${name}?`,
    deleteBlurb:
      "The cards, the archive, the releases, the memory and the whole history go — for every machine that opens this workspace, and this checkout stops pointing at it. The preview keeps no backups.",
    offerTitle: "Take the copy out of the repository",
    offerBlurb: (cards) =>
      cards === 1
        ? "One commit: 1 board file leaves git, .ai4kanban.json is added, and docs/kanban/ joins the root .gitignore. Nothing else in your working tree goes with it."
        : `One commit: ${cards} board files leave git, .ai4kanban.json is added, and docs/kanban/ joins the root .gitignore. Nothing else in your working tree goes with it.`,
    offerSafe:
      "Nothing is lost either way — the cards are in git history, and what you decide here is whether git records the move.",
    commit: "Commit this change",
    keep: "Keep the files as they are",
    committed: "Committed. The board is the workspace from here on.",
    left: (cards) =>
      cards === 0
        ? "This checkout no longer points at the workspace. What is in docs/kanban/ is the board again."
        : cards === 1
          ? "1 card is back in docs/kanban/, and this checkout no longer points at the workspace."
          : `${cards} cards are back in docs/kanban/, and this checkout no longer points at the workspace.`,
    leftBlurb: (cards) =>
      cards === 1
        ? "One commit: 1 board file goes back into git, .ai4kanban.json is removed, and docs/kanban/ leaves the root .gitignore. Nothing else in your working tree goes with it."
        : `One commit: ${cards} board files go back into git, .ai4kanban.json is removed, and docs/kanban/ leaves the root .gitignore. Nothing else in your working tree goes with it.`,
    reopen: "Reopen this board",
    deleted: (name) => `${name} is gone, and this checkout no longer points at it.`,
    boundary:
      "A workspace holds this board and nothing else — its cards, memory, releases and history. Cloud never receives your repository, never runs an agent, and never reads a card the board has not published.",
    folderPlaceholder: "Folder to write the board into",
  },
  cloud: {
    account: "Account",
    wherePosts: "Where it posts",
    blurb:
      "Where a card that needs you reaches you. One sign-in covers every project on this machine.",
    checking: "Checking this machine…",
    saving: "Saving…",
    unreachable: (why) => `Cloud could not be reached: ${why}. Nothing on this board is affected.`,
    signedIn: "Signed in",
    signOut: "Sign out",
    notAdmitted: "This account is not in the preview yet.",
    howWeAnswer:
      "We read every request by hand. Once we approve it your account is in, and we email you. No date is promised.",
    asked: (when) => `Asked ${when} — we’ll email`,
    askedUndated: "already",
    requestInvite: "Request an invite",
    asking: "Asking…",
    expired: "Your Cloud sign-in expired.",
    expiredBody: "Nothing was lost. Sign in again and whatever was waiting to send carries on.",
    inviteOnly: "Cloud is an invite-only preview.",
    inviteOnlyBody:
      "Sign in with GitHub and we will say straight away whether your account is in it.",
    boundary:
      "Cloud relays this board’s questions and review requests, and the decisions made on them. It never receives your repository, never runs an agent, and never reads a card the board has not published.",
    terms: "Signing in confirms you have read the",
    privacyLink: "Privacy Policy",
    termsAnd: " and the ",
    termsLink: "Terms of Service",
    termsEnd:
      ". GitHub is asked for your name, your handle and your verified email address, and nothing else — no repository access.",
    signIn: "Sign in with GitHub",
    signInAgain: "Sign in again",
    needsApp:
      "Signing in needs the AI4Kanban app — the consent screen comes back to it. Open this project there once, and every terminal on this machine is signed in with it.",
    waiting: "Waiting for the consent screen in your browser…",
    finishFailed: "that sign-in did not complete",
    signOutFailed: "couldn't sign out",
    silence: {
      title: "Silence this machine",
      blurb: "Every board stops interrupting you. The bell keeps filling.",
    },
    slack: {
      title: "Slack",
      blurb: "Decide from a message instead of the app.",
      checking: "Checking…",
      connect: "Connect",
      connecting: "Connecting…",
      waiting: "Waiting for the consent screen in your browser…",
      disconnect: "Disconnect",
      disconnecting: "Disconnecting…",
      inWorkspace: { before: "in workspace", after: "" },
      postsTo: "Posts to",
      pickChannel: "— pick a conversation —",
      loadingChannels: "Reading Slack…",
      noChannels:
        "Nothing to post to yet. Invite AI4Kanban to a channel in Slack, then pick it here.",
      refused: "Slack refused the last message",
      needsApp:
        "Connecting Slack needs the AI4Kanban app — the consent screen comes back to it.",
      unavailable: "This Cloud service carries no Slack app to connect to.",
      connectFailed: "that connection could not be started",
      saveFailed: "that destination could not be saved",
      disconnectFailed: "that could not be disconnected",
    },
    lark: {
      title: "Lark",
      install:
        "An administrator installs AI4Kanban in your organisation from its app directory first.",
      checking: "Checking…",
      connect: (cloud) => `Connect ${cloud}`,
      connecting: "Connecting…",
      waiting: "Waiting for the consent screen in your browser…",
      disconnect: "Disconnect",
      disconnecting: "Disconnecting…",
      postsTo: "Posts to",
      pickChat: "— pick a chat —",
      loadingChats: "Reading Lark…",
      noChats: "Nothing to post to yet. Add AI4Kanban to a group in Lark, then pick it here.",
      connectedBy: (person) => `Connected by ${person}.`,
      refused: (cloud) => `${cloud} refused the last message`,
      needsApp: "Connecting Lark needs the AI4Kanban app — the consent screen comes back to it.",
      unavailable: "This Cloud service carries no Lark app to connect to.",
      comingSoon: "Coming soon",
      connectFailed: "that connection could not be started",
      saveFailed: "that destination could not be saved",
      disconnectFailed: "that could not be disconnected",
    },
    server: {
      title: "Run this board's work here",
      blurb: "An approval pressed anywhere runs on this machine. A board runs on one machine only.",
      heldBy: (machine) =>
        `This board runs its work on **${machine}**, so an approval waits for that machine. Move it here if that machine has gone.`,
      moveHere: "Move it here",
      moving: "Moving…",
      switchOn: "Run this board's work here — on",
      switchOff: "Run this board's work here — off",
      runsAs: "Runs as",
      notSet: "not set",
    },
    notifications: {
      title: "This board",
      watching: "Watching",
      allReleases: "All",
      pickRelease: "— pick a release —",
      anyRelease: "Every card raises, whatever release it is promised to.",
      onlyThisRelease: "Cards in any other release raise nothing.",
      releaseClosed:
        "The release you were watching closed. Nothing fills the bell until you pick another.",
      saveFailed: "that could not be saved",
    },
  },
};

export default en;
