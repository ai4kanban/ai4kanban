---
title: Stand up the service every Cloud workspace runs on
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [311]
modules: [cloud]
questions: []
---

Cloud has a full design and nowhere to run it. Every card from #314 on assumes an API on a
host, a database with a schema, and a GitHub app to sign in against — and no card creates
any of them, so the first Cloud build would have to invent its own environment and the next
one would inherit it undocumented. Stand that service up on the account and the plans #311
settled, before the cards that write against it start.

<!-- agent -->

## Today
- No Cloud code and no Cloud infrastructure exists. `cloud` is a line in `modules.md`.
- The project already deploys `web/` to Cloudflare Pages with `wrangler`, and #294 stands up
  a telemetry Worker at `t.ai4kanban.dev` on that same account — the pattern this follows.
- #311 settled the platform, the host name, the store, and the plans; nothing has acted on it.

## Scope
- The API answers at `api.ai4kanban.dev`, never a `workers.dev` address, leaving
  `cloud.ai4kanban.dev` free for #322.
- One Supabase project holds Cloud's board, separate from anything else the project runs.
- The Worker reaches Postgres over HTTPS through PostgREST, so a mutation is one function
  call that runs its whole check-apply-audit sequence in one transaction (#311).
- The schema ships as versioned migrations applied by command, so a later card adds a table
  without a hand edit against the live preview.
- One scheduled Worker run serves the whole service; #314's keep-awake query and #320's
  Slack retry hang off it rather than each adding a schedule of its own.
- A GitHub app registered against that host asks for identity scopes only, so a sign-in
  token cannot read a repository even if everything else is wrong (#311).
- Secrets live in the Worker's secret store and never in git.
- Deploy and roll back with one command run from this repository, the way the site deploys.
- Stay inside the free plans: past the day's request allowance the Worker refuses the write
  with a reason a client can show, rather than spending into a bill (#311, #316).
- One project, not a staging copy beside it: our own testing runs in throwaway workspaces,
  because a workspace is already Cloud's isolation unit.
- Out of scope: membership, roles, leases, audit events, and every other board rule — those
  are #314's, written against what this card stands up.

## Todo
- [ ] Create the Supabase project and hold its connection details as Worker secrets.
- [ ] Add the versioned migration path and apply the first schema through it.
- [ ] Deploy a Worker answering at `api.ai4kanban.dev`, with one command to deploy and one
      to roll back.
- [ ] Register the GitHub app against that host with identity scopes only, and check a
      sign-in token cannot read a repository.
- [ ] Add the scheduled run the later cards hang their work off.
- [ ] Refuse a write past the day's allowance with a reason, and check no path can bill.

## Decided by the agent
- **Why one Supabase project and no staging copy**: the free tier allows two active projects
  per organization, so a staging project takes the last slot and doubles what has to be kept
  awake. #294 runs two copies because its events all land in one table; a Cloud workspace is
  already an isolation boundary, so our own testing gets a workspace instead of a project.

## Source
- #311 — the platform, host, store, plans, and free-tier behaviour this card acts on.
- #294 — the telemetry Worker on the same Cloudflare account, and its deploy pattern.
