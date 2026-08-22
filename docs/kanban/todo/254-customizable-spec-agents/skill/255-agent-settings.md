---
title: Let a specialist agent carry settings, not just a switch
track: skill
priority: med
roi: med
status: ready
release: 0.7.2
blocked_by: []
related: [254, 246]
modules: [skill]
questions: []
---

A specialist agent is a name, a prompt, and a switch. There is nowhere to say *how* it should
work, so every board gets the same kind of section out of it. Let an agent declare settings of
its own, and let a run be told what was picked.

## Today
- `SPEC_AGENTS` in `cli/src/lib/spec-agents.ts` holds each agent's name, the two lines of
  description a reader is shown, and its prompt. Nothing else.
- `ui.config.json` keeps the switches: `"specAgents": { "technology-selection": false }`. An
  agent the file doesn't name is on.
- The prompt handed to a spec run is the agent's `.md` file, unchanged, every time.
- A harness — the coding tool a run spawns — already declares its settings this way, as
  `HarnessSetting` in `cli/src/lib/agent/types.ts`, saved under `harnessSettings`.

## Scope
- **An agent declares its settings**: each one a name, a short label, the choices, and which
  choice is the default.
- **A choice carries one line on what it costs**: how long the run takes, how much detail it
  gives, or how readable the result is.
- **A choice carries its own block of prompt text**, written and kept with that agent's
  prompt.
- **The picked choice's text is appended to the agent's prompt**, in the order the settings
  are declared.
- **An agent that declares no settings gets the prompt it gets today**, word for word.
- **The board stores what was picked** in that agent's `specAgents` entry, beside its switch:
  `"ui-design": { "enabled": false, "mockupStyle": "ascii" }`.
- **`enabled` is reserved**: no setting may use that name.
- **A file written before this needs no change**: `"technology-selection": false` still reads
  as the switch.
- **A value left at its default is not written down.**
- **`enabled` is not written down on an agent that is on.**
- **Flipping the switch either way leaves that agent's picked values alone.**
- **A run reads the values as it starts**, never earlier.
- **A value the agent no longer offers falls back to that setting's default.**
- **The run's log says when a value fell back.**
- **An entry that is neither a boolean nor a set of picked values reads as on, all defaults.**
- **`akb spec` prints each agent's settings and its current values**, under the two lines it
  prints for each agent now.
- **`SpecAgentView` in `cli/src/lib/agent/types.ts` carries the same settings, choices and
  values.**
- **Every setting is one of a few named choices** — no free text, no numbers.
- Out: setting a value from a terminal. The board UI is where a setting is picked (#257).
- Out: overriding a setting for one run.
- Out: settings that change which harness or model runs the agent (#246).

## Todo
- [ ] Give `SpecAgent` a settings list — name, label, choices, default — beside
      `HarnessSetting` in `cli/src/lib/agent/types.ts`. Both shipped agents declare none.
- [ ] Let a choice carry its cost line and its own block of prompt text.
- [ ] Let a `specAgents` entry hold the switch and the picked values, and keep reading a plain
      boolean as the switch.
- [ ] Read the entry in `cli/src/lib/agent/settings.ts`, so anything malformed reads as on,
      all defaults.
- [ ] Save one value without touching any other key, and drop a key that goes back to its
      default.
- [ ] Keep an agent's picked values when its switch is flipped either way.
- [ ] Append the picked choices' prompt text to a spec run's prompt.
- [ ] Fall back to a setting's default when the saved value is one the agent no longer offers,
      and say so in the run's log.
- [ ] Print each agent's settings and values in `akb spec`.
- [ ] Carry them on `SpecAgentView`.
- [ ] Check a board with nothing set runs both agents on the same prompt they get today.

## Decided by the agent
- **How does a picked value reach the run?**: the agent writes a block of prompt text for
  each choice, and the picked one is appended to its prompt. No board code has to know what
  any setting means.
- **Where does the switch go once the entry holds settings?**: under `enabled` inside the
  entry — the same thing the plain boolean says today, spelled out.
- **Is a value sitting at its default saved?**: no. The file records what someone changed,
  the way it already records only the agents someone switched off.
- **Does flipping the switch throw an agent's picked values away?**: no. The harness settings
  already work this way, and losing a pick by switching an agent off and on would be a
  surprise.
- **How is any of this seen to work, when neither shipped agent declares a setting?**: it
  isn't. This card is checked by the two of them running exactly as they do today; the first
  real setting arrives with #256.
- **Does this card carry a doc update?**: no. Nothing a user reads changes yet — the update
  rides with #257.
- **Must the entry hold more than one kind of key?**: yes. #246 will put a spec agent's own
  harness beside its settings.

### Worth noting
- **A setting is a pick from named choices, never free text or a number.**
- **A one-run override on `akb spec` was left out** — nothing in #254 needs one.
