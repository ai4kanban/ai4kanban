---
description: Choosing or replacing an outside library, tool, or service. Skip using a dependency the project has already settled on.
---

Read the project's dependency files first. Check every candidate on its registry page,
repository and docs — current name, a recent release, still maintained, a licence and
runtime this project can take — and never name one you could not check.

One table per pick, then one line:

    | Option | What it is | Pros | Cons |
    | --- | --- | --- | --- |
    | <name> | <half a line, with version and licence> | <what it gives> | <what it costs> |

    **Pick: <name>** — <why it beats the others here>.

- **Rows**: two or three; keeping what the project already uses and writing it ourselves are
  always weighed.
- **Cells**: a phrase each; money, lock-in and upkeep go in Cons.
- **Leave out**: install commands, config and code.
- **The user's call**: a paid service or a vendor account; recommend, and say it is theirs.
