<div align="center">

# AI4Kanban

### The AI project manager for coding agents.

**English** · [简体中文](README-zh.md)

[Download](https://ai4kanban.dev/download) · [Website](https://ai4kanban.dev) · [Guide](https://ai4kanban.dev/docs/daily-loop)

<img src="https://cdn.ai4kanban.dev/og-image-v6.jpg" alt="AI4Kanban — the AI project manager for coding agents" width="720">

</div>

AI4Kanban is an AI project manager for developers using coding agents: it turns rough
ideas into planned tasks, runs implementation and review, and remembers project decisions.

## Why use it?

Coding agents need clear requirements. When plans live across long chat sessions, you end
up repeating decisions, clarifying the same questions, and coordinating work by hand.

AI4Kanban keeps tasks, dependencies, and project memory together in a Markdown board
versioned in Git. It uses your codebase and past decisions to clarify the next task, asks
you for the choices that need judgment, and runs ready work through your coding agents.

## See it work

A rough idea becomes a set of tasks with dependencies and acceptance criteria. You resolve
open questions, then press **Implement** on a card to build, review, and land the change.
By default, that approval covers the delivery through landing; enable **Approve diffs
before landing** if you want to inspect the changes first.

Click any screenshot for the full-size version.

<table>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-task-graph-v1.jpg" alt="A group card with its subtask map: five cards wired by dependency arrows" /></a><br/>
<sub><b>Define tasks and dependencies</b> — turn a large goal into bounded cards, with dependency arrows showing what can run in parallel.</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-clarify-v1.jpg" alt="A card's open questions, each with recommended and alternative answers" /></a><br/>
<sub><b>Clarify requirements</b> — use project memory and the codebase to answer routine questions; bring product decisions back to you.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-execute-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-execute-v1.jpg" alt="The runs panel: implement, review, and resolve sessions with their run log" /></a><br/>
<sub><b>Execute</b> — run ready tasks in parallel in separate git worktrees, review the changes, and resolve conflicts before landing.</sub>
</td>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-spec-agents-v1.jpg" alt="A ui-design agent's report with two working mockups attached to the card" /></a><br/>
<sub><b>Settle key decisions first</b> — use built-in or custom spec agents to compare technology choices and produce working UI mockups.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="https://cdn.ai4kanban.dev/loop-approval-v1.jpg"><img src="https://cdn.ai4kanban.dev/loop-approval-v1.jpg" alt="A Slack notification asking to approve a card, with Implement and Open card buttons" /></a><br/>
<sub><b>Approve work from Slack</b> — receive questions and approval requests, then answer or start implementation directly from the message.</sub>
</td>
<td width="50%" valign="top"></td>
</tr>
</table>

## Get started

**You need:** a project folder and one supported coding agent installed and signed in, or
configured with an API key. Use a Git repository with at least one commit and a checked-out
branch for isolated worktrees and automatic landing.

1. **[Download and install the desktop app](https://ai4kanban.dev/download).** The app bundles
   its runtime and the `akb` CLI; no separate Node.js or npm setup is needed.
2. **Create a Local board and open your project folder.** Setup tries the coding agents on
   your machine. Confirm or correct its understanding of the repository and describe your
   project goal.
3. **Select Finish setup.** AI4Kanban creates project memory, maps the modules, and proposes
   the first tasks.
4. **Try one task.** Open a proposed card, answer its open questions, and press **Implement**
   when its scope is clear. Follow the build and review in the runs panel.

Current builds are unsigned. Follow the [first-launch instructions](https://ai4kanban.dev/download)
for your operating system if it blocks the app.

You can also work from your coding agent using the board skill:

```text
what's next?
refine #4
implement #4
```

Replace `#4` with a card from your board. The app installs the skill when you open a project;
its installation control is also in **Configuration → General**. The desktop app, skill,
and `akb` CLI operate on the same board. See the [CLI guide](cli/README.md) for terminal use.

## Will it fit your setup?

| Area | Support and limitations |
| --- | --- |
| Desktop | macOS (Apple Silicon and Intel), Windows, and Linux. macOS builds are tested each release; Windows and Linux builds are published without release testing. All builds are unsigned. |
| Coding agents | Claude Code, Codex, Cursor, OpenCode, Kimi Code, DeepSeek Harness, ZCode, and Grok Build. Install and authenticate your agent separately. Reporting, permissions, and connector testing vary; see the [support matrix](https://ai4kanban.dev/docs/connectors). |
| Git | Separate worktrees isolate parallel builds. Without Git, an initial commit, or a checked-out branch, builds use the project folder and require a manual commit. |
| Integrations | The app's notification center and Slack receive questions and approval requests. Custom spec agents live under `docs/kanban/agents/`. |
| Language | English and Simplified Chinese for the app and board content; the app follows your system language by default. |
| Terminal | The desktop app offers `akb` installation on macOS and Windows. Linux AppImage does not leave a command on PATH; see the [CLI guide](cli/README.md) for standalone installation. |

### Local and Cloud boards

- **Local (default)**: cards, memory, releases, and configuration live under `docs/kanban/`
  and are versioned in Git. No Cloud workspace is required.
- **Cloud (invite-only preview)**: board content lives in a hosted workspace, accessible
  from machines you sign in from. Your coding agent still runs locally over your repository;
  AI4Kanban Cloud receives no repository code and runs no agent.
- **Move or export**: switch between Local and Cloud with a reviewed commit. Export a Cloud
  board as Markdown or delete its workspace under **Configuration → Workspace**. See
  [Local and Cloud boards](https://ai4kanban.dev/docs/local-and-cloud-boards) for details.

### Data and usage reporting

Your chosen coding agent and model provider handle the code they need according to their
own configuration. Local board storage does not make model calls offline.

AI4Kanban's anonymous usage reporting is **on by default** and disclosed before your first
board opens. It reports feature usage and failures, never code, card text, project names,
or file paths. Turn it off at first launch, in **Configuration → General**, or with
`akb telemetry off`. The [Privacy Policy](https://ai4kanban.dev/privacy) lists every event
and field.

## Documentation and contributions

AI4Kanban is under active development. Check the [releases](https://github.com/ai4kanban/ai4kanban/releases)
for published changes and the platform limitations above before trying it.

- **Learn the workflow**: [daily guide](https://ai4kanban.dev/docs/daily-loop),
  [project goals](https://ai4kanban.dev/docs/what-makes-a-good-goal), and `akb help`.
- **Report a bug or request a feature**: [open an issue](https://github.com/ai4kanban/ai4kanban/issues).
  For bugs, include your OS, app version, coding agent, and steps to reproduce.
- **Contribute a fix**: read the [repository guidelines](AGENTS.md) and the setup notes for
  the [desktop app](desktop/README.md), [board UI](kanban-ui/README.md), or [CLI](cli/README.md).
  Run the relevant checks and [open a pull request](https://github.com/ai4kanban/ai4kanban/pulls)
  describing the change and how you verified it.
- **See how we use it**: explore this repository's own [task board](docs/kanban/).

## License

[Apache License 2.0](LICENSE). Free to use, modify, and redistribute.

The public site in [`web/`](web/) is the exception: it is source-available for
reading only, under its own [license](web/LICENSE).
