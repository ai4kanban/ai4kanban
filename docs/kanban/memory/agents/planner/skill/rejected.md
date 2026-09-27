# Rejected

Ideas we turned down, one line each with the reason. Read before proposing.

## Agents and connectors

- **Custom leads and helpers across all three stages** — overdesigned.
- **The pi coding agent** — only a container keeps its runs inside the project.
- **Asking each harness for its model list** — none offers one cheaply and a cache goes stale; the model stays a text box.
- **Sending the prompt over stdin** — our prompts are short; argv limits don't bite.
- **`--trust` on Cursor** — headless Cursor works untrusted.
- **Telling users how to log in to an agent** — harness setup is theirs; the board connects to what exists.
- **Image input for ZCode** — its GLM models are text-only; a pasted image would be silently dropped.
- **Calling spec agents when a card is written** — a one-line ask has no spec yet, and a second call site doubles the flows. Refine asks.
- **A frontmatter field declaring a spec agent's output formats** — the agent's own prompt is enough.
- **A shot reference library for `scriptwriter`** — the `recipe-creator` skill already owns that convention.
- **Tightening the finished-film review, for now** — the user checks each clip in preview.
- **OpenDesign as a mockup style** — spawns a second coding agent with its own sign-in before our own drawing is good.

## Chat and planning

- **A separate flow limiting what chat may do** — chat is an ordinary kanban-skill session.
- **Chat handing the run a summary of what it settled** — anything that changes the build goes on the card.
- **Repairing one internal guide line as a user-facing task** — review keeps or drops it.
- **Telling the agent which cards a card holds up** — it's `blocked_by` reversed; use a group task where chains matter.
- **Grouping the cards a release plan writes** — the release is already the group.
- **`propose`, finding new work from the board alone** — produced untraceable cards.
- **Hand-editing a card's spec instead of asking a flow** — the next refine rewrites it.
- **A per-card acceptance check before closing** — review already judges against the card, and a human gate stalls the board.
- **Scoring how right a release plan turned out** — nothing runs when a plan finishes to compare against.
- **A screen drawing inside an open question** — questions stay one frontmatter line pointing at the body.

## Setup and the goal

- **A fixed `goal.md` template** — offer an ignorable guide, not an enforced shape.
- **Ending setup with v1 and vnext group tasks** — not every project plans releases on day one.
- **Splitting decisions by a deadline in the goal** — the board has no deadlines.
- **A per-editor rules file install** — Cursor and Windsurf read the shared `.agents` folder.

## Storage and structure

- **A file-storage-only backend layer for team work** — Cloud also owns revisions, leases, audit and lifecycle; collaboration needs identity, routing, single writers, shared memory and recovery too.
- **GitHub Projects as the shared board** — Cloud is the shared board; GitHub Issues is intake and a progress mirror.
- **Mirroring the board to a second backend** — two-way sync and conflicts; one backend per project.
- **Moving every flow off Read/Grep onto board commands** — buys nothing on a file board.
- **A kernel plus solution folders per board type** — a second mechanism and two concepts to learn; one general workflow carries all work.
- **Built-in connectors pulling outside sources onto the board** — connectors live outside the open core.
