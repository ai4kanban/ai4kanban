# web

The WildCrane Web app (#2020), served at `https://app.wildcrane.ai`: start tasks with 新想法,
see each project's board, read and answer a task's card, and chat with its agent. A static
Vite + React site over the cloud's public `/v1` API (`cloud/endpoints.md`). The review page
is `/s/<token>`, in `src/review/` with the sign-in, Share, AI chat and card body the rest of
the app imports through the `@review` alias: visitors read, invited guests comment, members
go to the task page.

- **Dev**: `npm run dev`; `VITE_API_URL` points it at another API.
- **Check**: `npm run lint` (typecheck) and `npm run build`.
- **Deploy**: [`docs/deploy.md`](../docs/deploy.md).
- **Supabase Auth**: `/auth/callback` is in `cloud/scripts/redirects.mjs` (`npm run redirects
  -- --set`). Email sign-in uses a 10-minute, 6-digit code through Resend as custom SMTP. The
  Magic Link template is `email/login-code.html` (subject `WildCrane 登录验证码` / sign-in code),
  uploaded by hand; it picks the language the sign-in page passed as `data.lang`.
