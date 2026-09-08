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
moment the user says which channels this goes to; leave it off until then. A topic is
`todo/<id>.md` — the title never reaches the filename, so `--slug` is refused here and a
non-English title needs nothing extra.

The card is the whole of it. Write no `content/<id>/` folder and no `source.md`: the source
is the user's own words, and a blank one is what invites them.
