# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- Both READMEs, in English and Chinese, are app-first: the quick start opens on downloading
  the board app, the `akb` command comes second, and the coding agent skill is an optional
  section further down. They teach the commands a person types, never the board's bookkeeping:
  `README.md`, `README-zh.md`.
- No page anywhere says installing a board installs the skill — the READMEs, the setup prompt
  at `web/public/INSTALL_PROMPT.txt` and the npm page `cli/README.md` all say the same.
- What belongs in `goal.md`, as advice the user can skip:
  `web/content/docs/what-makes-a-good-goal.mdx`. What each value of `reviewed:` means and who
  writes it: `web/content/docs/daily-loop.mdx`.
- Which coding agents the board runs, what each needs installed and signs in with, what a run
  may touch, and every agent's own settings — including which GLM Coding Plan tier reaches
  which models: `web/content/docs/connectors.mdx`.
- Writing a spec agent of your own — the folder shape, the `akb:` block, and how a setting's
  choice picks the one reference a run is given: "Let a specialist fill part of the spec" in
  `web/content/docs/agents.mdx`, which `/docs/spec-skills` redirects to.
- The four roles you can switch off, each with a section of its own, and why running Triage
  beside the Gater and the Decider is not recommended: `web/content/docs/agents.mdx`.
- What a Local board is, what a Cloud board is, and what moving between them costs:
  `web/content/docs/local-and-cloud-boards.mdx`, and a section of its own in both READMEs.
- Triage — the command, its settings, the recurring card that pulls it, and **Let it sort by
  itself**: `web/content/docs/triage.mdx`. `/docs/market-signals` is not redirected.
