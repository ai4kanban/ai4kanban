# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

## skill

- **Board, setup, update**: `akb guide board`, `akb guide setup`, `akb guide update`.
- **Daily loop** — refine, build, finish, reject or discard, test cases; planning never builds: `web/content/docs/daily-loop.mdx`.
- **Start now** builds a sentence, a discussion's plan or a triage item, writing its card first: `akb guide implement`.
- **Planning** — refine, resolve, next card, module map; matching spec agents always run, inside the card's one planning session: `akb guide refine`, `akb guide resolve`, `akb guide next-card`, `akb guide module-map`.
- **Revising a card**: a revision that adds images, page copy or a screen has the matching spec agent produce it, and feedback on a draft revises that draft and its preview in place: `akb guide revise`.
- **Long drafts**: a planning draft over about 20 lines goes in a card asset, one file per language: `akb guide spec-agent`.
- **Card stages** (blog, slide deck, social post, product video, video clone): stages are listed on the card, each review is a todo, and the user moves on with Approve (`akb card approve <id>`) rather than a confirmation question: `akb guide multi-stage-drafting`.
- **Cards finished in planning**: video, deck, social post, blog and video-clone cards end planning with every todo ticked and an Archive prompt, unless the workflow has a build agent; a delivered blog post lives only in its article file.
- **Slide deck revisions**: a card chat reuses what it already loaded on later turns, and a deck change edits and checks only the affected pages; slide text lives only in the pages, so a storyboard needs no `copy`.
- **Card embeds** — Asset labels, alt text and variants, Compare, Storyboard: `akb guide writing`.
- **Runs** — stop, retry, resume, creation resume/discard, sub-runs, runtimes: `web/content/docs/runs.mdx`.
- **Background tasks**: Claude Code runs and chats wait up to 2 hours on background work; a run's background commands end with it, a chat's survive the reply; quitting the desktop app ends replying chats.
- **Several boards per repository**: `kanban-ui/README.md`.
- **Triage**: `web/content/docs/triage.mdx`; follow-ups: `web/content/docs/follow-ups.mdx`, `akb guide follow-up`, `akb guide reflect`.
- **Triage items**: file names are English slugs (`akb triage add --slug`) the card keeps; an item from a workflow's scheduled agent becomes that workflow's card.
- **Auto-sort** asks only what is yours to decide; its cards check the code first and are archived with evidence when already done or obsolete.
- **Direct requests** become a card as asked, with no duplicate check.
- **Card source** lives in frontmatter `source:` (`akb raw create --source`, `--triage <source-id>`) and shows as a Source link.
- **Dependencies**: `akb guide add-task`; a card cannot depend on its own group or a parent group (`akb raw validate` reports `dependency-cycle`); when a dependency lands or is rejected, a waiting card gets one revision to recheck its plan.
- **Agents, workflows, specialists, Pro, rules, global memories, schedules, memory review, project description**: `web/content/docs/agents.mdx`, `web/content/docs/workflows.mdx`, `akb guide describe-project`.
- **Writing an agent**: `akb guide write-agent`; `akb raw agent-file <agent> AGENT.md` prints any agent's file, built-ins included; trailing `#` comments are ignored as in YAML; old keys (`stage`, `kind`, `lead: true`, `hook: execute`) are refused with the line to change.
- **Agent sections**: `akb guide writing`.
- **Workflow agents**: each agent belongs to one workflow; copying a workflow copies its agents, and copying is the only way to change a built-in agent's instructions; `akb workflow stage <id> --stage <stage> --on|--off <agent>` switches one; a refused lead is named with the reason and the line to fix.
- **Workflow choice**: a new card's workflow follows the work it delivers, falling back to the board default; each built-in's description says when to pick it, so a deck designed as HTML/TSX lands on Slide deck and a feed post (LinkedIn, X, carousel) on Social post — text-only unless the card asks for images or the platform needs them; `akb create --workflow <id>` sets it; `akb raw update <id> --workflow <id>` moves a card that has no run or delivery on it, sending it back to `todo` for a re-plan.
- **Discussions** never edit code, judge the idea first and end in **Plan tasks** or **Start now**; one discussion can hold several plans (`akb raw plan drop` withdraws one): `akb guide discuss-idea`, `web/content/docs/chat.mdx`.
- **Workflows without a worktree** end on a ticked `Output:` todo the delivery added, naming a file or folder with a directory (`./out/email/`); a bare file name, a ticked plan todo or an earlier delivery's `Output:` line is not an output.
- **Card chat** makes a settled change without asking again and picks its runtime per conversation: `web/content/docs/chat.mdx`.
- **Reject while the card chat replies**: `akb card reject` works mid-reply; the reply stops and the conversation is dropped.
- **Planning sessions carry on**: a card's planning continues the session it was created or last planned in, starting fresh only when the tool changed or the session is gone.
- **Planning questions** are written for someone who has not seen the board — no card ids, agent names or board terms.
- **Planning QA** checks the facts a plan turns on against authoritative sources, and stays open when it cannot settle one.
- **Auto-refine**: with the board open, a card written or edited is refined once; a card waiting on answers says so.
- **Suggest follow-up work**: at most 10 per round, deduplicated across cards; small fixes can be asked first (default), just done, or not suggested.
- **Scheduled agents** run only on new input.
- **Memory review**: unreviewed chats are kept up to 30 days; rejected or discarded cards and discussions are not reviewed.
- **Cleanup**: cards gone from the board for 7 days lose attachments, old mockups, chats and finished delivery worktrees (assets memory or open cards reference stay); archived cards are deleted after 30 days.
- **`akb raw list`**: `--archived` lists landed cards (`--since`, `--workflow`, `--json`); `--stale` lists parked cards, which the board never rewrites or drops.
- **`akb` with no arguments** (or `akb raw`) prints the command list and exits 0.
- **Releases removed**: no release command, `--release`, `releases.md` or changelog; `akb update` removes them from old boards.
- **Board settings are per machine**: `.akb/boards/<board>/ui.config.json`, outside git and Cloud; the old `docs/kanban/ui.config.json` migrates on first read.
- **Codex** runs without approvals or sandbox, your own `command` wins: `kanban-ui/README.md`; when the `codex` on PATH cannot start, the copy inside ChatGPT is used.
- **Codex cost per reply**: a resumed or forked Codex chat or run is billed only that turn's tokens; earlier records the rollout can prove are corrected once when a chat or Insights opens.
- **Specialist roles**: `copywriting` writes all copy outside the product's screens (one asset per page or file, languages as variants, shown as the reader sees it); `ui-designer` writes its mockups' text; `illustrator` makes every other image, and motion as a muted looping MP4 (GIF only where video cannot go).
- **Spec sections** sit above the card's divider for review; a plan lead with nothing to show writes none, and draws a mermaid diagram only when a sentence cannot explain a change.
- **prompt-writer** edits a prompt only where its agent lacks a needed instruction; **email-planner** covers any email, in its own format when it has a send script.
- **Competitor research**: a card that only names competitors gets a whole-product comparison and adds them to the `competitors` memory, re-read after three months; feature planning never adds competitors. Such a card is read and archived, not built.
- **Asset sources**: clips, covers and scripts use only self-made or generated, repository or open-licensed material; anything else (platform logos included) is asked first.
- **`akb cloud image` / `akb cloud tts`** generate an image or narration on Pro credits; every agent can call them.
- **All workflows are free**: every built-in and copied workflow runs and copies without Pro; without Pro or credits, agents fall back to local voices, layout or code-drawn images and no music, and say so on the card.
- **Deck planning**: a wireframe storyboard plus three styled samples first, then the final slides as HTML/TSX pages; the delivered `.pptx` is one image per slide with speaker notes, not editable. `akb raw agent-file deck-planner scripts/pack-pptx.mjs` packs PNGs into a deck.
- **Video script**: the first review is story, shots and exact lines; capture details and timing follow approval, and changing approved content reopens it.
- **Blog outline** shows the title, section plan, SEO title and meta description; with a primary keyword the planner reads the top-ranking pages and builds around what the post adds.
- **Video clone**: clones any video made with code into a beat-table template you fill with your own content without code changes; you approve a breakdown and a clone script against the source, get the clone side by side with it, and a score matched beat by beat: `web/content/docs/agents.mdx`.
- **Video clone templates** render beat by beat into cached clips, so a change re-renders only what it touches; shared `prop` and `motion` templates are checked before building new ones (`akb cloud template list-tags --category prop`).
- **Look-matched clones**: `ui-cloner` fixes the clone until it looks like the source, using the closest free font instead of the source's own, and the card compares the source with the final shot; `video-cloner` reuses a motion or prop whose style and timing match.
- **UI templates**: `hero-tilted-screen` is in the shared catalog (`akb cloud template search --category ui`); agents use a template only when the request names it.
- **Video templates**: a card naming a video template is built on it with no candidates offered; named props and motions go into their shots, and `hyperframes-editor` searches for others only when one may save work.
- **Publishing clones**: the `UI clone` workflow and `video-clone` with `video-template-publisher` publish a reviewed clone to the shared catalog, reproduce it from an empty folder, and record its `get` command on the card.
- **Template previews**: `akb cloud template preview <name>` keeps a preview already named `<name>-…` as it is.
- **Template publish defaults**: `akb cloud template publish` reads a `template.md` with no `access` as `pro` and no `source` as original; publishing agents write `access: free` only when the card asks for a free template; a malformed value is still refused.
- **Self-contained motions**: `card-widen`, `gather-into-icon` and `platform-orbit` from `akb cloud template get` render as their catalog clips with only the template's engine and your content; `platform-orbit` no longer ends in a logo.
- **draft-first**: a standalone skill for drafting a task's key parts for review before building; long drafts go in `.md` assets: [ai4kanban/draft-first](https://github.com/ai4kanban/draft-first).
- **Blog researcher**: the `blog-post` workflow researches the public facts, real-world solutions and counter-examples behind a post's angle before the outline and again while writing, saved as `research.md` beside the card; boards that already set up Blog post get it once, and turning it off just skips research: `web/content/docs/agents.mdx`.
- **Blog post covers third-party platforms**: a titled article on its own page — the project's site, dev.to or Medium — is picked as a Blog post; a post read in a feed is a Social post.
- **Blog post destinations**: a post is delivered as one copy per destination — a site folder, a CMS, dev.to or Medium — each in that destination's format and never written into another; the planner remembers each destination after its first publication, and a post published in several places points the others' canonical URL at the original.
- **Social post illustrator**: `social-illustrator` makes a social post's images after the copy is approved — the image slots on a carousel's pages, or by default one image for the paragraph of a text-only post that most needs it; boards that already set up Social post get it once: `web/content/docs/agents.mdx`.
- **Workflows in files**: every workflow is a `WORKFLOW.md` — the built-ins ship with `akb`, a board's own live in `docs/kanban/workflows/<id>/` and travel with the repo; ones saved in the board's settings move there by themselves on the next read.
- **Live carousel templates**: the carousel template designer's visual slots take images, videos or animated React/HTML components; a live page exports a cover PNG plus a seamless H.264 MP4 loop (needs ffmpeg), pages follow the card's or target platform's ratio and default to 3:4, and the catalog previews a live page by its cover frame.

## local-ui

- **Pro trial**: Configuration → Billing offers "Start 7-day free trial" / "免费试用 7 天" to an account that never had Pro, shows the days left while it runs, and offers Get Pro once it ends.
- **Agent characters**: every built-in agent wears its own costume in the agent lists and in the runs office, walking (always facing the way it goes), typing at a desk whose screen shows its kind of work, and sitting on the sofa; a custom agent is the plain robot with its first character on its arm: `kanban-ui/character-design/README.md`.
- **Desktop app** reopens the last repo, finds your coding agent, installs `akb` and updates in the background: `desktop/README.md`, `kanban-ui/README.md`. The browser board is deprecated: `akb guide local-ui`.
- **First run and Finish setup**: `kanban-ui/README.md`.
- **Board, search, Insights, Memory, Archive, Test cases, New idea, Discuss, card buttons, Diff, run cost, resume, assets, language, workflows, several boards**: `kanban-ui/README.md`, `web/content/docs/runs.mdx`.
- **Switch workflow**: click the card page's Workflow item to move a card to another workflow; locked while a run or delivery is on it, and the card is re-planned.
- **Workflow agents and schedules**, **global memory**: `web/content/docs/agents.mdx`; an agent's page lists the memories it uses and warns about a missing name.
- **Runtimes**: `web/content/docs/runs.mdx`, `web/content/docs/connectors.mdx`.
- **Stages on the card page**: one block shows the stages, where the card stands and, when a draft waits, **Approve, start <next stage>**.
- **Build agent for planning-only workflows**: Configuration → Workflows → Execute has no picker: **Set up agent** makes (or takes back a leftover) `<workflow>-executor`, and the row's × **Remove agent** deletes it; set, the card builds after planning.
- **Drafts on a card**: assets, storyboards and decks fold to one row and download or copy their path; a storyboard shows one shot at a time (‹ ›, ←/→); a deck slide may be an `.html`/`.tsx` page, and an enlarged deck pages with ‹ › and ←/→; Markdown assets read as articles; mermaid blocks draw as diagrams; mockups and images zoom.
- **Downloads**: carousel, deck and product-video storyboards download as an ordered zip; right-click (long-press) a board image to copy or download it.
- **Notifications** work signed out — cards waiting on you, deliveries that did not land, landings, stopped-short runs — survive a restart and load 30 at a time; signed in, the bell also carries every Cloud board's **To do** and **Landed**, each shown once.
- **Stale column**: cards untouched for over 5 days (not building) move to their own column, oldest first; a group counts as touched while any subtask is.
- **Group build-order map**: a group shows the order its cards build in.
- **Phone**: a bottom tab bar (Board, More), one column at a time, card search on top.
- **Discussions** hide once planning or building starts, stay on the agent that opened them, and **End discussion** stops everything they started; a failed load offers Retry, and a reply cut short can be resent.
- **Reject during a chat reply**: Reject stays available and stops the reply.
- **Revise** opens the card's chat with the first line typed.
- **Back and Forward** show a card as it is on disk; the desktop app re-reads every page when you switch back to it; opening a card no longer waits on background polls.
- **Restarts keep** drafts, the chat rail's state and width, celebrated milestones and shown run reminders.
- **Stopped-short runs** on an unhandled card stay visible on it and in **Unfinished**; a failed run's log leads with the board's reason.
- **Extra requirements**: a built-in helper's page has one box per workflow stage; an agent you added is told everything through its own `AGENT.md`.
- **Agent names** fall back to the English title in other languages.
- **Cloud settings** retry on their own when Cloud is unreachable; storing a board in Cloud is offered only to team accounts.
- **Pro**: **Upgrade to Pro** in Configuration → Billing, which lists all 6 workflows under Free and folds the workflow list and credit costs behind each row; a cancelled plan still in its period resumes renewal there.
- **Live sync**: signing in or out, buying Pro and editing workflows update every open screen at once.
- **Feature tour** shows once after setup or an upgrade, and can be replayed from Help, Configuration → General or Cloud settings.
- **Cheers** for a finished group and the day's first finished task, once per browser, not at phone width.
- **Triage source**: items an agent wrote show that agent as source, filterable.
- **Archive sort**: by delivery time (default) or creation time, newest first.
- **Removed**: release picker, filters, badges and actions; the feedback-sharing toggle, linked-task search and partner-feedback setting.
- **Agent avatars** draw instantly with their rows — no blank flash when opening Configuration → Workflows.

## site

- **Pricing starts the Pro trial**: Pro's button on `/pricing` reads "Start 7-day free trial" / "免费试用 7 天" and starts the trial through the Cloud sign-in; Cloud's Settings offers the same.
- **Carousel templates show every page**: `/templates/carousel/<name>` lays the example's pages out in order as a swipeable strip (`7 pages` / `共 7 页`), the catalog shows carousel covers portrait, four to a row, and the tab reads `Carousel` / `图文`. Publishers add pages with `pages` in `showcase.json` for `akb cloud template showcase`.
- **Live carousel pages play**: on a carousel template's page, live pages loop muted while in view and pause when scrolled away; with reduced motion they wait for the play button. Publishers register one as `{ "image", "video" }` in `pages`.
- **Template pages load in place**: `/templates` and each template's page show quiet blocks in the final layout while the catalog loads — the picked tab's own tile shape, never a flash of another tab — and images fade in over a matching wash; a template's preview waits for the current version instead of flashing an old one. Still under reduced motion, in English and Chinese.
- **Running office on the home page**: between the handoff section and the workflows, the agent office plays an 18-second loop — one agent leaves, one finishes and rests on the sofa, a new one takes the desk — with the clock and the view out of the window following the visitor's local time; it holds still with reduced motion, in all five languages.
- **Retired template links return 404**: `/templates/<category>/<name>` and its `/zh/` twin answer 404 when Cloud's catalog says the template is gone; on any other answer or a timeout they keep the 200 fallback page. Live on ai4kanban.dev since 2026-10-21 (the English URL may serve a cached 200 until about 2026-10-27).
- **Agent characters**: the docs and site pages show the same costumed agent art as the board.
- **Rotating idea in the handoff scene**: on the home page and `/builder`, the idea bubble changes each loop — a Pro plan, dark mode, a 30s v2 video, a v2 blog post, a 5-tip carousel — in all five languages.
- **Motion templates play**: on [/templates](https://ai4kanban.dev/templates) the Motion tab plays each motion's silent clip on hover (on a phone, the tile in view); a motion's page loops it with a pause button, and shows no source.
- **Guardrails, specs and drafts**: `web/content/blogs/guardrails-specs-drafts.mdx` explains action boundaries, feature requirements and concrete drafts to review before implementation.
- **[Home page](https://ai4kanban.dev)** tells one story in five sections, all five languages: you don’t manage every detail, you review the key drafts and agents do the rest; how it works, the six workflows (coding and video clone first, blog last; your own workflows via [/docs/agents](https://ai4kanban.dev/docs/agents)), your AI tools, download. The board, task graph, runs office, memory and follow-ups visuals now live in [/docs/daily-loop](https://ai4kanban.dev/docs/daily-loop), [/docs/runs](https://ai4kanban.dev/docs/runs), [/docs/memory](https://ai4kanban.dev/docs/memory) and [/docs/follow-ups](https://ai4kanban.dev/docs/follow-ups).
- **Positioning** is "You don’t have to manage every detail." under "Agent workspace for indie hackers", in all five languages; wording limits in `positioning.md`; `/index.md` and `llms.txt` tell the same story.
- **Landing**: the only way in is the app download; `/index.md` and `/llms.txt` mirror it.
- **Languages**: landing and comparison pages also in `/zh`, `/es`, `/ja`, `/fr`; no browser-language redirect, Markdown mirrors stay English, the footer is translated everywhere, and the desktop header offers the visitor's language when a copy exists.
- **Blog topics** use the same ember tabs as the template catalog.
- **Navigation**: header has Docs, Pricing, a Resources menu (Blog, Training, Templates), GitHub and Download; comparisons and the language switcher live in the footer.
- **Agent pages**: [Kanban for Grill Me](https://ai4kanban.dev/agents/kanban-for-grill-me), [Kanban for Codex](https://ai4kanban.dev/agents/kanban-for-codex), `/agents/kanban-for-claude-code` (English only), each in `llms.txt`.
- **Comparison pages** (`/vs-*`, all five languages): one neutral "Compare AI4Kanban and X on …" line, AI4Kanban arguing key drafts that cut rework and ready specialist workflows; each says where the other tool is ahead and who should pick which (`/vs-multica`, `/vs-task-master`, `/vs-hermes-kanban`, `/vs-orca`, `/vs-plannotator`).
- **`/workflows/coding`** and **`/solutions/saas`** (five languages, Markdown mirrors): coding with reviewed key drafts, at a measured 1.07–2.08× the cost of direct Claude Code; SaaS founders running product and marketing work on one board.
- **Removed pages**: the GitHub Issues, Linear and Vibe Kanban comparisons redirect home; `/recipes` goes to `/docs/agents`; the DeepSeek Harness post goes to `/blog`.
- **[/cloud](https://ai4kanban.dev/cloud)** says what Cloud is, what the relay carries and what stays on the machine.
- **[/privacy](https://ai4kanban.dev/privacy), [/terms](https://ai4kanban.dev/terms)**: English only; NULLREACH LTD as operator, the China company as training seller; cover Pro (Creem as merchant of record, auto-renewal, 14-day refund, monthly credit reset); no feedback sections, and past partner material can still be deleted on request.
- **[/training](https://ai4kanban.dev/training)** sells one-to-one guidance booked on the page ($99 a session, $349 a month for four); English and Chinese only.
- **[/pricing](https://ai4kanban.dev/pricing)** lists Free with all 6 workflows, Pro (monthly or yearly, Pro templates, idea screening, AI generation and credits, with rates behind a fold), seed partners, done-for-you agents ($15 per agent, via `/contact`) and training; English and Chinese only.
- **[/seed](https://ai4kanban.dev/seed)** takes seed-partner applications, answered by hand; **`/contact`** is one form for support and done-for-you agents.
- **[/builder](https://ai4kanban.dev/builder)** is the founder letter (English only); blog and agent posts are signed "Founder of AI4Kanban".
- **`/draft-first`** (all five languages) is the draft-first skill's page, linked from the footer, blog posts and the skill README; [Draft-first development](https://ai4kanban.dev/blog/draft-first-development) is its blog post.
- **[/demo](https://ai4kanban.dev/demo)** walks the desktop app through one fixed script, each step at `?step=<n>`; the source for board screenshots, kept out of navigation and search. [Interactive demo](https://ai4kanban.dev/blog/interactive-demo) explains how it was built.
- **[Templates](https://ai4kanban.dev/templates)** (English and Chinese): one tab per category (`#<category>` opens it), twelve templates a page, each comparing the original with its recreation, with a prompt to copy into AI4Kanban that names the template; props and motion show their whole keyframe and say they only run inside a video template.
- **`/blog`** is a grid with the newest featured, filtered by topic tabs (`?topic=<slug>`); feed at `/blog/rss.xml`; every post has its own cover (`featured_cover: <name>`).
- **Product video** is the demo video workflow's name everywhere.
- **The office shot** on [/docs/runs](https://ai4kanban.dev/docs/runs) and in the README overview shows real agents in their role costumes, each desk screen showing code, a doc or a design.

## docs

- **READMEs** are app-first and lead with draft review: `README.md`, `README-zh.md`.
- **Docs pages**: one per topic under `web/content/docs/` (Overview, Your first card, Draft review, Memory, Follow-ups, Workflows, Multi-runtime support, Runs and runtimes, Agents, Chat, Triage), saying only what you can do, how and where to set it; commands stay in `akb --help`.
- **[/docs/agents](https://ai4kanban.dev/docs/agents)**: built-in roles, specialists grouped by workflow, each with its own board character, rules, schedules and custom agents; memory is one link to `/docs/memory`.
- **llms.txt**: `web/public/llms.txt` lists every docs page in rail order with its frontmatter description; the docs build fails when it drifts.
- **Redirects**: `/docs/triage-endpoint` goes to `/docs/triage`; the old "What makes a good goal" page and `/docs/releases` are gone.

## marketing

- **Marketing work** is an ordinary card on the default workflow; its delivery is the file in the repo.
- **[awesome-agent-kanban](https://github.com/neverchanje/awesome-agent-kanban)** is a public CC0 directory of agent task tools, AI4Kanban listed on the same criteria as the rest.
- **Video assets**: free shared music, UI sounds and paper backgrounds (CC0) are on `cdn.ai4kanban.dev/video/`.
- **Shipped pieces**: the "see it first, then build it" product video (English and Chinese); a Chinese Xiaohongshu carousel, "review the UI, not the wall of text"; the blog post "[Visual specs for AI coding](https://ai4kanban.dev/blog/show-the-ui-first)"; the 0.10.0 newsletter (`node scripts/newsletter-send.mjs --issue 2026-10-07`); a 15-page Chinese investor pitch deck, "人只审重点，其余交给 Agent", readable from its slide titles alone. A 15-page investor pitch deck for the template business model (open-source workflows, paid closed-source templates on Cloud), in matching Chinese and English editions.
- **GitHub README** (`README.md`, `README-zh.md`) opens with "An agent workspace for indie hackers" and shows the six workflows and their agent teams in each agent's role costume (`node scripts/readme-figures.mjs` redraws the figure).
- **npm package page**: `cli/README.md` opens with "See the draft. Let agents do the rest."
- **Carousel template designer**: a template has one page per variant (openings, middles, closings in whatever counts it needs), each page stating its image slots and ratios, what the user fills with length limits, and whether overflowing text flows on or is rewritten shorter; it may recreate a reference the card gives.
- **Long-read carousel template**: `long-read` (carousel), a grained-paper long-form carousel whose body text flows onto continuation pages, Chinese or English at 3:4, 4:5 or 9:16: `akb cloud template get long-read`.
- **Warm animated explainer carousel template**: `warm-explainer` (carousel), a recipe rather than fixed layouts — warm paper, big serif titles, marker ink, cursors at work and data told by hundreds of small animated marks, with an 8-page Chinese and English 4:5 example where every page is a seamless loop: `akb cloud template get warm-explainer`.
- **Black-and-white how-to carousel template**: `mono-howto` (carousel, Pro), pure black or white 4:5 pages with centred tight sans, numbered steps, an FAQ and a comment call to action, Chinese or English, with a cursor-click screen page and looping video slots: `akb cloud template get mono-howto`.

## cloud

- **Pro trial before purchase**: a 7-day trial (1,000 AI credits, no card, once per account) comes before any checkout; past subscribers and seed partners buy directly: `POST /v1/billing/trial` in `cloud/endpoints.md`.
- **Trial button notices**: back on settings from the pricing page's trial button, subscribers see they already have Pro and accounts that used their trial are told to upgrade.
- **Motion clips**: the catalog list carries a motion's clip; `akb cloud template showcase` refuses a motion without `recreation.video`.
- **Live carousel pages**: a showcase's `pages` takes `{ image, video }` items and the template detail answers `pages` as `{ image, video }[]`; a showcase holds up to 30 files.
- **Sign-in, invites, seed-partner grants, free-tier limits, write leases**: `cloud/README.md`.
- **Workspaces, moving boards, members and roles, the read-only browser view, invite-only preview**: `web/content/docs/local-and-cloud-boards.mdx`; Cloud is free for invited users and pricing may change.
- **Notifications**: one on/off switch; a card reaching `ready` or raising a user-only question becomes a Cloud event, kept 30 days after it ends; a failed send retries for about four hours.
- **Public template catalog**: `GET /v1/catalog` lists every published template without sign-in; sources stay behind sign-in and Pro; maintainers set showcase media with `akb cloud template showcase <name> <dir>`, kept across republishes.
- **Templates are Pro**: every template already in the shared catalog, props and motions included, is Pro, and [/templates](https://ai4kanban.dev/templates) tags them Pro.
- **First video template**: `ui-walkthrough-launch` (`akb cloud template search --category video`), a launch walkthrough with its own score; swap in your content and `npm run render`.
- **Runtime privacy**: Cloud reports runtime names only, never keys, arguments or paths.
- **Pro** is sold monthly or yearly through Creem to any GitHub sign-in, managed at `cloud.ai4kanban.dev/settings`, with 5,000 AI credits each UTC month (a generated image 320, a music track 160); already subscribed lands there, and a cancelled plan in its period can resume renewal without the Creem portal.
- **Lost payment notification**: a payment still becomes Pro if Billing, Upgrade or a Pro workflow is used within 24 hours of checkout.
- **Seed partners** get six months of Pro once per GitHub handle, with no charge afterwards.
- **Refunds**: none unless the law requires; a refund or chargeback ends Pro and its credits at once.
- **Hosted music**: `akb cloud music --seconds <n> --out <file.mp3> "<prompt>"` makes an instrumental MP3 that ends at that length, for Pro, from mainland China too.
- **Stale column** on the hosted board judges a group by its subtasks, as the desktop app does.

## telemetry

- **Anonymous usage reporting**: `web/content/docs/local-and-cloud-boards.mdx`, `akb telemetry status|on|off`; nothing else is collected, and the feedback endpoint and stored feedback are gone.
