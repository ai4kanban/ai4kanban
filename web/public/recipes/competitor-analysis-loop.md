# Competitor analysis loop

**Track:** recurring · **Priority:** med · **ROI:** med
**Depends on:** [dist0](https://www.dist0.com) — a dist0 account + `DIST0_API_KEY`

> **Brand recipe.** This one isn't board-agnostic: it runs on
> [dist0](https://www.dist0.com)'s `competitors.list` capability, which mines
> Reddit buyer-pain threads for the products people name as competitors. You need
> a dist0 account and an API key in `DIST0_API_KEY` to run it. Everything else —
> the feature checklists, the cadence ladder, the gap-to-card handoff — is yours
> to keep.

Recurring task — it never archives. Each pass is one **run**: record it with
`akb board run <this card's id>` (+1 completed, card kept).

Each run keeps **one feature checklist per competitor** — every feature that competitor
offers its users, one line each, marked as something you already ship, something one of
your cards is building, or something nobody has touched. That last group is your gap list.
Open a competitor's file and you see where you stand in ten seconds.

## Output — `result.md` (index) + one checklist per competitor

`result.md` next to this card is the **index**, never this task file. It has two parts:

- A **competitors todo list** holding every product `competitors.list` has ever returned,
  one line each: `- [ ] <competitor>`. Check the box once it has its own checklist file
  (real competitor) or a line under `Not competitors` (false positive). Each handled line
  carries its **cadence** — when to look again:
  `- [x] <competitor> — read <YYYY-MM-DD>, cadence <daily|weekly|monthly|never>, next <YYYY-MM-DD>`
  (`never` drops the `next` date). Re-read a competitor only when its `next` date has
  arrived; skip the rest. See **Cadence** below for how to set it.
- An h2 **`Not competitors (False positives)`**, one line each:
  `- <competitor>: <one brief sentence on why it isn't a competitor>`.

Each real competitor gets its own file in a `competitors/` folder next to this card —
`competitors/<slug>.md` (slug: lowercase, drop any TLD suffix, spaces→hyphens, e.g.
`redditclient.com` → `competitors/redditclient.md`). The file holds three things and
nothing else:

```
Last read: 2026-08-10

## Features

- [x] **Weekly digest**: emails you the new buyer-pain threads every Monday.
- [ ] **Sentiment scoring**: labels each thread positive or negative (#212)
- [ ] **Slack app**: posts new threads straight into a channel.

## Sources

- Home: https://example.com
- Pricing: https://example.com/pricing
```

- **`Last read: <YYYY-MM-DD>`** — the day you last read this competitor. A stale date is
  the signal to look again.
- **`## Features`** — one checkbox line per feature, `- [ ] **bold title**: one liner`,
  with an optional `(#taskid)` at the end.
- **`## Sources`** — `- <Title>: <url>` for every page the features were read from, so the
  next run re-checks the same places.

Nothing else goes in the file: no prose on what the product does, no pricing, no
positioning, no content assets. A prose study reads well once, then nobody re-reads it and
it quietly goes stale. The checklist stays worth reading.

### What a line means

- `- [ ] **Title**: one liner` — the competitor has it and nobody on your side is on it.
  This is the gap list.
- `- [ ] **Title**: one liner (#212)` — a card on your board is building it; the number is
  that card.
- `- [x] **Title**: one liner` — you already ship the same feature.

A **feature** is anything the competitor offers its users: a product capability, an
integration, a free tool, a side product. If a user can use it, it gets a line.

**Tick a box only for something your user can do today** — the feature is in your board's
shipped memory (`docs/kanban/memory/**/readme.md`) or in your user-facing docs. The same
job for the user counts even when yours works differently. A planned, half-built, or
nearly-done match does not: leave it unticked.

### How a line changes over time

- A feature the competitor has grown since the last read → add a new unticked line.
- You file a card for an unticked line → write `(#id)` at the end of that line.
- That card ships → tick the box and drop the `(#id)`: the card is archived, so the id no
  longer points at anything on the board.
- The competitor drops a feature → delete the line. The file lists what it offers now.
- Never rewrite the file from scratch. Keep the lines that are still true, with their ticks
  and ids, and edit only what changed.

## Process

1. Gather the flagged competitors from dist0's `competitors.list` capability — a flat
   `competitors` array, one entry per product, ranked by mention count. Invoke it over the
   dist0 API (note the `www.` host — `dist0.com` 308-redirects and drops the POST body):
   ```
   curl -s https://www.dist0.com/api/v1/invoke \
     -H "Authorization: Bearer $DIST0_API_KEY" -H "Content-Type: application/json" \
     -d '{ "capability": "competitors.list", "input": {} }'
   ```
   Each entry has `name`, `mentions`, and `sources`.
2. **Normalize and dedup** — the capability keys on the raw name the pipeline emitted, so the
   same product often appears under case/suffix variants (e.g. `redditclient.com` and
   `RedditClient`, `Growditt.com` and `Growditt`). Before diffing, fold each set of variants
   into one product (sum their mentions) and treat it as a single todo line.
3. **Record and diff** — append any new normalized product to the todo list (create
   `result.md` if missing), then work only the products that need it this run: not yet
   handled, or whose `next` date has arrived. Skip the rest.
4. For each kept product, decide: real competitor (solves the same job for the same buyer
   as you) or false positive (unrelated product the pipeline over-matched)? Never stop to
   ask — a product you can't judge goes down as a false positive with the reason, and a
   later run can move it back.
5. **False positives** — log each under the `Not competitors` h2 in `result.md` with a
   one-sentence reason.
6. **Read each real competitor that is due.** Walk its site — home, features and pricing
   pages, docs, changelog, nav and footer, any free tool or side product — plus the Reddit
   threads that named it, and collect every feature it offers its users. Open its existing
   `competitors/<slug>.md` first and work from it; create the file if this is the first read.
7. **Write the checklist.** Set `Last read` to today, add a line for every feature not
   listed yet, delete the lines it no longer offers, and list each page you read under
   `## Sources`.
8. **Tick what you already ship.** Check each line against your board's shipped memory
   (`docs/kanban/memory/**/readme.md`) and your user-facing docs. Tick only the features a
   user can use today; leave the rest unticked.
9. **Tag the lines a card is already building.** Run
   `akb board list`, match the open cards against the unticked
   lines, and write `(#id)` on each line that already has one.
10. **File cards for the gaps worth closing.** Take the unticked lines with no id and file
    the high- and medium-value ones as cards via the `kanban` skill (it dedups against the
    board); drop the low-value ones. Write each new id back onto its line. For a big
    feature, file a rough-idea card to deep-dive later instead of speccing it now. A run may
    file no card — that's fine when the gaps are genuinely covered or not worth it.
11. **Set its cadence** (see **Cadence** below) and write the read/cadence/next line back
    to the todo list in `result.md`.
12. Record the run: `akb board run <this card's id>`.

## Cadence

Each competitor is re-read on its own schedule, tracked on its todo-list line. The ladder,
most to least frequent: `daily → weekly → monthly → never`.

- **First read** — set the starting cadence from how fast it can change. A strong
  competitor shipping often → `daily`, so you catch anything a run missed. A thin product
  that grows slowly → `monthly`. A dead product → `never`.
- **Each re-read** — if the run found no new feature and filed **no** card, move the
  cadence one step slower (toward `never`). If it did find something, keep the cadence (or
  move one step faster when a lot changed).
- `next` date = read date + cadence; `never` has no `next` and is never re-read.

## Done when (one run)

Every all-time competitor `competitors.list` returns is sorted: false positives logged
under the `Not competitors` h2, and every real competitor due this run has a fresh
`competitors/<slug>.md` — today's read date, one checkbox line per feature it offers,
boxes ticked only for what your users can already do, `(#id)` on the lines a card is
building — plus its cadence line in `result.md`. The run is recorded with
`run <this card's id>`. The loop never "finishes" — it runs on each cadence, and the
checklists get truer each pass.
