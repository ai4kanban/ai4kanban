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

## Scope
- Consume the same durable events and portable Markdown as the notification center.
- Keep Slack as a delivery destination, never task storage or authority.
- Open authenticated card review or Resolve from each Slack action.
- Attribute an answer to the member who completes the Resolve flow.
- Retry Slack delivery independently without duplicating the underlying event.
- Keep Slack credentials and connection setup outside the notification content model.

## Todo
- [ ] Add Slack connection and destination settings.
- [ ] Deliver the existing event Markdown to Slack.
- [ ] Connect review and Resolve actions to authenticated Cloud pages.
- [ ] Retry failed delivery without duplicate notifications.
- [ ] Check adding Slack changes no event eligibility or content rules.
