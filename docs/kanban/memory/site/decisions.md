# Decisions

Settled answers to cards' open questions — the question, then the answer, once resolved.
The resolve flow appends here. Read before proposing so you don't re-ask a settled call.
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
