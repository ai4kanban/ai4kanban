---
title: We moved our own marketing onto the board
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [building-in-public, shipped]
questions:
  - question: "[user] Which angle and hook does this lead with?"
    mode: single
    options:
      - "We stopped running our marketing in a chat window — open on the mess before: every draft corrected the same way, the correction never kept. Cost: the marketing board is days old, so the piece can show the setup but no results yet."
      - "A kanban board that is not for code — open on two boards in one repo, one for engineering and one for writing. Cost: a capability piece; it argues the product is general before we have a second user proving it."
      - "Watch it learn our writing rules — open on writing.md growing out of the edits we make. Cost: the payoff only exists after three pieces have gone out, so this one publishes last."
    recommend: [1]
  - question: "[user] Which channels, and which of them leads?"
    mode: single
    options:
      - "小红书 leads, X follows — building-in-public is what that audience already follows us for. Cost: the second-board mechanics need a screenshot to land."
      - "X leads, LinkedIn follows — 'dogfooding our own PM tool' is a Western build-in-public staple. Cost: our smaller audience there."
      - "LinkedIn leads alone — the long-form version, closest to the two essays already published there. Cost: the slowest channel, and no reach into the 小红书 following."
    recommend: [1]
---

A build-in-public piece for people who have watched us plan AI4Kanban with AI4Kanban: the
same repo now holds a second board that plans the writing, and the writing rules grow out of
the edits made to each draft instead of being repeated in every chat.

## Worth noting
- **The setup is what we can show, not the results**: the marketing board is days old, so
  the piece describes the loop and the first three topics rather than claiming a payoff; the
  cost is a weaker ending than a numbers post would have.

<!-- agent -->

## Today
- **Nothing published says the board does anything but code**: the imported line in
  `memory/published.md` is about the idea, and the unimported posts all frame the board
  around software tasks.
- **What actually shipped**: a repo can hold more than one board — `akb install --board <dir>
  --solution marketing` scaffolds a board whose cards are topics and whose delivery is a
  draft file, with no worktree and no branch (`docs/kanban/memory/skill/readme.md`).
- **The numbers we have are the product board's**: 112 completed, 218 created and 29 rejected
  over thirty days, already published as throughput; the 3x is a separate before-and-after of
  leaving the chat window, with no window recorded. Neither is evidence about the marketing
  board.

## Scope
- **The hook is the pain, not the feature**: every draft came back corrected the same way and
  nothing kept the correction. That is what a second board fixes.
- **Show `writing.md`**: one or two real `- ❌ … → ✅ …` lines is the whole argument, and they
  are more convincing than any description of the mechanism.
- **Say plainly that it is new**: the board was installed for this, the first three topics are
  running through it now, and there is no result yet.
- **Must not claim**: any marketing outcome, any second user, or that the product is a general
  work-management tool. Two boards exist; that is all.
- **Lead channel**: whichever the channels question settles.

## Todo
- [ ] settle the two `[user]` questions
- [ ] write `content/4-marketing-on-the-board/source.md` for the lead channel
- [ ] commit the draft before it is edited — the writing rules are read from that diff
- [ ] user edits the draft, then publishes it by hand
- [ ] append the `published.md` line: date, channel, URL, result
- [ ] diff the draft against what was posted and add the writing rules

## Decided by the agent
- **This one publishes last of the three**: it is about the loop the other two run through, so
  it can quote them once they are out.
- **No "kernel vs. solution" argument**: that is unshipped architecture (`marketing/plan.md`
  phase 5), and `decisions.md` forbids claiming the roadmap.

### Overruled by the user

## Source
`marketing/plan.md` §3 phase 1, and `docs/kanban/memory/skill/readme.md`.
