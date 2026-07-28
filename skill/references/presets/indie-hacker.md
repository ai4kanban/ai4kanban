# Preset: indie-hacker

For a solo or small-team product you're trying to launch and grow. Replaces the default
tracks with a growth-weighted three-track model, and adds two review gates (moat, trust)
plus a market-validation method.

To use this preset, set `PRESET: indie-hacker` in `docs/kanban/config.md` and copy the
three track values below into the `TRACKS` field.

## The three tracks

- **growth (50%)** — get in front of users: SEO posts, outreach DMs, posts on
  X / Reddit / LinkedIn / 小红书, YouTube, Product Hunt, G2. Suggest growth methods worth
  trying. If you keep a content pipeline, draft a writer-ready plan first.
- **validation (30%)** — check the market wants a feature before building deep. Use it for
  roadmap features not built yet, and for built features uncommon in the market. Method:
  post an honest, unbiased question on Reddit / X, or share a free trial on a
  build-in-public community. To run a Reddit validation, follow
  `references/presets/validate-on-reddit.md`. Save results to `docs/validations/<name>.md`
  (or wherever you keep them). Skip subjective tests ("ask your mom").
- **building (20%)** — stay at MVP; don't over-build. Build when it: scales internal work
  an agent can own, strengthens product positioning, or is strongly demanded by users.
  Building is the trust load-bearer — without it you can't convert, so building blockers
  gate the launch.
