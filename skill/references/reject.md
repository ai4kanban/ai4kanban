# Reject an idea

Start with `${KB} reject <id>`. It deletes the card file. Before deleting, it prints the
whole card — that printout is your copy, and you write the note from it.

The rest of its output names two jobs. Do both.

**1. Write the note.** The output says which `rejected.md` to use and which topics it
already has. Add one line under the topic that fits:

`- **<idea name>** — <why we said no, one line>.`

Name the idea, not the card. If an entry there already covers the same idea, rewrite that
entry instead of adding a second one. If a nearby entry gave this idea as its reason, fix
that entry too.

**2. Fix every line that mentions the card.** The output lists them, with the file and line
number. A mention may sometimes carry an argument — "build the storage layer, because #58
needs it". That argument is gone with the card, so the sentence around it is now wrong: say
what still holds, or drop the claim. Striking out the `#58` and leaving the rest is the one
thing that doesn't work — it reads as if the card were still there.

A mention in a card's frontmatter is an open question. Rewrite it with
`${KB} update-questions <id> --update <n> ".."` — the script owns frontmatter (see "The script" in `SKILL.md`).

Use that list. Searching for the id yourself also turns up dates and longer ids.
