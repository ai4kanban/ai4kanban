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

The CLI carries the note inside its build: `skill/SKILL.md` is a source file that
`cli/src/lib/skill/install.ts` imports as a string, so it ships baked into the rules. A
change to the note isn't in anyone's hands until the CLI is republished.

The board's rules are not a source file either. They live in `cli/src/`, in TypeScript, and
`cli/scripts/build.mjs` builds them into a single `cli/dist/kanban.mjs` — what `akb` runs,
what the tarball carries, and what the desktop app copies in. That built file is **not**
committed (#213): `npm install` in `cli/` builds it through the `prepare` script, and
`prepublishOnly` rebuilds it before every publish. Nothing to keep in sync, nothing to
forget to rebuild.

A skill folder is `SKILL.md` and nothing else, in a project and in the plugin alike, so the
plugin channel ships the note straight out of the repo with no build step in the way.

## One version, one place

The canonical version is the root `VERSION` file.

```
node scripts/sync-version.mjs 0.4.2   # bump VERSION and stamp everywhere
node scripts/sync-version.mjs --check # verify in sync (both prepublishOnly hooks run this)
```

Stamped spots: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
`SKILL_VERSION` in `cli/src/version.ts` (what an installed skill folder is stamped with, so
a project can tell it is behind — stamping it rebuilds `cli/dist/kanban.mjs`, which carries
the number in its first lines; a checkout that has never been built has no file there, and
`--check` says so instead of failing), `cli/package.json`, `kanban-ui/package.json`,
`desktop/package.json`. They
all share the one version, so they ship together. The app compares its own version against
the newest GitHub release to tell the user a newer one is out — so an unstamped app would
nag forever.

Tag every release. `npx ai4kanban update` links `…/compare/v<old>...v<new>`, which only
resolves if the tags exist.

Never rename the plugin slug (`kanban`) or either npm package — a rename breaks everyone's
install. `kanban-skill-ui` is the retired old UI name; it's deprecated on npm and that's all.

## Release checklist

1. `claude plugin validate .` passes, and `npm run lint` in `cli/` passes (the board's rules
   typecheck).
2. `node scripts/sync-version.mjs <new-version>`; commit and `git tag v<new-version>`.
3. README, `README-zh.md`, and the guides reflect any behavior change.
4. `npm publish` from `cli/` — smoke-test `npx ai4kanban@latest install` in a throwaway repo.
5. Build the app (below) and check a run works end to end on macOS.
6. `git push --follow-tags`, then create the GitHub release for `v<new-version>` and upload
   this version's files from `desktop/dist/` — the folder keeps every past release's builds
   too, so upload by name, not `dist/*`. Three traps, all silent:
   - **`--follow-tags` doesn't push a lightweight tag.** `git tag v<x>` makes one, so the
     push leaves the tag behind. `git ls-remote --tags origin | grep <x>`, and
     `git push origin v<x>` if it isn't there.
   - **Unset the proxies, like the deploy does.** `gh` uploads through
     `127.0.0.1:7890` and the big files reset mid-transfer.
   - **`gh release create` exits 0 even when an upload failed**, leaving a draft with some
     of the assets. Count them before publishing: `gh release view v<x> --json assets -q
     '.assets[].name' | wc -l` — 16. Then `gh release edit v<x> --draft=false --latest`.
7. Deploy the landing page — last, and not optional. Every asset name on a release carries
   the version, so the download page links straight at this tag's files: `web/lib/release.ts`
   reads the root `VERSION` at build time and writes
   `…/releases/download/v<version>/AI4Kanban-<version>-arm64.dmg` and its four siblings. Until
   the deploy, ai4kanban.dev/download hands out the previous release; deploy it before the
   release exists and the buttons 404. If a build's file name changes, that page's
   `components/download/builds.ts` is the one place to change it.

   Build it from the tag, not from the working tree. `next build` compiles whatever is on
   disk, so half-finished page work — yours or another session's — ships to production
   under the release's name. Clone and build there:
   `git clone --local <repo> /tmp/rel && cd /tmp/rel && git checkout v<x>`.

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

Marked once, on npm — **already done**, on all three published versions:

```
npm deprecate ai4kanban-ui "Deprecated — get the desktop app: https://ai4kanban.dev/download"
```

(through the temp npmrc above, like a publish). Two things to know before you touch it again:

- **Pin the registry.** A shell started from a pnpm script carries
  `npm_config_registry=https://registry.npmmirror.com`, and that env var beats the temp
  npmrc — the write goes to the mirror and fails. Run it as
  `env -u npm_config_registry NPM_CONFIG_USERCONFIG="$TMPRC" npm deprecate … --registry=https://registry.npmjs.org/`.
- **A 422 is not proof it failed.** Re-running the command with the message already set
  returns `422 Unprocessable Entity` while the live flag stays correct. Check the registry
  rather than the exit code:
  `curl -s https://registry.npmjs.org/ai4kanban-ui | node -e '…versions[v].deprecated'`, or
  just `npm install ai4kanban-ui` in a throwaway folder and look for the `npm warn
  deprecated` line.

The repo's `bin/kanban-ui.mjs` prints the same thing on every run and the board says it in a
line above the board — but both landed *after* 0.5.0 was published, and no release lands here
again, so **nobody on npm ever sees them**. For an npm user the registry warning on install is
the only notice there is. That is on purpose; freezing the version beat shipping one more.
