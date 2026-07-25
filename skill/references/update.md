# Updating the skill

Pull a newer version of the kanban skill into a project that already has it. `${KB}`
below is the script invocation from SKILL.md's "The script" section.

**The one rule: `docs/kanban/` — board data and `config.md` — is yours; the skill folder
(`SKILL.md`, `kanban.mjs`, `references/`) is upstream's and gets overwritten wholesale.
Nothing is merged, and an update never writes under `docs/kanban/` beyond adding a
brand-new config field.**

## Plugin install (skill lives in the plugin cache)

Refresh the marketplace and re-install, then do **Config check** below; nothing in your
repo changes:

```
/plugin marketplace update kanban
/plugin install kanban@kanban
```

## Copied install (skill lives in `.claude/skills/kanban/`)

1. **Clone upstream:**

   ```
   git clone https://github.com/dist0com/kanban-skill /tmp/kanban-skill-update
   ```

2. **Show what changed.** `${KB} version` prints the stamped source SHA. Summarise the
   delta in plain language before writing anything (no stamp? describe the notable
   recent changes instead):

   ```
   git -C /tmp/kanban-skill-update log --oneline <stamped-sha>..HEAD -- skill kanban-ui
   ```

3. **Overwrite the skill folder wholesale:**

   ```
   cp -R /tmp/kanban-skill-update/skill/. .claude/skills/kanban/
   ```

4. **Re-stamp:**

   ```
   printf 'sha: %s\ndate: %s\n' "$(git -C /tmp/kanban-skill-update rev-parse HEAD)" "$(date +%F)" \
     > .claude/skills/kanban/.version
   ```

## Config check (both channels)

Compare the shipped blank template against your filled-in config:

```
diff <skill folder>/config.md docs/kanban/config.md
```

Filled-in values vs `{{PLACEHOLDERS}}` is expected noise. You're only looking for a
whole new setting. If upstream added one, add just that line to `docs/kanban/config.md`
and ask the user only for the new value. Otherwise leave the config untouched.

## Verify

```
${KB} peek
${KB} version
```

Tell the user to review `git diff` before committing. The update is idempotent. The
board UI needs no update — `npx kanban-skill-ui@latest` picks up a new release.
