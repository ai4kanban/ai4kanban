# Resolve questions

Resolve every open question by answering it, dropping it, moving it to `verify:`, or
handing it to the user. This is where the answer and its consequences become clear, so this
flow — not the question audit — decides whether the result belongs in `## Worth noting`.

## Resolve each entry

1. Move a manual check to `verify:`; it asks the user to confirm work, not make a decision.
2. Research the card, code, board, goal, relevant project sources, and module memory. For a
   possible user decision, also check `decisions.md`, `rejected.md`, and `redesign.md`.
3. Apply the first matching outcome:
   - Already settled, duplicated, or unnecessary: drop it.
   - Agent-owned: decide from evidence or take a sensible reversible default, record it
     only when implementation needs a lasting call, then drop the question.
   - User-owned: rewrite it as a `[user]` question with choices and a recommendation. If it
     is already correctly written, only tag it.

```text
akb board update-questions <id> --to-verify <n[,n...]>
akb board update-questions <id> --drop <n[,n...]>
akb board update-questions <id> --update <n> "[user] <question>" \
  --recommended-option "<choice — reason>" --option "<choice — reason>"
akb board tag <id> <n[,n...]> user
```

Use `--clear` instead of `--drop` when every question is answered. Never clear `verify:`
to make the card look resolved.

## Who owns the question

- **Agent-owned**: the available evidence supports one answer strongly enough that user
  preference is unnecessary.
- **User-owned**: multiple reasonable answers remain and the choice materially changes what
  the user receives or accepts.

## Apply answers

Follow `akb guide writing`. Merge each answer into the existing decision on that topic;
keep only the selected choice, remove obsolete text, and add any newly required work as
unchecked todos. Preserve completed work.

When the answer picks one of several options a spec-agent section laid out,
cut the ones the user did not pick, along with the spec-tmp files, and
move what remains back below the boundary.

## Curate the human half

Put an answer in `## Worth noting` only when its known tradeoff materially changes
observable behavior, accepted scope, user risk, data or privacy, compatibility, or
meaningful ongoing cost, and a reasonable reviewer may reject it. Put a necessary lasting
agent decision below the boundary instead.

Re-read the whole human half after changing the plan. Delete or move below the boundary any
`## Worth noting` entry that fails the same worth-noting test, merely repeats scope, or
overlaps another entry. Merge entries caused by one governing decision. The section should
usually hold one to three independent decisions; every item beyond that needs clear,
separate user-facing stakes.

## Record lasting decisions

Record only durable, user-facing user decisions in `memory/<module>/decisions.md`; agent
and implementation decisions stay on the card. Write one `**<key>**: <call>` line under
the relevant topic, without its rationale. Replace a contradicted call instead of keeping
both; if the user's current choice is unclear, leave memory unchanged and ask.
