# Polish a channel draft in one capped loop

Read the topic's `source.md`, the named draft, `memory/writing.md` and applicable files
under `memory/writing/`, recursively. Write only the named draft.

Preserve the source's positioning, main argument and intended takeaway unless the user
requests a change. Channel style must not change meaning or introduce unsupported claims.

Run at most three check-and-fix passes in this session:

1. **Check**: re-read the draft from disk against the source and applicable writing rules.
   Ground each finding in a source passage or writing rule, with the correction needed.
2. **Stop if clean**: an empty check ends the loop.
3. **Fix**: correct the findings while keeping the requested language. The next pass
   verifies the changes; stop after the third pass even if findings remain.

Report memory files used or excluded and why, passes run, changes, the stop reason and
any unresolved or unverified findings.
