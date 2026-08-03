#!/usr/bin/env node
// Kanban board bookkeeping. The ONLY sanctioned writer of docs/kanban/next-id.
//
// Handles the id-touching moves so the board stays consistent:
//   init    — scaffold a fresh docs/kanban/ board (folders, the project-wide memory set in memory/, config.md)
//   memory-init — lazily scaffold a module's memory path with the four-file set (no goal.md)
//   setup-done  — tick one box on setup's own checklist; the last tick deletes the file
//   setup-status — how far setup got (or that this board has no checklist left)
//   create  — allocate task id(s); with --title, also write the card's frontmatter + index it
//   update  — rewrite a card's frontmatter fields (priority/roi/links/status/release, move track, rename)
//   update-questions — patch the open-question list in place (append/update/drop/clear)
//   tag     — set/clear the [user] tag on one open question (auto-refine triage)
//   list    — the open cards at a glance (--module filters to one module's cards)
//   release — add a release to docs/kanban/releases.md, list them with what each holds, or
//             close one: summary written, leftovers' release cleared, line off the list
//   migrate — convert old bold-header cards to the frontmatter meta format
//   archive — move a finished task's file/folder into docs/kanban/.archive/, strip its
//             README entry, drop its id from other cards' blocked_by/related, record "completed"
//   reject  — same, but delete the file/folder, record "rejected"
//
// archive/reject close with a handoff block: the memory file the note belongs in, and every
// line elsewhere still mentioning the id. Both are things the script knows for free while
// it works, and both used to be rediscovered by hand afterwards.
//   run     — record one run of a recurring task (+1 completed); keep the card
//
// It is the ONLY sanctioned writer of a card's frontmatter — Write/Edit are for the body
// only. It also keeps docs/kanban/metrics.csv (one row per day: completed, created, rejected).
//
// This file is the dispatcher; the work lives beside it in lib/ (shared plumbing:
// paths, frontmatter, questions, validation, board walking, README index, memory,
// reconcile) and commands/ (one file per command family).
//
// Usage:
//   node kanban.mjs init [track...]                     scaffold docs/kanban/ (folders, memory/, config.md)
//   node kanban.mjs memory-init <module>                lazily scaffold memory/<module>/ with the four-file set
//   node kanban.mjs setup-done <step>                   tick one box on docs/kanban/setup-checklist.md
//   node kanban.mjs setup-status                        print how far setup got
//   node kanban.mjs create [--count N]                  allocate N ids (default 1), print them
//   node kanban.mjs create --title T --track K [opts]   scaffold one card (frontmatter + body template + index)
//   node kanban.mjs update <id> [opts]                  rewrite a card's frontmatter fields / move / rename
//   node kanban.mjs update-questions <id> [ops]         patch the open-question list (append/update/drop/clear)
//   node kanban.mjs tag <id> <n[,n...]> <user|none>    set/clear the tag on one or more open questions
//   node kanban.mjs list [--module <m>]                 the open cards at a glance, optionally one module's
//   node kanban.mjs release new <id> [--fill]          add a release to docs/kanban/releases.md; --fill
//                                                       puts the high-priority cards with no release in
//   node kanban.mjs release list                       the releases in ship order + what each holds
//   node kanban.mjs release close <id>                 close a shipped release: summary + leftovers' release cleared
//   node kanban.mjs release drop <id>                  drop a release that won't ship: no shipped record,
//                                                       its open cards' release cleared
//   node kanban.mjs migrate [--dry-run]                 convert old bold-header cards to frontmatter
//   node kanban.mjs archive <id>                        finish task <id> (move card to .archive/ + README + metric)
//   node kanban.mjs reject  <id>                        reject task <id> (delete card + README + metric)
//   node kanban.mjs run     <id>                        record one run of recurring task <id> (+1 completed, card kept)
//   node kanban.mjs peek                                print the current next-id (no bump)
//   node kanban.mjs metrics                             print the metrics CSV

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { rel, readNextId, METRICS } from './lib/paths.mjs'
import { cmdInit, cmdMemoryInit } from './commands/init.mjs'
import { cmdCreate, cmdUpdate, cmdUpdateQuestions, cmdTag } from './commands/card.mjs'
import { cmdRemove } from './commands/remove.mjs'
import { cmdMigrate, cmdRun } from './commands/misc.mjs'
import { cmdList } from './commands/list.mjs'
import { cmdRelease } from './commands/release.mjs'
import { cmdSetupDone, cmdSetupStatus } from './commands/setup.mjs'

// Released version of the skill. Do NOT hand-edit — it's stamped from the repo's root
// VERSION file by scripts/sync-version.mjs (the one number for the whole repo; see
// PUBLISHING.md). It's baked in because this file is copied into installed projects away
// from the manifests, so `version` can answer without anything fetched.
const SKILL_VERSION = '0.5.0'

const SELF = fileURLToPath(import.meta.url)

// Print the installed version — the released number baked into this file when it was
// published. `npx ai4kanban update` reads the same number to say which version it moved
// you from.
function cmdVersion() {
  console.log(`ai4kanban ${SKILL_VERSION}`)
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  switch (cmd) {
    case 'init':
      return cmdInit(rest)
    case 'memory-init':
      return cmdMemoryInit(rest[0])
    case 'setup-done':
      return cmdSetupDone(rest)
    case 'setup-status':
      return cmdSetupStatus()
    case 'create':
      return cmdCreate(rest)
    case 'update':
      return cmdUpdate(rest)
    case 'update-questions':
      return cmdUpdateQuestions(rest)
    case 'tag':
      return cmdTag(rest)
    case 'list':
      return cmdList(rest)
    case 'release':
      return cmdRelease(rest)
    case 'migrate':
      return cmdMigrate(rest)
    case 'archive':
      return cmdRemove(Number(rest[0]), 'completed')
    case 'reject':
      return cmdRemove(Number(rest[0]), 'rejected')
    case 'run':
      return cmdRun(Number(rest[0]))
    case 'peek':
      return console.log(readNextId())
    case 'version':
    case '--version':
    case '-v':
      return cmdVersion()
    case 'metrics':
      return console.log(fs.existsSync(METRICS) ? fs.readFileSync(METRICS, 'utf8').trim() : '(no metrics yet)')
    case 'help':
    case '-h':
    case '--help':
    case undefined:
      return console.log(HELP)
    default: {
      const guess = nearestCommand(cmd)
      const hint = guess ? ` Did you mean \`${guess}\`?` : ''
      console.error(`kanban: unknown command "${cmd}".${hint}\n`)
      console.error(HELP)
      process.exit(1)
    }
  }
}

const COMMANDS = ['init', 'memory-init', 'setup-done', 'setup-status', 'create', 'update', 'update-questions', 'tag', 'list', 'release', 'migrate', 'archive', 'reject', 'run', 'peek', 'version', 'metrics', 'help']

const HELP = `kanban — the only sanctioned writer of docs/kanban/next-id.

Usage: node ${rel(SELF)} <command> [args]

  init [track...]      scaffold docs/kanban/ (folders, the project-wide memory set in memory/, and a blank
                       config.md, releases.md); tracks default to feature bug research. On an
                       existing board it only adds the files that are missing (safe to re-run).
  memory-init <module> lazily scaffold docs/kanban/memory/<module>/ with the four-file set
                       (readme, decisions, redesign, rejected — goal.md lives only at the
                       board root). Idempotent — run it before the first write to a
                       module's memory.
  setup-done <step>    tick one box on docs/kanban/setup-checklist.md as that setup
                       step finishes: install, config, goal, decisions, modules,
                       tasks. The tick that closes the last box deletes the file, so
                       a board without it is a board that is set up.
  setup-status         how far setup got, and which step comes next. Says setup is
                       finished when there is no checklist.
  create [--count N]   allocate N task ids (default 1), advance next-id, print them
  create --title T --track K [opts]
                       scaffold ONE card: write its frontmatter + a body template, index it.
                       opts: --priority high|med|low (default med), --roi high|med|low
                       (default med), --release v1 (default none — the card is wanted,
                       not promised to a version; free text, kept as typed),
                       --blocked-by 1,2, --related 3, --modules skill,site
                       (validated against modules.md), --question "..." (repeatable),
                       --slug my-slug, --no-body, --cadence "1d at 09:30"
                       (--track recurring only — see update below).
                       The script owns the frontmatter — fill only the body by hand.
                       A question the user picks from carries its choices: follow its
                       --question with one --option "a — why" per choice (2+), and
                       --mode single|multi (default single) for how many may be
                       ticked. The choice you recommend is declared by
                       --recommended-option "c — why" instead of --option — it joins
                       the same list and opens ticked, so it's written once. Without
                       any option the question stays a plain line with a text box.
  update <id> [opts]   rewrite a card's frontmatter fields: --title, --priority,
                       --roi, --status todo|ready|implementing, --release,
                       --blocked-by, --related, --modules, --cadence. --release ""
                       (an empty value) takes the card back out of a release.
                       --cadence sets how often a recurring card repeats — 30m, 6h,
                       7d, or 1d at 09:30 (a time of day only with whole days).
                       Recurring cards only; --cadence "" clears it and the card
                       runs by hand again.
                       --track moves the card + fixes the index; --slug renames
                       it. Body and questions are left untouched — questions have
                       their own command below.
  update-questions <id> [ops]
                       patch the open-question list, one op at a time, applied in
                       the order typed: --append ".." adds a question, --update
                       <n> ".." rewrites question n whole (options included),
                       --drop n[,n...] removes answered ones, --clear removes
                       them all. Positions are 1-based, read against the list as
                       it stands when the op runs. --option / --mode /
                       --recommended-option attach to the --append or --update
                       before them, same as create's --question. A question may
                       carry a leading [user] tag marking it as the human's
                       judgment call.
  list [--module <m>]  the open cards at a glance — one block per card with its id,
                       title, meta (track, status, priority, roi, release, blockers,
                       open questions), summary line and file path. --module <m>
                       narrows it to the cards tagged with that module (validated
                       against modules.md).
  release new <id>     add a release to the end of docs/kanban/releases.md (the open
                       releases, in the order they ship). A version id is free text
                       (v1, 0.5.0, august), kept as typed, and has to work as a
                       filename — letters, numbers, dot, dash, underscore. Refused: an
                       empty id and one already on the list.
                       --fill puts the high-priority cards with no release in as the
                       release is made: a card goes in when its priority is high,
                       nothing open is blocking it, and it is not a group root —
                       nothing else is looked at, and a card already in a release
                       stays where it is. One line per card moved; a high-priority
                       card left behind is named with the test it failed.
  release list         the releases in ship order, each with how many open cards name it
                       and how many of those are ready to build; the cards in no release
                       are counted last. Names any card pointing at a release that is
                       not on the list.
  release close <id>   the version shipped: write what it held to
                       docs/kanban/.release-summaries/<id>.md (what shipped, from the
                       archived cards naming it; what didn't, from the open ones), clear
                       the release off every card still open in it, and take its line off
                       the list. Always allowed, whatever is still open. There is no
                       second run — afterwards the id is unknown and no card names it.
                       A card with every todo ticked but never archived counts as not
                       shipped; the close names it so you can archive it and fix that
                       one line by hand.
  release drop <id>    the version will not ship: write one dated \`## Dropped\` section
                       to docs/kanban/.release-summaries/<id>.md (the cards archived
                       under it, and the open ones sent back), clear the release off
                       every open card in it, and take its line off the list. Nothing it
                       writes reads as a shipped version, and a later close of a remade
                       <id> skips the cards the drop listed.
  tag <id> <n[,n...]> <t>  set the tag on one or more open questions (1-based, e.g.
                       1 or 1,2,3): user | none (none strips it). Used by the
                       auto-refine loop to hand questions to the human without
                       rewriting the list.
  migrate [--dry-run]  convert old bold-header cards to frontmatter; missing meta falls
                       back to empty / med. Skips cards that already have frontmatter.
  archive <id>         finish task <id>: move its file/folder into docs/kanban/.archive/,
                       strip its README entry, drop the id from every other card's
                       blocked_by/related, count completed
  reject  <id>         reject task <id>: same, but delete the file/folder, count rejected.
                       Deleting is final — the receipt prints the card so its note can
                       still be written from its own words.
                       Both end with a handoff: which memory file the note goes in (and
                       its topics), and every line elsewhere that still mentions the id.
                       Read that instead of grepping — a bare id also matches dates.
  run     <id>         record one run of recurring task <id>: +1 completed, card kept (no archive)
  peek                 print the current next-id (no bump)
  version              print the installed skill version (+ source stamp if present)
  metrics              print docs/kanban/metrics.csv
  help                 show this

Never edit next-id or metrics.csv by hand — let the script write them. Never hand-write a
card's frontmatter — use create/update/update-questions. Write/Edit are only for the card body.`

// Levenshtein-based suggestion so a mistyped command auto-corrects to the closest match.
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[a.length][b.length]
}

function nearestCommand(input) {
  let best = null
  let bestDist = Infinity
  for (const c of COMMANDS) {
    const d = editDistance(input, c)
    if (d < bestDist) [best, bestDist] = [c, d]
  }
  // Only suggest when it's a plausible typo, not a wildly different word.
  return bestDist <= Math.max(2, Math.ceil(best.length / 2)) ? best : null
}

main()
