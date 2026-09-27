# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

- `akb cloud image` and `akb cloud tts` generate an image or hosted-voice narration on the
  signed-in account's Pro credits; every agent can call them (`akb cloud --help`).
- Built-in agents, workflows and specialists — Coding, Product video (script, hosted voice,
  film, cover), Slide deck (two approval rounds, editable `.pptx`), Carousel post (copy, then
  every page as PNG per platform ratio with captions; one template and best example per
  format), copywriting, ui-designer,
  prompt-writer, email-planner, reviewers, Sweeper, Triage, Memory pruner, Review chat memory,
  agent memory and rules, adding your own agent, and which workflows need Pro:
  `web/content/docs/agents.mdx`.
- email-planner covers any email, newsletters and announcements included; one with its own
  format and send script (the newsletter's issue JSON) is written and previewed in it, not TSX.
- `akb workflow stage <id> --stage <stage> --on|--off <agent>` switches one of a workflow's
  agents; `akb workflow duplicate` copies every agent into the new workflow.
- Every agent is one way of working and declares no settings of its own; writing one:
  `akb guide write-agent`.
- Video, slide deck and carousel cards track each review as a todo, ticked when a `[user]` answer
  accepts it; a change that makes a ticked todo stale adds a new one, and the card offers
  Archive once every todo is ticked and the file is on it.
- A video script's first review is the story, shots and exact lines; capture details and
  shot timing are settled after approval, and changing approved content reopens that review.
- A video retake restores and checks the shot's starting state before every take.
- prompt-writer edits a prompt only where its agent lacks a needed instruction, within the
  prompts the card names; app-controlled mechanics never become agent duties.
- Codex runs with approvals and sandbox bypassed by default, so no approval, sandbox, update
  or model-switch prompt interrupts a run, and it works in non-git projects; a command you
  configured yourself is left as is.
- The daily loop, discarding, Just discard, and what a build leaves on `verify:`:
  `web/content/docs/daily-loop.mdx`.
- Only the Coding workflow gets a branch and worktree; other workflows run in the project
  directory without committing, several cards at once, and a custom workflow toggles it under
  Advanced settings: `web/content/docs/daily-loop.mdx`.
- Board layout, group tasks, rule files, mockups, memory ownership and the board's language:
  `akb guide board`.
- Refining, planning a screen, turning a source into cards, picking the next card, and
  splitting a module: `akb guide qa-loop`, `akb guide extract-ideas`, `akb guide next-card`,
  `akb guide module-map`.
- Every board move and run is an `akb` command on any board, with `--json` and `--print`; a
  run outlives its command: `cli/README.md`, `web/content/docs/runs.mdx`.
- One repository can hold several boards (`--board`, `AI4KANBAN_BOARD`): `cli/README.md`.
- `akb chat` and card chat: `web/content/docs/chat.mdx`.
- Triage — fetch, add, sort, check, ignore, history and restore: `web/content/docs/triage.mdx`.
- Setup and the optional goal: `akb guide setup`, `web/content/docs/what-makes-a-good-goal.mdx`.
- Releases and changelogs on close: `web/content/docs/releases.mdx`.
- Implement carries a card from build to landed and archived, holding on open questions or
  diff approval; review can be switched off, and a failed delivery resumes: `akb guide
  implement`, `akb guide review`, `web/content/docs/daily-loop.mdx`.
- **Build now** builds a sentence or a handed-over plan, writing its card as it starts:
  `akb guide implement`.
- A failed or stopped card creation can be resumed or discarded, and resuming keeps the
  discard: `web/content/docs/runs.mdx`.
- A discussion judges the idea before planning it — outcome versus means, whether it is worth
  doing — and may disagree or ask for evidence; sending always starts a discussion, and
  **Start planning** or **Build now** under its plan starts work.
- One discussion can hold several plans; **Start planning** hands them to one planning run,
  an unused plan returns to the discussion, and `akb raw plan drop` withdraws one.
- A discussion's plan picks its workflow by the work the resulting cards will do, falling
  back to the board default.
- Card chat changes the card on a clear edit intent (including a question-shaped request or
  agreeing with its own suggestion) without asking again; a pure question only gets an
  answer, and work the card does not cover becomes a new card.
- Planning questions are written for someone who has not seen the board — no card ids,
  agent names or board terms.
- Standard planning QA checks the facts a plan turns on against authoritative sources and
  revises or stays open when it cannot settle one: `akb guide validate-assumption`.
- Updating an installed board: `akb guide update`.

## local-ui

`kanban-ui/README.md` is this module's doc; a line naming no other doc is covered there.

- The desktop app reopens the last repo, finds your coding agent, installs `akb` and updates
  in the background: `desktop/README.md`. The browser board (`npx ai4kanban-ui`) is
  deprecated: `akb guide local-ui`.
- Setting a board up in the app is a guided first run, and **Finish setup** runs the rest as
  one watchable, resumable run.
- The board, a **Queue** of ready and not-ready cards, search, the goal, a group's build-order
  map, **Insights**, read-only **Memory** by owner, and the **Archive**.
- On a phone the board becomes a bottom tab bar with one column at a time.
- **Upgrade to Pro** buys monthly or yearly inside Configuration → Billing on the app's Cloud
  sign-in, unlocking on return; Billing shows the plan, invoices and a link to manage billing.
- Pro workflows are locked without Pro, offering only upgrade or sign-in; archive and reject
  still work, and `akb` refuses them too.
- The board page has one entry, **New idea**, for ideas, progress questions, and moving,
  changing, archiving, rejecting or starting cards; **Discuss** exists only on a card page.
- A card's **Revise** opens its chat with the first line typed.
- Planning from a discussion continues the same agent session, so unwritten details reach the
  card; the discussion stays hidden once planning or building starts.
- A conversation stays on the agent that opened it; changing the helper's runtime affects
  only new conversations.
- Closing the discussion panel only hides it; drafts, images and in-flight replies stay, per
  discussion.
- Returning to a card with Back or Forward shows it as it is on disk.
- Card assets play in place: videos, audio, shot previews, storyboards, slide decks with
  speaker notes, `.pptx` downloads, and mockups labelled by device. Storyboard pictures keep
  their own shape, a page with no notes takes the full width, and `label` titles each one.
- A stopped-short run on a card nobody has dealt with stays visible on the card and in
  **Unfinished** until it is; runs that cannot resume offer no **Continue**:
  `web/content/docs/runs.mdx`.
- The Insights dialog shows completed, created and rejected over 30 days to a year, plus
  token use and estimated cost per connector and model.
- Notifications load 30 at a time; counts still include everything.
- Built-in workflows explain themselves in the workflow picker and `akb workflow list`.
- Each agent belongs to one workflow; a stage lists enabled agents and keeps disabled ones
  below, and copying a workflow copies its agents. Copying an agent is the only way to change
  a built-in agent's instructions; its memory starts empty.
- A built-in helper's page has one **Extra requirements** box per workflow stage; an agent you
  added is told everything through its own `AGENT.md`.
- A renamed agent's runtime change takes effect immediately.
- **Runtimes** is one list with **Global default** first: `web/content/docs/runs.mdx`,
  `web/content/docs/connectors.mdx`.
- Codex and Claude Code default to their subscription and existing CLI login; an API or
  gateway choice sticks: `web/content/docs/connectors.mdx`.
- Cloud and notification settings retry on their own when Cloud is unreachable and recover
  without reopening.
- Configuration has separate **Cloud** and **Notifications** tabs; Cloud says it is an alpha
  free for invited users, and storing a board in Cloud is offered only to team accounts.
- **Language** — English or 中文 — belongs to the machine and applies without reload; error
  messages follow it, with paths, commands and third-party diagnostics left as they are.
- A bell carries every Cloud board's **To do** and **Landed**, and a stopped-short run of this
  board even without Cloud; bell and chat share one side rail.
- A project with several boards shows each board's folder and opens another in a new window.
- **Prune memory** and **Tidy stalled cards** each carry **Run now** and a cadence.

## site

- The landing and comparison pages are also in `/zh`, `/es`, `/ja`, `/fr`; no browser-language
  redirect, and recipes and Markdown mirrors stay English.
- Positioning is "you steer, AI leads the team": an AI project manager runs your agents and
  reports only what you need; wording limits in `positioning.md`.
- The landing page's only way in is the app download; `/index.md` and `/llms.txt` mirror it.
- `/vs-task-master`, `/vs-linear`, `/vs-vibe-kanban` and `/vs-hermes-kanban` say where the
  other tool is ahead and who should pick which.
- Recipes: `web/public/recipes/`.
- [/cloud](https://ai4kanban.dev/cloud) says what Cloud is, what the relay carries and what
  stays on the machine.
- [/privacy](https://ai4kanban.dev/privacy) and [/terms](https://ai4kanban.dev/terms) are
  English-only, name NULLREACH LTD as operator and the China company as training seller, and
  cover Pro: Creem as merchant of record, auto-renewal, 14-day refund, credits reset monthly.
- [/training](https://ai4kanban.dev/training) sells one-to-one guidance with booking on the
  page ($99 a session, $349 a month for four); English and Chinese only.
- [/pricing](https://ai4kanban.dev/pricing) lists Free, Pro (monthly or yearly, straight to
  checkout), the seed-partner application and training; English and Chinese only.
- [/seed](https://ai4kanban.dev/seed) takes seed-partner applications (email, GitHub username,
  planned use), reviewed and answered by hand; English and Chinese only.
- `/contact` is one form for support and custom agents at $15 per agent.
- The built-in demo video workflow is called "Product video" everywhere.

## docs

- Both READMEs are app-first: download first, `akb` second, the skill optional:
  `README.md`, `README-zh.md`.
- One page per topic under `web/content/docs/`; commands stay in `akb --help`.
- Coding agents, what each needs and may touch, and their settings:
  `web/content/docs/connectors.mdx`.

## marketing

- Marketing work is an ordinary card on the default workflow; its delivery is the file in
  the repo.
- [awesome-agent-kanban](https://github.com/neverchanje/awesome-agent-kanban) is a public CC0
  directory of agent task tools, AI4Kanban listed on the same criteria as the rest.
- Free shared video assets (music, UI sounds, paper backgrounds, CC0) on
  `cdn.ai4kanban.dev/video/`: `assets/video/README.md`.
- Email changes are written by `email-planner` on a Coding card; the Email workflow is gone:
  `scripts/email/README.md`.
- The "see it first, then build it" product video exists in English and Chinese, 16:9, for
  YouTube and Xiaohongshu.

## cloud

- GitHub sign-in, invites, Slack and Lark: `cloud/README.md`.
- Notifications: a board's card reaching `ready` or raising a user-only question becomes a
  Cloud event, deleted 30 days after it ends; one event takes one action.
- A failed notification retries with backoff for about four hours, then marks the board out
  of step; a retry about an already-handled card is dropped.
- Workspaces, moving boards either way, and the read-only workspace URL:
  `web/content/docs/local-and-cloud-boards.mdx`.
- One writer holds a card or the board at a time on a half-hour lease; a stale write is
  refused as a conflict.
- Cloud reports runtime names only, never keys, arguments or paths.
- Cloud takes the [/training](https://ai4kanban.dev/training) bookings.
- Free-tier limits: `cloud/README.md`.
- Pro is sold monthly or yearly through Creem to any GitHub sign-in, managed at
  `cloud.ai4kanban.dev/settings`.
- Accepted seed partners get six months of Pro on their GitHub handle (`npm run seed`), one grant
  per handle and no charge afterwards; the end date shows in Configuration → Billing and
  `/settings`, and they can still subscribe.
- Pro gets 5,000 AI credits each UTC month for hosted capabilities, shown with the reset date
  in Configuration → Billing.
- The invite approval email says Cloud is an alpha, free for invited users, pricing may change.

## telemetry

- Anonymous usage reporting, on by default and disclosed once: `akb telemetry status|on|off`,
  `web/content/docs/local-and-cloud-boards.mdx`.
- A public route serves the install count for the README badge.
- Feedback never requires a task; sharing its conversation is one switch, off by default.
