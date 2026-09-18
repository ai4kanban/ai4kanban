# Classify questions, decisions, and checks

Use these categories whenever a flow finds an unresolved decision, an answered decision, or a
post-build hand-check. Research the card, prior user choices, and relevant project evidence
before classifying it.

### Question

A question is a decision that project evidence cannot answer, materially affects the user
experience, and has at least two coherent options. Ask it directly; state each option's outcome
and main cost, and recommend the option you would take.

- **Write for users**: describe outcomes and costs without card ids, agent names, or board jargon.

Settle facts, technical details, and safe choices yourself; record lasting answers below the
human half when necessary. Never ask whether to fix work here or create a card; follow
`akb guide follow-up` for placement.

### User-owned question (`[user]`)

Use this material-decision test here and for both `Worth noting` sections: the tradeoff
materially changes observable behavior, accepted scope, user risk, data or privacy,
compatibility, or meaningful ongoing cost, and a reasonable reviewer may reject it.

An unanswered question that passes this test is user-owned. Prefix it with `[user]`, leave it
open, and stop only the work that depends on its answer. Only `[user]` questions may survive a
completed QA pass.

A question marked `skipped: true` is one the user chose not to answer. It is not open: it
takes no option, grants nothing, and is never asked again.

```text
akb raw update-questions <id> \
  --append "[user] Which behavior should apply?" \
  --recommended-option "A — outcome and cost" \
  --option "B — outcome and cost"
```

A question about one spec agent's section adds `--agent <agent-name>` after its `--append`;
`--update` keeps the question's agent unless given another.

Questions are exclusive unless their options can genuinely be combined; the board supplies the
free-text choice. Use `--mode multi` only for combinable options, recommending every option you
would take. Use `--update <n>`, `--drop <n[,n...]>`, or `--to-verify <n[,n...]>` only for an
existing question.

### Implementation blockers

An implementation obstacle requiring user action also belongs in a `[user]` question, even
when no product decision is needed. State what cannot proceed and what action is needed;
offer concrete ways forward, such as granting access or deferring the affected work. Use
`akb raw update-questions` with options as above. Stop only dependent work and resume after
resolution. Do not reopen settled decisions or turn agent-resolvable issues into questions.

### `Worth noting` and `Worth noting after implementation`

These sections contain answers, never open questions. Put an answered question in `## Worth
noting` when it passes the same material-decision test. Use `## Worth noting after
implementation` instead when implementation or review surfaced and answered it.

Put a necessary lasting answer that fails the test below the human half. Never use `Worth noting
after implementation` to accept work that contradicts the approved requirements; fix the work
or leave a user-owned question.

### `verify:`

A `verify:` line is a post-build check that needs human judgment or an environment the agent
cannot use. It is not a decision, carries no options, and does not block the card. Give a
reproducible setup, human action, expected result, and any required fixture. Put checks the
implementation agent can run in `## Todo` instead.

### An agent's memory

A spec agent keeps `docs/kanban/memory/agents/<agent>/`, and its own AGENT.md says which
files are there and what each holds. When the user's answer or revision lands on that agent's
section — its recommendation taken, sent back, or overruled — read its AGENT.md and append
one line to the file it names for that kind of note, creating the file if missing. An agent
whose instructions define no memory keeps none — write nothing.

Append only what clears "What earns a note" in `akb guide board` — a correction or a choice
that will change the agent's next proposal. Most answers change nothing lasting: leave the
files untouched then, and merge into an equivalent line rather than repeating it.

One line, in the user's own terms, and no card id, date, or story of the run. Nothing else
goes in those files; the rest of them is the agent's. Never add a file its instructions do
not name.
