# Daily kanban maintenance

**Track:** recurring · **Priority:** med · **ROI:** high

A recurring maintenance card for your board. Each run it orients on what changed,
proposes a few new tasks, prunes stale memory, caps high-priority work, pushes your
top cards one step more concrete, and logs any open questions for you to answer
async. Follow the `/kanban` skill for every step. The cadence below is a suggestion —
run it as often as suits your board.

> This card is the loop machinery, not a product task. It does NOT count toward the
> high-priority cap in step 4, and it is NOT a refine target in step 5.

## Process

**Guard: don't run on a dirty queue.** Before step 1, read
`docs/kanban/open-questions.md`. If it still holds any unresolved question (any dated
section with content), skip steps 1–7 — don't pile new questions onto an unanswered
backlog. Jump to step 8 to re-arm the cron, then stop. The next run retries the guard
and only resumes once you've answered and cleared the file.

**Never block to ask the user.** Any question that comes up — a failed task review, a
refine question, a reconciliation, a priority swap — goes into
`docs/kanban/open-questions.md` under today's date (step 7). You answer async; the
next run folds answers back into the cards. When a question would change what you'd
do, take the safe/reversible default now, log the question, and move on.

Run these in order. Tags: `[script]` · `[ask]`.

1. **Orient.** Run `node .claude/skills/kanban/quickview.mjs` for the board. Read
   `docs/kanban/memory.md`. Check `git log` against the per-source watermarks in
   memory.md to see what changed since the last loop. Review a few changed (or
   never-reviewed) sources, not all of them.

2. **Propose new tasks.** Follow the skill's "Propose the next things to do". From the
   changed sources, find user-standpoint gaps not already on the board, in `archive.md`,
   or in `rejected.md`. Review each candidate against the checks in `references/refine.md`
   and `redesign.md`; add only those that pass — allocate ids with `kanban.mjs create`, write
   via a subagent given `references/add-task.md`, then re-review. Up to 3, fewer is fine.
   Don't pad the board with weak tasks.

3. **Prune.** Compress `memory.md`, `archive.md`, `rejected.md`, and `redesign.md` per
   `references/prune-memory.md`. Bump the watermarks you reviewed this run.

4. **Cap high-priority at 6.** The board holds at most 6 `**Priority:** high` product
   cards (this maintenance card doesn't count). Rank every high card by importance — your
   launch gate, your signup→paid path, and public-trust surfaces come first. Keep the top
   6, demote the rest to `med` by editing their Priority line. Never delete, only demote.

5. **Refine the 6 high tasks — one subagent per card, in parallel.** Skip a card whose
   frontmatter `questions` list isn't empty — it's waiting on your answers, not a refine.
   Each subagent reads `references/refine.md` and `redesign.md`; runs the card through
   refine's checks; then moves it one step forward
   (vague→concrete, stop at the code level) and writes the advance back into its own card.
   Subagents edit ONLY their own card file — no `kanban.mjs`, and no touching `README.md`,
   `memory.md`, `next-id`, or `metrics.csv` (those race under parallelism). They report
   any archive/reject/flag recommendation and any open question back; the main loop
   applies archives/rejects serially (step 6) and logs questions (step 7).

6. **Apply archives / rejects serially.** For any card a subagent flagged as done or
   dead, run `kanban.mjs archive <id>` or `kanban.mjs reject <id>` yourself, one at a
   time — never in parallel, since the script rewrites shared files. Add the
   archive/rejected line first per the skill.

7. **Log open questions → `docs/kanban/open-questions.md`.** Collect every question this
   run raised — proposal review fails, refine questions, reconciliations, priority
   swaps — and append them under a `## <YYYY-MM-DD>` heading (newest date on top), each
   with the card it belongs to and one line of context. Write every question in plain,
   clear, short language — no jargon, one line each. Don't ask the user during the run;
   this file is the async queue. First delete any question already answered or now moot
   (fold answers into the card). If nothing new came up, add nothing.

8. `[script]` **Re-arm the cron** so it survives the 7-day expiry: `CronDelete` the
   running job id, then `CronCreate` with cron `13 9 * * *`, recurring true, durable true,
   and the slim prompt below. Confirm the new job id.

9. `[script]` **Record the run:** `node .claude/skills/kanban/kanban.mjs run <this card's id>`.

### Slim cron prompt (what the schedule carries)

> Daily kanban maintenance. Read and follow this card — run every step in its
> `## Process`, including the cron re-arm at the end.

## Runs

Open questions for the user go in `docs/kanban/open-questions.md` (step 7) — one dated
section per run, answered async. When the user answers one, fold it into the affected
card and delete it from that file.

Questions about the loop *itself* (an `[ask]` step that still needs a human) — as opposed
to questions about the work — get folded back into this `## Process` so the next run is
more automatic, per the skill's recurring-task guide.
