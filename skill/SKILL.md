---
name: kanban
description: Manage the file-based board in docs/kanban/ with the akb command. Use to propose or add tasks (including from articles, research, analyses, or feedback), refine or resolve a task, mark it done, or reject it — and to start, watch, or stop a build. Triggers on "what's next", "create tasks from this", "add a task", "refine", "resolve", "done", "reject", "run it", "what's running".
---

The task board lives in `docs/kanban/`. Plain markdown, in git. The `akb` command owns it —
what to do for any board work is `akb`'s to say, not this file's, so it can never go stale
against the version installed here.

**Before any board action, ask the command what to do:**

```
akb <action> <id> --print
```

That starts nothing. It prints the job filled in for this board — the card's own path, the
steps it has left, the memory file its modules point at, the flows the job is done by in
full, and the command that closes it. Then do the job here, in this conversation.

The actions: `implement`, `refine`, `resolve`, `revise`, `run` (one pass of a recurring
card), `create`, `propose`, `plan-release`, `archive`, `reject`.

## Or start a run

Drop `--print` and it starts a run instead: a second agent, its own context, working on its
own. Print when the user is asking **you** for the action in this session; start a run when
they want the work to happen on its own, in the background. In doubt, print.
`akb help runs` carries the full rule and every command.

## Everything else the board does

```
akb runs                  what is running, and what ran lately
akb log <run> --follow    watch one
akb stop <run>            end one
akb resume <run>          continue one that failed or was cut off
akb agent                 which agent runs the board, and how it is set up
akb guide                 the board's flows, by name — `akb guide board` is how it all works
akb board help            the board's own bookkeeping: ids, a card's fields, the index
```

`akb help` lists them all. **Never hand-write a card's frontmatter** — `akb board create` /
`update` / `update-questions` / `schedule` own it. Write and edit only a card's body.

## A key is the user's to type

The board keeps its keys in `docs/kanban/.env`. Never run the command that saves one — hand
the user the line and let them run it:

```
akb agent set apiKey <their-key>
```

A key you type lands in your transcript and in their shell history, and a saved key is
never read back.

## When an ask can't run

- **no board here** — `akb install`
- **the agent isn't installed** — `akb agent test` names the install command
- **no key, or the wrong provider** — `akb agent` shows what is set; the user runs the line above

## No `akb` on the path?

It comes from the `ai4kanban` npm package: `npm install -g ai4kanban`, and
`npm install -g ai4kanban@latest` to move to a newer one. Without installing anything,
every command above also works as `npx --yes ai4kanban@latest <command>`.
