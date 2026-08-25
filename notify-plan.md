# Notification center and IM delivery

Build one notification primitive in the board rules, show it first in the local UI, and
add Slack later as another destination. The notification center is deliberately plain: its
main job in the first release is to prove that the right domain event fired with the right
payload.

## Product boundary

- **Off by default**: a board with no `notifications` block in
  `docs/kanban/ui.config.json` emits and delivers nothing.
- **One required release**: enabling notifications writes an explicit open release into
  the configuration. The UI initially selects the current release: the first open release
  in `releases.md` ship order. This is the nearest short-term goal; do not infer a release
  from semantic-version sorting.
- **One destination for v1**: enabling notifications selects `center`. Keep destinations
  as a list so `slack` can join without changing the event contract.
- **Only two events**: a buildable card becomes ready for review, or a card has one or more
  `[user]` questions. Untagged questions still belong to the agent/refine loop and must not
  notify a person.
- **Release filter at emission**: only cards whose `release` exactly matches the configured
  release may produce an event. A card in no release never notifies.
- **Actions stay on the card**: a ready notification opens the card for review; after
  sign-off, the existing **Implement** action starts #300's delivery and landing flow. A
  question notification opens the existing **Resolve** flow. Notifications do not create a
  second implementation or resolution path.
- **No other attention signals**: do not notify for hand checks, delivery progress,
  completion, failure, archive, release changes, or ordinary card edits. A delivery that
  genuinely needs a decision already expresses it as a `[user]` open question and therefore
  uses the question event.

## Configuration

Use the existing tracked `ui.config.json`, preserving unknown keys as its current writers
do:

```json
{
  "notifications": {
    "release": "0.8.0",
    "destinations": ["center"]
  }
}
```

- Missing `notifications` means disabled. Disabling deletes the block.
- `release` must name an entry currently present in `releases.md`; saving an empty, unknown,
  or closed release is refused.
- `destinations` must contain at least one known destination. For the first release the only
  accepted value is `center`.
- When notifications are enabled for the first time, preselect the first release in ship
  order and `center`, but write nothing until the user saves. If there is no open release,
  explain that one must be created before notifications can be enabled.
- A configured release that is later closed leaves notifications visibly paused with a
  configuration warning. Do not silently move the user to another release.

Add a **Notifications** pane to `components/Configuration.tsx` with an enable switch, one
release select, and a destination row. The copy should say that the center is a local event
preview and that only ready reviews and user-owned questions are sent.

## Event contract

Define the portable shape in `cli/src/lib/view/types.ts` and sync it into the UI:

```ts
type NotificationKind = "ready-review" | "open-questions";
type NotificationAction = "review" | "resolve";

interface NotificationEvent {
  id: string;
  kind: NotificationKind;
  createdAt: number;
  cardId: number;
  cardTitle: string;
  release: string;
  markdown: string;
  action: NotificationAction;
  readAt?: number;
}
```

`markdown` is the canonical destination-neutral message. Keep it to headings, paragraphs,
bold text, numbered lists, and bullet lists: no HTML, tables, product-specific blocks,
filesystem links, or embedded buttons. The structured fields carry routing and actions;
each destination decides how to turn `action` into a link or button.

Both messages include the card number, title, release, and only the human half of the card
body (everything above `<!-- agent -->`). Move the existing split rule from the UI-only
`lib/agent-half.ts` into the shared board rules so the card page and notification renderer
cannot disagree.

The ready message ends with a short instruction to review the card and choose **Implement**
when it is approved. The questions message adds only the `[user]` questions under a
`Questions` heading. Preserve option order, mark recommended options in words, and never
include the `[user]` storage tag in rendered text.

Example ready message:

```md
## #300 Build, review and land an approved card from one click

**Release:** 0.8.0

<human half of the card>

Review this task. If it is approved, open the card and choose **Implement**.
```

Example question message:

```md
## #123 Pick the import behavior

**Release:** 0.8.0

<human half of the card>

### Questions

1. Which source should win on a conflict?
   - Local board — recommended
   - Imported issue

Open **Resolve** to answer these questions.
```

## Emission and persistence

Add `cli/src/lib/notifications.ts` as the only place that decides eligibility, renders a
message, deduplicates it, and writes notification state.

- **Ready signal**: emit when a card in the configured release has `status: ready` and
  `canImplement(card)` is true.
- **Question signal**: emit when a card in the configured release has at least one question
  whose parsed tag is `user`. Render only those user-owned questions.
- **Semantic transition**: keep the currently active fingerprint for each
  `cardId + kind`. Emit when the signal becomes active, or when its meaningful payload
  changes while active. Clear the active fingerprint when the signal stops applying, so a
  later re-entry emits again.
- **Fingerprint inputs**: kind, card id, release, title, human half, and—for question
  events—the rendered user-owned questions. Agent-half edits and untagged-question edits do
  not create human notifications.
- **Configuration change**: saving or changing notification settings immediately reconciles
  the newly selected release. Existing actionable cards in that release therefore appear
  once; the fingerprint prevents a historical flood on later reads.
- **Mutation boundary**: after every successful board write, while the board lock is still
  held, reconcile notification candidates. This covers CLI commands, agent flows, and UI
  actions through the same path. A notification-store failure warns but never rolls back a
  successful card mutation; because the fingerprint was not saved, the next reconciliation
  retries it.

Persist local delivery state in an ignored `docs/kanban/.notifications.json`, written by
temp-file rename under its own notification lock. Add both paths to the board's generated
`.gitignore` and migration/update behavior. Store a schema version, active fingerprints,
the latest 100 events, read timestamps, and per-destination delivery receipts. The receipts
are unused beyond `center` in v1, but let Slack retry independently without duplicating the
event or the center item. Pruning may remove only events every configured destination has
delivered; a pending IM delivery is never discarded to satisfy the history cap.

Expose these board-rule operations to the UI through the existing optional-version pattern:

- `notificationSettings()`
- `setNotificationSettings(settings | null)`
- `listNotifications()`
- `markNotificationsRead(ids)`

Boards running older rules should show an update message in the Notifications configuration
pane and an empty center, not fail the whole board.

## Notification center UI

Add a bell to the shared header tool cluster, before Configuration, on board and card pages.

- Show a compact unread count on the bell; omit it at zero.
- While the page is visible, poll the small notification snapshot on the same relaxed
  cadence as the session registry. This is what lets a terminal-driven card transition
  update the bell without a page reload; do not reread the whole board for the count.
- Open a `Dialog` titled **Notifications**. Read fresh events each time it opens and after
  the board/session polling reports a change.
- Render newest first. Each item uses the semantic signal color already defined by the
  design system: mint for ready review, peach for open questions. Keep the dialog itself a
  single raised surface and the list rows flat inside it.
- Render the canonical `markdown` with the existing Markdown component rather than a second
  card template.
- A ready item has a **Review task** link to `/<cardId>`. It does not open Implement
  automatically because the card content is what the user must sign off first.
- A question item has a **Resolve questions** link to
  `/<cardId>?action=resolve`. Teach the card page to consume that query once and open its
  existing Resolve dialog; invalid or already-resolved links fall back to the normal card
  page without starting anything.
- Mark the items currently shown as read after the dialog opens successfully. Keep them in
  history so the center remains useful for verifying emission.
- Empty disabled state: “Notifications are off” with a link that opens Configuration on
  the Notifications pane. Empty enabled state: name the configured release and say that no
  ready reviews or user questions have fired yet.

The center is local to this board checkout. It is not a team inbox, an authority for card
state, or a replacement for the card page.

## Slack as the next destination

After the center proves the contract, add a `slack` adapter without changing eligibility or
message construction:

1. Add Slack connection/channel fields to the Notifications pane; keep secrets in
   `docs/kanban/.env`, never `ui.config.json`.
2. Add `slack` to the configured destination list and consume pending event receipts from
   the same local outbox.
3. Convert the canonical markdown to Slack's supported subset and add one action: review
   links to the card; resolve links to the authenticated Resolve surface.
4. Record success or a retryable failure per event and destination. Retry with bounded
   backoff; never re-emit a new domain event merely because Slack delivery failed.
5. Treat Slack as delivery, not storage. Answers must return through the same authenticated
   Resolve operation and preserve attribution; Slack must never edit markdown/frontmatter
   directly.

Do not implement Slack credentials, OAuth, interactive callbacks, or remote access in the
notification-center change.

## Shipping sequence

1. **Shared model and renderer**: shared human-half split, event/config types, markdown
   renderer, fingerprints, and unit tests.
2. **Emitter and store**: configuration reader/writer, release validation, locked local
   event store, post-mutation reconciliation, ignore-file update, and board-rule exports.
3. **Configuration UI**: Notifications pane with explicit enable/save behavior, release
   picker, center destination, stale-release warning, and older-rules fallback.
4. **Center UI**: header bell, unread state, dialog list, Markdown rendering, read receipts,
   and empty/error states.
5. **Action links**: ready review navigation and one-shot `?action=resolve` integration with
   the existing Resolve dialog.
6. **Slack follow-up**: adapter and authenticated interaction only after the first five
   steps are stable.

## Verification

- CLI tests cover disabled-by-default, required/known release, default current release,
  release filtering, ready eligibility, `[user]`-only question eligibility, human-half-only
  payloads, option rendering, deduplication, payload changes, signal exit/re-entry, bounded
  history, retry after store failure, and concurrent read/mark-read safety.
- UI checks cover both event cards, long markdown, long titles, unread counts above 9,
  keyboard focus, narrow windows, reduced motion, disabled/empty/stale-release states, and a
  Resolve deep link whose question disappeared before it was opened.
- Run `cd cli && npm run lint && npm test`.
- Run `cd kanban-ui && pnpm typecheck && pnpm run lint`.
- Do not use `pnpm build` for verification in this repository.

## Done when

- A fresh board produces no notification and writes no notification state.
- A user can explicitly enable center notifications for one open release.
- The two eligible card transitions create exactly one clean, portable Markdown event each.
- Events from CLI/agent activity appear in the center without requiring the mutation to
  originate in the UI.
- Review opens the card and leaves implementation to #300's existing **Implement** action.
- Resolve opens the existing question flow, with no second answer path.
- No card outside the configured release and no third event kind can notify a user.
