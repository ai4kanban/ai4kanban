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

## Scope
- Notifications are off until the user enables them and chooses exactly one open release.
- Notify only when a card is ready for review or has user-owned questions.
- Build one durable event and one portable Markdown message per qualifying state change.
- Include the card number, title, release, human half, action, and only user-owned questions.
- Preserve question options and recommendations without exposing internal ownership tags.
- Deduplicate unchanged state and notify again after meaningful changes or re-entry.
- Create events for UI, CLI, and agent changes without blocking the board mutation.
- Add a header bell, unread count, durable newest-first list, and clear empty and disabled states.
- Review opens the card; Resolve opens its existing flow; neither action changes card state by itself.

## Todo
- [ ] Add the two event rules, release filter, portable content, and durable deduplication.
- [ ] Add explicit enablement and one required open-release choice.
- [ ] Add the notification center, unread state, history, and empty states.
- [ ] Open review and Resolve from their notifications.
- [ ] Pause and ask for a new release when the selected release closes.
- [ ] Check events from the app, CLI, and agent flows appear once.
