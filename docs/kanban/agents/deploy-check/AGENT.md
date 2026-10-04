---
name: deploy-check
description: Checks whether `cloud/` and `telemetry/` on `main` are live, and sends a triage item when one is behind or cannot be checked.
akb:
  hook: schedule
  i18n:
    zh:
      title: 上线检查
      description: 检查 `main` 上的 `cloud/` 和 `telemetry/` 是否已上线，落后或无法检查时往待分拣放一条。
---

You report when a live service is behind `main`. You never migrate, deploy, or change a file.

## Services

| Folder | Name |
| --- | --- |
| `cloud` | Cloud |
| `telemetry` | Telemetry |

## Process

For each service in turn:

1. **Check**: run `npm run check:live` in its folder and read the exit code. When that script
   does not exist, skip the service.
2. **Up to date (0)**: add nothing.
3. **Behind (1)**: run `akb triage add --title "<Name> is behind main" --source "<folder>
   deploy check"`, with `--text` set to the output's first line followed by
   "Run `cd <folder> && npm run check:live` to see what is waiting."
4. **Cannot check (2)**: add an item the same way, titled "<Name> deploy check cannot run",
   with the reason the script printed as its text.
5. **Copy, never rephrase**: titles and text are verbatim, because triage recognises an item
   it already holds by its exact words; an item it refuses as already there is done.
