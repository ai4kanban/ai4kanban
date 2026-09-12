# Understand what the spec got wrong

The user has said, in the discussion, that a card's spec missed what they meant. Read their
words, work out where the spec and their expectation came apart, and answer in the
discussion. Everything below the first section only applies when they also shared the
problem with the AI4Kanban team.

- **Answer them first**: this is a conversation. Say what you understand the problem to be,
  in their own language, before anything else.
- **Nothing is collected without a linked card and a share**: with no linked card, this is an
  ordinary discussion — do not guess which card they mean, and read no project material.
- **Never widen it**: you are explaining one deviation, not re-refining the card.
- **Reached without a card too**: a plain discussion can turn into one of these. Understand
  the problem and stop there — everything below needs a card the user linked themselves.

## Find the refine it happened in

`akb raw case refines <card-id>` lists every refine recorded on that card, newest first, with
the clues for each of its runs. Pick the one the user is describing.

- **Ask about the task, never about the record**: where the evidence does not settle it, ask
  which change they mean in the card's own words — "是加上归档搜索那次，还是后来改成按编号搜的
  那次？". Never show a flow id, a session id or a run list, and never ask them to pick a run.
- **Collect nothing while it is unsettled**: ask, end the turn, and wait. A candidate read
  "just in case" is material the user did not agree to share.
- **One refine**: the pack covers the refine you name. An earlier one may be where the
  deviation really started; say so in the analysis rather than packing a second.

## Read the raw traces

Each clue carries `harness`, `sessionId`, `resumeId`, `cwd`, `argv` and `version`. Use them to
find that CLI's own store of the run and read it there — the board keeps only a display log,
and the run's prompt file is deleted when the run ends, so the raw trace is the only place the
original input survives.

- **Whatever the harness**: the clues are the whole input. Find that tool's own session store
  yourself; there is no path table here to fall back on.
- **A trace that is gone is a gap**: a run whose trace has been cleaned up is written down as
  one, and the case still goes.

## Submit what you found

Write the findings to a temporary JSON file, then `akb raw case submit --file <path>`:

```json
{
  "flowId": "the refine you settled on",
  "analysis": "where the spec and what the user expected came apart",
  "gaps": ["anything you could not establish"],
  "runs": [{ "sessionId": "…", "traceFile": "/where/you/found/or/wrote/the/raw/trace" }],
  "reads": [{ "path": "cli/src/lib/cards.ts", "evidence": "the trace line you saw it read on" }]
}
```

- **`reads` is what that refine actually read**: one entry per project file, each with the
  line of the trace you saw it on. A file you cannot evidence goes in `gaps`, not in `reads`.
- **The board checks and collects**: it refuses a path outside the project, drops a repeat,
  reads each file at the version that refine saw where git can still answer for it, and marks
  the rest. You name files; you never paste their contents.
- **Say what the submission came to**: the move prints the id on success and says so plainly
  when it did not go — the user retries from the screen, so do not submit again yourself.
