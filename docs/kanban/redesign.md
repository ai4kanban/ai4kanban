# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## Plugin install / script

- ❌ **Assuming the script can find the board when it runs from a read-only plugin cache** → ✅ the script must locate `docs/kanban/` from the working directory (commands run from the repo root), not from where its own file sits — a card that moves per-project state out of the skill folder for plugin support must fix root resolution too, or the plugin channel silently breaks.

## Local UI

- ❌ **A new global setting gets its own labeled control in the header** → ✅ turn the header's agent badge into ONE configuration (gear) icon button that opens a single Configuration dialog; global settings (auto-refine, the agent connector) live inside it, so the header stays one quiet icon instead of growing a control per setting.

## Auto-refine

- ❌ **Auto-refine records every auto-answer in `decisions.md`, same as the human resolve flow** → ✅ keep auto-answers on the card; append to `decisions.md` only a decision that helps future decision-making, so `decisions.md` stays a short memory not a dump of every answer.
- ❌ **An auto-refined card mixes the human's original input with the agent's own additions** → ✅ split the card into two parts — the plan, then what the agent decided/refined on its own — so the additions are easy to read and audit.
