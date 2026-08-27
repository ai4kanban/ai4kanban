---
title: Move the board UI's words into one typed copy module
track: features
priority: med
roi: med
status: implementing
release: 0.8.0
blocked_by: []
related: [332]
modules: [local-ui]
questions:
  - "[user] Review stopped on delivery jn2wsntz: the review run failed before it recorded a verdict. Decide: answer here, explicitly accept the condition under ## Worth noting after implementation, or cancel the delivery and start again from a changed card. Once you have, `node /Users/wutao/git/ai4kanban/desktop/resources/cli/bin/ai4kanban.mjs review 335` judges it again."
verify:
  - Read every screen once and confirm the words are unchanged — the sweep was by eye, and English-only means the build stays green whether a string was missed or not.
  - "Check the Configuration dialog's Setup pane and the Cloud pane: their sentences carry code chips that now render through i18n/rich.tsx rather than inline <code>."
---


Every word the board UI renders is written where it is drawn, spread across some fifty
component files. Nothing can be translated until those words live in one place with a shape
a second language has to match. Move them out, English only — the app reads exactly as it
does today when this lands.

## Worth noting
- **What still reads English after this lands?**: the failures. Every error the app shows
  comes from the board's rules or from Node rather than from the UI, and the group already
  keeps what `akb` says in English. The cost is that a Chinese user who hits a failure reads
  the failure in English.
- **Is the design-system page translated?**: no. `/design` is a reference for whoever
  changes the board's look, reachable only by typing the address, and its thousand lines
  would cost more than the whole board's copy while serving nobody who uses the app.
- **How do we know every word was found?**: nothing here proves it. This card ships English
  only, so the build stays green whether a string was missed or not; the sweep goes screen
  by screen and #336's read-through in Chinese is what turns a leftover up. The alternative
  was a lint rule banning bare text in JSX — it fires on every `—`, `·` and `{" "}` the
  layout uses, so its allowlist would outgrow the copy it guards.

## Worth noting after implementation
- **How does a sentence with a link in it stay one key?**: it doesn't. `i18n/rich.tsx` draws
  a code chip and a bolded run, not a link, so the one sentence that carries two — the
  privacy and terms line in the Cloud pane — is four keys around them, one of which is the
  bare connector `" and the "`. Every other sentence in the app is whole. The alternative was
  teaching `Rich` a link token, which buys a translator word order in one sentence and costs
  the module a second markup form to keep.

<!-- agent -->

## Scope
- **One module, `kanban-ui/i18n/`**: shaped the way `web/i18n/` is — one folder per
  surface, one file per language inside it, the shape declared beside the words in that
  folder's `types.ts`, and an index that joins them. English is the source of truth.
- **Everything the app renders**: columns, buttons, dialogs, empty states, status text, the
  `title` and `aria-label` a screen reader reads, and the window's own title and description
  in `app/layout.tsx`.
- **Strings outside the components too**: `lib/` renders text of its own — the no-rules and
  too-old messages in `lib/cli.ts` and `lib/cloud.ts` — and it moves with the rest.
- **Typed so a later language cannot skip a key**: every language file in a folder is typed
  by that folder's shape, so when #336 adds Chinese a key it has not translated fails
  `pnpm typecheck` rather than rendering blank.
- **Never edit `lib/format/`**: it is copied from `cli/src/lib/` by
  `scripts/sync-format.mjs`, and `npm run lint` fails when it drifts. Its four
  `MEMORY_FILES` labels are drawn by `components/Rail.tsx`, so that component looks each one
  up by `name` and the copied labels stay exactly as they are.
- **Extract whole sentences, never grammar**: the app branches on count in English —
  `is`/`are`, `it`/`them`, `stay`/`stays`, and singular and plural forms of a whole
  paragraph in `ReleasePicker.tsx`. Each branch takes its own key holding its whole
  sentence, and the branch itself stays in the component. A key holding `"s"` or `"are"` is
  untranslatable.
- **A reader, not a switch**: this card ships the way a component asks for copy and gets
  English back. Reading #334's setting is #336's step; nothing here has a second language to
  choose between.
- **Reachable from a client component**: nearly every component the app draws is
  `"use client"`, so copy reaches one through an import rather than a server round trip.
- **Names are not copy**: product names, file names, paths, track names, shell commands and
  URLs stay exactly as they are and never enter the module.
- **No visible change**: the same words in the same places, in English.
- **Not the documents**: the markdown the Guide drawer fetches from
  `kanban-ui/public/guides/`, and the mockups a card page draws from
  `docs/kanban/.mockups/`, are documents rather than copy and stay where they are. The frame
  around a mockup — its label row, the switch, the way back — is copy.
- **Not the design page**: `app/design/` is a developer reference and stays English.
- **Not the sync command**: `/translate-sync` names `web/i18n/` and nothing else. Pointing
  it at a second folder waits for #336, when there is a Chinese half to keep in sync.

## Todo
- [x] Create `kanban-ui/i18n/` with the shape `web/i18n/` uses, English only, and the way a
      component asks it for a string.
- [x] Move the shared chrome in — header, dialogs, buttons, the guide drawer, the not-found
      page, and the window's title and description.
- [x] Move the board and the card page in — columns, cards, chips, the release picker, the
      card body, the diff, the spec agents, the queue and the mockup frame.
- [x] Move runs, auto-delivery and chat in.
- [x] Move Setup, Configuration, Cloud, and the no-board and no-rules screens in.
- [x] Move the rail, memory, goal and Insights in.
- [x] Move the rendered strings in `lib/cli.ts` and `lib/cloud.ts` in, and point
      `components/Rail.tsx` at copy keyed by `MEMORY_FILES`' names.
- [x] Say in `kanban-ui/README.md` and `kanban-ui/design.md` where copy lives and that new
      copy is written in English first.

## By `technology-selection` agent

| Option | What it is | Pros | Cons |
| --- | --- | --- | --- |
| Write it ourselves, shaped like `web/i18n/` | Plain typed TS modules, no dependency; the shape the site's four languages and the repo's `translate-sync` command already read | A string missing from Chinese is a `tsc` error; tuples pin arity; a plain import reaches any `"use client"` component; switching is one context change, no round trip | No ICU plurals or date formatting — `{placeholder}` substitution is ours; both languages sit in the bundle; `web/i18n/` takes its locale from the URL, so that one seam is rewritten to read #334's setting |
| next-intl | 4.13.7, MIT, released 2026-08-17, actively maintained; the Next.js-native i18n toolkit | ICU messages, plurals, date and number formatting; `NextIntlClientProvider` feeds client components; message keys typed against English | Types only check that a key *used* exists in English — a key missing from Chinese is a runtime `MISSING_MESSAGE` with a fallback string, not a build failure; with no locale in the URL the locale resolves server-side, so a switch costs a `router.refresh()` through a `force-dynamic` page that re-reads the board |
| react-i18next | 17.0.12, MIT, published within the week; the React binding for i18next | Switches in-process with no reload; the largest ecosystem of the three | +22 kB gzipped for formatting this app does not use; same gap — a key missing from Chinese falls back at runtime, not at build; JSON resource files sit outside both `tsc` and `translate-sync` |

**Pick: write it ourselves, shaped like `web/i18n/`** — it is the only one of the three where a string missing from Chinese fails `pnpm typecheck`, and the only one where the no-reload switch #334 promises costs a re-render rather than a server round trip.

## Decided by the agent
- **Why copy `web/i18n/`'s shape?**: the site already keeps four languages in it, and one
  shape across the repo is one thing to learn. `/translate-sync` reads that shape, so
  pointing it at a second folder later is a change of scope rather than a rewrite — today it
  names `web/i18n/` and refuses everything else.
- **Why one card for a sweep this size?**: the screens divide cleanly and the work is the
  same move repeated, so a run that stops partway leaves the remaining todos naming exactly
  what is left. A card per screen would buy bookkeeping and nothing else.
- **How does a sentence keep a code chip or a bold run in it?**: `i18n/rich.tsx` renders the
  same `` `code` ``/`**bold**` subset `web/components/Rich.tsx` does, so `**v1** is closed`
  is one key rather than a bold span and a fragment after it. Without it every sentence with
  inline markup would have split into clauses no language can reorder.
- **How does a component ask?**: `useCopy()` (`i18n/use-copy.ts`) in a client component,
  `copy` from `i18n/` on the server and in `lib/`. `useCopy()` hands back English today; #336
  changes only its body, so no caller is touched twice.
- **Every `lib/` message moved, not only `cli.ts` and `cloud.ts`**: the too-old and refusal
  lines in `board.ts`, `chat.ts`, `chat-rail.ts`, `config.ts`, `edit.ts`, `flow-rules.ts`,
  `language.ts`, `mockup.ts`, `registry.ts`, `skill.ts` and `spec-agents.ts` are the same
  kind of sentence the scope named, drawn in the same places. Leaving them would have been a
  gap a reader hits on the day they matter.
- **Two folders the scope did not name**: `chips/` (the level, status, cadence and question
  words a card wears on both screens) and `chat/`. Both are surfaces of their own; folding
  them into `shared` would have made `shared` the place everything lands.
- **Level words and action names are drawn from copy, written as they were**: `high`/`med`/
  `low` and a run's `implement`/`refine` are still what the file holds and what a save
  writes — only the word on screen comes from `i18n/`.
