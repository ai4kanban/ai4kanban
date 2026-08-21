# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- What belongs in `goal.md`, as advice the user can skip — setup links it when it asks for the goal: `docs/guides/what-makes-a-good-goal.md`.
- What each value of the goal's `reviewed:` field means, who writes it, and which one makes the board ask you for a goal: `docs/guides/daily-loop.md`.
- Both READMEs, in English and Chinese, are app-first: the quick start opens on downloading
  the board app, with what a Mac user clicks through on first open and a picture of the
  guided first run; the `akb` command and `akb install` come second; the coding agent skill
  is an optional section further down. They teach the commands a person types, never the
  board's bookkeeping, and close on the two lines that update `akb`: `README.md`, `README-zh.md`.
- No page anywhere says installing a board installs the skill — the READMEs, the setup
  prompt at `web/public/INSTALL_PROMPT.txt`, and the npm page `cli/README.md` all say the same.
- Which coding agents the board runs, what each reports back, what a run may touch, and
  every agent's own settings — including ZCode, where the command comes from a package that
  isn't Z.ai's and a run has no fence around the project: `docs/guides/connectors.md`.
- Which GLM Coding Plan tier to buy to run the board on ZCode — the three tiers, their
  credit caps on both the 5-hour and weekly clocks, the models every tier reaches, and that
  the plan bought through BigModel in mainland China is the same plan. The tier numbers come
  from Z.ai's and BigModel's own docs and are marked untested; `README-zh.md` points at the
  section, `README.md` does not: `docs/guides/connectors.md`.
