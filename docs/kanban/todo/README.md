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
- [#67 Handle a failed agent run instead of just marking it red](features/67-handle-a-failed-agent-run-instead-of-just-marking-it-red.md)
- [#77 Read the board's memory in the UI](77-memory-in-the-ui/root.md)
- [#116 Unstick cards that sit on the board too long](116-stuck-cards/root.md)
- [#154 Show what a card unblocks, so the ones holding up work go first](features/154-show-what-a-card-unblocks-so-the-ones-holding-up-work-go-fir.md)
- [#160 Run the board with an agent beyond Claude Code and Codex](features/160-run-the-board-with-an-agent-beyond-claude-code-and-codex.md)
- [#179 Show a failed run on the card it was working on](features/179-show-a-failed-run-on-the-card-it-was-working-on.md)
- [#182 Sign the Mac build so it opens with no warning](features/182-sign-the-mac-build-so-it-opens-with-no-warning.md)
- [#183 Install the Mac app with one Homebrew command](features/183-install-the-mac-app-with-one-homebrew-command.md)
- [#225 Run the board on DeepSeek Harness (dsh)](features/225-run-the-board-on-deepseek-harness-dsh.md)

## skill

- [#16 auto-implement: let the agent build a ready card on its own](skill/16-auto-implement-let-the-agent-build-a-ready-card-on-its-own.md)
- [#112 Move a module's calls into its memory when the map gains that module](skill/112-move-a-module-s-calls-into-its-memory-when-the-map-gains-tha.md)
- [#141 Update the sibling tasks when one task's plan changes](skill/141-update-the-sibling-tasks-when-one-task-s-plan-changes.md)
- [#143 Plan UI tasks so the screen is agreed before it is built](143-ui-tasks/root.md)
- [#153 Name the one card to build next](skill/153-name-the-one-card-to-build-next.md)
- [#155 Flag a card that is too big to build in one run](skill/155-flag-a-card-that-is-too-big-to-build-in-one-run.md)
- [#156 Two runs writing cards at once must not clobber the board](skill/156-two-runs-writing-cards-at-once-must-not-clobber-the-board.md)
- [#157 Turn a spec you already wrote into the cards that build it](skill/157-turn-a-spec-you-already-wrote-into-the-cards-that-build-it.md)
- [#158 Say how a card will be checked before it counts as done](skill/158-say-how-a-card-will-be-checked-before-it-counts-as-done.md)
- [#186 Let a specialist agent fill the part of a spec it knows best](186-spec-agents/root.md)
- [#214 Mark the calls in a card that are not just common sense](skill/214-mark-the-calls-in-a-card-that-are-not-just-common-sense.md)
- [#221 Score how well the board does its own job](221-board-score/root.md)

## distribution

- [#2 List on a second marketplace and decide the site](distribution/02-second-marketplace-and-site.md)
- [#202 Test whether the board changes what a coding agent builds](202-board-vs-no-board/root.md)
- [#209 Teach the daily loop as buttons, not only as things you say](distribution/209-teach-the-daily-loop-as-buttons-not-only-as-things-you-say.md)
- [#215 Bring the plain-Markdown mirror of the landing page back in line](distribution/215-bring-the-plain-markdown-mirror-of-the-landing-page-back-in.md)
- [#216 Fix the memory file names the comparison pages still show](distribution/216-fix-the-memory-file-names-the-comparison-pages-still-show.md)

## 77-memory-in-the-ui/features

- [#129 Read the project's memory in the UI](77-memory-in-the-ui/features/129-read-the-project-s-memory-in-the-ui.md)
- [#130 Read a module's memory in the UI](77-memory-in-the-ui/features/130-read-a-module-s-memory-in-the-ui.md)

## 143-ui-tasks/features

- [#138 Let an open question carry an ASCII sketch of the UI](143-ui-tasks/features/138-let-an-open-question-carry-an-ascii-sketch-of-the-ui.md)

## 143-ui-tasks/skill

- [#137 Add a short UI design reference that UI features go through](143-ui-tasks/skill/137-add-a-short-ui-design-reference-that-ui-features-go-through.md)

## recurring

- [#181 Competitor analysis loop](recurring/181-competitor-analysis-loop.md)

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
