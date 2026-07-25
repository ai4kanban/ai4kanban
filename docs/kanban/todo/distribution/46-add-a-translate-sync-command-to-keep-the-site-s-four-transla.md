---
title: Add a /translate-sync command to keep the site's four translations current
track: distribution
priority: med
roi: med
status: ready
blocked_by: [30]
related: [30]
modules: [site]
questions: []
---

Add a Claude slash command that re-aligns the four site translations when the English copy changes, so they don't drift out of date after #30 ships them.

## Scope
- Blocked by #30: the translation structure (English source-of-truth copy, the four language versions) has to exist first. This card is only the upkeep tool.
- Covers only the surfaces #30 translates — the landing page and the three vs pages, in Chinese, Spanish, Japanese, French. Never touches the recipes or the plain-Markdown `.md` mirrors; #30 keeps those English.
- The command re-expresses each change in each of the four languages — not a literal translation, but the same meaning said the way that language naturally would.

## How the command runs
1. Read the last-synced English commit from a committed marker file (see below), and diff the English source copy from that commit to HEAD.
2. For each English copy key that moved, act by how it moved:
   - **Changed** — re-check the four existing translations and rewrite only the ones whose meaning no longer matches. A pure typo or formatting change that leaves the meaning intact rewrites nothing.
   - **Added** — write the new key into all four languages.
   - **Removed** — delete the key from all four languages.
3. Leave the edited language files in the working tree (do not commit). Print a short per-language summary of what changed.
4. Advance the marker to HEAD.

Run by hand when English copy changes. No pre-deploy gate. The human reviews the diff and commits — that review is the quality gate, so the command adds no separate fresh-reader pass.

## The marker
- One committed file storing the SHA of the last-synced English commit. Committed so the whole team syncs from the same baseline, not a per-checkout local file.
- **First run / marker missing** — treat as a full sync: translate every covered surface into all four languages from scratch. #30's build seeds the marker at the commit it ships, so the normal case is an incremental diff.

## Todo
- [ ] Add a `/translate-sync` Claude command file scoped to the landing page and the three vs pages only
- [ ] Read the committed marker, diff the English source from it to HEAD, and split moved keys into changed / added / removed
- [ ] Re-express changed keys (rewrite a language only when meaning moved), add new keys in all four languages, delete removed keys from all four
- [ ] Leave edits in the working tree, print a per-language summary, then advance the marker to HEAD
- [ ] Handle the missing-marker case as a full sync of all four languages
- [ ] Document the command in its own file description (like the other `.claude/commands/` cards), and note the marker in #30's translation setup so the build seeds it

## Decided by the agent
- **Where and how is the last-synced point stored?** A single committed file holding the last-synced English commit SHA. Committed (not local/gitignored) so everyone syncs from one baseline.
- **First run, before any marker exists?** Full sync: translate every covered surface into all four languages. #30's build writes the initial marker at its ship commit, so later runs are incremental.
- **Only changed keys, or added and removed too?** All three — changed keys get re-expressed, added keys get translated into all four, removed keys get deleted from all four. Otherwise the translations drift structurally, not just in wording.
- **Does a typo-only English edit force a re-translation?** No. The command re-checks the affected key and rewrites a language string only when the meaning moved; it still advances the marker so the key isn't re-examined next run.
- **Does the command commit its edits?** No. It leaves the changes in the working tree and prints a per-language summary; the human reviews the diff and commits, matching how the other manual `.claude/commands/` run.
