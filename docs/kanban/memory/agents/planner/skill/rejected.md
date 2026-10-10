# Rejected

Ideas we turned down, one line each with the reason. Read before proposing.

## Product scope

- **Connectors for more coding agents (e.g. Amp)** — people use only the top five or so; supporting every agent isn't worth the upkeep.
- **Pro-only Proposer** — the Proposer and hand sorting stay free: they show why Triage matters; Pro sells only the relief of auto-sort.
- **Keeping discussion chats for the memory review** — the review doesn't read discussions; only card chats become memory.
- **Cards for Windows-only edge cases (e.g. interrupted-run cleanup holding the run record's lock)** — not at this stage; Windows-only cases and tests wait for bandwidth.
- **Replacing Jev with agent triage** — on a 20-item eval in `evals/` neither sorted better, and Jev is much cheaper.
- **Follow-up planning pinning the runtime of the session it continues** — overdesign; the planner's current runtime is fine.

## Scheduled and background agents

- **Full rerun of the QA manual** — no point for now, so nothing gets built to reach it.
- **Scheduled agent's first run catching up on earlier cards** — listing nothing on the first run is intended; the QA cases are seeded from the codebase, not backfilled from past cards or chats.
- **Reporting or repairing recurring cards that fail to migrate to scheduled agents** — we assume users have none; no notice, retry UI or migration help.
- **Migrating QA proof that user projects committed under `docs/qa/`**: none ever did; it was only this repo's dev material, and this repo's history is already purged (#1585)
- **This board's notes-to-blog and composition-index jobs (#388, #983)** — dropped for good, never rebuilt as scheduled agents.
- **Cards that run or schedule the user's own agents (e.g. a first run of the competitor analysis agent, then turning on its schedule)** — when and how to run their agents is the user's call, not the board's.
- **Install or setup text announcing what runs in the background (e.g. the daily QA manager)** — overdesign; show the key background work as tutorial cards on a new board instead.
- **Treating an agent's stage as something users move (e.g. a refusal pointing a scheduled agent "back" to a stage)** — no such concept: a workflow's agents and their stages are fixed, and users' own agents are theirs to write.
- **Seeding a triage-fetch card or agent on the first fetch** — nobody used it; a board that wants scheduled fetching writes its own scheduled agent.

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
- **A per-card acceptance check before closing** — acceptance comes first, in planning, and a human gate stalls the board.
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
