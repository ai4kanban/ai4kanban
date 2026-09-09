# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- Install and quick start: `README.md`.
- The daily loop — propose, add, refine, resolve, review, finish, reject: `web/content/docs/daily-loop.mdx`.
- Beside it, one page each: `chat.mdx`, `releases.mdx`, `spec-skills.mdx`, `runs.mdx`. The
  commands themselves are `akb --help`, never copied onto the site.
- The notification bell says it is checking while it reads your Cloud sign-in, instead of
  showing "Not signed in to Cloud" for the moment before the answer arrives.
- Pictures pasted into Create task stay put when you switch between Discuss, Add task and
  Build now, and the mode you send with gets exactly the thumbnails on screen. Clicking one
  opens it whole; Escape or a click outside closes it, and its ✕ takes it out without
  opening it.
- Memory keeps only notes that change a later planning call: a duplicate rejection, a routine
  status change or a fact already written down leaves none, and asking not to record suppresses
  the write while the board action still finishes. Rejection is covered in
  `web/content/docs/daily-loop.mdx`.
- A notification that fails to reach Cloud is retried five seconds later instead of a minute,
  doubling to a five-minute cap, so a moment of bad network costs seconds rather than a
  minute of a card sitting unannounced. It still gives up after about four hours and says the
  board is out of step. A retry about a card somebody has since dealt with is dropped rather
  than raised.
