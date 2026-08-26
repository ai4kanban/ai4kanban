---
title: Admit a Cloud account with an invitation code
track: features
priority: med
roi: med
status: todo
release: 0.8.0
blocked_by: [326, 321]
related: [326, 321, 311]
modules: [cloud, local-ui]
questions: []
---

Let someone we have decided to invite admit themselves: we approve their request, Cloud
emails them a code, and they redeem it in the app. #326 admits an account by hand — a row
naming a GitHub handle, written against the live database — so every invitation costs a
person with database access one careful edit, and the invited person waits on it without
being able to see it happen. A code turns the admission into something they finish
themselves, and the email turns answering a request into one step rather than a letter
somebody writes.

## Worth noting
- **How a code reaches the person who asked for one**: Cloud emails it when we approve the
  invite request #326 recorded. Approving becomes one step instead of a reply written by
  hand, and nobody waits on a mailbox being read a second time. The costs are that the
  preview starts sending email to users — so #321's terms line saying it sends none is
  rewritten and its privacy page gains the mail provider — and that a sending domain has to
  stay verified. It beat replying by hand from `support@ai4kanban.dev`, which sends no mail
  at all but leaves every invitation as one person's letter.
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
- **Which release publishes the privacy and terms pages**: 0.8.0, the release this card
  ships in. The version that starts emailing a code carries the pages that say what it
  emails, rather than leaving them a gate somebody has to clear before Cloud is turned on.
  The cost is that #321 leaves its group — #311 is still in no release — and has to be
  written, reviewed and published on this release's schedule.
- **This does not open sign-up**: a code is still something we decide to give, so the preview
  stays invite-only and its capacity stays bounded, the way #311 settled. Nobody is admitted
  without a person approving them first. Self-serve sign-up is a later change that arrives
  with pricing.

<!-- agent -->

## Today
- #326 keeps the admitted-accounts list and refuses every account not on it. Admission is a
  hand-written row, documented in `cloud/README.md` beside standing the project up.
- #326's refusal offers **Request an invite**, which records the request against the account
  with the handle and email address the sign-in attested, and emails it to
  `support@ai4kanban.dev`. There is no way to answer that request other than by hand.
- #326 puts the Cloud sign-in in a **Cloud** section of the Configuration dialog, with one
  state per answer a sign-in can come back with, including signed in but not admitted.
- The Worker sends one message today, over a Cloudflare `send_email` binding restricted to
  the verified `support@ai4kanban.dev` destination. That is free on every plan; sending to
  any other recipient over that binding needs Workers Paid.
- `ai4kanban.dev` receives mail through Cloudflare Email Routing (#321), which owns the
  domain's MX and SPF records.
- Resend's free tier sends 3,000 emails a month and 100 a day from one verified domain, and
  keeps 30 days of logs.
- The Worker already runs hourly (#323) to keep the Supabase project from pausing, and that
  run is where later scheduled work hangs.
- Cloud's `api` schema is the only thing PostgREST serves, and a mutation is one `api`
  function and one transaction counted against the day's write budget.
- #321's terms page says the preview sends no email at all, and its privacy page names
  Cloudflare and Supabase as its only subprocessors. #321 ships in 0.8.0, ahead of this
  card.

## Scope
- Approve a recorded invite request by hand, against the live database the way an account is
  admitted today, and let approving alone issue the code and start it on its way.
- Issue a code the same way to someone who never made a request, by naming the address to
  send it to.
- Email the code to that address from the site's own domain, with `support@ai4kanban.dev` as
  the reply address, and say in the message what the code admits and where to paste it.
- Send from the Worker rather than from whoever approves: the hourly run sends every issued
  invitation not yet sent, so a failed send is retried instead of lost and no mail credential
  leaves the Worker.
- Send one email per invitation: one already sent is never sent again, whatever a later run
  finds.
- Redeem a code from the not-admitted state of the Configuration dialog's Cloud section: the
  user pastes it, and the account is admitted or told plainly why not.
- Admit exactly one account per code, and refuse a code that is unknown, already redeemed, or
  withdrawn, each with its own reason.
- Record which account redeemed which code and when, so an admission can be traced back to
  the invitation it came from.
- Let a code be withdrawn before it is redeemed, and an admitted account be removed, both by
  hand.
- Close out the invite request the code answers when the account that made it redeems.
- Send no code before #321's pages are live and say what the preview now emails — #321
  ships in this release and lands first, the same order #326 fixed for taking the request.
- Out of scope: open sign-up, a code anyone can request without us, expiry dates, an admin
  screen, workspaces, roles, and everything else #314 owns.

## Todo
- [ ] Add the invitation record to Cloud's schema: the code, the address it goes to, the
      request it answers, whether it has been sent, and the account and time it was redeemed.
- [ ] Send issued invitations from the Worker's hourly run through Resend, marking one sent
      in the same transaction so a retry never sends twice.
- [ ] Write the invitation email: what the code admits, where to paste it, and
      `support@ai4kanban.dev` as the reply address.
- [ ] Add the redeem route: one code, one account, refusing unknown, redeemed, and withdrawn
      codes with their own reasons.
- [ ] Add the code box to the not-admitted state of the Cloud section, with the answer it
      gives on each refusal.
- [ ] Verify a sending subdomain of `ai4kanban.dev` with Resend and hold its API key as a
      Worker secret.
- [ ] Write approving a request, issuing a code to someone who never asked, withdrawing a
      code, and the sending domain's setup into `cloud/README.md`, beside standing the
      project up.
- [ ] Amend the pages #321 published earlier in this release: rewrite the terms line saying
      the preview sends no email, and add the invitation email and its provider to the
      privacy page.
- [ ] Check that a code admits one account only, that a second redemption is refused, that a
      withdrawn code admits nobody, and that one approval sends exactly one email.

## Decided by the agent
- **What sends the mail**: Resend, from a subdomain of `ai4kanban.dev` verified for sending.
  The root domain's MX and SPF belong to the Email Routing that delivers
  `support@ai4kanban.dev`, and a sender on the same name fights them. The Cloudflare
  `send_email` binding #326 uses cannot serve: any recipient but a verified destination needs
  Workers Paid.
- **What the preview pays for it**: nothing. Resend's free tier covers 3,000 emails a month
  and 100 a day, and an invite-only preview issues codes in ones.
- **Where approving happens**: in the database, in the statement that admits an account
  today. An admin screen would be a second privileged surface on a service that answers
  nobody but its own Worker, and #326 already settled that this release has none.
- **What turns an approval into an email**: the hourly run #323 already deploys. Approving
  stays one write, the mail key never leaves the Worker, and a failed send is retried on the
  next run. The cost is up to an hour between approving and the code arriving, against a
  request nobody was promised an answer to.
- **Does #326's request notice move to Resend too?**: no. It goes to our own verified
  destination, which is free on the plan the preview runs, and moving a working send buys
  nothing.
- **Why #321 became a blocker rather than a line in the scope**: both cards ship in 0.8.0
  now, and no code may be emailed until the pages are live, so the board holds that order in
  `blocked_by` instead of leaving it to whoever picks the card up.
- **What a redeemed code leaves behind**: the invitation record, holding the address it was
  sent to. That is what ties an admitted account back to the invitation, so #321's privacy
  page lists it beside the invite request.

## Source
- #326 — the account record, the admitted-accounts list, the invite request this card
  approves, and the Cloud section it adds a box to.
- #311 and `docs/kanban/memory/cloud/decisions.md` — the invite-only preview and what opens
  sign-up.
- #321 — the terms page that says the preview sends no email, and the privacy page that lists
  what it holds and who processes it.
- #323 — the hourly scheduled run the send hangs off.
- Resend — free tier of 3,000 emails a month and 100 a day from one verified domain; a
  sending subdomain is what it recommends beside a domain that receives mail elsewhere.
