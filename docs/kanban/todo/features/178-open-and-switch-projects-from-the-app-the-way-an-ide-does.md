---
title: Open and switch projects from the app, the way an IDE does
track: features
priority: high
roi: high
status: ready
release: 0.6.0
blocked_by: [175]
related: [172, 171]
modules: [local-ui]
questions: []
---

The board today is tied to the folder the server was started in, so a person who works on
more than one project starts a second server for the second board. The desktop app has no
terminal to start anything from. Give it Open Folder and a list of the projects you already
opened, the way an editor does, so one app covers every project on the machine.

## Scope
- **Open Folder** — pick any folder on the machine and the app opens that board in the
  window. This is the only way a project enters the app.
- **The projects you opened before are listed**, so going back to one is a click, not a
  file picker. Each line shows the project's name and its path.
- **Open a folder with no board and the app starts onboarding there** — the make-a-board
  and setup flow, not an error and not a dead end.
- **A user can take a project off the list** without the folder on disk being touched.
- **A project whose folder was moved or deleted says so on the list** and offers to be
  removed, instead of opening an empty board.
- **One project is open at a time.** Switching replaces the board in the window and reloads
  everything for the new one — cards, releases, memory, runs, settings. Nothing from the
  project before is left on screen, and the window says which project is open.
- **A run you already started keeps going when you switch away.** It belongs to its own
  project: it writes only into that board, and it is there — live or finished — when you
  come back. The projects list marks a project that has a run going, so nothing runs
  unseen. Quitting the app still ends every run it started, in every project (#175).
- **Work the board starts on its own — auto-refine and recurring cards — runs for the open
  project only**, so the app never spends money on a project nobody is looking at.

## Decided by the agent
- **Where the list of projects lives**: with the app's own settings, outside every repo,
  and not in git. A list spanning projects cannot belong to any one of them. This does not
  bend the files-in-the-repo rule — a board's own content still lives only in its repo.
- **Who gets this**: the desktop app only. A board opened in a browser is served by a
  server someone started in that repo, so it has nothing to switch to.
- **One window or two**: one. #175 already says the app shows one board at a time, and the
  server behind it is built around one board — the runs, the background timer and every
  file path are shared for the whole app. Two boards side by side is a rebuild, not a
  setting, so it waits for someone to ask for it.
- **A run when the user switches away**: it keeps running. Runs already survive the app
  restarting and already start with nobody watching, so ending one because the user glanced
  at another project would be a surprise. The run has to remember the project it started
  in, or it finishes by writing into whichever board is open by then.

## Todo
- [ ] Add Open Folder to the app, and open the picked folder's board in the window.
- [ ] Keep the projects the user opened, and let them switch between them from a list.
- [ ] Send a folder with no board into onboarding instead of an error.
- [ ] Let a user remove a project from the list, and say when a project's folder is gone.
- [ ] Show which project is open, and make switching reload the whole board.
- [ ] Tie a run to the project it started in, so it keeps writing to that board after the
      user switches away, and keep the background refine and recurring runs on the open
      project alone.
- [ ] Mark on the projects list which projects have a run going.
- [ ] Open two different projects one after the other and check nothing from the first one
      is still on screen.
- [ ] Start a run in one project, switch to another and back, and check the run is still
      there with its log and that it changed the right board.
- [ ] Update the UI's README and the download page so opening and switching projects is
      taught where the app is.
