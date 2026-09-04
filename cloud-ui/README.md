# The hosted board

`cloud.ai4kanban.dev` — a Cloud workspace's board and its cards, read-only, in a browser
(#322). It is for a member away from the machine the app is installed on: a second computer,
a borrowed laptop, a phone.

Every page is member-only. There is no public board, no unauthenticated route and nothing a
reader presses that changes anything.

## What it serves

| Path | What it draws |
| --- | --- |
| `/` | The signed-in account's workspace, or the list when it reaches more than one |
| `/<workspace-id>` | That workspace's board — the columns and the release picker |
| `/<workspace-id>/<card-id>` | One card, whole: the human half, the folded agent half, its subtasks and its open questions |
| `/signin`, `/signin/callback` | The browser's own GitHub sign-in |
| `/signout` | Ends the browser session and nothing else |

## Where the screens come from

They are `kanban-ui`'s, imported rather than copied. #374 split each screen from the app's
window: `<Board>` and `<CardPage>` draw from one read and act through one passed-in client,
so a caller that hands in no `ScreenActions` and no `ScreenMachine` gets the same screens
read-only — every control that would write is gone rather than dead.

Three things make that import work:

- **`ai4kanban-ui` is a dependency of this app** (`file:../kanban-ui`) and is named in
  `transpilePackages`, because Next compiles source outside its own folder only for a
  package it is told to transpile.
- **`@/*` resolves to `../kanban-ui/*`**, so the components' own imports resolve unchanged.
  This app reaches its own files by relative path.
- **This app's `node_modules` is searched first** (`next.config.mjs`), so React and Next are
  one copy across both trees rather than two.

The board those screens draw is assembled by `cli/src/lib/board/assemble.ts` — the board's
own reading rules as plain functions, shared into `kanban-ui/lib/format/` by
`scripts/sync-format.mjs`. There is no filesystem, no git and no coding agent anywhere in
that path.

## The read

`GET api.ai4kanban.dev/v1/workspaces/<id>/read` — the workspace's name, its live cards and
the four configuration documents these two screens draw. `cloud/migrations/0018_reader_read.sql`
is what leaves everything else behind: the memory set, the per-flow rules, the archive,
closed releases' summaries, the history files, the trail, the delivery records and the
execution nodes are served to no browser.

A signed-out visitor, a signed-in account with no claim on the workspace, a deleted
workspace and a made-up id all meet the same sentence, so none of them learns anything from
the difference. A read the service could not answer says the board could not be read just
now, and is never that sentence.

## The browser session

A second sign-in, not a borrowed one. The app's session lives in the user's home directory
behind a URL scheme only the desktop app answers; this one is a PKCE sign-in of its own,
held in one `httpOnly` `Secure` `SameSite=Lax` cookie. Ending either leaves the other signed
in — `/signout` drops the cookie and revokes this session alone (`scope=local`).

`middleware.ts` is what keeps a visit tomorrow signed in: a server component cannot set a
cookie, so the refresh happens there, once, before the page renders.

## Commands

```
npm run dev        # next dev, against api.ai4kanban.dev
npm run lint       # eslint + tsc
npm run preview    # build the Worker and run it locally
npm run deploy     # build and deploy
```

The three endpoints are overridable, for a checkout pointed at a throwaway project — see
"Standing up a new project" in `../cloud/README.md`:

```
AI4KANBAN_SUPABASE_URL, AI4KANBAN_SUPABASE_ANON_KEY, AI4KANBAN_CLOUD_URL
```

## Deploy

**This Worker needs Workers Paid.** Server-rendering a board runs past the Free plan's
per-request CPU, and the bundle carries Next. It deploys to the same Cloudflare account the
site deploys from; the plan is changed in the Cloudflare dashboard, not in this repository.

Two things come first:

- **The sign-in's return address.** Add `https://cloud.ai4kanban.dev/signin/callback` to the
  Supabase project's redirect allow-list (`../cloud/README.md`, step 4). Auth does not refuse
  an address that is not on it — it returns to the site URL instead, so without this every
  sign-in lands on the marketing site and no board ever opens.
- **The schema.** Apply `cloud/migrations/0018_reader_read.sql` (`cd ../cloud && npm run
  migrate`) — without it the read route has no function to call.

Then:

```
npm run deploy
```

The first deploy also attaches the `cloud.ai4kanban.dev` custom domain, which
`../cloud/wrangler.jsonc` has kept free for it.
