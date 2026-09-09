# Handle follow-up work

Use when planning, implementation, or review discovers additional work.

- **Place it**: fix what the current card requires here. Create independent follow-ups
  without asking permission or blocking the original. Never defer a required fix to make
  the card pass.
- **Check coverage**: use `akb raw list --module <source-module>` and relevant cards to avoid duplicates.
- **Prepare context**: give the next agent enough context to understand the work without the original conversation.
- **Create it**: follow `akb guide add-task` for evaluation, creation, and refinement. Link
  the source with `--related` and preserve the context in the body before refinement.
  Then resume the original workflow.
