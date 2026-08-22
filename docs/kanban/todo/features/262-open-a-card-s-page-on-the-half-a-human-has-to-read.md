---
title: Open a card's page on the half a human has to read
track: features
priority: med
roi: med
status: implementing
release: 0.7.1
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

A card's page prints what the agent worked out at the same weight as what the user has to
decide, so reading one card means reading all of it. Show the human half; keep the agent
half on the same page, folded and quiet.

## Worth noting
- Open or shut is one setting for every card, not one per card: keeping the detail open is a
  habit about how you read, and the rail's Memory panel already remembers itself this way.
- It is remembered with the window, beside the rail's width and the Memory panel — not in
  the board's files, so it stays on this machine and never travels with the repo.
- The very first visit, with nothing remembered yet, opens the agent half shut.
- A card opened from a search that matched only its agent half is the one exception: that
  half opens, so a search never lands the reader on a page with no match on it.
- In a browser, the window's own Find opens the shut half and lands on a word inside it. A
  browser too old to do that finds only what is on screen.
- The desktop app has no Find of its own, so there a word that only a folded half holds is
  reached through the rail's **Find a card** box, which opens that half.
- Almost no card carries the boundary today — only the few written or rewritten since the
  two halves arrived have it — so most of the board keeps today's page until a flow next
  touches the card.

<!-- agent -->

## Scope
- The card's human half — everything above the `<!-- agent -->` marker ("Card format" in
  `akb guide board`) — sits at the top of the page and looks exactly as it does today.
- The agent half sits below it, behind one control reading `what the agent worked out`.
- The control also says how many sections are inside, as `· 4 sections` — counting the `##`
  headings below the boundary, `· 1 section` for one, and nothing at all when the half
  carries no heading of its own.
- The page opens with the agent half shut.
- One click opens it in place, and the same control shuts it again. No tab, no dialog, no
  second page.
- Whether the reader left it open or shut is remembered, and the next card page opens that
  way. One setting for every card, not one per card.
- Opened, it reads quieter than the human half — the softer ink the board already uses,
  no new colours.
- A card with no agent half shows no control at all.
- A card with no marker on it yet, so no boundary to split on, shows its whole body as it
  does today. Nothing is hidden.
- Nothing the user has to act on is folded: a mockup an open question points at sits in the
  human half, where the card format puts it.
- A card opened from the rail's matches list, where the typed word is found only below the
  boundary, opens with the agent half open.
- A word the card's title or human half also holds is already on screen, so that card opens
  with the half shut.
- The search hands the typed word to the card page, so every card opened from the matches
  list while that search stands opens this way, not only the first.
- Whether the word is found only below the boundary is judged the way the rail's search
  judges a match: the typed word as one string, and case makes no difference.
- Reloading such a page, or reaching the card any other way — a pasted address, a `#12`
  link, a rail row, the board — opens it at the remembered setting.
- Finding a word with the window's own Find opens the shut half and lands on the word,
  wherever the browser can do it.
- A half opened by a search match or by the window's Find reads as open: the control above
  it says so, and one click on it shuts the half again.
- Neither of those two routes writes the remembered setting. It changes only when the reader
  works the control, so the next card page opens the way they last left one themselves.
- Neither of them shuts a half either: typing on in the search box, or clearing it, leaves
  an open half open.
- Open questions, "check by hand", subtasks and the fields above the body do not move.
- The board's tiles and the chat rail are untouched.

## Todo
- [ ] Split the card body at the `<!-- agent -->` marker, and show the human half at the
      top, unchanged.
- [ ] Put the agent half below it behind one control that says what it holds, shut when the
      page opens.
- [ ] Remember whether the reader left it open or shut, and open the next card page that way.
- [ ] Make the opened agent half read quieter than the human half, using the board's own colours.
- [ ] Fall back to today's whole-body page for a card with no boundary.
- [ ] Carry the typed word from the rail's search to the card page, and open the agent half
      when the word is found only below the boundary, without changing what is remembered.
- [ ] Let the window's own Find reach the shut half and open it at the word, without
      changing what is remembered.
- [ ] Update the UI guide, `kanban-ui/README.md`.
- [ ] Check it end to end: open a long card that carries the boundary, such as #112, and
      see what is on screen before scrolling, then open the agent half and confirm nothing
      was lost.
- [ ] Open a card with no boundary, such as #56, and see its whole body as it is today.
- [ ] Search for a word that only a card's agent half holds, open the match, and see that
      half already open. Reload the page and see it shut again.
- [ ] In the browser app, shut the agent half, press the window's Find for a word only that
      half holds, and see the half open at the word. Reload the page and see it shut again.
- [ ] Open the same card in the desktop app, where there is no Find: search the rail for a
      word only the agent half holds, and see that half open.

## Decided by the agent
- **Why a search match opens the half**: the rail's search matches a card's body, so a match
  below the boundary would otherwise open a page showing nothing the search found.
- **Why neither exception is remembered**: each answers one visit. Following a match, or
  finding a word on the page in front of you, is no reason to change how every other card
  opens afterwards.
- **Why an exception ends at a reload**: it belongs to the act of following a match, not to
  the card. A page opened again later is an ordinary visit.
- **Why an exception never shuts the half**: text disappearing while it is being read costs
  the reader their place. Both routes only ever open.
- **Why the window's own Find opens the half**: the rail's search finds cards, not words
  inside the one you are reading, so without this the fold would make a word below the
  boundary unfindable on the page that holds it.
- **Why the fold has no second view to stay out of**: it is on the rendered page only. The
  UI has no view of a card's body as text today, and the box #274 adds edits the file whole,
  so it goes on showing the boundary marker and everything below it.
- **Why the control borrows the page's own words**: the page already captions a panel in
  plain lowercase — `open questions`, `check by hand` — and `·` is the separator the header
  and the queue already use.
- **Why the match test copies the search's own rule**: a control that judged the word
  differently from the search that found it would leave a match unopened.
- **Why nothing the user acts on is folded**: the card format already keeps a spec agent's
  section in the human half while an open question points at it, so the fold never has to
  decide this for itself.
