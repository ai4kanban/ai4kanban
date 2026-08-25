---
title: Deliver board notifications to Slack
track: features
priority: low
roi: med
status: todo
release: 0.8.0
blocked_by: [319]
related: [311]
modules: [cloud, local-ui]
questions: []
---

Send the app's proven board notifications to Slack without adding a second set of rules.

## Worth noting
- **A Slack action opens the installed app**: Cloud has no page at a URL in this release
  (#311), so acting on a notification means the machine the app is on. The Slack message
  still carries the whole question, so it reads anywhere; answering from a phone waits for
  the browser surface in #322.

## Scope
- Consume the same durable events and portable Markdown as the notification center.
- Deliver each event to the audience it already carries, so a question reaches the owners and
  never a shared channel every member reads (#311).
- Keep Slack as a delivery destination, never task storage or authority.
- Open card review or Resolve in the installed app from each Slack action.
- Attribute an answer to the member who completes the Resolve flow.
- Retry Slack delivery independently without duplicating the underlying event.
- Keep Slack credentials and connection setup outside the notification content model.

## Todo
- [ ] Add Slack connection and destination settings.
- [ ] Deliver the existing event Markdown to Slack, to the audience the event names.
- [ ] Check a member who is not an owner receives the ready-for-review card in Slack and not
      the question.
- [ ] Give the desktop app a URL scheme, and open review and Resolve in it from a Slack
      action.
- [ ] Retry failed delivery without duplicate notifications.
- [ ] Check adding Slack changes no event eligibility or content rules.
- [ ] Check a Slack action on a machine without the app tells the reader plainly rather than
      failing silently.

## Decided by the agent
- **How Slack reaches a card**: a URL scheme the desktop app registers and answers by opening
  that card. Nothing registers one today, so this card adds it.
