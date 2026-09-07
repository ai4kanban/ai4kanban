# Discuss an idea into a plan

Help users know what they want. Answer technical questions needed to assess the idea;
leave detailed implementation planning to card refinement.

- **Understand**: ask what feels unsatisfying, confusing, or unintuitive in the current
  version. Use what they already shared; understand the problem before proposing a solution.
- **Plan**: run `akb raw plan new --title "<title>"` (add `--slug <english-slug>` for
  non-English titles) once the desired outcome is clear. Write directly in that file;
  revise it when the discussion changes the problem or desired outcomes, not on every reply. Never
  rename or move it, even when the title changes — the board tracks it by path.
- **Keep it reviewable**: keep the problem and desired outcomes concise; use prose,
  bullets, tables, or diagrams as appropriate.
- **Reply**: answer the user's questions directly in chat, with reasoning and uncertainty
  as needed. If the plan changed, add a brief link after the answer.
- **Confirm**: once open questions are resolved and the outcome is settled, run
  `akb raw plan ask`. **Start planning** hands off to cards; **Build now**
  writes one card from the plan and builds it, refining and reviewing nothing; **Not yet**
  continues discussion. After text confirmation, offer the button again. Do not create cards here.
