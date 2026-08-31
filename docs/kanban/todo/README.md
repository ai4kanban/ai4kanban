# Board

Open tasks for ai4kanban. One card per file. Ids are global and never reused —
the number at the front of a filename is the task id.

Blockers gate the next milestone; clear them first. Everything else sits under a track.

## Blockers

_(none)_

## features

- [#56 Let a user read and edit the board in Obsidian](features/56-read-and-edit-the-board-in-obsidian.md)
- [#116 Unstick cards that sit on the board too long](116-stuck-cards/root.md)
- [#182 Sign the Mac build so it opens with no warning](features/182-sign-the-mac-build-so-it-opens-with-no-warning.md)
- [#183 Install the Mac app with one Homebrew command](features/183-install-the-mac-app-with-one-homebrew-command.md)
- [#250 Bring a task in from a file or your voice, not only typed text](250-friendly-task-import/root.md)
- [#266 Make the chat rail a full chat, not a message box](266-chat-rail-full/root.md)
- [#209 Make the daily loop something you can do from buttons](209-daily-loop-buttons/root.md)
- [#311 Bring team collaboration to AI4Kanban Cloud](311-team-collaboration-cloud/root.md)
- [#314 Build the Cloud control plane a workspace runs on](373-cloud-board-browser/features/314-build-the-cloud-control-plane-a-workspace-runs-on.md)
- [#315 Store the board in Cloud without moving the codebase](373-cloud-board-browser/features/315-store-the-board-in-cloud.md)
- [#316 Use Cloud boards safely from the app and CLI](373-cloud-board-browser/features/316-use-cloud-boards-safely-from-the-app-and-cli.md)
- [#317 Lead onboarding with Local and make Cloud an explicit choice](373-cloud-board-browser/features/317-lead-onboarding-with-local-and-make-cloud-explicit.md)
- [#313 Import GitHub Issues and mirror progress back](features/313-import-github-issues-and-mirror-progress-back.md)
- [#322 Open a Cloud board in the browser](373-cloud-board-browser/features/322-open-a-cloud-board-in-the-browser.md)
- [#328 Notify a workspace's owners and members about a card that needs them](311-team-collaboration-cloud/features/328-notify-a-workspace-s-owners-and-members-about-a-card-that-ne.md)
- [#360 Track the card in its Lark message and log each event in its thread](features/360-lark-card-message.md)
- [#363 Connect 飞书 by scanning a QR code, with no app to install](features/363-feishu-qr-connect.md)
- [#341 Chat with the board from Slack](features/341-chat-with-the-board-from-slack.md)
- [#357 Lay the board out for a phone screen](373-cloud-board-browser/features/357-phone-layout.md)
- [#364 Review and Resolve a Cloud card in the browser](373-cloud-board-browser/features/364-browser-card-decisions.md)
- [#365 Act on Cloud task events from Discord](features/365-discord-connector.md)
- [#371 Start a run on the computer its runtime names](features/371-run-on-runtime-computer.md)
- [#373 Put a board on Cloud and open it in a browser](373-cloud-board-browser/root.md)
- [#374 Render the board without the local machine](373-cloud-board-browser/features/374-render-board-off-machine.md)
- [#375 Hold a card against a second writer](311-team-collaboration-cloud/features/375-card-lease.md)
- [#376 Add members and roles to a Cloud workspace](311-team-collaboration-cloud/features/376-workspace-members.md)
- [#377 Run the board's work with Kimi CLI](features/377-run-the-board-s-work-with-kimi-cli.md)
- [#378 Run the board on Grok Build, xAI's coding agent](features/378-run-the-board-on-grok-build-xai-s-coding-agent.md)
- [#379 Run the board's work with Antigravity CLI](features/379-run-the-board-s-work-with-antigravity-cli.md)
- [#380 See archived tasks in the board UI](features/380-see-archived-tasks-in-the-board-ui.md)

## skill

- [#112 Move a module's calls into its memory when the map gains that module](skill/112-move-a-module-s-calls-into-its-memory-when-the-map-gains-tha.md)
- [#141 Update the sibling tasks when one task's plan changes](skill/141-update-the-sibling-tasks-when-one-task-s-plan-changes.md)
- [#157 Turn a spec you already wrote into the cards that build it](skill/157-turn-a-spec-you-already-wrote-into-the-cards-that-build-it.md)

## distribution

- [#202 Test whether the board changes what a coding agent builds](202-board-vs-no-board/root.md)
- [#292 See how the app is actually used, from download to daily work](292-app-telemetry/root.md)
- [#362 Publish the Lark app so anyone can connect it](distribution/362-publish-the-lark-app-so-anyone-can-connect-it.md)

## recurring

- [#181 Competitor analysis loop](recurring/181-competitor-analysis-loop.md)
- [#236 Prune oversized documentation](recurring/236-prune-oversized-documentation.md)

## 202-board-vs-no-board/distribution

- [#203 Write 20 test requests and say what a pass looks like](202-board-vs-no-board/distribution/203-test-requests.md)
- [#204 Run each test request twice — once with the board, once without](202-board-vs-no-board/distribution/204-run-both-ways.md)
- [#205 Score the runs and keep the whole record in the repo](202-board-vs-no-board/distribution/205-score-and-record.md)
- [#206 Show the result on the site and in the README](202-board-vs-no-board/distribution/206-publish-the-result.md)

## 250-friendly-task-import/skill

- [#251 Rewrite raw material into a short brief before any card is written](250-friendly-task-import/skill/251-intake-rewriter.md)

## 250-friendly-task-import/features

- [#252 Attach a file to Create task instead of retyping it](250-friendly-task-import/features/252-attach-a-file.md)
- [#253 Speak a task instead of typing it](250-friendly-task-import/features/253-speak-a-task.md)

## 266-chat-rail-full/features

- [#269 Copy, resend or reword a message without retyping it](266-chat-rail-full/features/269-reply-actions.md)
- [#270 Open up what the agent looked at, and say what the reply cost](266-chat-rail-full/features/270-what-it-did.md)
- [#271 Point at a card in the chat box](266-chat-rail-full/features/271-point-at-things.md)
- [#272 Pick the model for one conversation, not for the whole board](266-chat-rail-full/features/272-per-chat-model.md)
- [#273 Keep past conversations instead of only throwing them away](266-chat-rail-full/features/273-past-conversations.md)

## 209-daily-loop-buttons/features


## 209-daily-loop-buttons/distribution

- [#277 Rewrite the daily-loop guide so each step leads with the button](209-daily-loop-buttons/distribution/277-guide-leads-with-buttons.md)

## 287-per-action-harness/skill


## 287-per-action-harness/features


## 292-app-telemetry/features

- [#293 Ask before any usage data leaves the machine, and let it be turned off](292-app-telemetry/features/293-consent-and-switch.md)
- [#295 Report app opens and which parts of the board get used](292-app-telemetry/features/295-app-usage-events.md)

## 292-app-telemetry/distribution

- [#294 Take in usage events on a server we run](292-app-telemetry/distribution/294-telemetry-service.md)
- [#297 Count how many site visitors go on to download the app](292-app-telemetry/distribution/297-download-rate.md)

## 292-app-telemetry/skill

- [#296 Report the board's own numbers from metrics.csv and record.csv](292-app-telemetry/skill/296-board-numbers.md)
