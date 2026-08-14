# Document a change

A shipped change nobody can find is a change that doesn't exist. So every card that ships
something a user can **see or do** carries todos to update the docs it touches, and it
isn't done until they're written. Pick the surfaces the change actually touches — most
touch one, some touch none. If it touches none, say why on the card.

Write each doc update as its own todo, so it's checked off before the card is archived.

## Surfaces

Map the change to the reference docs your project keeps (see the skill's Configuration).
Common surfaces — use the ones you have:

- **User-facing docs / guides** — how a user does the thing. Add or update a guide when
  the change gives the user a **new action, setting, or step**. Without this the user
  never learns the capability is there. This is the default surface: most user-visible
  changes need it.
- **Landing / marketing copy** — what a **prospect is shown or promised**. Update it when
  the change adds a capability worth advertising, a new surface, or a headline claim.
  Write the change **into the doc only** — don't touch the landing page code unless the
  card says to. The user reviews the doc first, then decides whether to ship it.
- **Pricing / plans / limits** — update when the change **moves what a tier offers** — a
  new limit, a feature moved between tiers, a new plan, or any price change. Keep the doc
  in sync with what the code actually enforces.
- **Roadmap / direction** — update only for a **direction-level shift** (positioning, the
  core layers, monetization). A normal change does not belong here; reach for it only when
  the direction itself moves.

If your project keeps none of these docs, this step is a no-op — note that on the card and
move on.
