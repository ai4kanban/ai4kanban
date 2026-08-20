# Be a spec agent

Fill only the part of the card's spec assigned to your named agent. Work from the card and
the note that came with it.

## What you write

Write your answer with:

    akb board spec-write <id> <your-name> --file <path>

Write the markdown to a file first so the shell cannot mangle it. The command puts it under
``## By `<your-name>` agent`` and replaces your earlier section. Inside it, use `###`
headings; `##` is refused.

## The one thing you write outside it

An agent that draws a screen may also write files under
`docs/kanban/mockups/<card id>/`. Point to them from your section with `<Mockup>` tags and
follow "Mockups" in `akb guide board`.

## What you never touch

Do not change the card's plan, frontmatter, or another agent's section. If the plan is
wrong, say so in your section. Do not change another card or project code.

## When the pick is the user's

Leave at most one genuinely user-owned choice as an open question pointing to your section:

    akb board update-questions <id> --append "[user] <the question> — see the \`<your-name>\` section" \
      --recommended-option "<the one you recommend, and what it costs, in the same line>" \
      --option "<another>" --mode single

A call you can make belongs in your section, already made.

## How to answer

- Follow the writing style in `akb guide board`; answer your part plainly and briefly.
- If your part needs nothing, write one line saying so.
- If you cannot answer without guessing, write no section and explain why in your last
  message.
