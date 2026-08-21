---
title: ZCode's 'The login ZCode has' sign-in fails, and two places say it works
track: skill
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: [229]
modules: [skill, docs]
questions:
  - question: "[user] Should the login option be dropped from ZCode's Sign-in box, or kept and made to explain itself when it can't work? Dropping it is one line and leaves nobody stuck; keeping it needs the board to read which provider ZCode is signed in to."
    mode: single
    options:
      - Drop it — ZCode gets a key box and nothing else, until someone shows a login that works.
      - Keep it, and have the board say why it can't work when it can't.
    recommend: [1]
---

Picking ZCode's default sign-in, *The login ZCode has*, can leave a user unable to start at
all: the board says nothing is wrong, and the first run dies with an error about a missing
key for a provider they never chose. The guide and the board's own memory both tell them
this is the way to sign in.

What happens on a machine signed in through BigModel:

```
$ akb agent test
[error] Model provider is missing an API key: zai
```

The cause is that `zcode app-server` offers only the `zai` provider. A ZCode login on the
BigModel provider family — which is what `zcode login` gives a mainland-China account — is
invisible to it, so the run falls back to `zai`, which has no key. Pasting a Coding Plan
key into the board's key box works, and is currently the only route anyone has run.

Whether the option works for a login on Z.ai's own provider family is unknown — nobody has
tried one.

## Scope
- **The Sign-in box stops promising something that may not work** — either the option goes,
  or it says what it needs, depending on the open question.
- **A run that can't sign in says which provider it wanted and what to do**, instead of
  naming a provider the user never picked.
- **`docs/guides/connectors.md` stops telling the reader to leave Sign-in on the login
  option** as the ordinary path.
- **The ZCode line in `docs/kanban/memory/skill/readme.md` is corrected too** — it currently
  says "Sign in with `zcode login`, or paste a key" as if both work.
- **Nothing changes for the other five agents.**

## Todo
- [ ] Decide the open question, then change ZCode's Sign-in box to match.
- [ ] Make a ZCode run that can't reach a provider say which one it wanted and that a
      Coding Plan key in the board's key box is the way through.
- [ ] Rewrite the sign-in bullet in `docs/guides/connectors.md` so the key is the path it
      teaches.
- [ ] Fix the ZCode line in `docs/kanban/memory/skill/readme.md`.
- [ ] Check the Sign-in box in the board UI reads correctly after the change.

## Decided by the agent
- **Why this is not filed as a docs card**: the guide is only repeating what the board
  offers. Fixing the words while the box still offers a dead option moves the problem.
- **Why the failing message counts as part of it**: the error names `zai`, a provider the
  user never chose, which is why the dead end reads as a board fault rather than a missing
  key.

### Worth noting
- **The option may work for a Z.ai-family login.** It was only ever seen to fail on a
  BigModel-family one. Dropping it would then be removing something that works for some
  people; the open question is which way to take that.
