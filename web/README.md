# web

The WildCrane Web app (#2020), served at `https://app.wildcrane.ai`: start tasks with 新想法,
see each project's board, read and answer a task's card, and chat with its agent. A static
Vite + React site over the cloud's public `/v1` API (`cloud/endpoints.md`); it imports
`review/src` (sign-in, Share, AI chat, card body) through the `@review` alias.

- **Dev**: `npm run dev`; `VITE_API_URL` points it at another API.
- **Check**: `npm run lint` (typecheck) and `npm run build`.
- **Deploy**: `npm run build`, then `wrangler pages deploy dist --project-name wildcrane-app
  --branch main`, with `app.wildcrane.ai` as the project's custom domain. `public/_redirects`
  is the SPA fallback.
- **Supabase Auth**: `https://app.wildcrane.ai/auth/callback` is in `cloud/scripts/redirects.mjs`.
