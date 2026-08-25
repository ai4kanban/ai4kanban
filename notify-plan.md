# Notification center and IM delivery

Build notifications once, show them first in the AI4Kanban UI, then deliver the same
notifications to Slack and other IM tools.

## Scope

Only two events need human attention:

1. **Ready for review** — a buildable task reaches `status: ready`. The user reviews the
   task and, once satisfied, chooses **Implement**. The existing #300 flow then builds,
   reviews, corrects, and lands the work on the target branch.
2. **Questions need answers** — a task has one or more questions explicitly assigned to
   the user. The notification shows the human-readable part of the task and those questions,
   then leads into the existing **Resolve** flow.

Do not notify for progress, completion, delivery failures, hand checks, ordinary edits, or
agent-owned questions. If a delivery failure genuinely needs a decision, it should raise a
user question and use the second event.

## Configuration

- Notifications are off by default.
- The user must enable them manually and choose one open release.
- The initial release choice is the current release: the first open release in ship order.
  This keeps notifications focused on the nearest short-term goal.
- The first destination is **Notification center**. It mainly proves that an event fired and
  rendered correctly.
- If the configured release closes, pause notifications and ask the user to choose another
  release. Do not silently switch releases.
- Tasks outside the configured release, including tasks with no release, never notify.

## Notification content

Every notification uses one clean, portable Markdown message so future IM destinations do
not need their own content rules.

Include:

- task number and title;
- release;
- the human half of the task—the content above `<!-- agent -->`;
- the action the user should take.

For question notifications, include only user-owned questions. Preserve question options
and clearly identify recommendations, but do not expose internal tags such as `[user]`.

Keep messages to simple headings, paragraphs, emphasis, and lists. Do not use tables, HTML,
filesystem links, or destination-specific formatting.

### Ready example

```md
## #300 Build, review and land an approved card from one click

**Release:** 0.8.0

<human half of the task>

Review this task. If it is approved, open the task and choose **Implement**.
```

### Questions example

```md
## #123 Pick the import behavior

**Release:** 0.8.0

<human half of the task>

### Questions

1. Which source should win on a conflict?
   - Local board — recommended
   - Imported issue

Open **Resolve** to answer these questions.
```

## Event behavior

- Events are created by board state changes, regardless of whether the change came from the
  UI, CLI, or an agent flow.
- A qualifying state produces one notification, not one per destination.
- Re-reading unchanged state does not create duplicates.
- If the meaningful human content or user questions change while attention is still needed,
  create a new notification.
- If a task leaves and later re-enters a qualifying state, notify again.
- Enabling notifications or changing the selected release should surface currently
  qualifying tasks in that release once.
- Delivery to one destination may fail or retry without duplicating the underlying event or
  blocking the task change that caused it.

## Notification center

Add a bell to the shared header on both board and task pages.

- Show an unread count when it is greater than zero.
- Open a simple newest-first notification list.
- Use mint for ready reviews and peach for open questions, following the existing design
  language.
- Render the same Markdown that future IM tools receive.
- Keep read notifications in the list so the center remains useful for verifying events.
- **Review task** opens the task page. It must not start implementation automatically—the
  task itself is what the user is reviewing.
- **Resolve questions** opens the task page directly in its existing Resolve flow. If the
  questions have already gone, show the normal task page and do nothing.
- When notifications are disabled, explain that they are off and link to their configuration.
- When enabled but empty, name the selected release and say that no relevant events have
  fired yet.

The center is a local delivery destination, not another source of task state or a separate
team inbox.

## Delivery plan

1. **Notification primitive** — establish the two event rules, release filtering, portable
   Markdown content, deduplication, and durable history.
2. **Configuration** — add explicit enablement, required release selection, and the
   Notification center destination.
3. **Notification center** — add the bell, unread state, notification list, and empty/error
   states.
4. **Actions** — connect ready notifications to task review and question notifications to
   the existing Resolve flow.
5. **Slack** — add Slack as another destination after the center proves that event creation,
   content, and actions are correct.

## Slack follow-up

Slack must consume the same events and Markdown rather than introduce new notification
rules.

- Slack is delivery, not storage or task authority.
- A review action opens the task for sign-off.
- A resolve action enters the same authenticated Resolve flow and attributes the answer to
  the responder.
- Delivery failures retry independently and never create duplicate events.
- Credentials and connection setup belong to the Slack integration, not the notification
  content model.

## Acceptance criteria

- A fresh board sends nothing.
- A user can enable notifications for exactly one open release.
- Only ready reviews and user-owned questions notify.
- No task outside the selected release notifies.
- Each event contains clean Markdown with the task's human half.
- Unchanged state does not produce duplicates.
- Events created by CLI and agent activity appear in the UI center.
- Review leaves implementation to #300's existing **Implement** flow.
- Questions enter the existing **Resolve** flow.
- Adding Slack later does not change event eligibility or message construction.
