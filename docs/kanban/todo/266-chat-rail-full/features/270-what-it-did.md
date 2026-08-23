---
title: Open up what the agent looked at, and say what the reply cost
track: features
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: []
related: [266]
modules: [local-ui, skill]
questions:
  - question: "[user] Where does a reply's cost go — see the `ui-design` section"
    mode: single
    options:
      - B — on the reply's receipt row beside the lookups, so it costs no extra height
      - A — a line of its own under every reply
      - C — only inside the opened lookups, nothing in the rail
    recommend: [1]
---

While the agent hunts through the board, the rail shows a column of grey lines, each cut
off at the rail's width and none of them openable. And a reply says nothing about what it
cost, though every run on this board does.

## Worth noting
- A run of lookups folds into one line and hides the detail behind a click. Someone who
  likes watching the agent work loses the running commentary they have today.
- How much an opened lookup can say depends on what each connector's stream carries. On
  some connectors it will say little more than the folded line already does.

## By `ui-design` agent

### The screen

The rail keeps its 360px and its three parts — head, conversation, box. What changes is
what sits with a reply.

- **A run of lookups is one line**: "looked at 6 things", in the rail's grey, with a
  chevron. Clicking it opens the lookups under it: one per pair of lines, the thing on top
  in mono and what came back under it, so a path is not fighting a result for the width.
- **The lookup being made now is a line of its own**, under the growing count, with the
  board's pulse dot. It is folded in only once the reply is done, so the rail never goes
  quiet mid-answer.
- **What the reply cost** is elapsed, tokens and price, in the same dim text and the same
  middot form the run log already uses ("4.2s · 1,840 tokens · est. $0.03"). Where it sits
  is the choice below.
- **Jump to latest** is a pill floating clear of the box, centred, appearing only once the
  reader has scrolled away from the foot: `↓ 3 new lines`. Clicking it goes to the bottom
  and the pill goes away.

### Layouts

<Mockup src=".mockups/270/a.tsx" label="A" />

Cost gets a line of its own under every reply, and the lookups fold in place where they
happened — the fullest reading, at two rows of grey per reply in a rail this narrow.

<Mockup src=".mockups/270/b.tsx" label="B" />

The answer comes first and one receipt row under it carries both — lookups on the left,
price on the right, above a hairline — so cost costs no extra height, but the lookups move
to the foot of the reply instead of standing where they happened.

<Mockup src=".mockups/270/c.tsx" label="C" />

No numbers in the rail at all: the fold line is the only new thing on screen, and the cost
is the last line inside it when opened — the quietest, and the price is a click away every
time you want it.

**Recommended: B.** It is the only one that answers the open question with "yes, and it is
free" — the row it needs already has to be there for the lookups, so the price rides along
in space the reply was paying for anyway. A costs a second row of grey down the whole
conversation, which is what makes the rail feel like a log; C hides a number the board
shows everywhere else, so a chat is the one place work is done and never priced.

### The states with nothing in them

- **A connector that reports no price**: the row keeps the lookups and shows nothing on the
  right. Nothing is estimated or zeroed.
- **A reply that looked at nothing**: in B the row stays, with the price alone; in A and C
  there is no fold line at all.
- **A lookup whose stream carries no detail**: the opened line is the folded line's own
  words and no second line under it — the fold still says how many, and that the agent went
  and looked.
- **Nothing new below**: no pill. It appears with the count and leaves when the foot is
  reached.

<!-- agent -->

## Today
- `blocksOf` in `kanban-ui/components/Chat.tsx` splits the stream on the `⏺ ` marker every
  connector puts in front of a tool call, and draws each as one truncated mono line whose
  only detail is a `title` tooltip.
- A long hunt is a wall of grey the user scrolls past.
- Harnesses declare what they report — `reports: ['cost','tokens','model']` in
  `cli/src/lib/agent/harnesses.ts` — and a run shows it. A chat records the model and
  nothing else.
- Scrolled up to read an older answer, there is no way back to the newest line but
  scrolling.

## Scope
- **A run of lookups folds into one line**: "looked at 6 things", opened with a click.
- **An opened lookup says what it was**: the file or card, and what came back, as far as
  the stream carries it.
- **A lookup still being made is not folded away**: the line the agent is on stays visible
  while the reply is being written, so the rail does not go silent mid-answer.
- **A reply says what it cost**, quietly under it: elapsed, tokens and price, and only what
  this connector actually reports. A connector that reports none shows none.
- **A jump-to-latest button** appears when the reader has scrolled away from the foot, and
  says how many new lines are below.

## Scope out
- No diff view in the rail. What a run changed has its own view.
- Nothing is invented for a connector that does not report it.
- No total for the conversation or for the board. The unit is one reply.

## Todo
- [ ] Fold a run of lookups into one line that opens, leaving the lookup in progress shown.
- [ ] Carry enough of each tool call through the transcript for the opened line to say
      something — check what each connector's stream already gives.
- [ ] Record a reply's elapsed, tokens and cost where the transcript is written, and show
      only what the connector reports.
- [ ] Add the jump-to-latest button, with the count of what is below.
- [ ] Cover both in `kanban-ui/README.md`.
