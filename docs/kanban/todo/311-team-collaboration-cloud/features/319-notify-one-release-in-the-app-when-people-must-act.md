---
title: Notify one release in the app when people must act
track: features
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: [316, 318]
related: [311]
modules: [cloud, local-ui]
questions: []
---

Show people the two board events that need judgment without turning every change into noise.

## Worth noting
- **A question goes to the owners**: no card names a person in this release (#311), so a
  user-owned question is addressed to the workspace's owner role and a ready-for-review card
  to everyone watching the release. Routing a question to a named member waits for the
  version that gives a card an assignee.

## Scope
- Notifications are off until the user enables them and chooses exactly one open release.
- Notify only when a card is ready for review or has user-owned questions.
- Send a user-owned question to the workspace's owners, and a ready-for-review card to every
  member watching the release. On a Local board the one user receives both.
- Build one durable event and one portable Markdown message per qualifying state change.
- Include the card number, title, release, human half, action, and only user-owned questions.
- Preserve question options and recommendations without exposing internal ownership tags.
- Deduplicate unchanged state and notify again after meaningful changes or re-entry.
- Create events for UI, CLI, and agent changes without blocking the board mutation.
- Add a header bell, unread count, durable newest-first list, and clear empty and disabled states.
- Review opens the card; Resolve opens its existing flow; neither action changes card state by itself.

## Todo
- [ ] Add the two event rules, release filter, portable content, and durable deduplication.
- [ ] Give each event its audience — owners for a question, every subscriber for a ready
      card — and check a member watching the release sees the ready card and not the
      question.
- [ ] Add explicit enablement and one required open-release choice.
- [ ] Add the notification center, unread state, history, and empty states.
- [ ] Open review and Resolve from their notifications.
- [ ] Pause and ask for a new release when the selected release closes.
- [ ] Check events from the app, CLI, and agent flows appear once.
