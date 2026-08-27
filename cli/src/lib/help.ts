// What the moves are, in one table, rendered two ways.
//
//   - `akb board help` — one line per move, the whole surface on one screen, and the full
//     text of a move only when you ask for it by name. The old single block was a screen
//     and a half nobody read to the end.
//   - `kanban help` — the block an installed skill folder has always printed, word for
//     word, so a board installed before the CLI existed reads exactly the same.
//
// Both come out of the same entries: a move's brief line and its full text are written
// once. `detail` lines are stored already wrapped, so the long-form layout is the text
// itself rather than something a wrapper has to guess at.

// The three families the compact help groups moves under.
export const GROUPS = ['Cards', 'Releases', 'Board']

// One usage form as the compact list shows it: its label and the text beside it.
type Brief = [string, string]

// One usage form in full: its label, the detail lines under it, and how to lay it out.
type Legacy = [string, string[]] | [string, string[], { inline?: boolean }]

// One move of the board's bookkeeping, written once and rendered both ways.
export interface Move {
  name: string
  group: string | null
  brief: Brief[]
  legacy: Legacy[]
  aliases?: string[]
}

// `brief`  — [label, text] as the compact list shows it, one entry per usage form.
// `legacy` — [label, detail-lines] as today's block shows it. `inline` keeps a long label
//            on the same line as its first detail line, which is how `tag` has always
//            printed.
// `aliases` — other spellings that reach this move. `run` is the old name for
//            `record-run`: starting an agent becomes `akb run`, so counting a run that
//            already happened had to stop sharing the word.
export const MOVES: Move[] = [
  {
    name: 'init',
    group: 'Board',
    brief: [['init [track...]', 'scaffold docs/kanban/; on an existing board add only what\nis missing']],
    legacy: [
      [
        'init [track...]',
        [
          'scaffold docs/kanban/ (folders, the project-wide memory set in memory/, and a blank',
          'config.md, releases.md); tracks default to feature bug research. On an',
          'existing board it only adds the files that are missing (safe to re-run).',
        ],
      ],
    ],
  },
  {
    name: 'memory-init',
    group: 'Board',
    brief: [['memory-init <module>', "scaffold one module's memory folder"]],
    legacy: [
      [
        'memory-init <module>',
        [
          'lazily scaffold docs/kanban/memory/<module>/ with the four-file set',
          '(readme, decisions, redesign, rejected — goal.md lives only at the',
          'board root). Idempotent — run it before the first write to a',
          "module's memory.",
        ],
      ],
    ],
  },
  {
    name: 'setup-done',
    group: 'Board',
    brief: [['setup-done <step>', 'tick one setup step; the tick that closes the last one ends\nsetup']],
    legacy: [
      [
        'setup-done <step>',
        [
          'tick one box on docs/kanban/setup-checklist.md as that setup',
          'step finishes: install, config, goal, decisions, modules,',
          'tasks. The tick that closes the last box deletes the file, so',
          'a board without it is a board that is set up.',
        ],
      ],
    ],
  },
  {
    name: 'setup-status',
    group: 'Board',
    brief: [['setup-status', 'how far setup got and what comes next']],
    legacy: [
      [
        'setup-status',
        ['how far setup got, and which step comes next. Says setup is', 'finished when there is no checklist.'],
      ],
    ],
  },
  {
    name: 'create',
    group: 'Cards',
    brief: [
      [
        'create --title T --track K',
        'allocate its id and write exactly one card — fields, body\ntemplate, and index entry. Options: --priority, --roi,\n--release, --blocked-by, --related, --modules, --question,\n--slug, --cadence, --no-body, --proposed',
      ],
    ],
    legacy: [
      [
        'create --title T --track K [opts]',
        [
          'write exactly ONE card: allocate its id, write its frontmatter + a body',
          'template, and index it. There is no separate id-reservation mode.',
          '--track K is a top-level track name, never a group folder path.',
          '--blocked-by and --related take ids of existing open cards. For a group,',
          'create the root first, then create each subtask related to its id. See',
          '"Group task" in `akb guide board` for the folder and index steps.',
          'opts: --priority high|med|low (default med), --roi high|med|low',
          '(default med), --release v1 (default none — the card is wanted,',
          'not promised to a version; free text, kept as typed),',
          '--blocked-by 1,2, --related 3, --modules skill,site',
          '(validated against modules.md), --question "..." (repeatable),',
          '--slug my-slug, --no-body, --cadence "1d at 09:30"',
          '(--track recurring only — see update below), --proposed.',
          '--proposed says the board went looking for this work rather than',
          'a person asking for it — the propose, extract-ideas and',
          'plan-release flows pass it, nothing else does.',
          'The script owns the frontmatter — fill only the body by hand.',
          'A question the user picks from carries its choices: follow its',
          '--question with one --option "a — why" per choice (2+), and',
          '--mode single|multi (default single) for how many may be',
          'ticked. The choice you recommend is declared by',
          '--recommended-option "c — why" instead of --option — it joins',
          "the same list and opens ticked, so it's written once. Without",
          'any option the question stays a plain line with a text box.',
        ],
      ],
    ],
  },
  {
    name: 'update',
    group: 'Cards',
    brief: [
      [
        'update <id>',
        "rewrite a card's fields: --title, --priority, --roi,\n--status, --release, --blocked-by, --related, --modules,\n--cadence, --track (moves it), --slug (renames it)",
      ],
    ],
    legacy: [
      [
        'update <id> [opts]',
        [
          "rewrite a card's frontmatter fields: --title, --priority,",
          '--roi, --status todo|ready|implementing, --release,',
          '--blocked-by, --related, --modules, --cadence. --release ""',
          '(an empty value) takes the card back out of a release.',
          '--cadence sets how often a recurring card repeats — 30m, 6h,',
          '7d, or 1d at 09:30 (a time of day only with whole days).',
          'Recurring cards only; --cadence "" clears it and the card',
          'runs by hand again.',
          '--track moves the card + fixes the index; --slug renames',
          'it. Body, questions and verify lines are left untouched —',
          'those two have their own commands below.',
        ],
      ],
    ],
  },
  {
    name: 'update-questions',
    group: 'Cards',
    brief: [
      [
        'update-questions <id>',
        'patch the open questions one op at a time: --append,\n--update <n>, --drop <n,n>, --to-verify <n,n>, --clear.\n--append/--update need 2+ --option "a — why"; add\n--mode multi when several picks may be combined',
      ],
    ],
    legacy: [
      [
        'update-questions <id> [ops]',
        [
          'patch the open-question list, one op at a time, applied in',
          'the order typed: --append ".." adds a question, --update',
          '<n> ".." rewrites question n whole (options included),',
          '--drop n[,n...] removes answered ones, --to-verify n[,n...]',
          'moves ones that turned out to be hand-checks into the card\'s',
          'verify: list (tag dropped, wording kept), --clear removes',
          'them all. Positions are 1-based, read against the list as',
          'it stands when the op runs. --option and',
          '--recommended-option attach to the --append or --update',
          "before them, same as create's --question. Every question",
          'written here needs 2 or more --option "a — why" — a bare',
          'line is refused. It is exclusive unless --mode multi says',
          'the picks may be combined.',
          'The user also gets a free-text choice, added by the board:',
          'never write one yourself. A question may carry a leading',
          "[user] tag marking it as the human's judgment call.",
        ],
      ],
    ],
  },
  {
    name: 'update-verify',
    group: 'Cards',
    brief: [
      [
        'update-verify <id>',
        'patch what the user checks by hand before accepting the\nwork: --append, --drop <n,n>, --clear',
      ],
    ],
    legacy: [
      [
        'update-verify <id> [ops]',
        [
          'patch the `verify:` list — the hand-checks a finished build',
          'leaves for the user, one short line each. Ops apply in the',
          'order typed: --append ".." adds a line, --drop n[,n...]',
          'removes them by 1-based position, --clear removes them all.',
          'A verify line is a NOTE, not a question: it carries no tag',
          'and no options, nothing waits on an answer, and it never',
          'stops a card reaching ready or being archived. A decision',
          'the user has to make is an open question instead.',
        ],
      ],
    ],
  },
  {
    name: 'schedule',
    group: 'Cards',
    brief: [
      [
        'schedule <id>',
        'run an action by itself once the card is unblocked:\n--action implement|refine, --notes "..", --clear to take\nit off',
      ],
    ],
    legacy: [
      [
        'schedule <id> --action implement|refine',
        [
          'have the board run that action on this card by itself, the',
          'moment every card it waits on has left the board (archived or',
          'rejected — either way that card is gone). --notes ".." rides',
          'along and reaches the run when it fires. A card holds one',
          'schedule at a time, so a second one replaces the first, and',
          'a rough card gets a refine schedule by default when it first',
          'becomes blocked. --clear cancels it for that blocked episode;',
          'changing one non-empty blocker list into another leaves it off.',
          'Only a card that really is waiting on another card can carry',
          'one — start an unblocked card instead.',
        ],
      ],
    ],
  },
  {
    name: 'tag',
    group: 'Cards',
    brief: [['tag <id> <n[,n...]> <tag>', "mark a question as the human's call, or clear the mark"]],
    legacy: [
      [
        'tag <id> <n[,n...]> <t>',
        [
          'set the tag on one or more open questions (1-based, e.g.',
          '1 or 1,2,3): user | none (none strips it). Used by the',
          'refine loop to hand questions to the human without',
          'rewriting the list.',
        ],
        { inline: true },
      ],
    ],
  },
  {
    name: 'review-verdict',
    group: 'Cards',
    brief: [
      [
        'review-verdict <id>',
        'record a review\'s verdict on the delivery in flight:\n--verdict pass|ask, findings for ask in --file <path>',
      ],
    ],
    legacy: [
      [
        'review-verdict <id> --verdict pass|ask',
        [
          "record what a review made of the delivery in flight on that card,",
          'so the delivery knows whether to finish or stop and ask.',
          'pass — the reviewed and corrected work meets the approved card.',
          'ask — only the user can settle it. Ask carries findings:',
          '--file <path> (markdown, written to a file first), or --text ".."',
          'for a one-liner. Write each as `- **<short title>**: <evidence>`.',
          'Calling it twice in one run replaces the first verdict. A review',
          'run that never calls it stops the delivery and asks the user.',
        ],
      ],
    ],
  },
  {
    name: 'spec-write',
    group: 'Cards',
    brief: [['spec-write <id> <agent>', "write a spec agent's own section onto the card:\n--file <path>, or --text \"..\"; --half human|agent"]],
    legacy: [
      [
        'spec-write <id> <agent> --file <path>',
        [
          "put a spec agent's answer on the card as one section headed",
          '`## By `<agent>` agent`, and change nothing else. --file <path>',
          'is the answer (markdown, written to a file first); --text ".."',
          'for a one-liner. Run again for the same agent and the section',
          'is REPLACED, never added twice. The section goes before',
          '## Decided by the agent, or at the end. --half human puts it',
          'above the <!-- agent --> boundary, where a pick the user still',
          'has to make belongs; --half agent puts it below. Told nothing,',
          'a new section goes below and a rewrite stays put. Only a name',
          'the command ships as a spec agent is accepted — `akb spec`',
          'lists them.',
        ],
      ],
    ],
  },
  {
    name: 'list',
    group: 'Cards',
    brief: [['list [--module <m>]', 'the open cards: id, title, meta, summary, path']],
    legacy: [
      [
        'list [--module <m>]',
        [
          'the open cards at a glance — one block per card with its id,',
          'title, meta (track, status, priority, roi, release, blockers,',
          'open questions, hand-checks), summary line and file path.',
          '--module <m>',
          'narrows it to the cards tagged with that module (validated',
          'against modules.md).',
        ],
      ],
    ],
  },
  {
    name: 'release',
    group: 'Releases',
    brief: [
      [
        'release new <id>',
        'add a release, last in ship order. --goal ".." says what it\nis for; --fill puts today\'s unblocked high-priority cards in',
      ],
      ['release goal <id> ".."', 'change what a release is for; "" clears it'],
      ['release list', 'the releases in ship order, with their open and ready counts'],
      [
        'release close <id>',
        'the version shipped: write its summary, clear it off the\ncards still open, take it off the list, start its changelog',
      ],
      ['release drop <id>', 'the version will not ship: clear it off, no summary'],
      [
        'release changelog <id>',
        "put a changelog at the top of that version's newest closed\nsection: --file <path>, or --text \"..\"",
      ],
    ],
    legacy: [
      [
        'release new <id>',
        [
          'add a release to the end of docs/kanban/releases.md (the open',
          'releases, in the order they ship). A version id is free text',
          '(v1, 0.5.0, august), kept as typed, and has to work as a',
          'filename — letters, numbers, dot, dash, underscore. Refused: an',
          'empty id and one already on the list.',
          '--goal ".." says what the version is for, in the user\'s own words.',
          'It is kept on the release\'s own line, folded to one line whatever',
          'was typed, and is never required — a release with no goal works',
          'everywhere a release with one does.',
          '--fill puts the high-priority cards with no release in as the',
          'release is made: a card goes in when its priority is high,',
          'nothing open is blocking it, and it is not a group root —',
          'nothing else is looked at, and a card already in a release',
          'stays where it is. One line per card moved; a high-priority',
          'card left behind is named with the test it failed.',
        ],
      ],
      [
        'release goal <id> ".."',
        ['change what a release is for, after it was made. An empty goal', '("") clears it.'],
      ],
      [
        'release list',
        [
          'the releases in ship order, each with what it is for, how many open',
          'cards name it and how many of those are ready to build; the cards in',
          'no release are counted last. Names any card pointing at a release',
          'that is not on the list.',
        ],
      ],
      [
        'release close <id>',
        [
          'the version shipped: write what it held to',
          'docs/kanban/.release-summaries/<id>.md (what shipped, from the',
          "archived cards naming it; what didn't, from the open ones), clear",
          'the release off every card still open in it, and take its line off',
          'the list. Always allowed, whatever is still open. There is no',
          'second run — afterwards the id is unknown and no card names it.',
          'A card with every todo ticked but never archived counts as not',
          'shipped; the close names it so you can archive it and fix that',
          'one line by hand. The summary is a card list, so the close then',
          'starts the run that writes what the version changed at the top of',
          'it — nothing shipped, no run; inside a run, or if it cannot start,',
          'it names `akb changelog <id>` instead.',
        ],
      ],
      [
        'release drop <id>',
        [
          'the version will not ship: report the cards archived under it and',
          'the open ones sent back, clear the release off every open card in',
          'it, and take its line off the list. Writes no summary file or',
          'section; an existing summary for a reused id is left untouched.',
        ],
      ],
      [
        'release changelog <id> --file <path>',
        [
          "write a few plain lines saying what the version changed into the",
          "newest ## Closed section of its summary file, under a heading of",
          'their own, above the goal and the card list. --file <path> is the',
          'changelog (markdown, written to a file first); --text ".." for a',
          'one-liner. Every line must read as one thing the user can now see',
          'or do; six lines at most. Run it again for the same version and',
          'the changelog is REPLACED, never added twice. Refused for a version',
          'the board holds no closed record of, and for one that shipped no',
          'card. `akb changelog <id>` is the run that writes it.',
        ],
      ],
    ],
  },
  {
    name: 'migrate',
    group: 'Board',
    brief: [['migrate [--dry-run]', 'convert cards written before frontmatter']],
    legacy: [
      [
        'migrate [--dry-run]',
        [
          'convert old bold-header cards to frontmatter; missing meta falls',
          'back to empty / med. Skips cards that already have frontmatter.',
        ],
      ],
    ],
  },
  {
    name: 'archive',
    group: 'Cards',
    brief: [
      ['archive <id>', 'finish a card: file to .archive/, out of the index, off\nevery other card\'s links'],
    ],
    legacy: [
      [
        'archive <id>',
        [
          'finish task <id>: move its file/folder into docs/kanban/.archive/,',
          "strip its README entry, drop the id from every other card's",
          'blocked_by/related, delete its mockups, count completed',
        ],
      ],
    ],
  },
  {
    name: 'reject',
    group: 'Cards',
    brief: [['reject <id>', 'drop a card: delete it, same clean-up, counted as rejected']],
    legacy: [
      [
        'reject  <id>',
        [
          'reject task <id>: same, but delete the file/folder, count rejected.',
          'Deleting is final — the receipt prints the card so its note can',
          'still be written from its own words.',
          'Both end with a handoff: which memory file the note goes in (and',
          'its topics), and every line elsewhere that still mentions the id.',
          'Read that instead of grepping — a bare id also matches dates.',
        ],
      ],
    ],
  },
  {
    name: 'record-run',
    aliases: ['run'],
    group: 'Cards',
    brief: [['record-run <id>', 'count one run of a recurring card and keep the card']],
    legacy: [
      [
        'run     <id>',
        ['record one run of recurring task <id>: +1 completed, card kept (no archive)'],
      ],
    ],
  },
  {
    name: 'peek',
    group: 'Board',
    brief: [['peek', 'the next free id, without taking it']],
    legacy: [['peek', ['print the current next-id (no bump)']]],
  },
  {
    name: 'version',
    group: null, // `akb version` already prints it, so it is not one of the board's moves
    brief: [],
    legacy: [['version', ['print the installed skill version (+ source stamp if present)']]],
  },
  {
    name: 'metrics',
    group: 'Board',
    brief: [['metrics', 'print metrics.csv']],
    legacy: [['metrics', ['print docs/kanban/metrics.csv']]],
  },
  {
    name: 'help',
    group: 'Board',
    brief: [['help [<move>]', 'this list, or one move in full']],
    legacy: [['help', ['show this']]],
  },
]

export const MOVE_NAMES = MOVES.flatMap((m) => [m.name, ...(m.aliases || [])])

export const findMove = (name: string): Move | null => MOVES.find((m) => m.name === name || (m.aliases || []).includes(name)) || null

// ---- the compact list ------------------------------------------------------

const BRIEF_COL = 32

function briefLines(move: Move): string[] {
  const out: string[] = []
  for (const [label, text] of move.brief) {
    const [first, ...rest] = String(text).split('\n')
    out.push(`  ${label.padEnd(BRIEF_COL - 2)}${first}`)
    for (const line of rest) out.push(`${' '.repeat(BRIEF_COL)}${line}`)
  }
  return out
}

export function boardHelp(program: string): string {
  const out = [
    `${program} — the board's bookkeeping. The agent calls these between runs; a person`,
    'never has to type one.',
    '',
    `Usage: ${program} <move> [args] [options]`,
  ]
  for (const group of GROUPS) {
    out.push('', group)
    for (const move of MOVES.filter((m) => m.group === group)) out.push(...briefLines(move))
  }
  out.push(
    '',
    'Options — any move takes these',
    `  ${'--dir <path>'.padEnd(BRIEF_COL - 2)}the project to work on. Default: the nearest board at or`,
    `${' '.repeat(BRIEF_COL)}above the folder you ran in`,
    `  ${'--json'.padEnd(BRIEF_COL - 2)}answer as one JSON object instead of prose`,
    '',
    'Never edit next-id or metrics.csv by hand, and never hand-write a card\'s fields — these',
    'moves own them. Write and edit only a card\'s body.',
  )
  return out.join('\n')
}

// One move in full: every usage form it has, with the whole text.
export function moveHelp(move: Move, program: string): string {
  const out: string[] = []
  for (const [label, detail] of move.legacy) {
    out.push(`${program} ${label.replace(/\s{2,}/g, ' ')}`)
    for (const line of detail) out.push(`  ${line}`)
    out.push('')
  }
  if (move.aliases?.length) out.push(`also spelled: ${move.aliases.join(', ')}`, '')
  return out.join('\n').trimEnd()
}

// ---- the block an installed skill folder prints -----------------------------

const LEGACY_COL = 23

function legacyLines(move: Move): string[] {
  const out: string[] = []
  for (const [label, detail, opts] of move.legacy) {
    const head = `  ${label}`
    if (head.length + 1 <= LEGACY_COL || opts?.inline) {
      const gap = head.length + 1 <= LEGACY_COL ? ' '.repeat(LEGACY_COL - head.length) : '  '
      out.push(`${head}${gap}${detail[0]!}`)
      for (const line of detail.slice(1)) out.push(`${' '.repeat(LEGACY_COL)}${line}`)
    } else {
      out.push(head)
      for (const line of detail) out.push(`${' '.repeat(LEGACY_COL)}${line}`)
    }
  }
  return out
}

// The order today's block lists them in — it walks the moves by how a board is used, not
// by group, and an installed skill has to keep reading the same.
const LEGACY_ORDER = [
  'init',
  'memory-init',
  'setup-done',
  'setup-status',
  'create',
  'update',
  'update-questions',
  'update-verify',
  'list',
  'release',
  'tag',
  'migrate',
  'archive',
  'reject',
  'record-run',
  'peek',
  'version',
  'metrics',
  'help',
]

export function legacyHelp(usage: string): string {
  const out = ['kanban — the only sanctioned writer of docs/kanban/next-id.', '', `Usage: ${usage}`, '']
  for (const name of LEGACY_ORDER) out.push(...legacyLines(findMove(name)!))
  out.push(
    '',
    'Never edit next-id or metrics.csv by hand — let the script write them. Never hand-write a',
    "card's frontmatter — use create/update/update-questions/update-verify. Write/Edit are only for the card body.",
  )
  return out.join('\n')
}
