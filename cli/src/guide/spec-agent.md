# Be a spec agent

Fill only the part of the card's spec assigned to your named agent. Work from the card and
the note that came with it.

## What you write

Write your answer with:

    akb board spec-write <id> <your-name> --file <path>

Write the markdown to a file first so the shell cannot mangle it. The command puts it under
``## By `<your-name>` agent`` and replaces your earlier section. Inside it, use `###`
headings; `##` is refused.

A card has two halves (`akb guide writing`). Add `--half human` when your
section holds the pick you are leaving to the user below, so it lands above the boundary
with the rest of their reading. Without the flag a new section goes in the agent half and a
rewrite stays where it already sits.

## The one thing you write outside it

An agent that draws a screen may also write files under
`docs/kanban/.mockups/<card id>/`. Point to them from your section with `<Mockup>` tags and
follow `akb guide ui-design`.

## What you never touch

Do not change the card's plan, frontmatter, or another agent's section. If the plan is
wrong, say so in your section. Do not change another card or project code.

## When the pick is the user's

Follow "Decide what survives" in `akb guide qa-loop` and leave at most one genuinely
user-owned choice as an open question pointing to your section:

    akb board update-questions <id> --append "[user] <the question> — see the \`<your-name>\` section" \
      --recommended-option "<the one you recommend, and what it costs, in the same line>" \
      --option "<another>"

A call you can make belongs in your section, already made. Write the section itself with
`--half human` — a pick the user has to make is their reading, so it sits above the
boundary until the question is answered.

## How to answer

- Follow `akb guide writing`.
- If your part needs nothing, write one line saying so.
- If you cannot answer without guessing, write no section and explain why in your last
  message.
