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
- [#154 Show what a card unblocks, so the ones holding up work go first](features/154-show-what-a-card-unblocks-so-the-ones-holding-up-work-go-fir.md)
- [#179 Show a failed run on the card it was working on](features/179-show-a-failed-run-on-the-card-it-was-working-on.md)
- [#182 Sign the Mac build so it opens with no warning](features/182-sign-the-mac-build-so-it-opens-with-no-warning.md)
- [#183 Install the Mac app with one Homebrew command](features/183-install-the-mac-app-with-one-homebrew-command.md)
- [#229 Tell the user how to log in to the agent, not just how to install it](features/229-tell-the-user-how-to-log-in-to-the-agent-not-just-how-to-ins.md)
- [#232 Write a release's changelog with AI when it closes](features/232-write-a-release-s-changelog-with-ai-when-it-closes.md)
- [#247 Set a spec agent's harness and model where its switch is](features/247-set-a-spec-agent-s-harness-and-model-where-its-switch-is.md)
- [#250 Bring a task in from a file or your voice, not only typed text](250-friendly-task-import/root.md)
- [#254 Customize what a specialist agent produces, not just whether it runs](254-customizable-spec-agents/root.md)
- [#258 Run the board on ZCode, Z.ai's GLM coding agent](features/258-run-the-board-on-zcode-z-ai-s-glm-coding-agent.md)
- [#262 Open a card's page on the half a human has to read](features/262-open-a-card-s-page-on-the-half-a-human-has-to-read.md)

## skill

- [#16 auto-implement: let the agent build a ready card on its own](skill/16-auto-implement-let-the-agent-build-a-ready-card-on-its-own.md)
- [#112 Move a module's calls into its memory when the map gains that module](skill/112-move-a-module-s-calls-into-its-memory-when-the-map-gains-tha.md)
- [#141 Update the sibling tasks when one task's plan changes](skill/141-update-the-sibling-tasks-when-one-task-s-plan-changes.md)
- [#153 Name the one card to build next](skill/153-name-the-one-card-to-build-next.md)
- [#155 Flag a card that is too big to build in one run](skill/155-flag-a-card-that-is-too-big-to-build-in-one-run.md)
- [#156 Two runs writing cards at once must not clobber the board](skill/156-two-runs-writing-cards-at-once-must-not-clobber-the-board.md)
- [#157 Turn a spec you already wrote into the cards that build it](skill/157-turn-a-spec-you-already-wrote-into-the-cards-that-build-it.md)
- [#158 Say how a card will be checked before it counts as done](skill/158-say-how-a-card-will-be-checked-before-it-counts-as-done.md)
- [#221 Score how well the board does its own job](221-board-score/root.md)
- [#246 Give each spec agent its own harness and model](skill/246-give-each-spec-agent-its-own-harness-and-model.md)
- [#249 Group the cards a release plan creates, instead of writing them all loose](skill/249-group-the-cards-a-release-plan-creates-instead-of-writing-th.md)
- [#261 Put what a human must read at the top of a card, and the agent's own notes at the bottom](skill/261-put-what-a-human-must-read-at-the-top-of-a-card-and-the-agen.md)

## distribution

- [#2 List on a second marketplace and decide the site](distribution/02-second-marketplace-and-site.md)
- [#202 Test whether the board changes what a coding agent builds](202-board-vs-no-board/root.md)
- [#209 Teach the daily loop as buttons, not only as things you say](distribution/209-teach-the-daily-loop-as-buttons-not-only-as-things-you-say.md)

## recurring

- [#181 Competitor analysis loop](recurring/181-competitor-analysis-loop.md)
- [#236 Prune oversized documentation](recurring/236-prune-oversized-documentation.md)

## 202-board-vs-no-board/distribution

- [#203 Write 20 test requests and say what a pass looks like](202-board-vs-no-board/distribution/203-test-requests.md)
- [#204 Run each test request twice — once with the board, once without](202-board-vs-no-board/distribution/204-run-both-ways.md)
- [#205 Score the runs and keep the whole record in the repo](202-board-vs-no-board/distribution/205-score-and-record.md)
- [#206 Show the result on the site and in the README](202-board-vs-no-board/distribution/206-publish-the-result.md)

## 221-board-score/skill

- [#222 Pick the few numbers that say how well the board plans](221-board-score/skill/222-pick-the-metrics.md)
- [#223 Keep the record the numbers need, as the board runs](221-board-score/skill/223-keep-the-record.md)

## 221-board-score/features

- [#224 Show the board's score, and write it into every release](221-board-score/features/224-show-the-score.md)

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
