# WildCrane for Codex

Shape ideas with Codex in your own session and start them as WildCrane tasks, run on this
computer. No separate Runner to install: the plugin's local component runs the jobs while Codex is
open.

- **Needs**: Codex 0.159 or later, and Node 22 or later (found on the PATH or in the usual nvm,
  Volta, Homebrew, fnm, asdf and mise places).
- **Ideas**: tell Codex what you want to build; it asks in the conversation and saves the ideas,
  replying with one line and a link per idea. Review, change the workflow, discard and **Start** on
  the web: Codex never starts a task.
- **Ask Codex**: to sign in, to add this folder as a project, or for your projects, recent
  discussions and agent connections.
- **Approvals**: Codex asks before each WildCrane tool call unless you approve it for the session.

## Install

Download `wildcrane-codex.zip` from the latest `plugin-v*` release and unzip it, then:

```sh
codex plugin marketplace add ~/Downloads/wildcrane-codex
codex plugin add wildcrane@wildcrane
```

## Develop

```sh
cd runner && npm install && npm run build      # writes plugins/codex/server/dist/
codex plugin marketplace add ./plugins
codex plugin add wildcrane@wildcrane
```

After a rebuild, `codex plugin remove wildcrane@wildcrane` and add it again: Codex runs a copy.

## Check it

```sh
cd runner && npm test                          # the component's tools, lock and lifecycle
plugins/codex/server/bin/wildcrane codex </dev/null && echo started
```
