# Template selection

- **Search**: run `akb cloud template list-tags --category prop` or `--category motion`, then `akb cloud template search` within the best tag, adding shot keywords when they help.
- **Use a fit**: take a result whose style and timing fit the shot, and fetch it with `akb cloud template get <name> --to <board-state>/assets/<card id>/<name>/`.
- **No match**: when nothing fits, or the catalog cannot be reached, build it yourself; never ask the user to pick.
