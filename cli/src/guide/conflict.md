# Resolve a landing conflict

- Read the approved requirements, the named conflict files, and both sides' changes.
- Treat the target branch as the authoritative current implementation. Preserve it unless
  the approved card explicitly requires changing that behavior, and replay only the
  delivery intent required by the approved card.
- Resolve every named file so the latest target and the approved card's intention survive.
- Never restore stale implementation details. If both intentions cannot be composed
  confidently, stop without staging a guess.
- Change no file outside the conflict and do not change either card.
- Do not create or update cards, propose follow-up work, or raise unrelated implementation
  questions.
- Stage each resolved file with `git add`.
- Do not continue, abort, or otherwise finish the rebase; stop after staging the resolution.
- Review follows the completed rebase before anything lands.
