---
title: Admit a Cloud account with an invitation code
track: features
priority: med
roi: med
status: todo
release: 0.8.0
blocked_by: [326]
related: [326, 311]
modules: [cloud, local-ui]
questions: []
---

Run the whole invitation loop: a refused person asks for an invite from the app, we approve
the request, Cloud emails them a code, and they redeem it. #326 admits an account by hand — a
row naming a GitHub handle, written against the live database — and leaves everyone else a
support address to write to. This turns the ask into one button and the admission into
something the invited person finishes themselves.

## Worth noting
- **What a refused person presses**: **Request an invite**, in the not-admitted state of the
  Cloud section. The request is recorded against their account and emailed to
  `support@ai4kanban.dev`, which we answer by hand. Nothing is built on the site — no waitlist
  page, no queue, no public thread. The costs: a request is answered whenever someone reads
  that mailbox, with no promise of when, and the preview now holds a requester's email
  address. It beat a GitHub Discussion, which needs a GitHub account and puts the ask beside
  unrelated threads, and no link at all.
- **How a code reaches the person who asked for one**: Cloud emails it when we approve the
  request. Approving becomes one step instead of a reply written by hand, and nobody waits on
  a mailbox being read a second time. The costs are that the preview starts sending email to
  users — so the published terms line saying it sends none is rewritten and the privacy page
  gains the mail provider — and that a sending domain has to stay verified. It beat replying
  by hand from `support@ai4kanban.dev`, which sends no mail at all but leaves every invitation
  as one person's letter.
- **Why this ships in 0.8.0**: every invitation is self-serve from the first public release,
  rather than 0.8.0 admitting by hand and a later version replacing it. The cost is more
  Cloud work in a version whose headline is the asynchronous flow, and a second personal
  detail — the address a code is sent to — held during it.
- **Why a code rather than a longer list of handles**: a code is given to a person before we
  know which account they will sign in with, so we can invite someone we only have an email
  address or a Slack handle for. Adding a handle to #326's list needs that handle first, and
  gets it wrong whenever someone signs in with a different GitHub account than the one we
  guessed. The cost is a second thing to keep — codes that are issued, redeemed, and
  eventually stale.
- **Who a code admits**: whichever account first redeems it, one account per code. The
  preview never has to guess who a code was meant for, and a leaked code costs one admission
  we can revoke rather than an open door. The cost is that a code handed to a team admits one
  of them, so inviting three people means issuing three codes.

<!-- agent -->

## Today
- #326 keeps the admitted-accounts list and refuses every account not on it. Admission is a
  hand-written row, documented in `cloud/README.md` beside standing the project up.
- #326's refusal names `support@ai4kanban.dev` in plain text and offers nothing to press.
  There is no request record, and the Worker sends no mail and has no `send_email` binding.
- #326 puts the Cloud sign-in in a **Cloud** section of the Configuration dialog, with one
  state per answer a sign-in can come back with, including signed in but not admitted, and
  leaves the session route open to an account that is not admitted.
- `ai4kanban.dev` receives mail through Cloudflare Email Routing (#321), which owns the
  domain's MX and SPF records. Cloudflare's `send_email` binding is free to a verified
  destination address on any plan; any other recipient needs Workers Paid.
- Resend's free tier sends 3,000 emails a month and 100 a day from one verified domain, and
  keeps 30 days of logs.
- The Worker already runs hourly (#323) to keep the Supabase project from pausing, and that
  run is where later scheduled work hangs.
- Cloud's `api` schema is the only thing PostgREST serves, and a mutation is one `api`
  function and one transaction counted against the day's write budget.
- #321's pages are live. The terms page says the preview sends no email at all, and the
  privacy page names Cloudflare and Supabase as its only subprocessors.

## Scope
- Offer **Request an invite** in the not-admitted state, record it against the signed-in
  account, and show its state beside the button so pressing again neither writes a second row
  nor sends a second email.
- Leave the request route open to a verified sign-in that is not yet admitted, alongside
  #326's session route.
- Put in the request only what the sign-in already verified — the GitHub handle, the account's
  email address, and when it was asked — and email it to `support@ai4kanban.dev` with the
  requester as the reply address, after the response has been returned, so a slow or failing
  send never delays the sign-in.
- Treat the recorded request, not the mail, as what an answer is written from.
- Approve a recorded request by hand, against the live database the way an account is admitted
  today, and let approving alone issue the code and start it on its way.
- Issue a code the same way to someone who never made a request, by naming the address to
  send it to.
- Email the code to that address from the site's own domain, with `support@ai4kanban.dev` as
  the reply address, and say in the message what the code admits and where to paste it.
- Send from the Worker rather than from whoever approves: the hourly run sends every issued
  invitation not yet sent, so a failed send is retried instead of lost and no mail credential
  leaves the Worker.
- Send one email per invitation: one already sent is never sent again, whatever a later run
  finds.
- Redeem a code from the not-admitted state of the Cloud section: the user pastes it, and the
  account is admitted or told plainly why not.
- Admit exactly one account per code, and refuse a code that is unknown, already redeemed, or
  withdrawn, each with its own reason.
- Record which account redeemed which code and when, so an admission can be traced back to
  the invitation it came from.
- Let a code be withdrawn before it is redeemed, and an admitted account be removed, both by
  hand.
- Close out the request the code answers when the account that made it redeems.
- Amend the published privacy and terms pages before the first request is taken: the terms
  line saying the preview sends no email, and the personal details a request and an invitation
  hold, with the mail provider behind them.
- Out of scope: open sign-up, a code anyone can request without us, expiry dates, an admin
  screen, workspaces, roles, and everything else #314 owns.

## Todo
- [ ] Add the request record to Cloud's schema — the handle, address, and time — with one open
      request per account, and the invitation record beside it: the code, the address it goes
      to, the request it answers, whether it has been sent, and the account and time it was
      redeemed.
- [ ] Take the request on its own route, open to a not-yet-admitted sign-in, recorded inside
      the transaction, with the notice emailed after the response returns over a `send_email`
      binding restricted to the one support recipient.
- [ ] Add **Request an invite** and its requested state to the not-admitted state of the Cloud
      section, and the code box beside it with the answer it gives on each refusal.
- [ ] Send issued invitations from the Worker's hourly run through Resend, marking one sent
      in the same transaction so a retry never sends twice.
- [ ] Write the invitation email: what the code admits, where to paste it, and
      `support@ai4kanban.dev` as the reply address.
- [ ] Add the redeem route: one code, one account, refusing unknown, redeemed, and withdrawn
      codes with their own reasons.
- [ ] Verify a sending subdomain of `ai4kanban.dev` with Resend and hold its API key as a
      Worker secret.
- [ ] Write approving a request, issuing a code to someone who never asked, withdrawing a
      code, enabling the support send, and the sending domain's setup into `cloud/README.md`,
      beside standing the project up.
- [ ] Amend the published pages: rewrite the terms line saying the preview sends no email, and
      add the request, the invitation, and Resend to the privacy page.
- [ ] Check that a request pressed twice sends one email, that a code admits one account only,
      that a second redemption is refused, that a withdrawn code admits nobody, and that one
      approval sends exactly one email.

## Decided by the agent
- **Why the request lives here rather than in #326**: it is the first half of this loop and
  the only thing that makes a request answerable, and moving it here keeps a mail binding, a
  second table, and a privacy-page amendment off the card every other #325 card is blocked by.
  The cost is a window inside 0.8.0 where a refused person has only an address to write to.
- **What sends the mail**: Resend for the code, from a subdomain of `ai4kanban.dev` verified
  for sending. The root domain's MX and SPF belong to the Email Routing that delivers
  `support@ai4kanban.dev`, and a sender on the same name fights them. Cloudflare's
  `send_email` binding cannot carry the code: any recipient but a verified destination needs
  Workers Paid.
- **Why the request notice does not use Resend too**: it goes to our own verified destination,
  which the free Cloudflare binding covers on the plan the preview runs.
- **What the preview pays for it**: nothing. Resend's free tier covers 3,000 emails a month
  and 100 a day, and an invite-only preview issues codes in ones.
- **Where approving happens**: in the database, in the statement that admits an account
  today. An admin screen would be a second privileged surface on a service that answers
  nobody but its own Worker, and #326 already settled that this release has none.
- **What turns an approval into an email**: the hourly run #323 already deploys. Approving
  stays one write, the mail key never leaves the Worker, and a failed send is retried on the
  next run. The cost is up to an hour between approving and the code arriving, against a
  request nobody was promised an answer to.
- **What the request asks the user for**: nothing. The button is one click, because the
  sign-in already attests everything a hand-run admission needs, and a "why do you want in"
  box would be a form nobody has agreed to read.
- **What we promise about a reply**: no time at all. Naming a period would bind a mailbox one
  person reads, and a promise we break costs more than one we never made.
- **What a redeemed code leaves behind**: the invitation record, holding the address it was
  sent to. That is what ties an admitted account back to the invitation, so the privacy page
  lists it beside the request.

## Source
- #326 — the account record, the admitted-accounts list, the refusal this card gives a button
  to, and the Cloud section it adds the button and the code box to.
- #311 and `docs/kanban/memory/cloud/decisions.md` — the invite-only preview and what opens
  sign-up.
- #321 — the published terms page that says the preview sends no email, and the privacy page
  that lists what the preview holds and who processes it.
- #323 — the hourly scheduled run the send hangs off.
- Resend — free tier of 3,000 emails a month and 100 a day from one verified domain; a
  sending subdomain is what it recommends beside a domain that receives mail elsewhere.
- Cloudflare Email Service — sending to a verified destination address is free on every plan;
  any other recipient needs Workers Paid.
