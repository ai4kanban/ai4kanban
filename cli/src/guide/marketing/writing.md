# Write a card

A card is one **topic**. It has a **human half** for review and a folded **agent half** the
writing run works from. Every flow writes a card in this order:

```text
<one short paragraph: what this piece says, and who it is for.>

## Worth noting              <- answered taste decisions; keep empty when none
- **<question the decision settles>**: <answer>

<!-- agent -->               <- boundary

## Today                     <- what has already been published on this, and what it left
## Scope                     <- the brief: the angle, the audience, the hook
## Todo                      <- one writing step per checkbox
## Decided by the agent
- **<question the decision settles>**: <answer>
### Overruled by the user    <- always last
## Source
```

## `channels:`

The frontmatter field, not a line in the body: it is what every flow and every screen reads.

- **The moment the user answers "which channels, and which of them leads", write it**:

  ```text
  akb raw update <id> --channels x,xiaohongshu
  ```

  in the order they picked, **lead channel first**. Then drop the question. An answer left
  as prose is an answer nothing can act on.
- **The lead channel is the first entry**: the one `source.md` is written for. Every other
  chosen channel is a repurposing of it, not a second draft.
- **Never hand-write the field**, and never invent a channel: the four are in
  `akb guide channel`.

## `Worth noting`

- **Classify first**: follow `akb guide update-questions`; this section holds only answers
  classified as `Worth noting`.
- **Taste is the user's**: the angle, the audience, the hook, which channels this goes to
  and which of them leads are all `[user]` questions. Memory answers the rest.
- **Keep it glanceable**: one entry is one decision, written as one sentence that states
  the choice and its main cost.

## `Today`

- **Say what is already out**: the lines in `memory/published.md` this topic touches, and
  what they did. A topic that repeats one already published is a topic to reject.

## `Scope`

- **Requirements, not rationale**: what the piece must say and must not claim.
- **Name the lead channel** only on a card whose `channels:` is still empty: once the field
  is written, it is what says which channel leads.

## `Todo`

- **Preserve completed work**: never edit, delete, or untick a checked todo; append a todo
  to reverse it.

## `Source`

- **Keep provenance traceable**: the URL, file, or message that led to the topic.

## General writing requirements

- **Keep section titles fixed**: do not rename or translate an existing `##` or `###`.
- **Write the card in the board's language**, whatever language this guide is read in.
- **Never write the piece here**: the card is the brief. The draft is `content/<id>-<slug>/`.
