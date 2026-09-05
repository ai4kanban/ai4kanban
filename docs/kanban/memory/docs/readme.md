# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

- What belongs in `goal.md`, as advice the user can skip — setup links it when it asks for the goal: `web/content/docs/what-makes-a-good-goal.mdx`.
- What each value of the goal's `reviewed:` field means, who writes it, and which one makes the board ask you for a goal: `web/content/docs/daily-loop.mdx`.
- Both READMEs, in English and Chinese, are app-first: the quick start opens on downloading
  the board app, with what a Mac user clicks through on first open and a picture of the
  guided first run; the `akb` command and `akb install` come second; the coding agent skill
  is an optional section further down. They teach the commands a person types, never the
  board's bookkeeping, and close on the two lines that update `akb`: `README.md`, `README-zh.md`.
- No page anywhere says installing a board installs the skill — the READMEs, the setup
  prompt at `web/public/INSTALL_PROMPT.txt`, and the npm page `cli/README.md` all say the same.
- Which coding agents the board runs, what each reports back, what a run may touch, and
  every agent's own settings — including ZCode, where the command comes from a package that
  isn't Z.ai's and a run has no fence around the project: `web/content/docs/connectors.mdx`.
- Which GLM Coding Plan tier to buy to run the board on ZCode — the three tiers, their
  credit caps on both the 5-hour and weekly clocks, the models every tier reaches, and that
  the plan bought through BigModel in mainland China is the same plan. The tier numbers come
  from Z.ai's and BigModel's own docs and are marked untested; `README-zh.md` points at the
  section, `README.md` does not: `web/content/docs/connectors.mdx`.
- Running the board on Grok Build, xAI's coding agent: how to install `grok`, that a
  `grok login` or an xAI key both work with the saved login winning, that the board's rules
  go to `.agents/skills/kanban/`, that the run is fenced by `GROK_SANDBOX=workspace`, and why
  the board drives ACP rather than Grok's `-p` mode: `web/content/docs/connectors.mdx`.
- Running the board on Antigravity CLI, Google's coding agent: how to install `agy`, that a
  Google login signs its runs and there is no key box, that the thinking level rides inside
  the model id, why the board widens `--print-timeout` past a card's length, and that its
  shell is not fenced to the project — with the note that no card has run on it yet:
  `web/content/docs/connectors.mdx`.
- Writing a spec skill of your own — the directory shape, the `akb:` frontmatter block, and how a
  setting's choice picks the one reference a run is given: "Let a specialist fill part of the spec"
  in `web/content/docs/spec-skills.mdx`.
- What a Local board is, what a Cloud board is, and what moving between them costs — the
  committed `.ai4kanban.json` pointer, the git-ignored copy in `docs/kanban/`, the one reviewed
  commit each way, the export, leaving Cloud and deleting the workspace:
  `web/content/docs/local-and-cloud-boards.mdx`, and a section of its own in `README.md` and
  `README-zh.md`.
