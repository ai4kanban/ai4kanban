---
title: Set the board up by talking to it, not by filling in a form
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: [266]
modules: [local-ui, skill]
questions:
  - question: "[user] What does the first-run conversation talk on, before anyone has picked an agent?"
    mode: single
    options:
      - Whatever is already installed — the board takes the first agent CLI it finds on the PATH, says which one it used, and a first turn that fails shows what came back and opens the picker
      - The harness screen first, then the conversation — today's last screen becomes the first, so nothing is ever spent on an agent the user did not choose
    recommend: [1]
  - question: "[user] Does the conversation draft the goal, or ask for it in the user's own words?"
    mode: single
    options:
      - Ask — it may show what makes a good goal, but never words the user can accept unchanged; setup already treats seed text as no goal at all
      - Draft it from the repo and let the user edit or throw it away — fastest, and an untouched draft is accepted as the goal
    recommend: [1]
verify:
  - "Open a project of your own that has no board and go through the first run: it should read as a conversation you can answer in one sentence, not a form written out in prose."
  - "Halfway through, press \"I'll fill it in myself\" and check the form comes up carrying what the conversation had already settled."
---

The first thing a new user meets is a three-screen form: the project's name and its tracks,
the goal, then the agent. The product's promise is that you hand it something vague and it
works the rest out, and the first run does the opposite. Replace those screens with a
conversation: it reads the repo, says what it thinks the project is, asks for the one thing
no repo can tell it, and the board is set up.

## Worth noting
- **What the conversation covers**: the same three answers the form asks for today — the
  project and its tracks, the goal, the agent — and nothing more. `config.md`,
  `decisions.md`, the module map and the first cards stay with the **Finish setup** run that
  already follows the flow, so "two turns and it's set up" ends on a board whose memory is
  still being written in the runs panel.
- **The conversation is not a run**: it is the chat the board already holds with its agent,
  so it takes no place in the runs panel and writes no run log. Its record is the transcript,
  and a first run that goes wrong is cleared and started again rather than resumed.

<!-- agent -->

## Today
- The guided first run (`kanban-ui/components/Setup.tsx`) walks three screens in order —
  project, goal, agent — and the agent screen is last and cannot be pressed past.
  `readSetupDraft` fills each from the repo and the scaffolded board.
- `docs/kanban/setup-checklist.md` is the state. The three screens tick `project`, `goal`
  and `agent`; **Finish setup** starts one ordinary run for `config`, `decisions`, `modules`
  and `tasks`.
- The chat rail (`kanban-ui/components/Chat.tsx`, `cli/src/lib/agent/chat.ts`) already holds
  one session per board or card, resumes it turn by turn, streams the reply and lists what
  the agent looked at on the way. Every harness the board offers can resume. But
  `sendChatMessage` records every message as the user's, so the board has no way today to
  open a conversation with the agent speaking first.
- `agentInfo().options[].installed` already says which agent CLIs are on this machine, from
  one PATH read and no spawn. Whether one is logged in is only ever answered by really
  running it (`testConnection`).

## Scope
- **Where it starts**: a board whose first run is unfinished opens the conversation in place
  of the form's screens, full window, under the same header. Installing the board is
  unchanged — the conversation needs a board on disk to write to and to hold its transcript.
- **It reads first, asks second**: before its first sentence the agent reads the repo —
  README, package files, folder shape, recent commits — and opens with what it thinks the
  project is called, what it is, and what tracks its work falls into.
- **The board speaks first**: the opening turn is the board's, and it is never shown as
  something the user typed.
- **Two turns, not six fields**: the user corrects it in a sentence or says yes. Everything
  the agent is sure of is stated, not asked.
- **Nothing is written before the user agrees**: tracks are folders, so a guessed track
  written early is a folder to delete afterwards.
- **It writes what the form writes**: the project and tracks into `config.md` with their
  folders and index sections, the goal into `memory/goal.md` with its `reviewed:` judgement,
  and one `setup-done` per box as it finishes — through the board's own commands, following
  `akb guide setup`.
- **A way out on every turn**: "I'll fill it in myself" goes to the screens that exist today,
  carrying whatever the conversation had already settled.
- **A board part-way through**: a ticked box is answered — the conversation says what it
  holds and asks only for what is left.
- **A repo with nothing to read**: an empty folder gets a short, honest opening — what little
  it can see and one question — never a guess dressed as a finding.
- **It speaks the app's language**: the conversation follows the language setting, like
  everything else the agent writes.
- **It ends where the flow ends today**: the last tick hands `config`, `decisions`, `modules`
  and `tasks` to the **Finish setup** run in the panel, unchanged.
- **The words follow**: `cli/src/guide/setup.md` and `akb setup` describe a form-driven first
  run; both have to say what happens now, and so do `kanban-ui/README.md`, `README.md` and
  `README-zh.md`.

## Todo
- [ ] Write the first run turn by turn — what it says, what it asks, what it never asks.
- [ ] Let the board open a conversation with the agent speaking first, without the opening
      prompt reading as the user's message (`cli/src/lib/agent/chat.ts`).
- [ ] Give the agent the setup conversation's own instructions — read the repo, state the
      draft, ask only what is left — in `cli/src/guide/setup.md`.
- [ ] Draw the conversation full-window in place of the form's screens, with its progress,
      its errors and the way back to the form. Read `akb guide ui-design`.
- [ ] Write `config.md`, `goal.md` and the checklist ticks out of the conversation, through
      the board's own commands.
- [ ] Keep the form reachable from every turn and as the fallback when there is no agent to
      talk to, carrying what the conversation settled.
- [ ] Hand the remaining checklist steps to the **Finish setup** run when the conversation
      ends.
- [ ] Update `cli/src/guide/setup.md`, `kanban-ui/README.md`, `README.md` and `README-zh.md`.
- [ ] Try it on an empty folder, on a large existing repo, and on a machine with no agent
      CLI installed.

## Decided by the agent
- **Where the conversation lives**: full window, in place of the form's screens, not in the
  chat rail — on a first run there is no board behind the rail for it to sit beside. It
  reuses the rail's plumbing: one resumed session, the reply streamed with the lookups
  listed, which is also what keeps a forty-second repo read from reading as a hang.
- **How much it settles on its own**: everything it can read off the repo, stated back as one
  summary to confirm. One short question at a time is the form again, in prose.
- **Whether it replaces the form or sits in front of it**: replaces it. The form stays one
  click behind "I'll fill it in myself", and is the fallback when there is no agent to talk
  to.
- **What the board does not do**: teach a harness how to log in. A turn that fails shows what
  the agent said and offers the picker, the same way `akb agent test` already does.

## Source
- Feedback from a user, relayed in chat on 2026-08-21 — "涛哥目前 AI4Kanban 的新手体验我感觉
  有点太 old school 了。起手能不能整个小 agent，类似 openclaw onboard 那种聊两句就自动
  setup 好", followed by "not necessarily the openclaw onboard way. brainstorm it". The
  observation: today's first run is a form the user fills in by hand, so a new user's first
  impression is data entry rather than the agent that is supposed to do the thinking.
  `docs/kanban/memory/goal.md` already carries this as an unshipped item — "Onboarding：首次
  使用时应该经过类似于 typeless 的引导，完成看板的初始化，包括设置 goal.md" — with no card
  behind it.
