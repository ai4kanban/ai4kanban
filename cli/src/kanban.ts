// The board's bookkeeping, as the one file every copy of it ships as.
//
// The rules live in this package's `src/`, in TypeScript, and are built into a single
// dependency-free file — `cli/dist/kanban.mjs` — by `scripts/build.mjs`. That one built
// file is what the npm package carries, what the desktop app copies in, and what a board
// UI loads. Edit the sources here; never the built file, which is not even in git.
//
// It is both a program and a module, because the same rules are reached two ways:
//   - run it (`node kanban.mjs <command>`) — the door `akb install` and the desktop app
//     open, with the same commands, words and exit codes it has always had,
//   - import it (`akb board <move>`) — the CLI's door, which asks for the compact help
//     and puts the command's own name in front of a refusal.
//
// What the moves are, and what each one does, is `node kanban.mjs help`.
//
//   init | memory-init | setup-done | setup-status     the board itself
//   create | update | update-questions | tag | list    a card's fields
//   run-blocker                                        pause an implementation cleanly
//   schedule                                           what a blocked card runs when freed
//   release new | goal | list | close | drop           the versions being planned
//   archive | reject | run | migrate | peek | metrics  taking a card off, and the rest
//
// It is the ONLY sanctioned writer of docs/kanban/next-id, of a card's frontmatter, and of
// docs/kanban/metrics.csv. Write/Edit are for a card's body.

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { runAgent } from './lib/agent-cli'
import { runBoard } from './lib/board-cli'
import { SKILL_VERSION } from './version'

export { runBoard } from './lib/board-cli'
export type { RunBoardOptions } from './lib/board-cli'
export { runAgent } from './lib/agent-cli'
export type { RunAgentOptions } from './lib/agent-cli'
export { SKILL_VERSION } from './version'

// The blank `docs/kanban/config.md`, and which of its settings a board's own config has
// never heard of. `init` seeds the file; `akb update` reads the second one to name a
// setting this release added. Exported because the config template stopped being a file
// in the installed folder — the command carries it now (lib/config-template.ts).
export { CONFIG_TEMPLATE, missingConfigKeys } from './lib/config-template'

// The coding agent skill: whether this project has one, and the move that adds it. Not
// part of installing a board (#174) — `akb install` scaffolds the board and stops there,
// and this is what the UI, `akb skill install`, and a fresh chat call.
export { ensureSkillInstalled, installSkill, readCommandState, readSkillState, rulesPath, NEWER_COMMAND_LINE } from './lib/skill/install'
export type * from './lib/skill/types'

// What a board UI reaches for: the same run engine `akb` drives, so a run started from a
// button and one started in a terminal are one thing — one record, one set of rules, one
// copy of the words each run sends the agent. Nothing here is a second implementation of
// anything the commands do.
export {
  discardCost,
  getRun,
  listRuns,
  markSpawned,
  openResume,
  openRun,
  repairDeliveries,
  stopRun,
  titleOf,
} from './lib/agent/sessions'
// A delivery (#301): the whole job one Implement click starts, several runs long. The
// board reads the live rows to hold a card still and to say what is building it; the
// permanent record is one file per delivery under docs/kanban/deliveries/.
export { activeDelivery, heldByDelivery, listDeliveries } from './lib/agent/deliveries'
// Ending, discarding and approving a delivery are board WRITES, so they are operations of
// the contract below like every other one (#312) — the card page's buttons and `akb cancel`,
// `akb discard` and `akb approve` are the same call.
export { approveDelivery, cancelDelivery, discardDelivery } from './lib/view/api'
export { spawnWatcher } from './lib/agent/launch'
export { buildPrompt } from './lib/agent/prompts'
export { refinementRequest } from './lib/agent/refine'

// The flow rules (#306): one rule per flow, in the user's own words, appended to that
// flow's built-in prompt. The Rules pane in the Configuration dialog reads and writes them
// through these, the way it reads every other setting — the list of flows is the board's
// own, so a flow shipped later takes a rule with nothing else touched.
export { readFlowRules, setFlowRule } from './lib/agent/rules'

// The chat (#240): the board's conversation with its agent, and each card's. A screen
// drives it through these — `sendChatMessage` streams the reply back through `onText`, so
// a chat in the app and a chat in a terminal are the same conversation, held by the same
// code, in the same file. Nothing here touches the run record: a conversation is not a run.
export { clearChat, readChat, readChatView, sendChatMessage } from './lib/agent/chat'
export type { SendOptions as ChatSendOptions } from './lib/agent/chat'
export { chatAgent } from './lib/agent/resolve'
export { agentInfo, activeSettings, setupInstruction, settingSaveError } from './lib/agent/resolve'
export {
  autoCommitAllowed,
  diffApprovalRequired,
  setAutoCommit,
  setDiffApproval,
  setHarness,
  setHarnessSetting,
  setSecret,
} from './lib/agent/settings'
export { testConnection } from './lib/agent/test'
export { ensureAkbDir, setBoardRoot } from './lib/paths'

// The Cloud sign-in (#326): the account this MACHINE acts as, held in one file outside every
// repository, so the board UI server and a terminal `akb` are the same account. The Cloud
// section of the Configuration dialog reads and writes it through these; a sign-in starts
// there and nowhere else, and the desktop app is only what catches the answer.
export { readCloudAccount, signOutOfCloud } from './lib/cloud/account'
export type { CloudAccount, CloudMove, CloudState } from './lib/cloud/account'
// The two doors out of the not-admitted state (#327): ask us for an invite, and spend the
// code we answer with. Both are open to a verified sign-in we have not admitted.
export { redeemCloudInvitation, requestCloudInvite } from './lib/cloud/account'
export { finishSignIn as finishCloudSignIn, startSignIn as startCloudSignIn } from './lib/cloud/signin'
export { accessToken as cloudAccessToken, sessionFile as cloudSessionFile } from './lib/cloud/session'
export type { CloudSession, TokenResult as CloudTokenResult } from './lib/cloud/session'
// What #319 hands its private Realtime connection, so a refreshed sign-in reaches the
// socket as well as the Worker.
export { keepAuthorized as keepCloudRealtimeAuthorized } from './lib/cloud/realtime'
export { cloudConfigured, SIGN_IN_REDIRECT as CLOUD_SIGN_IN_REDIRECT, URL_SCHEME as CLOUD_URL_SCHEME } from './lib/cloud/config'

// The Cloud notification center (#319): the events this machine's boards raise, and the bell
// that carries every one of them. A board turns itself on as soon as this machine is signed
// in — notifications are not a setting — so what is left to choose is the release it watches.
//
// The board server the window is showing calls `startCloudCenter(true)` and draws from
// `readCloudCenter`; a backgrounded one calls neither and keeps publishing over `fetch`,
// because one subscription per server would raise one event's notification several times
// over. Optional to the UI like every Cloud move above: a project running older rules draws
// no bell rather than failing to draw the header.
export {
  openNotification,
  readCloudCenter,
  startCloudCenter,
  stopCloudCenter,
} from './lib/cloud/center'
export type { NotificationAlert, NotificationCenter, NotificationRow } from './lib/cloud/center'
// `enableBoardNotifications` and `disableBoardNotifications` are no surface's to call any
// more — `readBoardNotifications` registers the board itself — and stay exported so a UI
// build that predates that still works against these rules.
export {
  disableBoardNotifications,
  enableBoardNotifications,
  readBoardNotifications,
  setBoardServer,
  watchRelease,
} from './lib/cloud/notifications'
export type { BoardNotifications } from './lib/cloud/notifications'

// The board's server (#318): the machine that runs an approval taken anywhere else. A board
// attaches exactly one, and it is registered when its notifications are turned on.
//
// `startCloudServer` is the opposite of `startCloudCenter` above: EVERY enabled board's
// server calls it, backgrounded ones included, because a request is addressed to one board's
// server and the board a user has switched away from is exactly the one whose approval would
// otherwise never run. Idempotent, like the bell's.
export { startCloudServer, stopCloudServer } from './lib/cloud/board-server'
export type { BoardServer } from './lib/cloud/servers'
// The two moves a card page offers a delivery whose server was killed under it.
export { cancelCloudRequest, resumeCloudRequest } from './lib/cloud/requests'
export { notificationsSilenced, setNotificationsSilenced } from './lib/machine/settings'
export { readCloudBoards } from './lib/cloud/boards'
export type { CloudBoard } from './lib/cloud/boards'
// What a click on this machine records against a live event, so the same durable action is
// on Cloud whichever surface took it.
export { recordCloudActionFor } from './lib/cloud/publish'
export type * from './lib/cloud/events'

// The language the app and the agent work in (#334): one answer for this MACHINE, held in
// `~/.ai4kanban/settings.json` beside the Cloud sign-in. The Language section of the
// Configuration dialog reads and writes it through these, and the desktop app reads it at
// startup so its first menu is right. It is never a board setting — a language is a fact
// about the reader, and follows the person into every project.
// `languageChosen` and `languageForTag` are the desktop app's (#339): on the launch that
// finds nothing said, it walks the system's preferred languages through the mapping here and
// saves the first this build has a copy for.
export { languageChosen, readLanguage, setLanguage, settingsFile as machineSettingsFile } from './lib/machine/settings'
export {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_NAMES,
  LANGUAGE_TAGS,
  LANGUAGES,
  languageForTag,
} from './lib/machine/types'
export type { Language } from './lib/machine/types'

// The spec agents (#191): the list a screen draws — each one's two lines and whether it is
// switched on — and the switch itself. The words and the order are the board's own, so the
// Agents section in the Configuration dialog and `akb spec` can never say different things.
export { readSpecAgents, setSpecAgentEnabled, setSpecAgentSetting } from './lib/spec-agents'
export type * from './lib/agent/types'

// …and the board itself: the columns, one card in full, the releases, the metrics, the
// setup checklist, the goal, the board's memory (the project's and each module's) — plus every write a screen makes and the
// question the board's background timer asks each tick. One door (lib/view/api.ts), the same rules the commands
// run, so a button and a command can never disagree about what a card says.
export {
  addVerify,
  allCards,
  boardStamp,
  clearSchedule,
  closePlan,
  closeRelease,
  deliveryDiff,
  deliveryPlan,
  dropPlan,
  dropRelease,
  dropVerify,
  fillPlan,
  findCard,
  finishSetupStep,
  newRelease,
  nextWork,
  patchCard,
  readBoard,
  readGoalText,
  readMemoryFile,
  readMemoryModules,
  readMetricsView,
  readModules,
  readReleases,
  readScoreView,
  readSetupDraft,
  readSetupState,
  saveGoal,
  saveProject,
  setCardsRelease,
  setReleaseGoal,
  setSchedule,
} from './lib/view/api'
export type * from './lib/view/types'

// The board's operation contract (#312): the one set of operations every part of AI4Kanban
// reads and writes a board through, and the provider answering them. Local is the markdown
// board in `docs/kanban/`; a board that lives elsewhere is one more provider and nothing
// else changed. `setBoardProvider` is what puts a different one in front of the callers.
export { board, envelope, moveTarget, newOpId, setBoardProvider, withLease } from './lib/board'
export { NO_REVISION } from './lib/board'
export type * from './lib/board/contract'

const SELF = fileURLToPath(import.meta.url)

// True when this file IS the program, rather than something another program imported.
// Both sides are resolved through their real path first: this repo installs its own skill
// as a symlink, and the two spellings of the same file must still count as one.
function invokedDirectly(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return fs.realpathSync(entry) === fs.realpathSync(SELF)
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  const argv = process.argv.slice(2)
  // The one word this door answers that the board's moves don't: the process that watches
  // a run, spawned by whichever command started it. Spelled so it can never collide with a
  // move — `run` has meant "record one pass of a recurring card" here since it existed.
  if (argv[0] === '__watch') {
    void runAgent(argv, { program: 'akb' }).then((code) => {
      process.exitCode = code
    })
  } else if (argv[0] === 'board' || argv[0] === 'guide') {
    // The two doors every flow names by hand — `akb board <move>` and `akb guide <topic>` —
    // answered here under the same spellings (#173). This file is the copy of the rules the
    // board is actually running, and a setup run is told to call it: without these, an
    // agent on a machine with no `akb` on its PATH would have to translate every line of
    // every flow into the legacy door below, or fetch a different version off npm.
    //
    // Neither word collides: there is no `board` move and no `guide` move. The rest of the
    // run commands are deliberately left out — they DO collide (`create`, `archive`,
    // `reject` are board moves here), and a run never starts another run anyway.
    if (argv[0] === 'guide') {
      void runAgent(argv, { program: `node ${SELF}` }).then((code) => {
        process.exitCode = code
      })
    } else {
      void runBoard(argv.slice(1), {
        program: `node ${SELF} board`,
        style: 'board',
        version: `ai4kanban ${SKILL_VERSION}`,
        usage: `node ${SELF} board <move> [args]`,
      }).then((code) => {
        process.exitCode = code
      })
    }
  } else {
    void runBoard(argv, {
      program: 'kanban',
      style: 'legacy',
      version: `ai4kanban ${SKILL_VERSION}`,
      // Absolute, like the two doors above: this line is printed for a person to paste, and
      // a path relative to a working directory that may be anywhere runs from that one
      // folder and nowhere else.
      usage: `node ${SELF} <command> [args]`,
    }).then((code) => {
      process.exitCode = code
    })
  }
}
