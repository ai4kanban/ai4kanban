---
name: draft-first
description: Draft the key parts of a task and have the user confirm them before building. Use instead of plan mode or writing a spec, before building any change.
---

# Draft first

## Key parts

From the project root, run `node <this skill's directory>/scripts/helpers.mjs`. It lists
every helper's file and the parts it covers. A part is key only when a helper covers it and
the user has not already settled it. With no key part, build directly and create no files.

## The contract

Name the task with a short lowercase slug and write `.draft-first/<slug>.md` in the user's
language:

- **Frontmatter**: `status: draft`.
- **Summary**: a `#` title and one paragraph on what will be built.
- **Diagram**: when the paragraph and the drafts cannot make clear what changes, add one
  `mermaid` block under the summary: a `flowchart TB` of at most six labelled nodes and arrows,
  no subgraphs, styles or coordinates, showing before → after or who triggers what.
- **One `##` section per key part**: one line on what is being decided, then the draft its
  helper describes. Add up to two alternatives under `###` headings only when they differ in
  a way the user would care about.
- **Long drafts**: put a draft over about 20 lines in `.draft-first/.assets/<slug>/<name>.md`
  and embed it with `<Asset>`; put a shorter one in a code block.
- **The agent half**: a line holding only `<!-- agent -->`, then `## Decided by the agent`
  with one line per choice the build depends on that you made alone.

## Review

Run `node <this skill's directory>/scripts/review.mjs .draft-first/<slug>.md`, give the user
the address it prints, and stop until they reply. If the contract's status is still `draft`,
say it is unconfirmed and stop again.

## Build

Build from the confirmed contract; a `> Note:` line overrides what it annotates. When the
build meets a new key part, draft and review it the same way.
