# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Agents and connectors

- **Expanding specialist registration into custom leads and helpers across all three stages**
  — rejected as overdesigned.
- **The pi coding agent** — nothing keeps a run inside the project but a container. Every
  agent we run stays in the repo.
- **Asking each harness for its model list** — no harness hands one over for free and a cache
  goes stale anyway. The model stays a box you fill in.
- **Sending the prompt over stdin instead of on the command line** — the argv limits it dodges
  bite products that pack a transcript into the prompt; ours is a sentence plus a rule block.
- **`--trust` on Cursor** — a headless Cursor run works untrusted.
- **Telling the user how to log in to an agent** — setting a harness up is the user's own
  business; the board only connects to what is already there.
- **An image input for the ZCode harness** — every GLM model in ZCode's config declares
  text-only input, so declaring it would swap an honest gap for a paste silently thrown away.
- **Calling spec agents when a card is written** — a card from a one-line ask has no spec to
  fill in yet, and a second call site means two flows to keep in step. Refine asks.
- **`akb.produces`, a frontmatter field declaring a spec agent's output formats** — a format
  contract written into the agent's own prompt is enough.
- **Seeding a shot reference library for `scriptwriter`** — how a recipe entry is written is
  already owned by the `recipe-creator` skill, so restating that convention in the agent's own
  index gives one rule two homes to drift between.
- **OpenDesign as a third mockup style** — until our own drawing is good, a style that spawns
  a second coding agent with its own sign-in buys a shared look on a moving foundation.

## Chat and planning

- **A separate flow that limits what chat may do** — a chat is an ordinary kanban-skill
  session, so it needs no second workflow or permission layer.
- **A chat handing the run a summary of what the conversation settled** — anything that
  changes what gets built goes on the card, which chat already does.
- **Repairing one internal guide line as a user-facing task** — repairs found during review
  stay with the delivery or are dropped.
- **Telling the agent which cards a card is holding up** — it is `blocked_by` read backwards,
  and the weaker half. Where a chain matters we make it a group task.
- **Grouping the cards a release plan writes** — a release is already the group.
- **`propose`, a flow that finds new work from the board alone** — guessing what to build from
  memory made cards nobody could trace back to anything.
- **Changing a card's spec by hand instead of asking a flow to rewrite it** — hand edits have
  no flow behind them and the next refine rewrites them anyway.
- **A card carrying its own acceptance check, run before the card closes** — review already
  judges the delivery against the approved card, and making human notes a gate stalls a board.
- **A score for how right a release plan turned out** — nothing runs at the moment a plan is
  finished, so there is no roster to compare the close against.
- **A drawing of a screen inside an open question** — a question lives in frontmatter and
  stays one short line, pointing at the drawing in the card body.

## Setup and the goal

- **A fixed template for `goal.md`** — what we write instead is a best-practices guide the
  user can ignore, not a shape the agent enforces.
- **Ending setup with a v1 and a vnext group task** — not every project plans releases on day
  one. Setup ends with the first tasks.
- **Reading a deadline from the goal and splitting decisions by it** — the board has no
  deadlines, so every settled call lands in one `decisions.md`.
- **A per-agent install that writes each editor's own rules file** — Cursor and Windsurf both
  read the shared `.agents` folder, which install already writes.

## Storage and structure

- **A file-storage-only backend layer for team collaboration** — Cloud also owns revisions,
  leases, audit events and lifecycle rules, which the narrower abstraction would hide. A
  storage picker alone is not the collaboration feature either: that also needs identity,
  question routing, one writer per card, shared memory and delivery recovery.
- **GitHub Projects as the shared board authority** — Cloud is the shared board; GitHub Issues
  is an intake door and progress mirror, not another writable copy.
- **Mirror the board to a second backend** — two live copies means two-way sync and a conflict
  story. One backend per project.
- **Move every flow off Read and Grep and onto board commands** — the command already owns the
  part that needs one owner; wrapping the rest buys nothing on a file board.
- **Splitting the two boards into a kernel plus solution folders** — a second configurable
  mechanism beside the stage contracts and registered agents, with two concepts for a user to
  learn. One general workflow carries every kind of work instead.
- **Built-in connectors that pull outside sources onto the board** — the connector belongs
  outside the open core; the skill only evaluates material it can already read.
