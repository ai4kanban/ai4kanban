# Verify a channel draft

Run `akb marketing verify <channel> <id>` after repurposing. It starts fresh sessions, has no
`--print`, and never follows `akb channel` automatically.

- **Read independently**: read the named channel draft, `memory/writing.md`, and only the
  assigned files from `memory/writing/`. Never read writing sessions, logs or prior reports.
- **Check every rule**: judge every applicable rule against the words on the page. Report
  each failed rule with its memory path, quoted rule, failing passage and needed correction.
- **Change nothing**: write no file and start no run. Put findings in the final reply; when
  all applicable rules pass, reply exactly `PASS` with nothing else.

The board merges the readers' reports, starts one writer to fix the draft, then verifies
again. A reader gets at most six assigned files, plus the shared `writing.md`. A third
verify pass ends the loop even if findings remain. Stopping a reader ends the loop; an
errored reader still hands on its report. No report means no fix run.
