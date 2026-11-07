# Add tasks

Use this guide whenever work may become a card.

- **Modules**: read `docs/kanban/modules.md` and relevant code or plans to choose or verify tags;
  follow `akb guide module-map` when none fits or a module needs splitting, and never ask the
  user to categorize the task.

## Create the card

Write the fields with flags, never by editing frontmatter. Only `--title` is required:

```text
akb raw create --title "..." --modules <names> --priority <high|med|low> \
  --workflow <id> [--previews <agents>] [--blocked-by <ids>] [--related <ids>] [--source <ref>]... \
  [--slug <short-english-slug>] \
  [--question "..." --recommended-option "..." --option "..." [--mode multi]]...
```

- **Workflow**: the request's own, else the id from `akb workflow list` that fits the work.
- **Previews**: the agents from `akb previews --triggers --workflow <id>` whose conditions the
  card meets, or `--previews ""` when none is met.
- **Dependencies**: `--blocked-by` for cards this one waits on, `--related` for cards that only
  relate; an existing card that needs this one's output gets
  `akb raw update <id> --add-blocked-by <ids>`.
- **Source**: each plan path, card `#id` or URL the card came from.
- **Non-English title**: needs `--slug`.
- **Open questions**: classify each as `akb guide update-questions` says before writing it.

For example:

```text
akb raw create --title "Document the export format" --modules docs --priority low \
  --workflow coding --blocked-by 42 --related 41 --source "#41"
```

### Group tasks

Use a group when the cards are parts of one larger outcome, such as a plugin system with its
Slack and Notion examples: a root plus one card per part. Otherwise keep cards independent.

```text
todo/<id>-<short-slug>/
  root.md                # the whole job
  <subid>-<slug>.md      # one part, its own card
```

1. Create the root; call the id it prints `<id>`.
2. Create each part with `--related <id>`, and `--blocked-by <subid>` where order matters.
3. Move the files: the root becomes `todo/<id>-<short-slug>/root.md`, and each part keeps
   its filename under that folder. The folder slug is short English ASCII.
4. Point the root at its parts: `akb raw update <id> --related <subid,subid,...>`.
5. Repoint the moved cards in `todo/README.md`: give each bullet its new path and leave it
   under its heading.

The root's `## Todo` lists its parts, one line each ending in `#<subid>`.

### Writing

Fill the body scaffold that `akb raw create` wrote, carrying the request's constraints into
it. Do not rename or translate its section titles, and leave empty scaffold sections in
place. Do not repeat the title as an H1.

Cloud moves the card on by itself once it reaches the board; do not refine it in this session.
