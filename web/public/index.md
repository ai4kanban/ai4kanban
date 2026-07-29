# AI4Kanban — your task board in Markdown, right next to your code

> A Claude Code skill that runs a kanban board from plain Markdown files in your
> repo — versioned in git, no database, no MCP.

Claude proposes the next work, writes the cards, and archives what's done. Your
backlog lives as plain Markdown files in `docs/kanban/` — in git, diffable,
readable by you and the agent. No database, no MCP. Just talk to the board.

- Install in one prompt
- View on GitHub: https://github.com/dist0com/ai4kanban

## Why it's different

- **Plain Markdown, in your repo.** Every card is a Markdown file under
  `docs/kanban/`. Diffable, reviewable, versioned with your code — not locked in
  a SaaS.
- **Steered in plain language.** Say "/kanban what's next?" or "/kanban #4 is
  done." Claude reads the board and your sources, then proposes, writes, and
  archives for you.
- **No database, no MCP.** Just a skill file and a small Node script. The board
  is plain Markdown any agent can read, so Cursor or Codex can drive it too —
  nothing to install, host, or pay for, and it keeps working offline.
- **Built for solo founders.** Keep marketing, building, docs, and research side
  by side in one repo — so the model can compose across everything you have.

## 01 · Setup — Install in one prompt

From your project root, tell Claude Code (or any agent that can run shell
commands):

```
Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt
and follow it.
```

The agent copies the skill into `.claude/skills/kanban/`, reads your codebase to
fill in the configuration, scaffolds the board, and proposes your first three
tasks.

## 02 · Usage — Using ai4kanban in Claude Code

Once installed, drive it in plain language:

| You say | What Claude does |
| --- | --- |
| "/kanban what's next?" | reads the board + your sources, proposes 3 new tasks |
| "/kanban add a task: …" | reviews the idea, writes a card, adds it to the index |
| "/kanban refine #4" | reviews card #4, then pushes it one stage toward concrete |
| "/kanban review the board" | checks cards for clarity, duplication, done-ness |
| "/kanban #4 is done" | notes what shipped, moves the card off the board |
| "/kanban #4 was a bad idea" | records why in rejected.md so it's never re-proposed |

## 03 · Board UI — A local board you can open in the browser

Prefer to look instead of ask? One command opens a board over the same Markdown
files — read a task in full without hunting for its file in your IDE tree, and
act on it with a click instead of re-typing the same prompt into the chat.

It's optional — the install step ships nothing extra. When you want it, just ask
Claude:

```
/kanban run the local board UI
```

Claude starts the prebuilt server for you — localhost only, nothing to compile.

Each card's buttons hand a move to an agent, no chat needed:

- **Implement** — hand the card to Claude to build
- **Edit** — revise the card, don't run it
- **Refine** — push a stuck card one step on
- **Resolve** — answer the card's open questions
- **Archive** — file a finished card away
- **Reject** — drop a card and note why

## 04 · Presets — The indie-hacker preset

Building all day while nobody's watching is the classic solo-founder trap. This
preset splits your time three ways — finding users, checking demand, and
building — and Claude keeps new work spread across all three instead of piling it
onto one.

- **growth (50%)** — Get in front of users — posts, outreach, launches. Claude
  suggests methods worth trying and drafts them.
- **validation (30%)** — Check the market wants it before you build deep. Post an
  honest question, share a trial, save the verdict.
- **building (20%)** — Stay at MVP. Build when it scales your work, strengthens
  the product, or users clearly ask for it.

The `indie-hacker` preset also adds review gates — a moat test and a trust
test — plus a market-validation method for posting to Reddit or X before you
build. Swap in your own tracks and weights at install time.

## 05 · Features — Project management in Markdown, not a flat list

A flat to-do list is just a list. This one does four things a list can't —
recurring work, subtasks for the big jobs, a memory of what's done, and a
throughput count.

### Recurring tasks

Some work is never one-and-done. Keep each as a card in
`docs/kanban/todo/recurring/` — a job that never gets archived — and let Claude
Code's `/loop` run it on the cadence you pick, like every morning.

- **Competitor tracking** — See what rivals shipped or changed, and flag anything
  worth a response.
- **Social listening** — Pull fresh posts from Reddit or Slack and surface the
  ones that matter.
- **Board review** — Sweep the backlog for stale, duplicate, or already-done
  cards.

Not every job needs the same level of automation. A card can sit at any rung —
from one you drive by hand, to one Claude handles for you, to a script that runs
on its own:

- `[ask]` — you do it by hand
- `[agent]` — Claude does it for you
- `[script]` — a command runs it, no human

Push each job as far up as it earns — some stay hands-on, others run themselves.

### Group tasks

A task too big to start tends to just sit there. When one card can't hold it, it
becomes a **group task** — its own folder with a tracking `root.md` and one card
per piece. Each piece gets its own id and is wired with `Blocked by` and
`Related` links, so you always know the next thing to pick up.

```
todo/42-payments/
  root.md                  # the tracking task
  feature/43-checkout.md   # a subtask, its own card + id
  feature/44-refunds.md
  bug/45-webhook-retry.md
```

### Project memory

Working the board is a loop. Each round, Claude proposes new work by pulling from
three sources, you make the call, and it folds the result into a memory hub — so
the next round builds on the last instead of repeating it.

The three stages of one loop:

1. **Propose** — Pulls from three sources for work that isn't already shipped or
   shelved.
2. **You decide** — Ship it, skip it, or fix the plan. A few words back to Claude
   is enough.
3. **Learn** — Folds the outcome and your feedback into the hub, so the next
   round starts sharper.

The three sources it pulls from:

- **Your project** — Codebase, board, docs, team chat — it connects what's
  already here into work worth doing.
- **The outside** — Reddit, Slack, your CRM. Recurring jobs pull in fresh signal
  and drop the findings on the board.
- **You** — Your own steer and feedback, kept in the board so a good call is never
  lost or asked twice.

The hub — `docs/kanban/`, the files that hold your feedback:

- **memory.md** — Notes from each scan carry to the next, with a watermark per
  source — so it re-reads only what changed.
- **archive.md** — Shipped work shrinks to a plain line. It reads this before
  proposing, so it won't re-suggest what's done.
- **rejected.md** — Ideas you turned down are kept with the reason, so it never
  floats them at you again.
- **redesign.md** — A design mistake you corrected becomes a note, so the next
  card doesn't repeat the wrong plan.

### Task metrics

Each archived card is one shipped unit, so your velocity is just a number in git
next to the work — no external tool to keep in sync.

---

Install ai4kanban · https://github.com/dist0com/ai4kanban
