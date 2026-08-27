---
title: Write the board in the language the user picked
track: skill
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [332]
modules: [skill]
schedule:
  action: refine
questions: []
---


A Chinese reader with a Chinese app still gets an English board: every card, open question,
memory line and changelog the agent writes for them is in English. Carry the language into
every run, and say once — in the board's own rules — which parts of a card follow it and
which stay English whatever it says.

## Worth noting
- **Are the flows themselves translated?**: no. `akb guide *` is what a coding agent reads,
  not the user, so an English flow producing a Chinese card is the normal case. Translating
  them would mean keeping every flow in two languages forever and would change how an agent
  is instructed; the cost is that a user who opens a flow in the app still reads English.

<!-- agent -->

## Scope
- **One place tells every run**: the language rides in the prompt where `buildPrompt`
  already appends the board's flow rules (`cli/src/lib/agent/prompts.ts`), so every flow and
  every connector is told once.
- **Chat is a second path**: a chat message never reaches `buildPrompt` — it is sent as
  `skillPrompt(text)` (`cli/src/lib/agent/chat.ts`), and only the message that opens a
  conversation carries even that, since every later one resumes the agent's own session. So
  the language is said there too, on the opening message.
- **What follows the language**: the prose a person reads — card titles and bodies, open
  questions and their options, memory entries, changelogs, and chat replies.
- **What stays English whatever the setting**: frontmatter keys and values, section
  headings (`## Worth noting`, `## Scope`, `## Todo`, …), the `<!-- agent -->` boundary,
  todo checkboxes, the `[user]` tag, and card filenames. The command and the app match
  these by literal English regex (`cli/src/lib/record.ts`, `cli/src/lib/agent/deliveries.ts`,
  `cli/src/lib/agent/flow.ts`, `kanban-ui/lib/agent-half.ts`), so a translated one is a card
  the board can no longer read.
- **Said once, in `akb guide board`**: which parts of a card follow the board's language,
  which stay English, and that an edit keeps the file's existing language — so every flow
  works to one rule instead of each repeating it.
- **An edit follows the card, not the setting**: a flow rewriting a card, a memory file or a
  changelog that already exists writes in the language that file is already in. The setting
  decides the language of a file the agent creates.
- **Card filenames stay ASCII**: `slugify` drops every non-ASCII character, so a Chinese
  title on its own would name every card `<id>-task.md`. A flow writing a non-English title
  passes `board create --slug` a short English slug; the id in front is what the board
  points at either way.
- **The setting outranks the goal's language**: `akb guide changelog` writes in the language
  of `goal.md` today; it follows the setting instead.
- **Not what leaves the machine**: the notifications the Cloud relay sends (#319, #320) are
  composed away from this setting and stay English here.

## Todo
- [ ] Add the language to every run's prompt, where `buildPrompt` appends the board's flow
      rules.
- [ ] Say the language on the message that opens a chat, which does not go through
      `buildPrompt`.
- [ ] Say in `akb guide board` which parts of a card follow the board's language, which stay
      English, and that an edit keeps the file's existing language.
- [ ] Have the flows that write a card pass `board create --slug` an English slug when the
      title is not English.
- [ ] Point `akb guide changelog` at the setting instead of the goal's language.
- [ ] Run a whole board in Chinese — propose, refine, resolve, implement — and fix what the
      flows still write in English.
