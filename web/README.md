# web

The WildCrane Web app (#2020), served at `https://app.wildcrane.ai`: start tasks with 新想法,
see each project's board, read and answer a task's card, and chat with its agent. A static
Vite + React site over the cloud's public `/v1` API (`cloud/endpoints.md`); it imports
`review/src` (sign-in, Share, AI chat, card body) through the `@review` alias.

- **Dev**: `npm run dev`; `VITE_API_URL` points it at another API.
- **Check**: `npm run lint` (typecheck) and `npm run build`.
- **Deploy**: staging first, then production, on Pages project `wildcrane-app`
  (`public/_redirects` is the SPA fallback):
  1. **Staging**: build with `VITE_API_URL` (the staging Worker), `VITE_SUPABASE_URL` and
     `VITE_SUPABASE_ANON_KEY` from `cloud/.env.staging`, then
     `wrangler pages deploy dist --project-name wildcrane-app --branch staging`. It serves
     `https://staging.wildcrane-app.pages.dev`.
  2. **Verify**: sign in there, open a project's board and a card, and walk what the change
     touches.
  3. **Production**: a plain `npm run build`, then the same deploy with `--branch main`
     (`app.wildcrane.ai`).
- **Supabase Auth**: both sites' `/auth/callback` are in `cloud/scripts/redirects.mjs`.
