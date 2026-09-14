# The newsletter

One issue a week to the list `newsletter-subscribers.mjs` builds. Preview it, mail it to
yourself, mail it to the list, pick up what failed.

```sh
node scripts/newsletter-send.mjs --issue 2026-09-13 --preview
node scripts/newsletter-send.mjs --issue 2026-09-13 --test you@example.com
node scripts/newsletter-send.mjs --issue 2026-09-13 --send
node scripts/newsletter-send.mjs --issue 2026-09-13 --retry
```

`--dry-run` works on `--send` and `--retry`: it reports the recipients and mails nobody.

## Writing an issue

Copy `issues/example.json` to `issues/<date>.json` and write the words. Every string a
reader sees is English — the sender refuses an issue that carries any other script.

- **`hero`** is optional, and so is a `highlights[i].image` — `{ src, alt }`, drawn under
  that highlight's own words. A highlight with no picture stays plain text.
- **An image address** is either a site-root path — the picture lives in
  `web/public/newsletter/<date>/` and the site has to be deployed before the send — or a
  full `https://` address on a CDN. The sender checks every one is live and refuses to
  start if one 404s. A CDN key is immutable: changing a picture means a new filename.
- **`alt`** is what the picture showed, not that there is one. The plain-text alternative
  carries it; the images-off preview drops the picture and leaves the words.
- **The corner is baked into the picture**, not applied in CSS. `mat.mjs` does it — see
  below.
- **`preheader`** is the line the inbox shows beside the subject.

## The pictures

`mat.mjs` mounts a capture on the landing page's wash and exports it at 1104 × 736 — the
mat, the corner and the soft shadow baked in, because an email client keeps none of them as
CSS. Sources are the real app captures in `screenshots/`; drawn mock-ups do not go in a
letter.

```sh
node scripts/newsletter/mat.mjs --in screenshots/board-notifications.png \
  --out delivery-v1.png --crop 1960,105,826,517 --wash peachEmber
node scripts/newsletter/mat.mjs --in screenshots/landing-figures/execute.png \
  --out runs-v1.png --whole
```

- **`--crop x,y,w,h`** is the region of the source to show, in source pixels. The panel is
  1.597 wide to tall; a crop of another shape is scaled to the panel's width and loses its
  bottom or leaves white under it, and says so.
- **`--wash`** is one of `web/components/home/washes.ts` — a different one per picture, so a
  letter of four does not read as one texture repeated.
- **`--whole`** is for a figure that already carries a mat: it is scaled whole and padded to
  3∶2 in the page's own white.
- **Crop to the part the words describe.** The picture is read at 552px; a whole screen
  shrunk to that is grey lines.
- **300 KB is the ceiling.** Over it, re-encode as JPEG —
  `sips -s format jpeg -s formatOptions 90 in.png --out out.jpg`.
- **Upload, then reference.** Follow the `cdn-images` skill: `newsletter/<date>/<name>-v1.png`
  in the `kanbanskill` bucket, `--remote`, the real content type, and `curl -sI` until it is
  200. The key is immutable, so a changed picture is a new `-v<n>` and an edit in the JSON.

`--preview` writes three files next to the list and opens the first:
`index.html`, `images-off.html` (what a client with images off draws) and `plain.txt`.

## What a send does

Every send is written to the list as it happens, so an interrupted run resumes where it
stopped and one address is mailed once per issue. Both `--send` and `--retry` pull the
site's unsubscribes back into the list before they decide who gets a copy, and both stop
rather than mail anyone if that read fails.

`--retry` reads each message's last event back from Resend: a temporary failure is sent
again, a hard bounce or a spam complaint takes the address off the list for good.

To exercise both endings for real, add `bounced@resend.dev` and `complained@resend.dev` to
`subscribers` in the list file as two ordinary deliverable records, run `--send` and then
`--retry`: the first comes back `bounced`, the second `complained`, and both end with
`deliverable: false`. Delete the two records afterwards.

## Unsubscribing

The link at the foot of every issue carries an HMAC of the address, never the address.
`web/functions/unsubscribe.ts` writes the token to the newsletter's D1 database — the site
never learns whose it is — and the next send works it out locally by signing every address
the same way. The endpoint answers success only once the row is committed, and the same
token arriving twice stays one unsubscribe with its first timestamp.

An unsubscribe is permanent, and is kept by address *and* by GitHub login: re-collecting the
same person, under any address, can never turn it back on.

## Setup

1. **Resend** — `RESEND_API_KEY` from the same account the Cloud Worker uses
   (`cloud/README.md`). `ai4kanban.dev` is already verified there as a sending domain, and
   the newsletter sends as `AI4Kanban <newsletter@ai4kanban.dev>` from that root domain —
   the same one the invite mail uses, so the two share its reputation.
2. **DMARC** — bulk mail needs a policy on the sending domain. `_dmarc.ai4kanban.dev`
   answers `v=DMARC1; p=none;`; check a test message's raw headers show `spf=pass`,
   `dkim=pass` and `dmarc=pass` before the first real send.
3. **D1** — `wrangler d1 create ai4kanban-newsletter`, put the id it prints into
   `web/wrangler.jsonc`, then `cd web && npm run migrate` to create the table. It is the
   newsletter's own database, not the telemetry one.
4. **The read-back token** — set `NEWSLETTER_ADMIN_TOKEN` as a Pages secret on the
   `kanban-skill` project (Settings → Variables and Secrets), and export the same value
   locally. It guards `/api/newsletter/unsubscribes`, which is how a send learns who left.
5. **Deploy the site** — `cd web && npm run deploy`. Wrangler reads `web/wrangler.jsonc`,
   picks up `web/functions/` and binds `NEWSLETTER_DB` to the deployment.

Run the migration before the deploy: a Function that answers `/unsubscribe` against a
database with no table records nothing and tells the reader so.

## Environment

| Variable | What it is |
| --- | --- |
| `RESEND_API_KEY` | Required to send anything. |
| `NEWSLETTER_ADMIN_TOKEN` | Reads the site's unsubscribes. Required by `--send` and `--retry`. |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | Signs the links. Written to `~/.ai4kanban/newsletter/unsubscribe-secret` on first use — losing it breaks every link already in an inbox. |
| `NEWSLETTER_FROM` | The sender. Defaults to `AI4Kanban <newsletter@ai4kanban.dev>`. |
| `NEWSLETTER_REPLY_TO` | Defaults to `support@ai4kanban.dev`. |
| `NEWSLETTER_SITE_URL` | Defaults to `https://ai4kanban.dev`. Point it at a preview to try the whole loop without touching production. |

## Checks

```sh
node --test scripts/newsletter/newsletter.test.mjs
```

The logo in the email is `web/public/newsletter/logo.png`, exported from
`web/public/logo.svg` at 600px wide — email clients do not render SVG. Re-export it when the
logo changes.
