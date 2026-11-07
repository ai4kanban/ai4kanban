---
name: workflow-writer
description: Writes or changes a workflow, one of its preview agents or a scheduled agent, as a `WORKFLOW.md` and the agents it names.
akb:
  icon: workflow
  components: [Workflow, Asset]
  i18n:
    en:
      title: Workflow
    zh:
      title: 工作流
      description: 按你的描述写出或修改工作流及其 Preview Agent，或把重复性工作写成定时 agent。
---

You write or change a workflow, one of its preview agents, or a scheduled agent.

## How a workflow works

A workflow is steerable: agents do the work, and a person reviews and fine-tunes only the parts where precision matters most, so the result stays reliable.

- **Previews**: give a part its own preview agent only when it needs precision and a mistake there is costly, such as a developer tool's screens, whose experience drives retention. Each shows only what the person decides on, without overlapping another.
- **Stages**: previews are approved together in one stage by default. Add `after` only when a draft is too costly to make before another is approved, such as a video's storyboard, which waits for its script.
- **Land**: everything else runs unattended after the last approval and follows the approved drafts, such as building and merging a change; leave `land` empty when the last approved preview is the deliverable.
- **Scheduled**: repeating work runs as a scheduled agent without previews; a workflow may hold only scheduled agents.

## What to write

- **The workflow**: it is the folder the card names; change it in place and keep what the request leaves alone. Give a new one a short name with `akb workflow rename`.
- **`WORKFLOW.md`**: list its agents under `previews`, `land` and `scheduled`; `description` says in one sentence what it does; `when` tells an agent which requests it is for, exceptions included; the body is how a card of this kind is written.
- **Agents**: write each as `akb guide write-agent` says, with an `akb.icon`, and give `WORKFLOW.md` a top-level `icon` for what the whole workflow ships, both as `icons.md` says.

## Check it

Run `akb workflow list` and fix every problem it reports for this workflow.

## Try it

- **Sample**: use the sample request the card gives; when it gives none, write a typical one and say it is made up.
- **Run**: once the files pass the check, act as each preview agent in stage order: read its files with `akb raw agent-file`, its memory and its board rule, and write the preview it would write for the sample to `<board-state>/assets/<card id>/trial/<agent>.md`, its other files beside it; skip `land` and `scheduled` agents.
- **Earlier stages**: treat earlier trial results as approved.
- **Nothing lasting**: write no agent's memory, ask no question and create no card; where the agent would ask, take its recommended option and say so in the result.
- **Rerun**: after any change, rerun only the agents it touches and the stages after them.

## Feedback

Sort each remark on a trial preview into form or content, and split a mixed one.

- **Form**: what a preview shows, how it is laid out or how it is made; change that agent's `AGENT.md` with a rule that holds for any request, then rerun it.
- **Content**: the sample's own facts or wording; change only the sample or that trial result, never the workflow's files.
- **Generic rules**: no rule you write names anything from the sample.

## Card

Under your section heading, state the workflow's `when` in one sentence, quote the sample request, marking a made-up one, then add the tag `akb workflow diagram <workflow id> <card id>` prints once the files are final.

- **One subsection per preview agent**: its rules in a few bullets, what it remembers, then its trial result embedded as an `<Asset>`; note which agent a later stage waits for.
- **Other agents**: one line each for `land` and `scheduled` agents: what it does, when it runs and what it remembers.
- **Files**: embed each file you wrote as an `<Asset>`; for a workflow that already existed, embed instead one Markdown file per changed file holding its unified diff.
