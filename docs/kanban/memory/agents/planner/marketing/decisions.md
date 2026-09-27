# Decisions

Settled user-facing answers for marketing. Read before proposing.

## How the work runs

- **Content work runs on the ordinary board** and default workflow; no second board or flow set.
- **The board never picks a cheaper runtime**: a run uses its agent's runtime, else the Global default.
- **A format change migrates the open cards**: the board never carries two card formats.
- **自定义工作流的自动选择**：靠工作流名称和负责 agent 的描述自动选中，不为此加产品规则。

## awesome-agent-kanban

- **Categories follow what the reader hands over**, never UI/CLI/MCP; a category needs a complete,
  usable workflow, and listing in several is not a ranking.
- **Only tools where an agent really does the work**, every claim backed by docs, source or a
  reproducible flow.
- **AI4Kanban gets no advantage**: same criteria and entry shape, no pin, badge or marketing copy.
- **English only, hand-maintained**: one README, no automation, CI, badge wall or star ranking;
  public repos for the English community keep one English doc.

## The newsletter

- **Sending**: Resend free tier from `newsletter@ai4kanban.dev` on the verified root domain;
  outgrowing the free tier is a decision to revisit later.
- **Subscriber list**: one local file on the user's machine with an encrypted backup, never in git
  or a hosted service, so issues go out only from there.
- **发送前站点须已部署**：logo 与退订链接都走站点，否则正式发送会停下。
- **配图放 `cdn.ai4kanban.dev`**，不进仓库。

## The demo video

- **只做一支**：英文旁白，同一工程渲染英文字幕版和中文字幕版，官网、Product Hunt 与中文渠道共用。
- **被演示的产品**：用专门搭建的独立演示项目，不拿 AI4Kanban 自身开发做演示。
- **素材**：本地 `assets/video/` 审阅，定稿存 CDN，二进制不进 git。
