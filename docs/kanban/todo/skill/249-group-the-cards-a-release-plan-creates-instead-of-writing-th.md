---
title: Group the cards a release plan creates, instead of writing them all loose
track: skill
priority: high
roi: high
status: ready
release: ""
blocked_by: []
related: [155, 157]
modules: [skill]
questions: []
---

Planning a release writes several cards for one goal, and they always come out as loose
cards — never as one group task, a root card with the pieces as subtasks under it. The
board then hides that they are one piece of work, and the same question gets asked on each
of them.

Three things make the agent skip grouping. The release flow never asks for a group. The
rule for when work becomes a group is worded differently in three places. And a group
cannot be built with the commands we ship.

## Scope

The rule:

- One wording says when work becomes a group. It lives in `akb guide board`.
- The add-task, refine, and propose flows point at that wording instead of saying it again
  in their own words.
- Work becomes a group when several cards aim at one outcome and no single card delivers
  that outcome alone.
- It also needs a root worth writing: the shared plan, the order the pieces are built in,
  and the open questions that apply to every piece.
- Pieces with nothing shared to write stay loose cards, wired together with `blocked_by`.
- A card that delivers something on its own stays loose.
- Before opening a group, read the roots of the groups already on the board. When one
  already aims at the same outcome, the new piece goes in there.

The command:

- `akb board create --group new` writes a group root and the group's folder.
- `akb board create --group <root id>` writes a subtask into that group, under the track
  the subtask is given.
- Writing a subtask links it to the root both ways: the root's `## Todo` gains a line for
  it, and the two cards are related. Nobody edits a file by hand.
- A subtask takes the root's release. A `--release` on the same call wins over it.
- Both cards are indexed in `todo/README.md`, the way the groups already on the board are.
- The group recipe in `akb guide board` says what the command actually does.
- The recipe drops `akb board create --count N`, and so does `docs/guides/daily-loop.md`.

The release flow:

- Before it writes any card, it reviews all the cards it is about to write together, and
  puts the ones the rule accepts into one group.
- It never moves a card that is already on the board into a group folder. It names that
  card in the report and leaves it where it is.
- Its report already has three lists — `moved in`, `written`, and `left out`. In the first
  two, a group is one line for the root with its subtasks listed under it.
- In `left out`, a group is the root's line only, with one reason for the whole group.

## Todo
- [ ] Write the group rule in `akb guide board`, and have add-task, refine, and propose
      point at it.
- [ ] Let `akb board create --group new` write a group root, and `--group <root id>` write
      a subtask into that group, linked to the root and indexed in `todo/README.md`.
- [ ] Rewrite the group recipe in `akb guide board` to match the command, and take
      `akb board create --count N` out of it and out of `docs/guides/daily-loop.md`.
- [ ] Add a step to the release flow that looks at all the missing cards together and
      groups the coupled ones before any card is created.
- [ ] Make the release flow's report list each group as its root with its subtasks under it.
- [ ] Say in `docs/guides/daily-loop.md` that planning a release can write a group instead
      of loose cards, and how the report shows one.
- [ ] Plan a release whose goal needs several cards that only make sense together, and
      check they come out as one group.

## Decided by the agent
- **Which of the three wordings wins?** None as written. `akb guide board` today asks that
  a subtask itself be big enough to split again, which would reject four of the five groups
  open on this board. Refine asks only whether a card makes sense alone, which would turn
  every blocked pair into a group. The new rule keeps "one outcome, several cards" and adds
  the test that the root has a shared plan to write.
- **One create call per card, or one call for the whole group?** One per card. A group
  gains pieces long after it opens — the chat group gained a fifth subtask that way — and one
  batch call cannot carry each subtask's own modules, blockers, and questions.
- **Which release does a subtask get?** The root's, unless the call names one. That way a
  release plan can add a piece to a group already promised to an earlier version.
- **Why does the recipe drop `--count N`?** It prints ids that the cards then never get:
  `create --title` takes a fresh id of its own, so the printed ones are spent for nothing.

### Worth noting
- The release flow leaves a card that is already on the board loose, even when it belongs
  with a group the flow is writing. Nothing moves a card into a group folder today, and a
  group root's release is written onto every card under it, so a move could reassign a card
  that already belongs to another version. The alternative is to move only cards in no
  release; it was not taken because "planning only ever adds" is what the guide promises.
- Turning a card that is already open into a group root is not in this card. #155 needs
  that move when it splits a card that is too big to build in one run.
