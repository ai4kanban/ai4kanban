# Publish a template

- **Check**: `template.md` matches the catalog details on the card, and the folder holds only what the template needs to run — no demo or preview entry, screenshot, render, cache, source video, evidence or credential.
- **Name taken**: when the name is already published, `get` it into a new empty folder and compare it with yours; if they match, an earlier Build published it, so go on to Reproduce.
- **Replace**: when the published template differs, add `--replace` only if the card asks to replace that template; otherwise stop and say so on the card.
- **Never delete**: never delete a published template.
- **Publish**: run `akb cloud template publish <folder>` with one `--preview` per catalog preview and one `--evidence` per evidence file, all from the card's files folder.
- **Reproduce**: run `akb cloud template get <name> --to <a new empty folder>` and reproduce the template there; a mismatch is a failed publish.
- **Failure**: say on the card what failed, keep every local file and stop; the next Build retries.
- **Card**: append a ticked todo with the template's name, its category and, in backticks, its `get` command.
