---
title: Write the board in the language the user picked
track: skill
priority: med
roi: high
status: ready
release: 0.8.0
blocked_by: []
related: [332]
modules: [skill]
questions:
  - question: "[user] On a card already written in English, do the open questions and verify lines an agent adds for you to read follow your language, or the card's?"
    mode: multi
    options:
      - Your language — the two things written to be read by you personally arrive in 中文 on every board, including the ones that existed before the setting; the cost is a Chinese question and verify line inside an English card
      - The card's — an English card stays English end to end, at the cost of a Chinese reader still being asked in English on every card written before they picked the language
    recommend: [1]
verify:
  - "Switch the app to 中文 and add a task: the card comes back with a Chinese title and body, and its frontmatter keys, section headings, todo checkboxes and filename are still English."
  - "With the app in 中文, send two messages in one card's chat: both replies come back in Chinese, not only the first."
---

A Chinese reader with a Chinese app still gets an English board: every card, open question,
memory line and changelog the agent writes is in English. Carry the picked language into
every run, and say in the board's own rules which parts of a card follow it and which stay
English whatever it is set to.

## Worth noting
- **Are the flows themselves translated?**: no. `akb guide *` is what a coding agent reads,
  not the user, so an English flow producing a Chinese card is the normal case. Translating
  them would mean keeping every flow in two languages forever and would change how an agent
  is instructed; the cost is that a user who opens a flow in the app still reads English.

<!-- agent -->

## Scope
- **One place tells every run**: the language rides in the ask `buildAsk` builds
  (`cli/src/lib/agent/prompts.ts`), read off the machine with `readLanguage`
  (`cli/src/lib/machine/settings.ts`, #334), so every flow, every connector and every
  `--print`ed flow is told once. An English board is told nothing.
- **Two paths carry it themselves**: a chat message never reaches the ask — it is sent as
  `skillPrompt(text)` (`cli/src/lib/agent/chat.ts`), and only the message that opens a
  conversation carries even that, since every later one resumes the agent's own session. The
  setup line a user pastes into their own agent (`setupInstruction`,
  `cli/src/lib/agent/resolve.ts`) is the other. One helper behind all of them, and every
  caller sits inside the command's own bundle, so nothing new crosses a process boundary.
- **Every chat turn says it, not only the first**: a resumed turn sends the user's raw text
  and never reaches `skillPrompt`, so a conversation told once at the top drifts back to
  English as the session grows, and a language switched mid-conversation never reaches it at
  all. The line costs a sentence a turn, and only on a board that isn't English.
- **What the line says**: the language to write the board's prose in, and in one sentence
  what follows it and what stays English — spelled out, not left to a guide.
- **What follows the language**: the prose a person reads — card titles and bodies, open
  questions and their options, the verify lines a user checks by hand, memory entries,
  changelogs and chat replies.
- **What stays English whatever the setting**: frontmatter keys and their fixed values,
  section headings (`## Worth noting`, `## Scope`, `## Todo`, …), the `<!-- agent -->`
  boundary, todo checkboxes, the `[user]` tag and card filenames. The command and the app
  match these by literal English regex (`cli/src/lib/record.ts`,
  `cli/src/lib/agent/deliveries.ts`, `cli/src/lib/agent/flow.ts`,
  `kanban-ui/lib/agent-half.ts`), so a translated one is a card the board can no longer read.
- **Prose held in frontmatter is not structure**: a title, a question, an option and a verify
  line follow the language even though they sit in a field.
- **`akb guide board` carries the rule in full**: which parts of a card follow the board's
  language, which stay English, and that an edit keeps the file's existing language — so
  every flow works to one rule instead of each repeating it.
- **An edit follows the file, not the setting**: a flow rewriting a card, a memory file or a
  changelog that already exists writes its body in the language that file is already in; the
  setting decides the language of a file the agent creates. Whether the open questions and
  verify lines an agent adds to an existing card follow the file or the reader is this card's
  open question.
- **Card filenames and group folders stay ASCII**: `slugify` drops every non-ASCII character,
  so a Chinese title on its own would name every card `<id>-task.md`. A flow writing a
  non-English title passes `board create --slug` a short English slug and names a group's own
  folder with one; the id in front is what the board points at either way.
- **The setting outranks the goal's language, where there is one**: `akb guide changelog`
  writes in the language of `goal.md` today and follows the language the run was told
  instead — on a rewrite as much as on the first pass, since that command replaces the whole
  changelog block rather than editing it. A run told no language keeps the goal rule, so an
  English machine with a Chinese `goal.md` still gets a Chinese changelog.
- **The command's own questions stay English**: the questions `akb` puts on a card itself — a
  stopped review (`stopQuestion`, `cli/src/lib/agent/review.ts`) and a delivery that could not
  land (`cli/src/lib/agent/landing.ts`) — are text `akb` writes, and #332 keeps what `akb`
  says in English.
- **Not the code, and not the repository's own documents**: the line reaches an implement run
  too, so it says plainly that it governs board prose — code, comments, commit messages and
  the files under `docs/` a card asks for follow the repository, not the reader.
- **Not what leaves the machine**: the notifications the Cloud relay sends (#319, #320) are
  composed away from this setting and stay English here.

## Todo
- [ ] Add the language and its one-sentence boundary to the ask `buildAsk` builds, and say
      nothing when the setting is English.
- [ ] Say the language on every chat message and on the setup line a user pastes, neither of
      which goes through the ask.
- [ ] Say in `akb guide board` which parts of a card follow the board's language, which stay
      English, and that an edit keeps the file's existing language.
- [ ] Have the flows that write a card pass `board create --slug` an English slug when the
      title is not English, and name a group's folder with one.
- [ ] Point `akb guide changelog` at the language the run was told, keeping the goal's
      language for a run told none.
- [ ] Cover the ask in `cli/test/flow-rules.test.ts`: a `zh` machine's prompt names the
      language and its boundary, an English one is unchanged (`AI4KANBAN_HOME` sets the
      machine, as `cli/test/machine-settings.test.ts` does).
- [ ] Run a whole board in Chinese — propose, refine, resolve, implement — and fix what the
      flows still write in English.

## Decided by the agent
- **Why the ask and not `buildPrompt`**: a printed flow is built from `buildAsk` alone and
  appends the board's own rule itself (`printFlow`, `cli/src/lib/agent/flow.ts`), so a line
  added beside that rule in `buildPrompt` would reach every started run and no `--print`ed
  one — and `--print` is how the work is done in the user's own session.
- **Why the boundary rides in the line rather than only in `akb guide board`**: the flows
  that write the most prose — `writing`, `qa-loop`, `revise`, `spec-agent` and `changelog` —
  are never given that guide (`GUIDES_FOR`, `cli/src/lib/agent/flow.ts`). A run told to write
  Chinese without the boundary translates a section heading, and that is a card the board can
  no longer read.
- **Why an English board is told nothing**: the flows are written in English, so an English
  board's prompts stay exactly as they are and cost nothing. The price is that a machine left
  on English is never told to keep a Chinese card in Chinese when it edits one — the mixed
  board #332 already accepted as the price of a setting that is not in git.
