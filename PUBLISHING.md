# Publishing AI4Kanban

Everything ships from this one repo. Two things need publishing on npm — the `ai4kanban`
CLI, and the frozen `ai4kanban-ui` board UI — and the desktop app ships as files on the
GitHub release. The plugin and the skill ship by pushing to GitHub; directories read the
repo directly.

## What ships where

| Piece | Where it lives | How it ships |
| --- | --- | --- |
| Skill (`skill/`) + plugin/marketplace manifests | this repo | `git push` — nothing to publish |
| Setup CLI | npm `ai4kanban` | `npm publish` from `cli/` |
| Board app | GitHub release for the version tag | `npm run dist` from `desktop/`, then upload |
| Board UI (frozen) | npm `ai4kanban-ui` | **deprecated — no new releases**, see below |
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
they're behind), `cli/package.json`, `kanban-ui/package.json`, `desktop/package.json`. They
all share the one version, so they ship together. The app compares its own version against
the newest GitHub release to tell the user a newer one is out — so an unstamped app would
nag forever.

Tag every release. `npx ai4kanban update` links `…/compare/v<old>...v<new>`, which only
resolves if the tags exist.

Never rename the plugin slug (`kanban`) or either npm package — a rename breaks everyone's
install. `kanban-skill-ui` is the retired old UI name; it's deprecated on npm and that's all.

## Release checklist

1. `claude plugin validate .` passes.
2. `node scripts/sync-version.mjs <new-version>`; commit and `git tag v<new-version>`.
3. README, `README-zh.md`, and the guides reflect any behavior change.
4. `npm publish` from `cli/` — smoke-test `npx ai4kanban@latest install` in a throwaway repo.
5. Build the app (below) and check a run works end to end on macOS.
6. `git push --follow-tags`, then create the GitHub release for `v<new-version>` and upload
   everything in `desktop/dist/`.

Nothing to do for `kanban-ui/` — it is frozen (below).

### npm publish on this machine

The global `~/.npmrc` points at a read-only mirror with a dead token, so a bare
`npm publish` fails. Publish through a temp npmrc built from `NPM_TOKEN` in the repo-root
`.env` (gitignored, npm account `neverchanje`):

```
set -a && . ./.env && set +a
TMPRC=$(mktemp) && chmod 600 "$TMPRC"
printf 'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$TMPRC"
(cd cli && NPM_CONFIG_USERCONFIG="$TMPRC" npm publish)
rm -f "$TMPRC"
```

`kanban-ui` is not published any more — see "`ai4kanban-ui` is frozen" below. The same temp
npmrc is how the one-off `npm deprecate` there is run.

## The desktop app

The app is the board UI in a window: `desktop/` is a thin Electron shell that carries
`kanban-ui`'s prebuilt Next server as a resource, starts it on a private loopback port, and
shows it. `desktop/README.md` says how it works; this is how it ships.

```
cd desktop
npm install
npm run dist            # macOS + Windows + Linux, into desktop/dist/
npm run dist:mac        # one system at a time
```

`npm run dist` builds the board UI into `desktop/resources/server/` first (that folder is a
build product and is gitignored). Cross-building Windows and Linux from macOS works because
neither has native modules to compile.

What each system gets, and what we promise about it:

| System | Build | Signed | Tested |
| --- | --- | --- | --- |
| macOS arm64 + x64 | `.dmg`, `.zip` | yes | yes, each release |
| Windows x64 + arm64 | `.exe` (NSIS) | no | no |
| Linux x64 + arm64 | `.AppImage` | no | no |

Windows and Linux are built and published untested. The download page and the READMEs say
so, and say the one step past each system's warning. Revisit a Windows certificate when
users ask.

### Signing the Mac build

The Mac build is signed and notarized so a fresh download opens with a double-click and no
warning. That needs an Apple Developer account ($99/year), its "Developer ID Application"
certificate in the login keychain, and three variables in the environment:

```
export APPLE_ID="…"                    # the Apple ID that owns the account
export APPLE_APP_SPECIFIC_PASSWORD="…" # made at appleid.apple.com, not the account password
export APPLE_TEAM_ID="…"               # the 10-character team id
cd desktop && npm run dist:mac
```

`electron-builder.yml` already sets `hardenedRuntime`, the entitlements notarizing requires,
and `notarize: true`. Without the certificate or those variables the build fails at signing
— build it unsigned with `npx electron-builder --mac -c.mac.notarize=false`, and say so
wherever it is handed out.

Check a signed build the way a user meets it: download the `.dmg` on a machine that has
never run the app, open it, and confirm no Gatekeeper warning. `spctl -a -vvv -t install
/Applications/AI4Kanban.app` answers the same question from a terminal.

## `ai4kanban-ui` is frozen

The npm package is deprecated as of the release that shipped the app, and frozen at its
last published version. It is **not** unpublished: a board someone opens tomorrow still
comes up. Nothing new is built for it and no release lands there again.

Marked once, on npm:

```
npm deprecate ai4kanban-ui "Deprecated — get the desktop app: https://ai4kanban.dev/download"
```

(through the temp npmrc below, like a publish). `bin/kanban-ui.mjs` prints the same thing on
every run, and the board it serves says it in a line above the board — so nobody finds out
from a changelog.
