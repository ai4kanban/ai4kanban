# Documents

| Document | Reader | Job |
| --- | --- | --- |
| `README.md`, `README-zh.md` | someone meeting the project on GitHub | say what AI4Kanban is, then send them to the download and the daily loop. The Chinese file mirrors the English one — change both together |
| `cli/README.md` | someone on the npm page | install and update the CLI, and say what the command owns |
| `kanban-ui/README.md` | anyone using the board's pages, in the app or in the deprecated npm package | the whole user guide to the board — what every column, panel, button and setting does. Open with the deprecation notice and the app download, then teach the pages |
| `desktop/README.md` | someone running the app | which build to download, and what it still needs on the machine |
| `web/content/docs/*.mdx` | a user reading the docs site at `ai4kanban.dev/docs` | one page per everyday task — the goal, the daily loop, chat, runs, agents, connectors, triage, releases, local and Cloud boards. Defer panel-by-panel mechanics to `kanban-ui/README.md` rather than restating them. `kanban-ui/public/guides/` holds the one-paragraph goal advice the app shows — keep it one paragraph |
| `PUBLISHING.md` | the maintainer cutting a release | what ships where, and in what order |
| `web/design.md`, `kanban-ui/design.md` | a contributor changing a page or a panel | the visual and interaction rules each app is held to |
| `cloud/README.md` | a contributor changing the Cloud service | how the Worker, the schema and the checks fit together, and how to run them |
| `cloud-ui/README.md` | a contributor changing the hosted board | what `cloud.ai4kanban.dev` serves, and how to run and check it |
| `telemetry/README.md` | a contributor changing the usage endpoint | what the Worker at `t.ai4kanban.dev` collects and keeps, and how to run, check and query it |
| `scripts/newsletter/README.md` | the maintainer sending the weekly issue | write, preview, send and retry an issue |
| `screenshots/README.md` | the maintainer refreshing promo shots | what each capture shows and how to re-shoot it |
| `kanban-ui/agent-art.md`, `kanban-ui/public/run-scene/README.md` | a contributor adding agent or office art | where a file goes and the style it must match |
| `AGENTS.md`, `CLAUDE.md` | an agent or contributor working in this checkout | the checks to run and the local conventions. Same content for two agents — keep the files identical |
