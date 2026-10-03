# Handle follow-up work

Use when planning or implementation discovers additional work.

- **Place it**: fix what the current card requires here; never defer a required fix to make
  the card pass. Queue independent follow-ups in triage without asking permission or blocking
  the original, and create no card for them.
- **Another card's change is not a follow-up**: when it only changes an open card, run
  `akb card revise <id> "<the change and why>"` instead.
- **Queue it**: `akb triage add --title "<one line>" --slug <short-english-slug> --source "#<id>" --text "<what and why, readable without this session>"`,
  then resume the original workflow. Skip one the command reports as already there.
