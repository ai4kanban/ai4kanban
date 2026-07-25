# Decisions

Settled answers to cards' open questions — the question, then the answer, once resolved.
The resolve flow appends here. Read before proposing so you don't re-ask a settled call.

## Auto-refine (#40)

- **How does one card's auto-refine loop run — one session or a process per pass?** One
  session: a single `claude -p` runs the whole loop start to finish, never pausing to ask
  the user. It answers the questions it's sure of, re-reviews, and keeps going until the
  only questions left can't be answered easily — those it leaves on the card as open
  questions, then the session ends (`ready`, or with open questions for the user).

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

- **Where does the auto-refine on/off setting live?** In `docs/kanban/ui.config.json`, as a
  top-level `autoRefine` boolean, off by default. It goes in the existing file (which the UI
  already reads and the project keeps) rather than a new one — fewest files. Accepted
  tradeoff: the name reads UI-only though the setting is really board behavior.
- **Is the auto-refine switch the same as #16's "auto-design" autonomy level?** Yes — same
  switch. Building #41 settles #16's auto-design. It ships as one on/off switch, not #16's
  full four-level ladder; the other levels can add sibling keys later.
- **vs-vibe-kanban page — is the blunt "shutdown + stalled repo" framing OK?** Yes. Frame
  the page on the honest version: Bloop closed in April 2026 and the official
  BloopAI/vibe-kanban repo has had no commits since late April 2026 (verified against the
  repo, not aggregator "community maintained" claims). Don't soften it.
- **vs-vibe-kanban page — should it point readers to a maintained alternative or fork?**
  No. Compare only against the official Vibe Kanban, even shut down. Name and link no
  competitor, alternative, or community fork — not even a generic "watch the forks" nudge.
  For readers who wanted parallel-agent orchestration, say plainly our skill isn't that and
  stop there.

## Translate the site (#30)

- **Which site pages get translated into zh/es/ja/fr?** The landing page and all three vs
  pages (`vs-github-issues`, `vs-hermes-kanban`, `vs-vibe-kanban`) — the acquisition
  surface. The recipes pages stay English: long technical how-tos for existing users, high
  upkeep, low acquisition value.
- **How do the four translations stay in sync when English changes?** A `/translate-sync`
  Claude command: it reads the git diff of the English source and re-aligns each language
  version — not a literal translation, but the same meaning expressed the way that language
  naturally would. Run by hand when English copy changes; no pre-deploy gate.
- **Does the site auto-redirect visitors by browser language?** No. The default is always
  English at the root. Offer only a visible language switcher — never redirect by browser
  language.
- **Do the plain-Markdown page mirrors (`/index.md`, `/vs-x.md`) get translated?** No — keep
  them English. They serve AI crawlers and llms.txt consumers, which read English fine; same
  reason recipes stay English. Only the human-facing HTML pages get the four languages.

## /translate-sync (#46)

- **How does `/translate-sync` know what English copy moved since the last sync?** A single
  committed marker file holding the last-synced English commit SHA; the command diffs the
  English source from that commit to HEAD. #30's build must seed this marker at its ship
  commit, so the first upkeep run is an incremental diff, not a full re-translation. A
  missing marker means a full sync of all four languages.
