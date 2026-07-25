# Decisions

Settled answers to cards' open questions — the question, then the answer, once resolved.
The resolve flow appends here. Read before proposing so you don't re-ask a settled call.

## Create task + propose (#38)

- **Propose scope when several modules are picked — one focus, per-module fan-out, or
  agent-choose?** One module only. The picker is a single-module dropdown, not a
  multi-select; propose runs once on the one picked module (3 tasks).
- **Is the module pick required for propose, and optional for add-task?** Not required for
  either. The dropdown takes one module or none. On propose with none picked, the agent
  picks the focus itself (`references/propose.md`). On add-task it's optional.
- **Where is `modules.md` parsed for the dialog?** Server-side in the UI: a reader (e.g.
  `kanban-ui/lib/modules.ts`) reads `docs/kanban/modules.md` and returns only the bolded
  name at the front of each line, exposed to the client through a server action in
  `app/actions.ts` (same shape as `getBoard`).
- **Is propose its own `AgentAction` or a flag on `create`?** Its own action, `propose`.
  The sessions panel labels each session by its `action` (`RUNNING_VERB`, the overlay
  title), so a distinct action is what labels a propose session correctly. Wire it into the
  `AgentAction` union (`lib/types.ts`), the `ACTIONS` set (`app/actions.ts`), `RUNNING_VERB`,
  and a new `buildPrompt` case.
- **How do add-task's picked modules reach the card — prompt hint or script flag?** Write
  them to the card's `modules:` frontmatter via a `--modules` flag on the create script, not
  a prompt hint. That flag is task #34's core scope (#39 already `blocked_by: [34]`), so
  #38's frontmatter-write depends on #34 landing the flag.
- **How to sequence #38's `--modules` write vs #34?** Moot — #34 already shipped the
  `--modules` flag on `create`/`update`. #38 uses it directly; no blocker needed.

## Auto-refine (#40)

- **How does the dispatcher run one card's loop — one session or a process per pass?** One
  session: the dispatcher launches a single `claude -p` per card and lets it run the whole
  loop to the end (never pausing to ask the user), then moves to the next card. The loop
  lives inside that one session, not a fresh process per pass.

## Auto-refine dispatcher (#43)

- **How often does the auto-refine dispatcher run, and how many refines at once?** A
  1-minute timer inside the local-UI server; one refine at a time, highest-priority card
  first. It runs only while the auto-refine switch is on.
- **With auto-refine off, can you still refine a card by hand?** No — refine is only ever
  automatic now. The manual "Refine" button is removed; with the switch off, nothing
  refines.
- **Does the dispatcher answer a card's open questions in the background?** No. It skips any
  card that has open questions (a refined card ends either `ready` or holding human-only
  questions, so this also stops the dispatcher spinning on a card it can't move). Answering
  questions stays with the Resolve flow.

## Auto-refine switch (#41)

- **Where does the auto-refine on/off setting live, and what reads/writes it?** In
  `docs/kanban/ui.config.json` as a top-level `autoRefine` boolean, off by default. The UI
  switch reads and writes it there — same file the UI already reads for the agent `command`.
  Accepted tradeoff: the file name reads UI-only though the setting is really board behavior.
- **Is it the same switch as #16's "auto-design"?** Yes — one on/off switch; #16's other
  autonomy levels could add sibling keys later.
