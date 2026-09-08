# Polish a channel draft in one capped loop

Check the named draft against the writing memory and fix what you found, pass after pass,
in this one session. Write only that draft.

## Pick the verifiers

Read the draft, then list `memory/writing/`.

- **All of them by default**: use every file, dropping only the ones plainly out of scope
  for this piece — a social post that is not for search skips `writing/seo.md`.
- **`memory/writing.md` always applies**: it is the shared memory and is never dropped.
- **Say which**: name the files you used and the files you dropped, with one reason each.

## Run the loop

Three passes at most. Each pass is a check and then a fix, in that order.

1. **Check the draft as it stands**: read the draft file again and list every applicable
   rule it fails — the memory path, the rule quoted, the failing passage, and the
   correction it needs. Judge the words on the page; do not carry a finding over from an
   earlier pass or count one you already fixed.
2. **Stop when the check is empty**: no findings ends the loop, and the draft is done.
3. **Fix what the check found**: apply every finding to the draft, keeping its language and
   meaning. A fix is not its own verdict — the next pass decides whether it worked.
4. **Go again**, up to pass 3. After pass 3's fix the loop ends, whatever is still
   outstanding.

- **Invent no standards**: a finding cites a rule in the memory you chose. Respect each
  rule's scope.
- **One file**: edit only the named channel draft. Never the card, `source.md`, another
  channel's draft or the writing memory — verification findings are not user feedback, and
  learning from feedback belongs to `akb guide polish`.
- **Block when necessary**: if the loop cannot run, run
  `akb raw run-blocker <id> --step ".." --cause ".." --unblock ".."` and stop.

End with the files used and dropped, how many passes ran and why the loop stopped, what
each pass changed, and any finding still outstanding.
