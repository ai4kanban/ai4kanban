---
description: Build the static export and deploy the ai4kanban landing page to Cloudflare Pages
---

Deploy the latest version of this site to Cloudflare Pages (Direct Upload — no Git).

Run all commands from the `web/` directory.

Steps:

1. Build the static export:
   ```bash
   cd web && npm run build
   ```
   This regenerates `web/out/`. If the build fails, stop and report the error — do not deploy.

2. Deploy `out/` to the `kanban-skill` Pages project. Unset proxy env vars for
   this command — a proxy in the environment makes Wrangler's uploads silently
   fail:
   ```bash
   cd web && env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
     npx wrangler pages deploy out --project-name=kanban-skill --branch=main --commit-dirty=true
   ```
   Wrangler must print `✨ Deployment complete!` with a fresh `*.pages.dev`
   preview URL. If it does not, the deploy did **not** land — stop and report it.
   Report the deployment URL Wrangler prints.

3. Verify the **new** build is actually live on the production domain — a plain
   `200` is not enough, since the previous deployment also returns `200`. Confirm
   the current commit's markup is served (adjust the grep string to something in
   your latest change):
   ```bash
   printf "%s -> " "https://ai4kanban.dev/"; curl -s -o /dev/null -w "%{http_code}\n" -L "https://ai4kanban.dev/"
   ```
   If a `200` returns but the live HTML still shows the old content, the upload
   failed (see the proxy note above) — re-run step 2.

Notes:
- Requires a prior `npx wrangler login` (one-time). If Wrangler reports it's not authenticated, tell the user to run `! npx wrangler login`.
- Proxy gotcha: if `HTTP_PROXY`/`HTTPS_PROXY` are set, `next build` still succeeds but `wrangler pages deploy` fails to upload — the live site keeps serving the old deployment. Step 2 unsets these; if you deploy manually, do the same.
- The `package.json` `deploy` script runs steps 1–2 in one go: `npm run deploy`.
- This is a pure static export (`output: "export"` in `next.config.mjs`); there is no server/middleware.
- `kanbanskill.cc` is still a custom domain on the project, but a Cloudflare Redirect Rule on that zone 301s every path to `ai4kanban.dev`. Verify against `ai4kanban.dev` — the old domain no longer serves the build.
- On a brand-new project, the `*.pages.dev` TLS certificate can take ~30s to provision after the first deploy — a transient `522`/`000` right after deploy is expected; retry.
