---
title: Import GitHub Issues and mirror progress back
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: [311, 250]
modules: [skill, cloud]
questions:
  - question: "[user] Should we register an AI4Kanban GitHub OAuth app so a member without `gh` signs a machine in with one command instead of making a personal access token by hand? — see the `technology-selection` section"
    mode: single
    options:
      - No — ship on `gh auth token` with a `GH_TOKEN` fallback; costs a member without `gh` a hand-made token, and costs us no account to keep alive
      - Yes — register the OAuth app and enable its device flow; one sign-in command everywhere, and our name on every member's consent screen forever
    recommend: [1]
verify:
  - Paste a real issue URL from a repository you can comment on into the app's Create task box. A card should appear carrying that URL in ## Source, and one comment should appear on the issue naming the card.
  - Import the same issue again. No second card, and no second comment.
  - Archive one imported card and reject another. Each source issue should get exactly one more comment, readable by someone who has never seen the board.
  - Remove the GitHub credentials and import an issue. The failure should say what to set up, not print a stack trace.
  - Take the GitHub credentials away, then archive an imported card. The card should still leave the board, and the run should say the comment did not go out.
---

Let a community propose work through GitHub Issues, and let whoever opened an issue see what
became of it — without making GitHub a second board anyone can write. Today an issue reaches
the board only by being retyped, its link is lost on the way, and its author never learns
whether the work was taken up, folded into a card that already existed, or shipped.

## Worth noting
- **Nothing polls GitHub**: a maintainer imports an issue on purpose, one at a time. The cost
  is that an issue nobody looks at never reaches the board. Importing every labelled issue on
  a schedule is the roadmap's separate scheduled-jobs-and-webhooks work, and it would fill the
  board with cards nobody chose.
- **A mirrored comment comes from the person who imported the issue, not from a bot**: #311
  keeps every GitHub credential on a member's own machine, so a comment carries that person's
  account. A bot identity would read better to a community, and it needs a token held by a
  service — the one thing the group refuses.
- **Three moments reach the issue, not every stage**: the import's outcome, the card being
  archived, and the card being rejected. A card also becomes ready, starts a delivery and
  passes a review; posting those turns an issue thread into a build log. The cost is that an
  author sees nothing between "we took this" and "it shipped".
- **Comments, never labels**: a comment needs the permission any contributor already has,
  while a label has to exist in the repository first and needs push access. The cost is that a
  maintainer cannot filter imported issues in GitHub's own interface.
- **An issue's later comments never reach the board on their own**: importing the same issue
  again is how new material gets in, and it updates the card already linked to that issue
  rather than adding a second one. The cost is that a maintainer has to notice the discussion
  moved on.
- **The issue thread is what the board remembers**: a rejected card leaves no file behind and
  an archived one leaves a checkout nobody else has, so the comments already on the issue are
  what tell a later import that this issue was taken up, shipped or turned down. The cost is
  that an issue whose comments were deleted looks new again.
- **A comment GitHub refuses never holds up the board**: archiving or rejecting a card
  finishes either way, and the run says which comment did not go out. The cost is that an
  author can be left without the last word, because nothing retries it later.

## By `technology-selection` agent

### Reaching the GitHub Issues API

| Option | What it is | Pros | Cons |
| --- | --- | --- | --- |
| `gh api` | GitHub's own CLI, v2.98.0 (2026-08-20), MIT, spawned as a child process | Hosts, retries and pagination already solved; nothing added to the bundle | A second install for anyone without it; a machine's `gh` can be years behind (this one is 2.20.2, 2022); every call becomes argv-building and stdout-parsing |
| `@octokit/rest` | GitHub's official JavaScript client, 22.0.1, MIT, four direct dependencies, `engines: node >= 20` | Typed endpoint methods, retry and throttle plugins | The first runtime dependency in a package that ships none, in a single dependency-free bundle; raises `akb`'s floor from Node 18 to Node 20 |
| `fetch` against the REST API | Node's built-in `fetch`, already available at the `node18` target the bundle builds for | No install, no bundle growth, no Node floor to raise; the card needs three endpoints | We write the retry, rate-limit and error wording ourselves |

**Pick: `fetch`** — three REST calls do not earn a dependency that forces Node 20 or a binary a member may not have.

### Where the member's token comes from

| Option | What it is | Pros | Cons |
| --- | --- | --- | --- |
| `gh auth token` | Reads the token out of an already-authenticated `gh`, one spawn per import (subcommand present since gh 2.17) | Nothing to set up on a maintainer machine that already has `gh`; `gh auth login` already handles a browserless machine with a device code | Nothing for a member without `gh`, who then installs a whole CLI to hand over one string |
| `GH_TOKEN` / `GITHUB_TOKEN` in the environment | A personal access token the member creates, the variable `gh` and Actions already read | Works on any machine with or without a browser; nothing to install and no account for us to run | The member creates, scopes and rotates the token by hand, and a long-lived `repo` token sits in a shell profile |
| An AI4Kanban OAuth app's device flow | `POST /login/device/code`, then poll for the token with our client ID and no client secret | One `akb` command signs a machine in; the code is typed on any device, so a browserless machine is fine; the token stays on the machine, never at a service (#311) | An OAuth app we register, publish a client ID for and keep alive; our name on every member's consent screen |

**Pick: `gh auth token`, falling back to `GH_TOKEN` / `GITHUB_TOKEN`** — between them every machine is covered with no account of ours to run, and the fallback is what the missing-credential message tells someone to set.


<!-- agent -->

## Today
- Nothing in `akb` reaches GitHub. The word appears only in sign-in wording in
  `cli/src/guide/{setup,add-task,resolve}.md`; there is no API call and no credential. `cli/`
  ships no runtime dependency at all — one esbuild bundle built for Node 18 — so `fetch` is
  already there and a client library would be the first dependency the command carries.
- `akb create "..."` runs `akb guide add-task`, whose router already sends a complaint or a
  write-up to `akb guide extract-ideas`. That flow already validates a source against the goal
  and module memory, already requires a `## Source` line carrying a URL, and already creates
  with `--proposed`. It has no way to be handed an issue.
- extract-ideas answers a source with `add`, `update #<id>`, or `skip`, so one issue may
  produce a new card, a change to a card that already covers it, or nothing at all.
- The app's Create task box starts the same request as `akb create`: the words the user typed
  become the run's description, and nothing else travels with it.
- `docs/kanban/.sessions/` is out of git and already holds a run's own material — the plan it
  was started with, the asks it raised — beside its log, named by session id. The 30 newest
  logs are kept, and what sits beside a pruned log goes with it.
- `akb board archive <id>` moves the card into `docs/kanban/.archive/` and `akb board reject
  <id>` deletes the file. Both print the whole card first, and neither reaches the network.
- #312 shipped the operation contract, so every board write already goes through one provider
  and nothing here has to know whether the board is Local or Cloud.
- #250 would put a brief step in front of loose material, and #252 plans the same "hand the run
  a path, never the text" rule for an attached file. Neither has a release and both have open
  `[user]` questions, so this card uses the router as it stands and builds that path itself.

## Scope
- A GitHub issue URL handed to the board's task intake imports that issue: `akb create <url>`
  and the app's Create task box both accept one. Words typed alongside the URL still travel as
  the request.
- The import fetches the issue's title, body and comments into the run's own folder in
  `docs/kanban/.sessions/` and hands the run that path. The text never travels inside the words
  a run is started with, never lands in git, and goes when the run's log goes.
- The material goes to `akb guide extract-ideas`, which decides as it does for any source: a
  new card, an update to a card that already covers it, or nothing.
- Every card the import writes or updates names the issue's canonical URL —
  `https://github.com/<owner>/<repo>/issues/<n>` — in `## Source`, whatever form was pasted.
- The board is authoritative. Nothing GitHub says overwrites a card, and a later comment or
  edit reaches the board only through another import.
- An import first looks for an open card whose `## Source` carries that URL, and hands
  extract-ideas that card to update rather than a blank slate.
- An import whose issue already carries the board's shipped or turned-down comment stops there
  and says which it was. It writes no second card.
- Three moments post one comment each, on every GitHub issue the card's `## Source` names: the
  import's outcome when it wrote or updated a card, the card being archived, and the card being
  rejected.
- A comment says what happened in plain words someone who has never seen the board can read,
  names the card, and carries a marker that identifies the card and which of the three moments
  it is.
- Posting reads the issue's comments first and skips a marker already there, so a repeated
  import or a repeated move posts nothing twice.
- The comment is written from the card while the card is still readable — reject deletes the
  file, so the URLs come out of it before the card leaves the board.
- A board move never waits on GitHub: archiving or rejecting finishes when the comment cannot
  be posted, and the run says which comment did not go out.
- GitHub is reached with the member's own credentials on their own machine. No workspace and
  no service holds a token that can read or write a repository (#311), and the repository grant
  is never the Cloud sign-in token #323 issues.
- A missing credential, an issue that cannot be read, and a refused comment each say what to do
  about it, and a missing credential names what to set up.
- Nothing carries a board-specific path: a card reaches Local or Cloud through #312's operation
  contract.
- Out: labels, closing or reopening an issue, pull requests, and other trackers such as Linear.
- Out: importing a whole issue tracker, and pushing cards to GitHub as new issues.

## Todo
- [ ] Fetch a named GitHub issue with the member's own credentials into the run's folder, and
      hand the run that path.
- [ ] Route a GitHub issue URL from `akb create` and the app's Create task box to
      extract-ideas with that file.
- [ ] Record the issue's canonical URL in `## Source` on every card an import writes or
      updates.
- [ ] Point a repeat import at the open card that already names the issue, so it updates that
      card instead of writing a second one.
- [ ] Stop an import whose issue already carries the board's shipped or turned-down comment,
      and say which it was.
- [ ] Post the import's outcome back to the issue as one comment, carrying the card's marker.
- [ ] Post one comment when a card from an issue is archived, and one when it is rejected,
      reading the card's `## Source` before the card leaves the board.
- [ ] Skip a comment whose marker is already on the issue.
- [ ] Let a board move finish when GitHub refuses, and say which comment did not go out.
- [ ] Say what to do when the credentials are missing, the issue cannot be read, or GitHub
      refuses the comment.

## Decided by the agent
- **Why extract-ideas rather than a new import flow**: an issue is a complaint or a write-up,
  which the router already sends there. That flow validates against the goal and module
  memory, requires a `## Source` URL, and marks the card as proposed — a separate importer
  would be a second, thinner reading of the same material.
- **The issue URL is the stable link**: it sits on the card in `## Source`, so nothing is added
  to a card's frontmatter and the link survives an export, an import into Cloud, and a card
  moving between tracks.
- **Why a marker on the comment rather than a record on the board**: the two cases that need
  remembering are a card that was rejected, which leaves no file, and a card archived on
  someone else's checkout. Neither is on the board a later import reads; both are on the issue.
- **Where the fetched issue lives**: beside the run's log in `docs/kanban/.sessions/`, pruned
  with it — the rule #250's group sets for material a user hands the board, so an issue and an
  attached file do not end up with two conventions.
- **Nothing is posted when an issue produces no card**: whoever ran the import already sees
  that outcome, and announcing "we did not take this" on someone's issue is a maintainer's
  call to make in their own words.
- **Why no confirmation step before a comment goes out**: importing the issue is the deliberate
  act, and archiving and rejecting run as background flows with nobody watching. The run's log
  says what was posted.
- **Why GitHub Issues is intake and never a second board**: two writable copies needs two-way
  sync and a conflict story, which `memory/skill/rejected.md` already turned down.
- **Why this card stands alone**: #312 shipped the operation contract, so an import writes to
  whichever board a checkout points at without any Cloud code. Nothing in #311 reads or writes
  what this card builds, and a team shares a board without it — so it is built and checked
  against a Local board, and #316's own checks cover the Cloud side.
- **Why this card does not wait for #250**: #250's group carries no release and still has open
  `[user]` questions. This card brings an issue into the intake flow the board has today; if
  #250 lands later, an issue's text is material its brief step reads like any other.

## Source
- `docs/kanban/memory/goal.md` — "外部系统接入（近期）：从Obsidian、Notion、GitHub Issues等导入需求
  或镜像进展；它们不是AI4Kanban的权威存储", and "GitHub Issues、Linear等继续作为社区反馈入口和进展镜像;
  外部评论只作为建议导入，不能直接覆盖看板".
- #311 — the group's rule that Cloud never holds a credential that can reach a repository, and
  its decision that this card's repository grant is never the sign-in token #323 registers.
