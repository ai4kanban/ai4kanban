---
title: Archive a finished group root by itself
track: features
priority: med
roi: med
status: ready
release: 0.8.0
blocked_by: []
related: []
modules: [skill, local-ui]
questions: []
---

A group root sits on the board after its last subtask is finished, waiting for someone to press Archive. Nothing about that press is a judgment call — the group is over the moment its pieces are. Close it in the command instead, so a finished group leaves the board on its own.

## Worth noting
- **Does anyone confirm the root's close?**: No. The group is over the moment its pieces are, so the root leaves the board unasked, and whatever notes it still carried go to the archive with it.
- **Does a closing group write a `readme.md` line?**: No. Each subtask records its own user-facing outcome as it leaves, and the root is the tracking card for those pieces — its line would only restate them.
- **What holds a finished-looking root back?**: An open question of its own, which is a call nobody has made, or an unticked todo of its own, which is work no subtask covers. Either one leaves the root on the board for a person.
- **Does the Archive button change?**: No. Pressing it is a person's decision, and it is the only way off the board for the roots the automatic rule holds back.
- **Does rejecting subtasks close a group?**: Only when at least one of them was archived. A group whose subtasks were all rejected waits for a person: rejecting deletes the card, and its `rejected.md` note has to be written from the card's own words.
- **Are nested group folders covered?**: No. The board draws a group folder only at the top of `todo/` — an inner root shows in no column and on no page — so there is no such group on the board for this rule to close. Making nesting real is a task of its own, and the rule extends to it then.

<!-- agent -->

## Today
- A subtask leaving the board ticks or strikes its line in the group's `root.md` `## Todo`.
- The board's UI then shows Archive on the root once every subtask line is resolved — ticked by archive, struck by reject.
- Nothing archives the root. It stays in its column until a person clicks the button or an agent runs `akb board archive <id>`.
- A card that stops existing while its page is open lands the user on the app's "not found" page, which counts down five seconds and then goes to the board. A run this page started skips that page and goes to the board at once, and the chat rail's poll does too — but the page re-reads itself as soon as any run finishes, seconds before that poll, so a card another card's run removed shows the countdown.

## Scope
- After a subtask leaves the board, check the enclosing group's root: if every subtask line on it is resolved, archive that root in the same command run.
- Fire on every path a subtask leaves by — a person's Archive or Reject, an agent's `akb board archive`/`reject`, and the archive a delivery's own run ends with.
- Keep today's meaning of resolved: a line ticked `[x]` by archive, or struck `~~…~~` by reject. A line that carries no `#<subid>` is not a subtask line and does not count.
- Never auto-archive a root with no subtask lines. That group is closed by a person.
- Never auto-archive a root whose subtask lines were all struck out by reject. A group whose lines are a mix of ticked and struck does close, on whichever subtask leaves last.
- Never auto-archive a root that carries an open question, or an unticked todo of its own that is not a subtask line.
- Leave the root page's Archive button exactly as it is. A root the automatic rule holds back stays archiveable by hand.
- Ask for no `readme.md` line for the root: the receipt reports the archive and hands nothing over to write.
- Run the root's archive through the same board bookkeeping a manual archive uses: the card is counted, its index entry dropped, its mockups and its conversation dropped, every stale `blocked_by:` and `related:` repaired, and every sentence still naming the root's id listed for someone to rewrite.
- Take the root's archive before the subtask's own list of sentences still naming its id, so a line in a root that left with it is not handed over to be rewritten.
- Keep the subtask's own archive final. If the root's archive cannot go through, name the reason in the receipt and leave the root on the board; the subtask stays archived either way.
- Say it in the receipt the subtask's archive already prints: which root went, and where it moved to.
- Say the same in the structured result the board UI and the chat rail read from that archive, so the rail's account of what it did names the root as well.
- Say it too when a root's every subtask line is resolved but one of the rules above holds it back, naming the rule in one line.
- Send a user sitting on the closed root's page straight back to the board: the page's own re-read after a run finishes must not land on the "not found" page and its countdown.
- Say the rule once in the board's own guide, in the group-task section that already explains how a group is built from its subtasks.
- Say it once in the daily-loop guide too, in the paragraph that already tells the user what happens to a group's main card when a subtask finishes.
- The refine that starts on its own after a subtask leaves the board must not target a root that left with it. A root that stayed behind keeps today's rule: it is skipped, not refined.

## Todo
- [ ] Add the "every subtask line resolved" check where a subtask's fate is already written into `root.md`.
- [ ] Archive the root through the same path a manual archive takes, so the counting, the index, the cross-reference repair and the mention report stay identical — and take it before the subtask's mention report is read.
- [ ] Skip the roots the rule excludes: no subtask lines, every line struck out by reject, an open question of its own, or an unticked todo of its own.
- [ ] Keep the subtask's archive standing when the root's cannot go through, reporting the reason instead of failing the run.
- [ ] Print the root's archive in the subtask's receipt, on its own line, and in the structured result the UI and chat rail read; print the reason when a finished-looking root was left behind.
- [ ] Send the user straight back to the board when the root's page re-reads itself and finds the card gone, instead of the "not found" countdown.
- [ ] Update the group-task section of the board guide with the closing rule.
- [ ] Add one sentence to the daily-loop guide's group paragraph saying a group closes itself when its last subtask does.
- [ ] Keep the follow-up refine from targeting a root that just left the board.

## Decided by the agent
- **Why the command and not a flow?** The rule is arithmetic on the root's `## Todo`, so a command can settle it exactly. Asking an agent to notice would cost a run and could still miss it.
- **When does it fire?** At the moment a subtask leaves the board, not on a sweep. That is the only moment the answer can change, and the receipt is already being printed.
- **What if the root's archive cannot go through?** The subtask's archive has already happened by then, so failing the run would report finished work as broken. The receipt says what stopped the root and the root waits for a person.
- **Why touch the daily-loop guide?** It is the one user doc that already says what a subtask's finish does to the group's main card. A reader who only learns the rule from the board guide would be surprised when a card leaves on its own.
- **How is the follow-up refine kept off a root that just left?** The follow-up picks its cards from the board as it stands after the run, so a root that is no longer in `todo/` is never a candidate. The todo is a check that this still holds, not new logic.
- **What does the root's page do when the group closes under it?** It goes straight back to the board, which is what the daily-loop guide already tells the user to expect. The chat rail's poll gets there on its own, but the page's re-read on a finished run beats it by seconds and lands on the "not found" page — so the re-read is what has to change.
- **Does the check run when the subtask was not listed on the root?** Yes. The command already warns that nothing was ticked; the check then reads the root as it stands, so a root whose listed lines were all resolved before still closes when its last unlisted subtask leaves.

## Source
- The requirement, in the user's words: "when all children tasks are completed, we should automatically archive the group-task. this should be done programmatically."
