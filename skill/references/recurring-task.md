# Run a recurring task

A recurring task is a job we repeat on a cadence. Unlike a one-shot task, it never
archives — each pass is a **run**, and the card gets sharper each run until a run needs
no human. This guide covers running one and improving it.

## The card shape

A recurring card lives in `todo/recurring/`, its own folder parallel to `blockers/` and
the track folders (see your tracks in Configuration). Its frontmatter marks the track:

```
---
title: …
track: recurring
priority: …
roi: …
blocked_by: []
related: []
questions: []
---
```

It adds two sections beyond a normal card:

- `## Process` — the in-order steps of one run, each tagged by how it runs today.
- `## Runs` — a pointer to the per-run open-questions files.

### The `## Process` ladder

Every step carries one tag:

- `[script]` — a command anyone can run as-is. The most automatic; include the exact
  command.
- `[agent]` — a plain-language instruction the agent follows without asking the user.
- `[ask]` — a step that still needs the user (a judgement call, an approval, missing
  data).

The whole point of the recurring type is to **move steps up the ladder** over runs:
`[ask]` → `[agent]` → `[script]`. A run where every step is `[script]` or `[agent]` needs
no human. Keep the tags honest — only mark a step `[script]` once the command actually
exists and works.

## One run, start to finish

1. **Read the card**, especially `## Process` and the newest run file under `runs/`.
2. **Do the steps in order**, following each tag. A `[script]` step: run its command. An
   `[agent]` step: do it yourself. An `[ask]` step: ask the user, and hold the answer for
   step 5.
3. **Record the run:**

   ```
   ${KB} run <id>
   ```

   This adds +1 to `completed` in `metrics.csv`, stamps `last_run: YYYY-MM-DD HH:MM`
   into the card's frontmatter, and **keeps the card** — no archive, no README edit. It
   refuses if the card isn't under `todo/recurring/`.
4. **Self-improve `## Process`.** Rewrite it so the next run needs less human effort:
   - An `[ask]` you answered the same way it could be derived → rewrite as an `[agent]`
     instruction.
   - An `[agent]` step you did the same mechanical way every run → write a small script
     and change it to `[script]` with the command.
   - A step that broke or was ambiguous → tighten the wording.
   Do the smallest real improvement each run; don't invent automation you didn't just do.
5. **Log what still needed a human.** For each `[ask]` this run, write the question and
   the user's answer to:

   ```
   docs/kanban/todo/recurring/<id>-<slug>/runs/<YYYY-MM-DD>-open-questions.md
   ```

   (Create the `<id>-<slug>/runs/` folder next to the card if it doesn't exist.) Before
   the next run, fold answered questions back into `## Process` and delete them from the
   run file. A run file that empties out is the signal that step is now automatic.

## Open-questions file shape

Keep it plain — the question, the answer, and whether it can be automated next time:

```markdown
# 49 — run 2026-07-10 open questions

- **Which topic this run?** → "cold email reply rates" (user picked).
  Next: could a script rank sources by pain count and propose the top one? → move to [agent].
- **Byline author?** → Jane. Stable across runs → fold into Process as a default.
```

## What not to do

- Don't archive a recurring task or record it as shipped behavior. It has no end state.
- Don't mark a step `[script]` before the script exists.
- Don't let run files pile up unread — their whole value is being folded back into
  `## Process` and then emptied.
