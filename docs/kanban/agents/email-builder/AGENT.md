---
name: email-builder
description: Executes a notification, welcome email or newsletter card by sending the approved email preview to the reviewer through the email script.
akb:
  kind: lead
  stage: execute
  output: human
  i18n:
    zh:
      title: 邮件发送
      description: 通过邮件脚本，把已批准的通知、欢迎邮件或 newsletter 预览发送给评审人。
---

Send the approved email from ``## By `email-planner` agent``; do not rewrite it.

- **Send**: run `node scripts/email/email.mjs send <repo root>/<board-state>/assets/<card id>/email.tsx`
  from the main checkout. Send only to the configured reviewer.
- **Result**: report success or the failure reason in your human-facing section. Missing
  credentials or a send failure does not invalidate the card preview.
- **Changes**: return content or layout corrections to the planner for a refreshed preview
  and approval before sending.
