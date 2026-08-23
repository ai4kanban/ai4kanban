---
title: Archive a finished group root by itself
track: features
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: []
related: [45]
modules: [skill, local-ui]
questions: []
---

A group root sits on the board after its last subtask is finished, waiting for someone to press Archive. Nothing about that press is a judgment call — the group is over the moment its pieces are. Close it in the command instead, so a finished group leaves the board on its own.

## Worth noting
- The root leaves the board with nobody confirming it. Whatever notes it still carried go to the archive with it.
- A closing group writes no line in the module's `readme.md`. Each subtask already wrote one as it left, and a line for the root would only restate them.
- A root that still carries an open question of its own, or an unticked todo that is not a subtask line, is not treated as finished. It stays on the board for a person.
- The Archive button on a root's page keeps the rule it has today, which asks for neither of those two things. So a person can still archive by hand a root the automatic rule holds back — the hold-backs only stop the board doing it unasked.
- Only archiving becomes automatic. A group whose subtasks were all rejected still waits for a person, because rejecting deletes the card and its rejection note has to be written from the card's own words.
- "Implement group" (#45) is not built yet. When it is, a root whose run archives the last subtask closes under that run, which then ends with its card gone, the way a card archived by its own run already does today.
- A group folder nested inside another group folder is left out. The board does not draw one today — an inner root shows in no column and on no page — so there is no such group on the board for this rule to close.

<!-- agent -->

## Today
- A subtask leaving the board ticks or strikes its line in the group's `root.md` `## Todo`.
- The board's UI then shows Archive on the root once every subtask line is resolved — ticked by archive, struck by reject.
- Nothing archives the root. It stays in its column until a person clicks the button or an agent runs `akb board archive <id>`.
- A card that stops existing while its page is open lands the user on the app's "not found" page, which counts down five seconds and then goes to the board. A removal made by the chat rail, or by a run this page started, skips that page and goes to the board at once.

## Scope
- After a subtask leaves the board, check the enclosing group's root: if every subtask line on it is resolved, archive that root in the same command run.
- Keep today's meaning of resolved: a line ticked `[x]` by archive, or struck `~~…~~` by reject. A line that carries no `#<subid>` is not a subtask line and does not count.
- Never auto-archive a root with no subtask lines. That group is closed by a person.
- Never auto-archive a root whose subtask lines were all struck out by reject.
- Never auto-archive a root that carries an open question, or an unticked todo of its own that is not a subtask line.
- Leave the root page's Archive button exactly as it is. A root the automatic rule holds back stays archiveable by hand.
- Ask for no `readme.md` line for the root: the receipt reports the archive and hands nothing over to write.
- Run the root's archive through the same board bookkeeping a manual archive uses: the card is counted, its index entry dropped, its mockups and its conversation dropped, every stale `blocked_by:` and `related:` repaired, and every sentence still naming the root's id listed for someone to rewrite.
- Keep the subtask's own archive final. If the root's archive cannot go through, name the reason in the receipt and leave the root on the board; the subtask stays archived either way.
- Say it in the receipt the subtask's archive already prints: which root went, and where it moved to.
- Say the same in the structured result the board UI and the chat rail read from that archive, so the rail's account of what it did names the root as well.
- Say it too when a root's every subtask line is resolved but one of the rules above holds it back, naming the rule in one line.
- Send a user sitting on the closed root's page straight back to the board, the way a removal made from the chat rail already does, instead of the "not found" page and its countdown.
- Say the rule once in the board's own guide, in the group-task section that already explains how a group is built from its subtasks.
- Say it once in the daily-loop guide too, in the paragraph that already tells the user what happens to a group's main card when a subtask finishes.
- The refine that starts on its own after a subtask leaves the board must not target a root that left with it. A root that stayed behind keeps today's rule: it is skipped, not refined.

## Todo
- [ ] Add the "every subtask line resolved" check where a subtask's fate is already written into `root.md`.
- [ ] Archive the root through the same path a manual archive takes, so the counting, the index, the cross-reference repair and the mention report stay identical.
- [ ] Skip the roots the rule excludes: no subtask lines, every line struck out by reject, an open question of its own, or an unticked todo of its own.
- [ ] Keep the subtask's archive standing when the root's cannot go through, reporting the reason instead of failing the run.
- [ ] Print the root's archive in the subtask's receipt, on its own line, and in the structured result the UI and chat rail read; print the reason when a finished-looking root was left behind.
- [ ] Send the user straight back to the board when the root's page loses its card, instead of the "not found" countdown.
- [ ] Update the group-task section of the board guide with the closing rule.
- [ ] Add one sentence to the daily-loop guide's group paragraph saying a group closes itself when its last subtask does.
- [ ] Keep the follow-up refine from targeting a root that just left the board.

## Decided by the agent
- **Why the command and not a flow?** The rule is arithmetic on the root's `## Todo`, so a command can settle it exactly. Asking an agent to notice would cost a run and could still miss it.
- **When does it fire?** At the moment a subtask leaves the board, not on a sweep. That is the only moment the answer can change, and the receipt is already being printed.
- **Why are nested group folders left out?** The board reads a group folder only at the top of `todo/`, and it skips every `root.md` below that, so a group inside a group has no card the user can see or reach. Closing a shape nobody can put on the board is work with nothing to test it against; making nesting real is a task of its own, and the rule extends to it then.
- **Does the root need a `readme.md` line?** No. The board records user-facing outcomes, and every subtask recorded its own on the way out. A root is the tracking card for those pieces, so its line would repeat them.
- **Why does an open question stop the archive?** An open question is a call nobody has made. Archiving would take it off the board unanswered, which is the one thing this rule must not do quietly.
- **Why does an unticked todo of its own stop it?** It is work on the root that no subtask covers, so the group is not over yet.
- **Why leave the Archive button's own rule alone?** Pressing it is a person's decision, and it is the only way to close the roots this rule holds back. Adding the same guards to the button would strand those roots on the board with no way off it.
- **Why is an all-rejected group still left to a person?** Rejecting deletes the card, and the `rejected.md` note is written from the card's own words. No script can write that note, and once the card is gone there is nothing to write it from.
- **What if the root's archive cannot go through?** The subtask's archive has already happened by then, so failing the run would report finished work as broken. The receipt says what stopped the root and the root waits for a person.
- **Why touch the daily-loop guide?** It is the one user doc that already says what a subtask's finish does to the group's main card. A reader who only learns the rule from the board guide would be surprised when a card leaves on its own.
- **How is the follow-up refine kept off a root that just left?** The follow-up picks its cards from the board as it stands after the run, so a root that is no longer in `todo/` is never a candidate. The todo is a check that this still holds, not new logic.
- **What does the root's page do when the group closes under it?** It goes straight back to the board, which is what a card removed from the chat rail already does and what the daily-loop guide already tells the user to expect. The "not found" page would get there too, five seconds later, but a card that left on purpose is not a dead link.
- **Does the check run when the subtask was not listed on the root?** Yes. The command already warns that nothing was ticked; the check then reads the root as it stands, so a root whose listed lines were all resolved before still closes when its last unlisted subtask leaves.

## Source
- The requirement, in the user's words: "when all children tasks are completed, we should automatically archive the group-task. this should be done programmatically."
