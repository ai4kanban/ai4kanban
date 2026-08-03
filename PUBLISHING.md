# Publishing AI4Kanban

Everything ships from this one repo. Only two things need publishing — the `ai4kanban` CLI
and the `ai4kanban-ui` board UI, both on npm. The plugin and the skill ship by pushing to
GitHub; directories read the repo directly.

## What ships where

| Piece | Where it lives | How it ships |
| --- | --- | --- |
| Skill (`skill/`) + plugin/marketplace manifests | this repo | `git push` — nothing to publish |
| Setup CLI | npm `ai4kanban` | `npm publish` from `cli/` |
| Board UI | npm `ai4kanban-ui` | `npm publish` from `kanban-ui/` |
| Landing page | ai4kanban.dev (Cloudflare Pages) | optional, `env -u NODE_ENV pnpm run deploy` from `web/` when the copy changes |

The CLI carries the skill inside its tarball (`scripts/bundle-skill.mjs` copies `skill/` to
`cli/skill/` at publish time; that copy is gitignored). So `npx ai4kanban install` is what a
new user actually gets — a skill change isn't in anyone's hands until the CLI is republished.

## One version, one place

The canonical version is the root `VERSION` file.

```
node scripts/sync-version.mjs 0.4.2   # bump VERSION and stamp everywhere
node scripts/sync-version.mjs --check # verify in sync (both prepublishOnly hooks run this)
```

Stamped spots: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
`SKILL_VERSION` in `skill/kanban.mjs` (what installed projects print, so they can tell
they're behind), `cli/package.json`, `kanban-ui/package.json`. Both packages share the one
version, so publish them together.

Tag every release. `npx ai4kanban update` links `…/compare/v<old>...v<new>`, which only
resolves if the tags exist.

Never rename the plugin slug (`kanban`) or either npm package — a rename breaks everyone's
install. `kanban-skill-ui` is the retired old UI name; it's deprecated on npm and that's all.

## Release checklist

1. `claude plugin validate .` passes.
2. `node scripts/sync-version.mjs <new-version>`; commit and `git tag v<new-version>`.
3. README, `README-zh.md`, and the guides reflect any behavior change.
4. `npm publish` from `cli/` — smoke-test `npx ai4kanban@latest install` in a throwaway repo.
5. `npm publish` from `kanban-ui/` — smoke-test `npx ai4kanban-ui` in a repo that has a board.
6. `git push --follow-tags`. That's the whole plugin release.

### npm publish on this machine

The global `~/.npmrc` points at a read-only mirror with a dead token, so a bare
`npm publish` fails. Publish through a temp npmrc built from `NPM_TOKEN` in the repo-root
`.env` (gitignored, npm account `neverchanje`):

```
set -a && . ./.env && set +a
TMPRC=$(mktemp) && chmod 600 "$TMPRC"
printf 'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$TMPRC"
(cd cli && NPM_CONFIG_USERCONFIG="$TMPRC" npm publish)
(cd kanban-ui && NPM_CONFIG_USERCONFIG="$TMPRC" npm publish)
rm -f "$TMPRC"
```
