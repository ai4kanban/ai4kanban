# Marketing board — plan

A second board in this repo, at `marketing/kanban/`, where one card is one content topic
and agents write, repurpose and publish it per channel. Local-first, markdown, no Cloud.

It is also the first test of a bigger claim: AI4Kanban is a kernel plus job plugins, the
way Notion is a block editor plus templates. `product` is the first plugin, `marketing` the
second. The kernel is only what both need — and it is extracted from two working boards,
not designed first. Marketing is built as a second hardcoded job; a line moves into the
kernel only when both plugins use it unchanged.

## 1. Kernel vs. plugin

A **plugin** is a job — what a manager of that job owns. The **kernel** is what every job
has: cards, the clarify loop, runs, memory as a folder, skills, rules.

```text
kernel (job-agnostic)                    plugin (one job)
─────────────────────────────────        ──────────────────────────────────────
card: id, title, priority,               areas — the word and the list ("modules", "pillars")
      questions, blocked_by, related
create / refine / resolve / revise       what a finished card is, and its flow text
[user] vs agent questions, classify      the execution flow (implement = build, write…)
runs, run log, stop/resume               the execution agent (coding agent, writer, designer)
memory/ folder,                          every other memory file: name, purpose,
  decisions.md, rejected.md                who appends, when
skills: SKILL.md + settings + a run      the built-in skills and what a skill fills
rules/<command>.md                       delivery: worktree + land, or a file + publish
recurring cards, schedule                what archive records, and where
propose: read sources, drill areas       the planning sources
board: columns, run panel, questions     the card face and the card detail
```

The only kernel memory is `decisions.md` and `rejected.md`: what a manager of any job
settles, and what they turned down. Everything else is the plugin's, declared, not assumed.

**Rules** (`rules/<command>.md`): one file per flow, in the user's own words, appended to
the end of that flow's prompt on every run — a standing instruction the user gives a flow
without editing the flow. Kernel, because it is just "append the user's text"; what flows
exist is the plugin's.

**The card UI is not customizable today.** `kanban-ui` hardcodes one card face and one
detail view, both shaped for a product card. A marketing card needs a different face
(channel logos with status) and a different detail (an editor with a channel tab strip).
So the plugin owns both, and the kernel owns only what is around them: columns, the run
panel, the questions inbox.

Primitives are adapters: the kernel knows a card has an execution flow and a finish; the
plugin says what those mean. `implement` on the product plugin means a worktree and a diff;
on marketing it means a draft file. The word in the UI is the plugin's too.

### The product plugin, made explicit

- **Memory**: `goal.md` (the product's long-term goal and roadmap), `readme.md` (what
  shipped), `redesign.md` (design mistakes), per-module sets.
- **Areas**: modules, `modules.md`.
- **Delivery**: git worktree, review against the approved card, land on main.
- **Skills**: `ui-design`, `technology-selection`.
- **Card UI**: today's face and detail.
- **Presets**: `indie-hacker` is a preset of this plugin, not a plugin.

## 2. The marketing plugin

- **Card**: one topic, published to N channels. `channels:` in frontmatter, CLI-owned:
  `[{ name, status: draft|ready|scheduled|published, url }]`.
- **Areas**: pillars — the h2s of `decisions.md`. What propose drills into.
- **Execution**: `write` — a writer agent produces `content/<id>/source.md` for the lead
  channel. Then one **channel skill** per chosen channel repurposes it into
  `content/<id>/<channel>.md`. The kernel runs them as it runs a spec skill today.
- **Finish**: `publish` per channel, then archive when every chosen channel is published.
- **Delivery**: a file. No worktree, no branch, no review-against-diff; the review is the
  user editing the draft.
- **No goal**: marketing has no goal of its own. Positioning, audience and what we may
  claim are `decisions.md` lines; the product's `goal.md` is a planning source it reads.
- **Memory** (the plugin's, beside the kernel's two):
  - `writing.md` — the voice: what every format shares.
  - `writing/<format>.md` — rules that hold for one format only (`thread`, `short-post`,
    `note`, `carousel`, `long-post`, `script`). Format ≠ channel: a channel skill names the
    formats it uses, so a rule learned on one channel carries to another.
  - `published.md` — one line per published piece: channel, URL, result. What propose reads
    to avoid repeats and to see what worked.
  - No `redesign.md`. A lesson from an edited draft is a writing rule and lands in
    `writing.md` or the format file. A marketing manager has nothing to "redesign".
  - Later: `design.md` + `design/<surface>.md` for covers and carousels, once a design skill
    exists.
- **Planning sources**: the product board's `memory/goal.md` and `memory/readme.md`
  (what shipped → launch), the site docs, and this board's `published.md` / `rejected.md`.
- **Card UI**: face = title + one logo per channel with its status dot; detail = markdown
  editor with a channel tab strip, Repurpose and Publish.

### Layout

```text
marketing/kanban/
├── config.md                 plugin: marketing; planning sources
├── todo/<id>-<slug>.md
├── todo/recurring/           weekly proposals, publish what is due, pull results
├── content/<id>-<slug>/      the deliverable — tracked in git, kept after archive
│   ├── source.md  x.md  linkedin.md  xiaohongshu.md …
│   └── assets/
├── memory/
│   ├── decisions.md  rejected.md                   kernel
│   ├── writing.md  writing/<format>.md  published.md   plugin
│   └── <pillar>/decisions.md rejected.md           per area, as modules are today
├── skills/<channel>/SKILL.md
└── rules/<command>.md
```

### The loop

```text
create ─▶ refine ─▶ write ─▶ channel skills ─▶ you edit ─▶ publish ─▶ archive
 topic     brief    source.md   <channel>.md               per channel  published.md
                                                                        + writing lessons
```

- **refine → brief**: the kernel's clarify loop. The `[user]` questions are taste: angle,
  audience, hook, channels, what we may claim. Memory answers the rest.
- **you edit**: every edit is a lesson. On publish, the flow diffs the agent's draft against
  what was posted; a recurring pattern becomes one line in `writing.md` or
  `writing/<format>.md`, in the user's voice, `- ❌ … → ✅ …`.
- **auto-split**: the prune pass moves a rule that only holds for one format out of
  `writing.md` into its format file. One more step on the existing `prune-memory` card.
- **results**: the `published.md` line carries them — typed at first, pulled later.

### Card detail

```text
┌ #12 Why kanban beats a chat loop ─────────────────────────────┐
│ [source] [𝕏] [in] [小红书] [reddit]          Repurpose  Publish │
├───────────────────────────────────────────────────────────────┤
│ (markdown editor for the selected tab)                        │
├───────────────────────────────────────────────────────────────┤
│ 𝕏 ● published  in ● ready  小红书 ○ draft  reddit — not chosen │
└───────────────────────────────────────────────────────────────┘
```

Phase 1 needs none of it: VS Code and the CLI.

### Publish automation — last

- 小红书 first: `.claude/skills/xiaohongshu-skills` is already vendored.
- X / LinkedIn: API with a key; otherwise the skill opens the composer with the text on the
  clipboard and waits for the URL.
- `status: scheduled` + `akb raw schedule`; a recurring card posts what is due; another
  pulls results into `published.md`.

## 3. Phases

- **Phase 0 — a board at another path**: `akb` hardcodes `<root>/docs/kanban`
  (`cli/src/lib/paths.ts`). Add `--board <dir>` and `AKB_BOARD`; a board switcher in
  `kanban-ui`. `akb install --job marketing --board marketing/kanban` scaffolds §2 with
  the marketing flow text swapped in by the crudest means that works.
- **Phase 1 — the loop by hand, CLI only**: seed `writing.md` from `social-posts/`; write
  the positioning lines into `decisions.md`; run three topics through create → refine →
  write → edit → publish by hand → archive. Done when `writing.md` has grown from the three
  edits without you writing it. This is the pain-point fix, before any UI, skill or
  platform work.
- **Phase 2 — channel skills**: `akb channel <name> <id>`, `content-write`, `channels:`
  frontmatter; built-in `x`, `linkedin`, `xiaohongshu`, `reddit`; the format split.
- **Phase 3 — proposals**: marketing planning sources, pillars as areas, the weekly card,
  a launch card created when the product board closes a release.
- **Phase 4 — marketing UI, hardcoded**: board switcher, the marketing card face and
  detail in `kanban-ui`, keyed on the board's plugin name. Two hardcoded UIs before any
  generic one.
- **Phase 5 — extract the kernel**: with two boards running, move what both share into the
  kernel and the rest into `plugins/product/` and `plugins/marketing/`. A plugin is a
  folder of markdown — `config.md`, flow text, SKILL.md files, memory headers — plus its
  card face and detail. `akb plugin init <name>` copies one as a starting point. Whether a
  non-technical user can also write the UI part, or only the markdown part, is decided
  here, not before.
- **Phase 6 — publish automation and results**.

## 4. Not doing

- **No Cloud**; multi-user arrives with the product board's Cloud.
- **No plugin mechanism before phase 5**, and no third plugin until a user names the job.
  The built-in marketing plugin is the product for founders who want marketing AI; the
  mechanism is for a job we don't know yet.
- **No campaign or calendar objects**: a product release is the campaign; `schedule` is
  the calendar.
- **No analytics dashboard**: one result line per piece.

## 5. Open questions

- **Lead channel** for `source.md`: 小红书 (most existing material) or X (shortest,
  repurposes upward)?
- **`social-posts/`**: import as published cards so `published.md` has history on day one,
  or seed `writing.md` from it and leave it?
- **Language**: one `writing.md` with both, or `writing.md` + `writing/zh.md`? The board's
  language rule assumes one language per file.
- **Word for a plugin** in the product: `job`, `plugin`, `template`? The plan uses
  "plugin" for the mechanism and "job" for what a user picks.
