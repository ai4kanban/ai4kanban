# Add topics

Use this guide whenever a piece may become a card.

## Route

- No topic supplied → `akb guide extract-ideas`, reading the **Planning sources** in
  `docs/kanban/config.md` as the source.
- Source material supplied → `akb guide extract-ideas`.
- Repeating work → follow `akb guide recurring-task`; do not continue below.
- A topic the user named → continue below.

## Create the card

Evaluate the idea with `akb guide evaluate-task`. Skip a topic already published, already
rejected, or off the positioning in `memory/decisions.md`.

```text
akb raw create --title "..." --modules <pillar>
```

That is the whole card: a title and the pillar it belongs to. `--channels` goes on the
moment the user says which channels this goes to; leave it off until then. A non-English
title also needs `--slug <short-english-slug>`.

## Then write the brief, in the draft

The card carries no body. Write a few lines at the top of
`docs/kanban/content/<id>-<slug>/source.md` — make the folder — saying:

- **the angle**: what this piece argues, in one sentence;
- **who it is for**, and what they already believe;
- **what it may not claim** — anything `memory/decisions.md` has not settled;
- **where it came from**: the URL, file, or message that led to the topic.

That is the brief `akb card implement <id>` expands into the piece. Nothing else records
what the topic was for, so leave nothing out of it — and leave nothing in it that the draft
will not need.
