# The hosted board

`cloud.ai4kanban.dev` — a Cloud workspace's board and its cards, in a browser (#322). It is
for a member away from the machine the app is installed on: a second computer, a borrowed
laptop, a phone.

Every page is member-only. There is no public board and no unauthenticated route.

The board page is a read. A card page carries the card's TWO decisions and no third (#364) —
approve a delivery for review, and answer the questions the user owns — because those are what
a member away from their machine is blocked on. A card's fields, its body and its delivery all
stay in the app.

## What it serves

| Path | What it draws |
| --- | --- |
| `/` | The signed-in account's workspace, or the list when it reaches more than one |
| `/<workspace-id>` | That workspace's board — the columns and the release picker |
| `/<workspace-id>/<card-id>` | One card, whole: the human half, the folded agent half, its subtasks and its open questions — with Implement and Resolve where the board is raising a decision for it |
| `/<workspace-id>/<card-id>/decide` | Where a press is recorded. A route handler, because the session is an `httpOnly` cookie the page cannot read |
| `/signin`, `/signin/callback` | The browser's own GitHub sign-in |
| `/signout` | Ends the browser session and nothing else |

## Where the screens come from

They are `kanban-ui`'s, imported rather than copied. #374 split each screen from the app's
window: `<Board>` and `<CardPage>` draw from one read and act through one passed-in client,
so a caller that hands in no `ScreenActions` and no `ScreenMachine` gets the same screens
read-only — every control that would write is gone rather than dead.

A card page is handed a client, and a `ScreenControlsProvider` naming the two controls this
surface offers (#364). The page draws those and no more: `lib/actions.ts` implements the two
and throws on everything else, which nothing on the page can reach.

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

## The reads

`GET api.ai4kanban.dev/v1/workspaces/<id>/read` — the workspace's name, its live cards and
the four configuration documents these two screens draw. `cloud/migrations/0018_reader_read.sql`
is what leaves everything else behind: the memory set, the per-flow rules, the archive,
closed releases' summaries, the history files, the trail, the delivery records and the
execution nodes are served to no browser.

`GET .../v1/workspaces/<id>/events` — the decisions that board is raising, one live event per
card waiting on somebody (#364). A second read on a second clock: a press elsewhere settles an
event without the board changing at all. A card page asks for both at once, so the controls
never appear under the reader after the first paint.

A signed-out visitor, a signed-in account with no claim on the workspace, a deleted
workspace and a made-up id all meet the same sentence, so none of them learns anything from
the difference. A read the service could not answer says the board could not be read just
now, and is never that sentence.

## The write

`POST .../v1/events/<id>/action`, through this app's own `/<workspace>/<card>/decide`. It
records the one durable action the card's live event carries — the same one the app, Slack and
Lark record — so the first surface to act settles it and every other redraws as answered.

The token never reaches the page: the session is an `httpOnly` cookie, so a route handler on
this server holds it. `SameSite=Lax` is what refuses a cross-site press.

A press waits for a machine. Cloud runs no agent over a board, so nothing builds until one of
the workspace's own machines claims it, and the card reads *waiting for a machine* until one
does. A refusal says why in the service's own words; a press the service could not answer says
so and leaves the decision unmade.

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

This is a Worker, on the same Cloudflare account the site deploys from. It server-renders
every page and its bundle carries Next, so it is the heaviest thing we deploy — about 1.1 MB
gzipped.

Two things come first:

- **The sign-in's return address.** `https://cloud.ai4kanban.dev/signin/callback` has to be on
  the Supabase project's redirect allow-list — `cd ../cloud && npm run redirects` says whether
  it is, `-- --set` puts it there. Auth does not refuse an address that is not on the list; it
  returns to the site URL instead, so without this every sign-in lands on the marketing site
  and no board ever opens.
- **The schema.** Apply `cloud/migrations/0018_reader_read.sql` and
  `cloud/migrations/0021_workspace_events.sql` (`cd ../cloud && npm run migrate`) — without the
  first the read route has no function to call, and without the second no card page finds a
  decision to offer.

Then:

```
npm run deploy
```

The first deploy also attaches the `cloud.ai4kanban.dev` custom domain, which
`../cloud/wrangler.jsonc` has kept free for it.
