# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- Install and quick start: `README.md`.
- The daily loop — propose, add, refine, resolve, review, finish, reject — including what
  rejection records and what **Just discard** (`--discard`) skips:
  `web/content/docs/daily-loop.mdx`.
- Beside it, one page each: `chat.mdx`, `releases.mdx`, `runs.mdx`, `agents.mdx`,
  `connectors.mdx`, `triage.mdx`, `local-and-cloud-boards.mdx`. The commands themselves are
  `akb --help`, never copied onto the site.
- Memory keeps only notes that change a later planning call: a duplicate rejection, a routine
  status change or a fact already written down leaves none, and asking not to record
  suppresses the write while the board action still finishes.
- Triage sorting is an optional agent, off by default and asking once before it goes on:
  `web/content/docs/agents.mdx`, `web/content/docs/triage.mdx`.
- Pictures pasted into Create task stay put when you switch between Discuss, Add task and
  Build now, and the mode you send with gets exactly the thumbnails on screen. Clicking one
  opens it whole, and its ✕ takes it out without opening it.
- Submitting a batch of draft comments can carry one optional note about the whole draft; a
  comment on a passage wins where the two disagree.
- Edit on a card opens that card's chat with the caret in the box and the first line — "修改
  当前卡片：" / "Change this card:" — typed for you. Pressing it again folds the rail away, and
  a box that already has something in it is left exactly as it is.
- A notification that fails to reach Cloud is retried in seconds rather than a minute, backing
  off to a five-minute cap and giving up after about four hours with the board said to be out
  of step. A retry about a card somebody has since dealt with is dropped.
- A discussion now judges the idea before it plans one: it separates the outcome you want from
  the means you named, says whether the thing is worth doing at all, and may disagree, advise a
  pause, or ask for evidence first. A turn that only answers your question is a finished turn.
