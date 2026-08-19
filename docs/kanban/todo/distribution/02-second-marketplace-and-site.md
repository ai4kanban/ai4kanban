---
title: List on a second marketplace and decide the site
track: distribution
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: []
modules: []
questions: []
---

Don't depend on one channel. The site question is settled — the landing page is live
at ai4kanban.dev. The LobeHub listing is also requested (2026-07-21): we submitted
the skill repo, https://github.com/dist0com/ai4kanban, and now wait on their
review — nothing more to do for that step. What's left: the awesome-list PR, the
directory checks, and the `PUBLISHING.md` updates. skills.sh and the official
directory are already submitted, also waiting on review.

## Decisions (researched 2026-07-21)
- **Second marketplace: LobeHub** (lobehub.com/skills). It has the strongest domain
  authority of the third-party directories (~55) and a mid-size catalog (~4k skills),
  so a listing there gets seen. The mega-directories (SkillsMP ~30k entries,
  claudemarketplaces.com ~23k) scrape GitHub in bulk — a listing there is free but
  drowns in the crowd, so they're a check, not the pick.
- **Cheap extra: an awesome-list PR.** VoltAgent/awesome-agent-skills is the biggest
  hand-curated list (1000+ skills, covers Claude Code, Codex, Cursor, Gemini CLI —
  fits our portable SKILL.md). A human-reviewed spot there carries more trust than a
  scraped page. It can take weeks to merge; fine, it runs in the background.
- **Site: done.** ai4kanban.dev is live on Cloudflare Pages with the custom domain.

## Watch out
- Several other kanban skills already sit on these directories (MCP Market, SkillsMP,
  claudemarketplaces all carry a few). Our listing copy must lead with the agent-first
  angle — reuse the plugin.json description — so we don't read as one more markdown
  board.
## Todo
- [x] Shortlist a second marketplace and check its submission rules.
- [x] Submit the repo to LobeHub's skills directory. (Done 2026-07-21: requested the
      listing for https://github.com/dist0com/ai4kanban; waiting on their review,
      nothing else to do for now.)
- [ ] Open a PR adding the repo to VoltAgent/awesome-agent-skills.
- [ ] Check claudemarketplaces.com, SkillsMP, and MCP Market for the repo; submit
      wherever auto-indexing missed it.
- [ ] Record every live listing in the Channel 3 table in `PUBLISHING.md`, so
      releases ping them.
- [x] Decide site vs. no site, and where it lives. (Done: ai4kanban.dev is live.)
- [ ] Update the "A website" section in `PUBLISHING.md` to record the site decision.
