---
title: Attach a file to Create task instead of retyping it
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [250]
modules: [local-ui, skill]
questions: []
---

Create task already accepts typed messages and pasted images in its full-page composer.
Add a text, PDF or Word document without pasting its contents; the selected runtime reads
it with its own tools and reports a failure when it cannot. The attachment follows Discuss, Add task, or Build now, whichever the user selects.

## Worth noting
- **Document support**: accept PDF and Word alongside text on every runtime, let the agent use its available reading tools, and surface its errors; this is best-effort reading, not a promise that every harness or model supports each format.
- **Local copy**: desktop and browser both stage the selected document beside local conversation or run data, outside git; the copy survives sending and is deleted with its owner.
- **Large files**: read long documents in sections without prompt truncation, with a 60 MiB document limit beneath the existing upload ceiling.

## By `ui-designer` agent

<Mockup src=".mockups/252/a.tsx" label="A" />

<!-- agent -->

## Today
- **Current screen**: `kanban-ui/components/CreateSheet.tsx` has a shared composer, Discuss/Add task/Build now mode selector, runtime picker, transcript and optional plan pane; there is no Describe tab.
- **Existing images**: `pictures.ts`, `picture-box.ts` and `CreateSheet.tsx` already stage pasted images, check runtime support and hand them to a discussion or run.
- **Web research (2026-09-09)**: the sources below do not establish native PDF-and-Word support in a majority of the eight harnesses. Native file input, agent-run extraction, and consumer-app uploads are different capabilities; these are documentation findings, not local runtime tests.

| Harness | PDF evidence | Word evidence |
| --- | --- | --- |
| Claude Code | Built-in `Read` supports PDF and page ranges | Anthropic's DOCX skill reads with `pandoc`; a tool/dependency path, not native `Read` support ([Read](https://code.claude.com/docs/en/tools-reference), [DOCX skill](https://github.com/anthropics/skills/blob/main/skills/docx/SKILL.md)) |
| Codex CLI | CLI docs describe image flags and workspace tools, without confirming direct PDF input | Direct Word input not established in CLI docs; workspace-tool reading is a possible route, dependent on installed tools ([CLI](https://learn.chatgpt.com/docs/codex/cli), [flags](https://learn.chatgpt.com/docs/developer-commands?surface=cli)) |
| Cursor | Staff documents working PDF attachment in the editor; headless parity is unconfirmed | Staff says DOCX cannot attach directly but agent tool-based reading works ([staff answer, July 8](https://forum.cursor.com/t/cursor-cant-handle-attached-docx-files/165095/7)) |
| OpenCode | V2 docs explicitly exclude PDF binary attachments from model requests | Other binary attachments are also excluded; shell tools offer a separate extraction route ([V2 attachments](https://opencode.ai/v2/docs/attachments), [tools](https://opencode.ai/docs/tools/)) |
| Kimi Code | Built-in docs list text `Read`, image/video `ReadMediaFile`, and Bash; direct PDF reading unconfirmed | Direct Word reading unconfirmed; Bash is available for extraction ([tools](https://www.kimi.com/code/docs/en/kimi-code-cli/reference/tools.html)) |
| dsh | A PDF-reader plugin exists; not evidence of default support | An Office plugin provides DOCX reading; it must be installed ([PDF plugin source](https://github.com/sunshine-lang/dsh-pdf), [Office plugin source](https://github.com/kw78/dsh-office-tools)) |
| ZCode | The CLI wrapper documents image attachments and runtime tools; PDF support unconfirmed | Word support unconfirmed in the wrapper documentation ([wrapper source](https://github.com/kingsword09/zcode-cli)) |
| Grok Build | Official page documents terminal execution, skills and headless mode; format-specific support unconfirmed | Word support unconfirmed for Build; consumer Grok upload support is not proof of CLI support ([Build](https://x.ai/build)) |

- **Transport conclusion**: stage the original file and put its readable path in the agent's message for all harnesses. The agent can read natively or extract with available tools; do not feed document bytes through an image flag or assume a binary attachment reaches the model.
- **Existing image boundary**: this revision leaves `Harness.images` and the pasted-image workflow unchanged; a document path needs no new model-format capability gate.
- **Transport**: `kanban-ui/next.config.mjs` currently caps server-action bodies at 64 MB; the old unlimited-file promise cannot hold on this path.

## Scope
- **Entry point**: add an accessible file picker and document drop target to the existing Create task composer; keep its mode selector, runtime picker, transcript, plan pane and responsive layout.
- **One document**: allow one new document per message or run, alongside optional typed instructions and existing pasted images; reject extra documents without replacing the first.
- **Formats**: accept nonempty `.txt`, `.md`, `.pdf`, `.docx` and `.doc` files; preserve original bytes and extension. Binary PDF/Word contents are valid uploads. Reading quality, legacy Word, encryption and scanned-page extraction are handled by the agent and its available tools.
- **Mode semantics**: Discuss reads and discusses the attachment; Add task creates/refines cards; Build now retains its existing confirmation and build flow. Text alone or an accepted document alone enables sending in each mode.
- **Visible attachment**: show filename, size and Remove inside the composer's frame; keep the full name accessible when truncated. A document-only message/run uses the filename as its visible input label.
- **Draft state**: switching mode or runtime keeps the file and text; do not block document sending based on a harness/model format table or switch runtimes automatically.
- **Effective runtime**: use the discussion's pinned runtime in Discuss and the selected/default planner or builder runtime for Add task/Build now; preserve the existing runtime availability and session checks.
- **Runtime reading**: hand every runtime the original staged path and ask it to read the document with its own available tools. The board does not select/install converters, add document plugins, or gate formats by model capability.
- **Bounded upload**: use a shared 60 MiB document limit beneath the existing 64 MB request ceiling, checked in the picker/drop handler and server. Leave existing image limits unchanged; never silently truncate document bytes or extracted text.
- **Staging**: upload bytes through the same local-server boundary in desktop and browser; use generated storage IDs and retain the original name as metadata. Browser-supplied paths never grant access to arbitrary local files.
- **Ownership**: stage unsent files in the composer's box; on accepted send, transfer ownership to that discussion or run. Removal/closing discards unsent files; a refused send preserves them and the text for retry.
- **Retention**: discussion files live beside the transcript under `.chats/` and survive hiding or archiving the discussion; clearing/deleting the transcript deletes them. Direct-run files live beside the log under `.sessions/` and survive retries until log deletion.
- **Plan handoff**: when a discussion's plan starts a run, carry required source references and give that run its own retained copy; clearing the discussion must not break a run reading its source.
- **Reachability**: the resolved path must be readable from the actual run workspace and harness sandbox, including Build now's isolated checkout. No source copy enters git or a card body.
- **Failure behavior**: upload or transfer failure starts no partial send and preserves the draft for retry. A later unsupported-format, parser, permission, model or missing-tool error remains visible in the discussion/run; the agent must report unreadable material and not derive work from an unread source.
- **Prompt**: send typed instructions, original filename and the staged path; keep document bytes out of the start prompt and visible run label. Ask the agent to read the material completely with available file/extraction tools, report partial or failed reading, and never silently discard an attachment.
- **Routing**: the selected mode still controls the action; within card planning, explicit user intent and file contents use the existing add-task/extract-ideas routing. A written plan needs no new brief step; #251 owns that separate feature.
- **Provenance**: each resulting card names the original file in `## Source`; the transcript or run log records the attachment read. Reuse existing work and skip already-built work under the normal planning rules.
- **Boundary**: this card changes the product board's Create task surface and its shared file transport; marketing New topic, general card-chat file picking, voice, folders and bulk imports are out of scope.

## Todo
- [ ] Carry staged document paths through every harness's message transport, fresh and resumed, without adding model-format gates or passing documents as images.
- [ ] Exercise PDF and DOCX reading with available runtimes and record versions/results; verify failures remain visible instead of disabling the format for other runtimes.
- [ ] Add one-document picking/drop, filename/size/Remove, document-only sending, and upload/refusal states to the current composer.
- [ ] Extend staging, atomic ownership transfer and cleanup for discussion sends, direct runs and discussion-plan handoffs; preserve failed drafts and existing images.
- [ ] Pass readable staged paths into Discuss, Add task and guarded Build now, including isolated workspaces; add transcript/run metadata and resulting-card provenance.
- [ ] Verify typed-only, file-only, text-plus-file and existing image sends; mode/runtime changes; repeated discussion turns; plan-to-run handoff; retry/resume; and Build now confirmation.
- [ ] Verify empty/over-limit files, valid binary PDF/Word uploads, corrupt or encrypted documents, missing extraction tools, long names, multiple dropped documents, upload failure and missing paths, with no silent source loss.
- [ ] Verify removal, closing, transcript clearing, discussion archiving and log pruning delete only the files they own; one discussion/window cannot access another's staged files.
- [ ] Run an end-to-end spec-file creation and inspect the resulting cards, original-name provenance and complete reading of a long fixture.
- [ ] Document accepted formats, best-effort runtime reading and size limit in `kanban-ui/README.md`; add the planned file-input sentence to existing `web/` copy without page-code changes.
- [ ] Run the required checks for the implementation's touched apps.

## Decided by the agent
- **Delivery mechanism**: paths keep document transport independent of native multimodal input; extraction is the runtime's work and depends on its tools and permissions.

### Overruled by the user
- **Runtime support**: accept a format only through a verified harness input path; a CLI attachment flag or an image-capable harness alone does not prove the selected model can read it.
- **No conversion choice yet**: PDF/Word extraction depends on the format question; if selected, obtain the tech-stack-advisor spec before choosing a converter or marking those formats supported.
- **No size limit on the file**: the agent can read a long plan in sections, so a number
  here would refuse a file the board can handle. What is refused is a file the board cannot
  read.
- **Why the browser's text is written to the run's folder**: a document sent as the run's
  prompt is copied into the run's record and shown as the run's label. A file the run opens
  keeps it in one place.
- **How the router tells a plan from an article**: it reads what the user typed alongside
  the file first, then the file's opening. When it still cannot tell, the file is read as a
  plan — that reading drops nothing.

## Source
- **User correction**: research PDF/Word support on the web; allow the runtime to report unsupported-format errors instead of preemptively disabling documents by model.
