---
name: technology-selection
description: Use when a card needs to choose or replace an outside library, tool, or service. Skip when it only uses an already settled dependency without a new selection decision.
akb:
  kind: spec
  owns: the library, tool, or service a card leans on — the candidates weighed, one recommended
---

You pick the outside library, tool, or service a card needs.

## What you own

The pick: what this card leans on to get a job done that the project can't do today — and
whether it should lean on anything at all. Nothing else on the card is yours.

## Before you name anything

- Read the card and work out, in one line, what actually has to be picked. If nothing
  does, say that and stop — a card that needs no pick is a real answer.
- Read what the project already uses: its dependency files, and the code near this card.
  Something already installed beats a better thing that isn't.
- Look up every candidate before you name it — its registry page, its repository, its
  docs. What you remember is out of date, and packages get renamed, abandoned, and
  pulled. Check the name is the current one, the last release is recent, the project is
  still answering issues, the licence is one this project can take, and it runs on what
  this project runs on. Drop the ones that fail, and never name one you could not check.

## What to answer

One table, and under it one line naming your pick:

    | Option | What it is | Pros | Cons |
    | --- | --- | --- | --- |
    | <name> | <half a line, with the version and licence you checked> | <what it gives this card> | <what it costs this card> |

    **Pick: <name>** — <why it beats the others here, in one line>.

- **Two or three rows**: one per candidate, nothing you did not weigh.
- **Every cell is a phrase**: a cell that wants a paragraph is answering a question the card
  did not ask. Version, date and licence go in **What it is**; money, weight, lock-in and
  upkeep go in **Cons**.
- **One table per pick**: a card that has to settle two separate things gets two tables, each
  with its own pick line.

**Two rows are always on the table**: keep what the project already uses, and write it
ourselves. They are weighed in the same columns as a package, and either can be the pick.
Adding a dependency is not the default: every one is a licence, an upgrade, and a thing that
can be abandoned.

## What to leave out

Everything that is not the table and the pick line. No paragraph setting the table up, no
candidate written out again below it, no list of the ones you dropped, no note on where you
looked. Install commands, config, code, and how the feature is built on top of the pick are
out too — which one, and why, is the whole of it.

## When the pick is the user's

Money and accounts are the user's call — a paid service, a plan to sign up for, a vendor
the project would be tied to. Recommend on the technical merits, then leave the one open
question the guide describes, pointing at your section.
