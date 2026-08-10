---
title: Let the UI finish the setup steps that need an agent
track: features
priority: med
roi: high
status: todo
release: 0.6.0
blocked_by: [172]
related: []
modules: [local-ui, skill]
questions: []
---

Once the user has answered what only they can answer, setup still has steps that read the repo and think: the settled calls, the module map, the first cards. Run those from the UI, so a user who never opens a coding agent still ends up with a board that is ready to work.

## Scope
- After the guided first run, the UI offers to finish setup, and does it as an ordinary
  run — it shows in the runs panel, its log can be read, and it can be stopped.
- It covers the steps left over: the settled calls, the module map, and the first cards.
- The progress bar keeps showing how far setup got, and it goes away when the last step is
  done, the same as it does today.
- The questions the agent could not settle land on the board as a card, the way setup
  already leaves them.
- If the run fails, the user is told what is left and can run it again.

## Decided by the agent
- Running setup from the UI was turned down before, on the grounds that the UI shows the
  instruction and the coding agent does the work. The 0.6.0 goal reverses that, so the UI
  runs it.

## Todo
- [ ] Offer to finish setup once the guided first run is answered.
- [ ] Run the leftover setup steps as a normal run, with its log in the runs panel.
- [ ] Keep the progress bar and the questions card behaving as they do now.
- [ ] Let a failed or stopped setup run be started again without redoing the answered
      steps.
- [ ] Set a board up end to end with only the UI, on a repo with code and on an empty one.
