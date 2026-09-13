# Understand what the spec got wrong

The user has said, in a conversation, that a card's spec missed what they meant. Read their
words, work out where the spec and their expectation came apart, and answer them. Everything
below the first section only applies to the one turn that submits.

- **Answer them first**: this is a conversation. Say what you understand the problem to be,
  in their own language, before anything else.
- **Nothing is collected while it is going**: read no project material and submit nothing.
  The user shares by ending the conversation, and the board starts one more turn for it.
- **Never widen it**: you are explaining one deviation, not re-refining the card.

## Submit it when the conversation ends

The board says the conversation has ended and was shared. That turn is the only one that
collects, and nobody is reading the conversation any more — settle every open point yourself
and write down as a gap whatever you could not.

`akb raw case refines <card-id>` lists every refine recorded on that card, newest first, with
the clues for each of its runs. Pick the one the conversation is about.

- **Pick, never ask**: the conversation is over. Where the evidence does not settle which
  refine they meant, take the likeliest one and say in the analysis which others it could
  have been.
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

- **The conversation goes with it**: the board carries the whole transcript itself. Never
  paste it into the findings.
- **`reads` is what that refine actually read**: one entry per project file, each with the
  line of the trace you saw it on. A file you cannot evidence goes in `gaps`, not in `reads`.
- **The board checks and collects**: it refuses a path outside the project, drops a repeat,
  reads each file at the version that refine saw where git can still answer for it, and marks
  the rest. You name files; you never paste their contents.
- **Submit once**: the move prints the id on success and says so plainly when it did not go.
  Nobody is waiting on the answer — do not submit again.
