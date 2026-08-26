---
title: Identify the user who sends and acts on Cloud events
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [325]
modules: [cloud, local-ui]
questions: []
---

Give the Cloud relay a stable user identity so it can separate one person's events, actions,
and execution nodes from another's. Without authentication, any caller could read or act on
another user's task notification.

## Worth noting
- **Authentication is not team membership**: 0.8.0 needs one account boundary per user, not
  workspaces, invitations, roles, or shared-board permissions.
- **Use a maintained auth system**: the service should rely on an established authentication
  layer, such as Better Auth, rather than owning passwords or session security itself.

<!-- agent -->

## Scope
- Let a user sign in and out through the desktop app.
- Let the local execution node use the same account without putting credentials in the board
  or repository.
- Scope every event, action, connector, and execution node to the authenticated user.
- Reject missing, expired, or mismatched identity before returning event content or changing
  an action.
- Keep sessions usable across normal desktop restarts and refresh them without interrupting
  a delivery already running.
- Give #320 a trusted way to associate a Slack action with the same AI4Kanban user.
- Keep team membership, roles, invitations, and shared workspaces out of this task.

## Todo
- [ ] Add one maintained sign-in flow to the Cloud service and desktop app.
- [ ] Share the signed-in account with the local execution node without storing it in git.
- [ ] Isolate events, actions, connectors, and nodes by authenticated user.
- [ ] Reject unauthenticated and cross-user requests.
- [ ] Keep sessions working across restarts and ordinary expiry.
- [ ] Expose the authenticated identity needed to link a Slack actor in #320.
