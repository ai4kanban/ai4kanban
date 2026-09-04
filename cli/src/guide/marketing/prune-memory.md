# Prune the memory set

Prune every file in the memory set (see "The memory set" in `akb guide board`) — the
board's own at `docs/kanban/memory/`, or a pillar's at `docs/kanban/memory/<pillar>/`.

One principle for all files: they exist to stop us re-proposing a topic, re-making a
positioning mistake, or re-learning a writing rule the user has already taught us. Rewrite
each as **topics** (h2 title) with plain-language takeaways under each. Keep only what helps
the next piece; drop dates, card ids, and step-by-step stories.

Merge lines that say the same thing. Rewrite, don't just cut.

On top of that, per file:

- `decisions.md` — one line per live decision, in plain words: positioning, audience, the
  claims we may make. Drop a decision once the question no longer arises.
- `rejected.md` — one line per idea: what not to propose and why. "Already published" is not
  a rejection — that belongs in `published.md`; drop it from here.
- `published.md` — one line per published piece: date, channel, URL, what it did. Never
  prune a line away, only shorten it: it is the only record that a piece went out.
- `writing.md` — the voice every piece shares, as `- ❌ … → ✅ …` lines in the user's own
  words. Never invent a rule; every line came from an edit.

## Split the rules that stopped holding everywhere

`writing.md` is what holds for **every** piece. A rule that has stopped being true
everywhere — it only applies to one language, one channel's format, one length — moves out
into a file under `memory/writing/` that says so in its name.

- **Move, don't copy**: a rule in both files is a rule that will be edited in one of them.
- **Create, merge and drop those files as the rules demand**: no layout is fixed. Two files
  that keep collecting the same rules are one file; a file down to a single line that
  `writing.md` already covers goes back into it.
- **A rule learned on one channel is not a channel rule**: keep it in `writing.md` unless the
  edits show it failing somewhere else. Channels have no instruction file, and a rule split
  out too early is a rule the next channel never sees.
