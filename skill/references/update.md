# Updating the skill

Pull a newer version of the kanban skill into a project that already has it. `${KB}` below
is the script invocation from SKILL.md's "The script" section.

**The one rule: `docs/kanban/` is yours; the skill folder (`SKILL.md`, `kanban.mjs`,
`references/`) is upstream's and gets overwritten wholesale. Never merge the two.**

## Plugin install (skill lives in the plugin cache)

```
/plugin marketplace update kanban
/plugin install kanban@kanban
```

Then run both checks below.

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

Then run both checks below.

## Config check (both channels)

```
diff <skill folder>/config.md docs/kanban/config.md
```

Ignore filled-in values vs `{{PLACEHOLDERS}}`. If upstream added a whole new setting, add
that one line to `docs/kanban/config.md` and ask the user only for the new value.
Otherwise leave the config untouched.

## Scaffold check (both channels)

1. Add what an older version never wrote — it reports what it added:

   ```
   ${KB} init
   ```

2. If it seeded a blank `docs/kanban/modules.md`, fill it in per `references/module-map.md`.

3. Re-run `${KB} init` to create a memory path for every module on the map. (For one
   module added later: `${KB} memory-init <module>`.)

Leave the root notes and the cards alone — don't move notes into the module paths, and
don't hand-add `modules:` lines to cards.

## Verify

```
${KB} peek
${KB} version
```

Tell the user to review `git diff` before committing. The update is idempotent. The
board UI needs no update — `npx kanban-skill-ui@latest` picks up a new release.
