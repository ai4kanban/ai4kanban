# Marketing board — plan

A second board in this repo, at `marketing/kanban/`, where one card is one content topic
and agents write, repurpose and publish it per channel. Local-first, markdown, no Cloud.

It is also the first test of a bigger claim: AI4Kanban is a kernel plus solutions, the way
Notion is a block editor plus templates. `product` is the first solution, `marketing` the
second. The kernel is only what both need — and it is extracted from two working boards,
not designed first. Marketing is built as a second hardcoded solution; a line moves into the
kernel only when both solutions use it unchanged.

## 1. Kernel vs. solution

A **solution** is one line of work — what the manager of that work owns. The **kernel** is
what every solution has: cards, the clarify loop, runs, memory as a folder, skills, rules.

```text
kernel (any solution)                    solution (one line of work)
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

The only kernel memory is `decisions.md` and `rejected.md`: what the manager of any work
settles, and what they turned down. Everything else is the solution's, declared, not
assumed.

**Rules** (`rules/<command>.md`): one file per flow, in the user's own words, appended to
the end of that flow's prompt on every run — a standing instruction the user gives a flow
without editing the flow. Kernel, because it is just "append the user's text"; what flows
exist is the solution's.

**The card UI is not customizable today.** `kanban-ui` hardcodes one card face and one
detail view, both shaped for a product card. A marketing card needs a different face
(channel logos with status) and a different detail (an editor with a channel tab strip).
So the solution owns both, and the kernel owns only what is around them: columns, the run
panel, the questions inbox.

Primitives are adapters: the kernel knows a card has an execution flow and a finish; the
solution says what those mean. `implement` on the product solution means a worktree and a
diff; on marketing it means a draft file. The word in the UI is the solution's too.

### The product solution, made explicit

- **Memory**: `goal.md` (the product's long-term goal and roadmap), `readme.md` (what
  shipped), `redesign.md` (design mistakes), per-module sets.
- **Areas**: modules, `modules.md`.
- **Delivery**: git worktree, review against the approved card, land on main.
- **Skills**: `ui-design`, `technology-selection`.
- **Card UI**: today's face and detail.
- **Presets**: `indie-hacker` is a preset of this solution, not a solution.

## 2. The marketing solution

- **Card**: one topic, published to N channels. `channels:` in frontmatter, CLI-owned:
  `[{ name, status: draft|ready|scheduled|published, url }]`.
- **Areas**: pillars — the h2s of `decisions.md`. What propose drills into.
- **Execution**: `write` — a writer agent produces `content/<id>/source.md` for the lead
  channel that card picked. Then one **channel skill** per chosen channel repurposes it into
  `content/<id>/<channel>.md`. The kernel runs them as it runs a spec skill today.
- **Finish**: `publish` per channel, then archive when every chosen channel is published.
- **Delivery**: a file. No worktree, no branch, no review-against-diff; the review is the
  user editing the draft.
- **No goal**: marketing has no goal of its own. Positioning, audience and what we may
  claim are `decisions.md` lines; the product's `goal.md` is a planning source it reads.
- **Memory** (the solution's, beside the kernel's two):
  - `writing.md` — the voice: what every piece shares.
  - `writing/*.md` — a rule that holds somewhere narrower: per format (`thread`,
    `short-post`, `note`, `carousel`, `long-post`, `script`), per language, or whatever the
    rules turn out to need. The agent creates, merges and drops these files on demand; no
    layout is fixed up front. Format ≠ channel: a channel skill names the formats it uses,
    so a rule learned on one channel carries to another.
  - `published.md` — one line per published piece: channel, URL, result. What propose reads
    to avoid repeats and to see what worked.
  - No `redesign.md`. A lesson from an edited draft is a writing rule and lands in
    `writing.md` or the file under `writing/` it belongs in. A marketing manager has
    nothing to "redesign".
  - Later: `design.md` + `design/<surface>.md` for covers and carousels, once a design skill
    exists.
- **Planning sources**: the product board's `memory/goal.md` and `memory/readme.md`
  (what shipped → launch), the site docs, and this board's `published.md` / `rejected.md`.
- **Card UI**: face = title + one logo per channel with its status dot; detail = markdown
  editor with a channel tab strip, Repurpose and Publish.

### Layout

```text
marketing/kanban/
├── config.md                 solution: marketing; planning sources
├── todo/<id>-<slug>.md
├── todo/recurring/           weekly proposals, publish what is due, pull results
├── content/<id>-<slug>/      the deliverable — tracked in git, kept after archive
│   ├── source.md  x.md  linkedin.md  xiaohongshu.md …
│   └── assets/
├── memory/
│   ├── decisions.md  rejected.md                   kernel
│   ├── writing.md  writing/*.md  published.md      solution
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
  audience, hook, channels, which of them leads, what we may claim. Memory answers the
  rest.
- **you edit**: every edit is a lesson. On publish, the flow diffs the agent's draft against
  what was posted; a recurring pattern becomes one line in `writing.md` or a file under
  `writing/`, in the user's voice, `- ❌ … → ✅ …`.
- **auto-split**: the prune pass moves a rule that no longer holds everywhere out of
  `writing.md` into the file under `writing/` it belongs in, creating or merging those files
  as it goes. One more step on the existing `prune-memory` card.
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
  `kanban-ui`. `akb install --solution marketing --board marketing/kanban` scaffolds §2
  with the marketing flow text swapped in by the crudest means that works.
- **Phase 1 — the loop by hand, CLI only**: import `social-posts/` as archived published
  cards and seed `writing.md` from them; write the positioning lines into `decisions.md`;
  run three topics through create → refine → write → edit → publish by hand → archive. Done
  when `writing.md` has grown from the three edits without you writing it. This is the
  pain-point fix, before any UI, skill or platform work.
- **Phase 2 — channel skills**: `akb channel <name> <id>`, `content-write`, `channels:`
  frontmatter; built-in `x`, `linkedin`, `xiaohongshu`, `reddit`; the split under
  `writing/`.
- **Phase 3 — proposals**: marketing planning sources, pillars as areas, the weekly card,
  a launch card created when the product board closes a release.
- **Phase 4 — marketing UI, hardcoded**: board switcher, the marketing card face and
  detail in `kanban-ui`, keyed on the board's solution name. Two hardcoded UIs before any
  generic one.
- **Phase 5 — extract the kernel**: with two boards running, move what both share into the
  kernel and the rest into `solutions/product/` and `solutions/marketing/`. A solution is a
  folder of markdown — `config.md`, flow text, SKILL.md files, memory headers — plus its
  card face and detail. `akb solution init <name>` copies one as a starting point. Whether a
  non-technical user can also write the UI part, or only the markdown part, is decided
  here, not before.
- **Phase 6 — publish automation and results**.

## 4. Not doing

- **No Cloud**; multi-user arrives with the product board's Cloud.
- **No solution mechanism before phase 5**, and no third solution until a user names the
  work. The built-in marketing solution is the product for founders who want marketing AI;
  the mechanism is for work we don't know yet.
- **No campaign or calendar objects**: a product release is the campaign; `schedule` is
  the calendar.
- **No analytics dashboard**: one result line per piece.

## 5. Settled

- **Lead channel**: the user picks it per topic while refining; the board fixes none.
- **`social-posts/`**: imported as archived published cards, so `published.md` carries real
  history on day one and `writing.md` seeds from what was really posted.
- **Writing memory layout**: the agent's — `writing.md` plus whatever it splits, merges or
  adds under `writing/`, per format or per language, as the rules demand.
- **The word**: `solution` — for both what a user picks and the folder that provides it.
  `job` and `plugin` are dropped.
