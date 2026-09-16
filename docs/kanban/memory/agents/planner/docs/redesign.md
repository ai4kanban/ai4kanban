# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Guides

- ❌ **A guide card that teaches "do it in the app" without checking the app can** → ✅ Walk
  the screens first. A step with no button makes the card a build card, and the docs pass
  waits on it.
- ❌ **Teaching a provider route by bolting a base URL onto another agent's connector** → ✅ Name
  the agent we ship for that provider. A gateway that happens to reach the models is not a
  route we document.
