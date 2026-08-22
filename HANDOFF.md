# Handoff — bugs from the opencode harness test

Found by driving `opencode` through a whole board (install → setup → implement → stop →
resume → chat → propose → two-at-once → app UI) on 2026-08-21.

**Test project: `/tmp/akb-opencode-test`** — a small zero-dependency Node CLI (`csvstat`)
with source, tests, README, and a git history committed at each stage. Still on disk. The
board there is mid-flight and carries the damage described in bug 3, which is useful for
reproducing but means you should re-run from a fresh copy when retesting.

## Setup for any retest

The installed `akb` is 0.6.0 while the repo is 0.7.0. A run's prompt names bare `akb`, so
without a shim you test two versions at once:

```bash
mkdir -p /tmp/akb-shim
printf '#!/bin/sh\nexec node %s/cli/bin/ai4kanban.mjs "$@"\n' "$PWD" > /tmp/akb-shim/akb
chmod +x /tmp/akb-shim/akb
export PATH=/tmp/akb-shim:$PATH
cd cli && npm run lint && npm run build
```

Working agent config: `akb agent use opencode && akb agent set model zai-coding-plan/glm-5.3`.
The model pinned in `~/.omo/omo.jsonc` and `~/.config/opencode/opencode.json`
(`opencode/deepseek-v4-flash-free`) is retired, and OpenCode Zen paid models return
`No payment method` (401). Only `*-free` models and the Z.AI plan work.

---

## Bug 1 — opencode ignores the spawn `cwd`, so the agent runs in the caller's folder

**Severity: high.** This is the app's normal path — the desktop server's cwd is its own
bundled folder, never the project.

`chat.ts:343`, `watch.ts:126`, `test.ts:121` and `launch.ts:32` all pass `cwd: REPO_ROOT`,
and `REPO_ROOT` is correct (chat writes `.chats/board.json` into the right board). The
problem is downstream: **`opencode` does not honour the `cwd` its process was spawned
with.** Proven independent of ai4kanban:

```bash
cd /tmp/probe-dir && node -e '
const {spawn}=require("child_process");
spawn("opencode",["run","--format","json","--model","zai-coding-plan/glm-5.3",
  "Run pwd and reply with only its output."],
  {cwd:"/tmp/akb-opencode-test",stdio:["ignore","pipe","pipe"]})
  .stdout.on("data",d=>process.stdout.write(d));'
# → /tmp/probe-dir      (not /tmp/akb-opencode-test)
```

So the comment at `chat.ts:341-342` ("The project, not this process's cwd") is not true for
this harness — it silently does nothing.

### What it looks like from outside

`akb chat --dir <project>` from elsewhere: the agent answers from an empty folder.

```
$ cd / && akb chat --dir /tmp/akb-opencode-test "Run pwd and print exactly what it says. Then give the title of card 14."
   pwd output (exactly): /
   Card 14 title: Unavailable — there is no kanban skill installed in this environment.
```

Run flows are worse — they don't refuse, they go looking. `akb refine 14 --dir /tmp/akb-opencode-test`
from `/`:

```
⏺ bash(for d in /Users/wutao/git/*/docs/kanban; do [ -d "$d" ] && echo "$d"; done ...)
The ai4kanban project's own board has numbered cards. Let me look for card 14 there.
⏺ bash(find /Users/wutao -maxdepth 6 -name "next-id" ...)
```

It found **this repo's real board** and was about to work card #14 there, which also exists.
I killed it at 1m45s and confirmed nothing under `docs/kanban/` was written
(`find docs/kanban -newermt '-25 minutes'` was empty). It was one step from editing the
wrong project's board.

### Two fixes, both verified working

- **`--dir` flag** — `opencode run` takes `--dir <path>` ("directory to run in"). Add it in
  `opencodeExtraArgs` (`cli/src/lib/agent/harnesses.ts:532`), guarded the same way
  `--format json` is: only when the user's own `command` hasn't already named it.
- **`PWD` in the spawn env** — same spawn, plus `env: {...process.env, PWD: REPO_ROOT}`,
  makes `pwd` report the project. Confirmed.

The `--dir` flag is the better fix; `PWD` is worth setting anyway since it costs nothing and
may help other harnesses. **Check the other harnesses the same way** — codex, cursor, dsh
and zcode were not tested, and any that also ignores `cwd` has the same hole. `zcode.ts:391`
already resolves an explicit `workspacePath`, which suggests the problem was known there.

---

## Bug 2 — a chat resumed from a different folder hangs forever, silently

**Severity: high**, and it hit the app.

Single-variable repro — same board, same thread, same agent, only the folder changes:

```
$ cd /tmp/akb-opencode-test && akb chat "Reply with just the title of card 10."
  → 38s, correct
$ cd /tmp/akb-opencode-test && akb chat "Now reply with just the title of card 11."
  → 10s, correct          (resume in-folder is fine)
$ cd / && akb chat --dir /tmp/akb-opencode-test "Now reply with just the title of card 6."
  → >10 min, zero bytes of output
```

The child had 47s of CPU in 18 minutes — stalled, not working. Probably a consequence of
bug 1 (the resumed session's recorded directory disagrees with where opencode actually
runs), so **fix bug 1 first and re-check this one** — it may go away.

What makes it bad regardless of cause:

- `chat` writes **nothing** until it finishes. A wedged chat and a slow one look identical.
- A chat has no entry in `akb runs` and no stop command. The only recovery is deleting
  `docs/kanban/.chats/board.json` by hand.

Worth fixing independently: give chat a timeout or a heartbeat, and a way to abandon one.

**In the app**: same symptom. Configuration → Test passed ("the agent answered in 9.9s"),
but a chat message sat at "Thinking…" past 8 minutes. Because of this I never confirmed
whether the app's chat reads the board correctly at all.

---

## Bug 3 — nothing detects cards left pointing at a card that no longer exists

**Severity: medium.** The board accepted two runs that left it inconsistent and marked both
`✓ done`.

Both implement runs finished a card with `rm <card>.md` plus a hand-appended `record.csv`
line instead of `akb board archive`. Current state of the test board:

```
docs/kanban/todo/feature/12-document-errors.md:8:blocked_by: [4]   ← #4 shipped and deleted
docs/kanban/todo/research/10-default-stat-set.md:9:related: [3]    ← #3 shipped and deleted
docs/kanban/todo/research/11-display-policy.md:9:related: [3]
docs/kanban/todo/feature/9-number-formats.md:9:related: [4]
```

#12 is permanently blocked by a card that exists nowhere — no `.archive/` entry, no file,
no way to unblock it from the UI.

The command itself is fine. Run by hand on #5 it did everything right, including flagging a
stale mention in another card's body:

```
$ akb board archive 5
  2. rewrite 1 mention of #5 — each line below now points at a card that isn't there:
       docs/kanban/todo/feature/12-document-errors.md:25  (body)
```

So this is primarily the agent disobeying `akb guide board:162` and `akb board help`
("Never edit next-id or metrics.csv by hand"). It did it twice — the second time explicitly
"mirroring card #3's completion", so one bad run teaches the next.

Two things worth doing on the board side:

- **A post-run integrity check.** A run that ends with dangling `blocked_by`/`related` ids
  should not report a clean `✓ done` without saying so.
- **Make the guide harder to skip.** The instruction is one line deep in `akb guide board`;
  the finish-a-task step should lead with the command.

---

## Bug 4 — the suggested command is cwd-relative, so it can't be pasted

**Severity: low.**

```
$ cd / && akb board list
node Users/wutao/git/ai4kanban/cli/bin/ai4kanban.mjs board list: no board here. ...
  Run `node Users/wutao/git/ai4kanban/cli/bin/ai4kanban.mjs install` to make one
```

The leading slash is gone. It happens to work from `/` and nowhere else. Every hint the
board prints for a person to paste — follow it, stop it, resume it — is built the same way.

---

## Bug 5 — dates are UTC

**Severity: low.** At 00:56 CST the CLI wrote `2026-08-21` while the agent's hand-written
rows said `2026-08-22`, splitting one session across two `metrics.csv` rows:

```
date,completed,created,rejected
2026-08-21,1,13,0
2026-08-22,2,0,0
```

Internally consistent, but anyone east of UTC will see today's work filed under yesterday.

---

## What passed, so you don't re-litigate it

Install (nothing outside `docs/kanban/`), agent select, connect, setup 8/8 in 7m55s,
implement (code + tests + README all correct, verified independently), stop (card back to
`todo`, clean tree, tests green, resume offered), resume (finished the stopped card),
chat in-folder (cited `stats.js:62` and `:84` exactly), propose (valid frontmatter, open
questions attached), and two-at-once (`refine` + `propose` — 12 cards = 12 files, no
duplicate ids, no locks, `next-id` correct). No ids leaked when I killed a run mid-flight.

The app's board UI loaded the right board, showed live `REFINING` state, live-updated when a
new card appeared, and Configuration → Test passed.

`akb agent test` handled the retired model well: it printed the provider's message verbatim,
said "the agent did not answer", and refused to tick the setup box.

Not a bug: the five `resolve`/`refine` runs that appear on their own after `propose` are the
designed chain (`refineRound` in `.sessions.json`), bounded at `MAX_SESSIONS = 6` in
`cli/src/lib/agent/refine.ts`.

## Not tested

Other harnesses; release flows and `reject`; the recurring card; `akb skill`; behaviour
under a provider rate limit (none occurred); and the app's chat end-to-end, which bug 2
blocked.
