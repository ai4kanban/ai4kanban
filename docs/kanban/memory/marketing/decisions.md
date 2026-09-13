# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## Writing and channels

- **A channel is a name and a language, not a skill**: the repurpose carries one built-in
  instruction and there is no per-channel instruction file to edit.
- **The writing memory is what decides quality**: `memory/writing.md` and the files under
  `memory/writing/` are where the user's taste lives, so a rule learned on one channel reaches
  every channel it fits. Nothing declares formats.
- **A learned rule is filed by topic**: a polish appends it to the `memory/writing/` file whose
  topic it belongs to — what the rule checks, not the language or channel it was learned on —
  and one no topic file covers goes to `memory/writing.md`.
- **A repurpose run is one pass; the loop is a step of its own**, run by the user next. There
  is no clarify or QA phase on a draft: the loop reads written-down rules, not the topic.
- **Repurposing does not follow the write run**: the user runs `akb channel` per channel once
  `source.md` reads right.
- **A marketing card has no lead channel**: `source.md` is the argument and belongs to no
  channel, so `channels:` is only the set, in the order the user picked.
- **A marketing card has no `ready` stage**: with no refine to vet a topic, a card moves only
  between `todo` and `implementing`, and nothing on the board says which topic is written next.
- **Publishing is local-first, never a channel API**: a piece goes out from a browser the user
  is already signed into — the vendored 小红书 skill, or the channel's own composer carrying
  the draft. No developer account is funded and no token is kept alive.
- **The board never picks a cheaper runtime for you**: every run goes on the runtime its agent
  is pointed at, and on **Global default** when it names none.
- **A user `write` agent adds to the writer, never replaces it**: the bundled writer keeps
  writing the draft and calls a named specialist when one helps.
- **A format change takes the cards already open with it**: the board never carries two card
  formats at once.
- **A topic's first real title renames its files**, so a topic never reads as `untitled` for
  life; later retitles move nothing.
- **A new topic's `source.md` starts empty**: no flow writes a brief into it — the angle, the
  audience and the limits are settled in the card's own chat.
- **面向英文社区的公开仓库只维护英文一份文档**：awesome list 这类仓库的读者和贡献者以英文为主，产品 UI 的中英双语惯例不延伸过去，中文读者自己读英文。

## The topic page

- **A card's channels are picked on the page, not asked for**: the picker lists the channels
  this card has not chosen and adds the picked one as a tab, so nothing waits on a run.
- **Closing a channel tab drops the channel from the card**: the card's channel list is the
  only record of which tabs exist, so a close loses that channel's status and URL while the
  draft file stays.
- **The draft editor keeps the syntax marks on screen**: `##` and `**` stay in the line, so a
  draft is edited exactly as it sits in the file the agent wrote.
- **A batch of draft comments is cleared once its polish returns**: the polished draft is the
  answer, so no comment stays behind as resolved.
- **Machine-local state is dropped, not migrated**: a format change under `.comments/` loses
  whatever was unsubmitted rather than shipping a converter.
- **An unwanted topic is discarded by hand**, and a blank topic left behind is never removed
  automatically.

## awesome-agent-kanban

- **The directory sorts by what the reader hands over, not by form factor** — never UI, CLI or
  MCP. A category is earned by a complete, independently usable workflow; a product may appear
  once per category it earns, and that is not a ranking.
- **AI4Kanban is listed there with no advantage**: same criteria, same entry shape, no pin,
  badge or marketing copy. The exposure is given up on purpose, for the directory to be worth
  citing.
- **Only tools where an agent really does the work**: general boards, and products whose only
  AI feature is summarizing or drafting text, stay out — even though that keeps the list short.
  Every claim needs official docs, source, or a reproducible flow.
- **English only, hand-maintained**: one README, no automated updates, CI checks, badge wall or
  star ranking.

## The newsletter

- **Which domain do issues go out from?**: a subdomain of `ai4kanban.dev` with SPF, DKIM and
  DMARC set up, so the address a reader sees matches the product. The unsubscribe link points
  at the `ai4kanban.dev` site too.
- **The subscriber list lives in one local file on the user's machine**, kept outside the repo
  with an encrypted backup, never in git and not on any hosted service, so issues go out only
  from that machine.
- **Which service sends the issues?**: Resend, on its free tier, with the sending domain
  verified and the API key in the environment. A list that outgrows the free tier is a decision
  to revisit, not a limit to design around now.
