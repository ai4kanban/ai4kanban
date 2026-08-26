---
title: Harden the Cloud event flow before the first invite
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: [320]
related: [325]
modules: [cloud, local-ui, skill]
schedule:
  action: refine
questions: []
---

Put the assembled #325 flow through the failures it will actually meet — a closed app, a
killed server, a duplicate click, an expired sign-in — and fix what breaks. Each of #318, #319,
#320 and #326 checks its own piece against a working system; nobody yet checks what happens
when two pieces fail at once, and the preview opens to real people the moment they land.

## Worth noting
- **This is a card, not a checklist at the end of #320**: the failures worth finding cross
  card boundaries, so a check owned by whichever card ships last would be written by someone
  looking at one piece. The cost is one more card in 0.8.0.
- **Free-tier headroom is a release gate, not a nice-to-have**: Supabase pauses a free project
  and the Worker holds one write budget for the whole service, so a preview that invites more
  people than the tier carries fails for everyone at once. The cost is measuring before we
  know how many accounts there will be.

<!-- agent -->

## Scope
- Check a local board change made while Cloud is unreachable: it succeeds, and it publishes
  when Cloud returns.
- Check a desktop restart with an event, an answer, and a finished delivery that all landed
  while the app was closed.
- Check a reconnect that missed broadcasts, and one that received the same broadcast twice.
- Check the same button pressed twice, in the desktop inbox and in Slack, and a Slack callback
  replayed.
- Check a task edited, resolved, or moved after its message was created: the action is refused
  and the local task is unchanged.
- Check an expired sign-in mid-delivery, a signed-out machine, and a disabled server.
- Check a Slack delivery that failed and retried, and a Slack actor who is not linked.
- Check a server killed mid-delivery: exactly one interrupted request, resumable or cancellable
  as that delivery.
- Check that a second account reaches nothing belonging to the first, over every #325 route.
- Check that Cloud holds only the event snapshot and its decisions — no repository content,
  paths, credentials, branches, or worktrees.
- Measure a week of preview use against the Supabase free tier and the Worker's daily write
  budget, and say in `cloud/README.md` how many accounts the tier carries.
- Fix what these turn up in the card that owns it, and record anything left as a known limit.

## Todo
- [ ] Check offline publication and its catch-up when Cloud returns.
- [ ] Check a restart across an event, an answer, and a finished delivery.
- [ ] Check reconnect catch-up with missed and with duplicated broadcasts.
- [ ] Check duplicate clicks and a replayed Slack callback.
- [ ] Check a stale revision and a task that left its actionable state.
- [ ] Check an expired session, a signed-out machine, and a disabled server.
- [ ] Check a failed Slack delivery retried, and an unlinked Slack actor.
- [ ] Check a server killed mid-delivery, and resuming and cancelling what it left.
- [ ] Check account isolation across every #325 route.
- [ ] Check that Cloud holds no repository content, path, or credential.
- [ ] Measure free-tier and write-budget usage, and write the account ceiling into
      `cloud/README.md`.
- [ ] Fix what these find, and record what is left as a known limit.

## Source
- `notify-plan.md`, "Hardening" — the list this card's Scope comes from.
- #318, #319, #320, #326 — the pieces this checks together, and where a fix lands.
- #323 — the Worker's daily write budget and the hourly run that keeps Supabase awake.
