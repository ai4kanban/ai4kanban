---
title: Store where the API key comes from, never the key
track: features
priority: med
roi: med
status: todo
blocked_by: [93]
related: [92]
modules: [local-ui]
questions: []
---

`docs/kanban/ui.config.json` is a file in the user's git repo. A key typed into the board
would be committed and pushed. So the board records where a key comes from, and never the
key itself.

## Scope
- A provider that needs a key names the environment variable it reads — for the Anthropic
  API that is `ANTHROPIC_API_KEY`. The name comes with the provider; it is not something
  the user types.
- The key is read from the environment the UI server was started in and handed to the agent
  when a run starts. The user exports it in their shell or their own dotfile, the way they
  already do for the agent's CLI.
- No key is ever written to `ui.config.json`, printed in a run's log, or shown on screen.
  There is no box to paste one into.
- The dialog names the variable a provider reads and says whether it is set right now. The
  value never appears, set or not.
- A run whose variable is empty fails with a plain reason — the variable's name, and that
  it is not set — instead of a 401 buried in the log.
- Telling the user before they press a button is #96. This card is about the run itself,
  and where the value comes from.

## Todo
- [ ] Let a provider name the environment variable it reads, and pass that variable's value
      into the run.
- [ ] Show the variable's name and whether it is set in the Configuration dialog, never the
      value.
- [ ] Fail a run whose variable is empty with a plain reason naming the variable, instead
      of the vendor's 401.
- [ ] Say in `kanban-ui/README.md` that the board never stores a key, which variable each
      provider reads, and where to export it.
- [ ] Start the UI with the variable unset, start a run, and check the failure names the
      variable — and that no key reaches `ui.config.json` or any log.
