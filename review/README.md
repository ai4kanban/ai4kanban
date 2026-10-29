# review

The card review page (#2019), served at `https://review.wildcrane.ai/{token}`: a static
Vite + React site over the public API's `/v1/shared/*` routes (`cloud/endpoints.md`).

- **Dev**: `npm run dev`; `VITE_API_URL` points it at another API.
- **Deploy**: [`docs/deploy.md`](../docs/deploy.md).
- **Supabase Auth**: add `https://review.wildcrane.ai/auth/callback` to the redirect URLs;
  enable email sign-in with a 10-minute, 6-digit code; Resend as custom SMTP; the Magic Link
  template is `email/login-code.html` (subject `WildCrane 登录验证码` / sign-in code), which
  picks the language the sign-in page passed as `data.lang`.
