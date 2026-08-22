# Board

Open tasks for ai4kanban. One card per file. Ids are global and never reused —
the number at the front of a filename is the task id.

Blockers gate the next milestone; clear them first. Everything else sits under a track.

## Blockers

_(none)_

## features

- [#45 Implement a whole group task in one goal-mode agent run](features/45-implement-a-whole-group-task-in-one-goal-mode-agent-run.md)
- [#48 Run each implement in its own git worktree and merge it back to main](features/48-run-each-implement-in-its-own-git-worktree-and-merge-it-back.md)
- [#50 Show what a run changed in the working tree](features/50-show-what-a-run-changed-in-the-working-tree.md)
- [#56 Let a user read and edit the board in Obsidian](features/56-read-and-edit-the-board-in-obsidian.md)
- [#57 Let a user choose where the board is stored](57-choose-where-the-board-is-stored/root.md)
- [#116 Unstick cards that sit on the board too long](116-stuck-cards/root.md)
- [#179 Show a failed run on the card it was working on](features/179-show-a-failed-run-on-the-card-it-was-working-on.md)
- [#182 Sign the Mac build so it opens with no warning](features/182-sign-the-mac-build-so-it-opens-with-no-warning.md)
- [#183 Install the Mac app with one Homebrew command](features/183-install-the-mac-app-with-one-homebrew-command.md)
- [#229 Tell the user how to log in to the agent, not just how to install it](features/229-tell-the-user-how-to-log-in-to-the-agent-not-just-how-to-ins.md)
- [#232 Write a release's changelog with AI when it closes](features/232-write-a-release-s-changelog-with-ai-when-it-closes.md)
- [#247 Set a spec agent's harness and model where its switch is](features/247-set-a-spec-agent-s-harness-and-model-where-its-switch-is.md)
- [#250 Bring a task in from a file or your voice, not only typed text](250-friendly-task-import/root.md)
- [#254 Customize what a specialist agent produces, not just whether it runs](254-customizable-spec-agents/root.md)
- [#262 Open a card's page on the half a human has to read](features/262-open-a-card-s-page-on-the-half-a-human-has-to-read.md)
- [#266 Make the chat rail a full chat, not a message box](266-chat-rail-full/root.md)
- [#287 Run each board action on its own harness](287-per-action-harness/root.md)
- [#209 Make the daily loop something you can do from buttons](209-daily-loop-buttons/root.md)
- [#279 Decide whether the card page still needs an Edit button](features/279-decide-whether-the-card-page-still-needs-an-edit-button.md)
- [#280 Set the board up by talking to it, not by filling in a form](features/280-set-the-board-up-by-talking-to-it-not-by-filling-in-a-form.md)
- [#291 Pick a model from a list in the Harness pane](features/291-pick-model-from-list.md)

## skill

- [#16 auto-implement: let the agent build a ready card on its own](skill/16-auto-implement-let-the-agent-build-a-ready-card-on-its-own.md)
- [#112 Move a module's calls into its memory when the map gains that module](skill/112-move-a-module-s-calls-into-its-memory-when-the-map-gains-tha.md)
- [#141 Update the sibling tasks when one task's plan changes](skill/141-update-the-sibling-tasks-when-one-task-s-plan-changes.md)
- [#153 Name the one card to build next](skill/153-name-the-one-card-to-build-next.md)
- [#155 Flag a card that is too big to build in one run](skill/155-flag-a-card-that-is-too-big-to-build-in-one-run.md)
- [#156 Two runs writing cards at once must not clobber the board](skill/156-two-runs-writing-cards-at-once-must-not-clobber-the-board.md)
- [#157 Turn a spec you already wrote into the cards that build it](skill/157-turn-a-spec-you-already-wrote-into-the-cards-that-build-it.md)
- [#158 Say how a card will be checked before it counts as done](skill/158-say-how-a-card-will-be-checked-before-it-counts-as-done.md)
- [#246 Give each spec agent its own harness and model](skill/246-give-each-spec-agent-its-own-harness-and-model.md)
- [#282 ZCode's 'The login ZCode has' sign-in fails, and two places say it works](skill/282-zcode-s-the-login-zcode-has-sign-in-fails-and-two-places-say.md)
- [#283 Fix the recipe that tells a flow how to write a group task](skill/283-fix-the-recipe-that-tells-a-flow-how-to-write-a-group-task.md)
- [#290 Ask each harness for its model list instead of a free-text box](skill/290-harness-model-list.md)

## distribution

- [#2 List on a second marketplace and decide the site](distribution/02-second-marketplace-and-site.md)
- [#202 Test whether the board changes what a coding agent builds](202-board-vs-no-board/root.md)
- [#292 See how the app is actually used, from download to daily work](292-app-telemetry/root.md)

## recurring

- [#181 Competitor analysis loop](recurring/181-competitor-analysis-loop.md)
- [#236 Prune oversized documentation](recurring/236-prune-oversized-documentation.md)

## 202-board-vs-no-board/distribution

- [#203 Write 20 test requests and say what a pass looks like](202-board-vs-no-board/distribution/203-test-requests.md)
- [#204 Run each test request twice — once with the board, once without](202-board-vs-no-board/distribution/204-run-both-ways.md)
- [#205 Score the runs and keep the whole record in the repo](202-board-vs-no-board/distribution/205-score-and-record.md)
- [#206 Show the result on the site and in the README](202-board-vs-no-board/distribution/206-publish-the-result.md)

## 221-board-score/skill


## 221-board-score/features


## 254-customizable-spec-agents/skill

- [#255 Let a specialist agent carry settings, not just a switch](254-customizable-spec-agents/skill/255-agent-settings.md)
- [#256 Draw a card's layout options in ASCII instead of a rendered screen](254-customizable-spec-agents/skill/256-ascii-mockups.md)

## 254-customizable-spec-agents/features

- [#257 Set a specialist agent's settings where its switch is](254-customizable-spec-agents/features/257-set-agent-settings.md)

## 250-friendly-task-import/skill

- [#251 Rewrite raw material into a short brief before any card is written](250-friendly-task-import/skill/251-intake-rewriter.md)

## 250-friendly-task-import/features

- [#252 Attach a file to Create task instead of retyping it](250-friendly-task-import/features/252-attach-a-file.md)
- [#253 Speak a task instead of typing it](250-friendly-task-import/features/253-speak-a-task.md)

## 266-chat-rail-full/features

- [#267 Stop a reply while it is being written](266-chat-rail-full/features/267-stop-a-reply.md)
- [#268 Keep typing while a reply is still coming](266-chat-rail-full/features/268-keep-typing.md)
- [#269 Copy, resend or reword a message without retyping it](266-chat-rail-full/features/269-reply-actions.md)
- [#270 Open up what the agent looked at, and say what the reply cost](266-chat-rail-full/features/270-what-it-did.md)
- [#271 Point at a card in the chat box](266-chat-rail-full/features/271-point-at-things.md)
- [#272 Pick the model for one conversation, not for the whole board](266-chat-rail-full/features/272-per-chat-model.md)
- [#273 Keep past conversations instead of only throwing them away](266-chat-rail-full/features/273-past-conversations.md)

## 209-daily-loop-buttons/features

- [#274 Change a card's words and fields without starting an agent run](209-daily-loop-buttons/features/274-edit-fields-directly.md)
- [#275 Put a specialist agent on a card from the card's page](209-daily-loop-buttons/features/275-spec-agent-button.md)
- [#276 Cross off a hand-check on the card, and add one](209-daily-loop-buttons/features/276-tick-hand-checks.md)

## 209-daily-loop-buttons/distribution

- [#277 Rewrite the daily-loop guide so each step leads with the button](209-daily-loop-buttons/distribution/277-guide-leads-with-buttons.md)

## 287-per-action-harness/skill

- [#288 Let every board action name its own harness and settings](287-per-action-harness/skill/288-per-action-harness-cli.md)

## 287-per-action-harness/features

- [#289 Set each action's harness in the UI, with one global harness that resets them all](287-per-action-harness/features/289-per-action-harness-ui.md)

## 292-app-telemetry/features

- [#293 Ask before any usage data leaves the machine, and let it be turned off](292-app-telemetry/features/293-consent-and-switch.md)
- [#295 Report app opens and which parts of the board get used](292-app-telemetry/features/295-app-usage-events.md)

## 292-app-telemetry/distribution

- [#294 Take in usage events on a server we run](292-app-telemetry/distribution/294-telemetry-service.md)
- [#297 Count how many site visitors go on to download the app](292-app-telemetry/distribution/297-download-rate.md)

## 292-app-telemetry/skill

- [#296 Report the board's own numbers from metrics.csv and record.csv](292-app-telemetry/skill/296-board-numbers.md)
