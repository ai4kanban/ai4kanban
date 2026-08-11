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
| Landing page | ai4kanban.dev (Cloudflare Pages) | `env -u NODE_ENV pnpm run deploy` from `web/` — every release (below), and whenever the copy changes |

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
7. Deploy the landing page — last, and not optional. Every asset name on a release carries
   the version, so the download page links straight at this tag's files: `web/lib/release.ts`
   reads the root `VERSION` at build time and writes
   `…/releases/download/v<version>/AI4Kanban-<version>-arm64.dmg` and its four siblings. Until
   the deploy, ai4kanban.dev/download hands out the previous release; deploy it before the
   release exists and the buttons 404. If a build's file name changes, that page's
   `components/download/builds.ts` is the one place to change it.

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
| macOS arm64 + x64 | `.dmg`, `.zip` | no | yes, each release |
| Windows x64 + arm64 | `.exe` (NSIS) | no | no |
| Linux x64 + arm64 | `.AppImage` | no | no |

Nothing is signed this release, and Windows and Linux are built and published untested. The
download page and the READMEs say so, and say what to click past each system's warning.
Revisit a Windows certificate when users ask.

### The Mac build ships unsigned

`npm run dist` needs no certificate and no Apple account — `electron-builder.yml` sets
`identity: "-"`, `hardenedRuntime: false` and `notarize: false`, so the Mac build is ad-hoc
signed and nothing else.

Ad-hoc is not "no signature", and the difference matters: Apple Silicon refuses to launch a
binary with no valid signature at all, so a truly unsigned arm64 build opens as *damaged*
with no way past. Ad-hoc gives it a valid signature that names no developer — Gatekeeper
still calls the app unidentified and blocks the first open, which is the warning the
download page walks the user through. Confirm the build got one:

```
codesign -dv --verbose=2 desktop/dist/mac-arm64/AI4Kanban.app   # Signature=adhoc
spctl -a -vvv -t install desktop/dist/mac-arm64/AI4Kanban.app   # rejected — expected, until #182
```

Check it the way a user meets it: download the `.dmg` on a machine that has never run the
app and open it, following the download page's steps. If those steps do not get the app
open, that is a build bug, not something to wait for a certificate to fix.

Signing and notarizing for real is #182: an Apple Developer account ($99/year), its
"Developer ID Application" certificate in the login keychain, `APPLE_ID` /
`APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` in the environment, and `mac.identity`
dropped with `hardenedRuntime` and `notarize` back to `true` — the entitlements that
notarizing needs are already in `desktop/build/`.

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
