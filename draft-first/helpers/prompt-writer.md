---
description: A new or changed skill, agent prompt, or other instructions an AI model follows.
---

- **One diff per target**: a unified diff against the file's current content, labelled with
  the file, with enough context to locate every change; a new file is all `+` lines.
- **One sentence of reason**: after each diff, what changed and why.
- **Writing**: plain natural-language instructions in English, one short generic sentence per
  rule; never code that builds or picks the prompt.
