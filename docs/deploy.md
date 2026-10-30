# Deploy

How each WildCrane component goes live, and how far each one can go back.

| Component | Where it runs | How it ships |
| --- | --- | --- |
| Cloud | Worker `api.ai4kanban.dev` + Supabase | `cloud/`: `npm run migrate`, `npm run deploy` |
| Web | Pages `wildcrane-app` → `app.wildcrane.ai` | `wrangler pages deploy` |
| Review | Pages `wildcrane-review` → `review.wildcrane.ai` | `wrangler pages deploy` |
| Runner | npm `wildcrane-runner` | `npm publish`, then `npm run runner-release` |
| Plugins | GitHub release `plugin-v*` | tag → `.github/workflows/plugin-release.yml` |
| Desktop | GitHub release `desktop-v*` | tag → `.github/workflows/desktop-release.yml` |
| artifact-sdk | npm `wildcrane-artifact-sdk` | tag → `.github/workflows/artifact-sdk-release.yml` |

## Order

1. **Staging, then production**: Cloud and Web go to staging first; production only once
   staging passes.
2. **Migrations before the Worker**: the Worker always finds the tables it expects. Every
   migration must keep the deployed Worker working; if it cannot, ship it in two deploys.
3. **Cloud before Web and Review**: both sites call the Worker's `/v1` API.
4. **Runner before `RUNNER_MIN_PROTOCOL`**: raise it in `cloud/src/config.ts` only after the
   new Runner is `stable` and the plugin is released, or older Runners are refused.

## Before you start

- **Clean copy**: deploy from `git worktree add --detach <dir> <commit>`, with `cloud/.env` and
  `cloud/.env.staging` copied in; remove both once done. Not `git archive`: `npm run deploy`
  stamps the Worker with the git commit.
- **Dependencies**: `NODE_ENV= npm ci` in each app, so devDependencies (wrangler, vite) install.
- **Network**: Node scripts that reach `workers.dev` need `NODE_USE_ENV_PROXY=1`. If wrangler's
  OAuth has expired, run `npx wrangler whoami` with the proxy set to refresh it.

## Cloud

From `cloud/`. Every command takes `-- --env staging`, which reads `cloud/.env.staging` alone.
Staging is described in `cloud/README.md#staging`.

1. **Staging**: `npm run migrate -- --env staging`, then `npm run deploy -- --env staging`.
2. **Verify staging**: `npm run check:live -- --env staging` reports `up to date` and
   `npm run check:closed -- --env staging` passes. Then sign in on the staging Web app and
   walk the flow the change touches.
3. **Back up production**: see [Rollback](#rollback).
4. **Production**: `npm run migrate -- --dry-run` lists only the expected new migrations; then
   `npm run migrate` and `npm run deploy`.
5. **Verify production**: `npm run check:live` reports `up to date`;
   `curl https://api.ai4kanban.dev/health` answers 200; `POST /v1/self-check` passes with an
   admitted account's token. `not_admitted` means the account is not on the list, not a failed
   deploy. A throwaway account admitted for this is removed afterwards with
   `cloud.remove_account`.

## Web

From `web/`. `public/_redirects` is the SPA fallback.

1. **Staging**: build with `VITE_API_URL` (the staging Worker), `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from `cloud/.env.staging`, then
   `wrangler pages deploy dist --project-name wildcrane-app --branch staging`. It serves
   `https://staging.wildcrane-app.pages.dev`.
2. **Verify staging**: sign in, open a project's board and a card, and walk what the change
   touches.
3. **Production**: a plain `npm run build`, then
   `wrangler pages deploy dist --project-name wildcrane-app --branch main --commit-hash <commit>`.
   Always pass `--branch main`: from a detached checkout wrangler otherwise lands a Preview.
4. **Verify production**: the entry JS named in `https://app.wildcrane.ai/` matches
   `dist/index.html`.

## Review

From `review/`. No staging; it is deployed by hand only, so it lags main until someone does.

1. **Production**: `npm run build`, then
   `wrangler pages deploy dist --project-name wildcrane-review --branch main`.
2. **Verify**: the entry JS named in `https://review.wildcrane.ai/` matches `dist/index.html`.

## Runner

The `runner-v*` workflow and `runner/scripts/publish.mjs` expect npm trusted publishing, which
is not set up, so publish by hand.

1. **Publish**: in `runner/`, raise `version`, `npm run build`, then
   `npm publish --provenance=false` with an npm token. Publishing makes the version
   installable, not used.
2. **Candidate**: in `cloud/`, `npm run runner-release candidate <version> <percent>` sends that
   share of machines to it on their next start.
3. **Stable**: `npm run runner-release stable <version>`. `npm run runner-release` alone shows
   what is set.
4. **Protocol**: only now, and after a plugin release, raise `RUNNER_MIN_PROTOCOL` and deploy
   Cloud.

## Plugins, desktop, artifact-sdk

Each one ships by pushing a tag that matches its version; the workflow refuses a mismatch.

- **Plugins**: raise the version in `plugins/claude-code/.claude-plugin/plugin.json` and
  `plugins/codex/plugin.json` together, push `plugin-v<version>`. Then put the release's versioned zip URL and the sha256 the workflow
  printed into `.claude-plugin/marketplace.json` and commit it.
- **Desktop**: raise `runner/desktop/package.json`'s version, push `desktop-v<version>`. The
  release carries the updater's `latest.json`; installed apps update on restart.
- **artifact-sdk**: raise `artifact-sdk/package.json`'s version, push `artifact-sdk-v<version>`.
  This workflow also needs npm trusted publishing, so it cannot publish until that is set up.

## Rollback

| Component | Goes back to |
| --- | --- |
| Cloud Worker | an earlier version: `npm run rollback` in `cloud/` |
| Cloud schema | **nothing**: migrations are forward only; fix forward with a new migration |
| Web, Review | an earlier deployment: roll back in the Pages project's Deployments |
| Runner | `npm run runner-release rollback` (candidate to 0%) or `stable <older version>` |
| Plugins | point `.claude-plugin/marketplace.json` back at the earlier release |
| Desktop, artifact-sdk | nothing; release a higher version |

**Production Supabase has no backups and no point-in-time recovery.** Before every production
migration, export each `cloud` table as JSON through the Supabase Management API
(`POST /v1/projects/<ref>/database/query`, with `SUPABASE_ACCESS_TOKEN`), and keep it outside the
repository.
