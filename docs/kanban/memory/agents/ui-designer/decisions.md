# What the user chose for `ui-design`

## Runtimes

- **A runtime is the whole answer to what a run runs as** (#466, reversing "named runtimes
  are retired"): harness, provider, endpoint, key, model id, reasoning and extra args under
  a name the user typed. 运行时 is that bundle; 连接器 is the CLI again; 模型 survives only as
  the model-id box inside a runtime. Nothing on screen calls the bundle a model.
- **Global default is the first row, not a badge**: it leads the list, cannot be deleted or
  renamed, and picking it is how a pick is cleared — an agent that named none and an agent
  that picked it are the same thing in the file.
- **The harness card grid stayed; it moved inside the row** (correction on #468, reversing
  "the card grid is gone"): an expanded runtime's 连接器 is that same grid, both groups, same
  cards. Never a harness dropdown — only its size may give.
- **Provider, endpoint, key, model id, reasoning and extra args sit behind a folded
  高级设置**; 测试连接, 删除 and the login-or-install command stand outside that fold.
- **删除 belongs at the runtime's title, not at the foot of its settings**, and 测试连接 keeps
  the existing hard-shadow button rather than a new control.
- **A deletion says what it takes with it**: the Runtimes delete confirmation names the key
  going too — a cost only counts as said if it is said in the confirmation.
- **状态 is 未登录 / 未安装**, one at a time, said in words rather than by dimming; the key and
  login notes sit beside their own fields, and a row never repeats a harness name the mark
  already carries.

## The marketing board and its cards

- **One column, no vetting**: the ready/not-ready split was sent back — a marketing card
  never gets vetted, so 选题 and 周期任务 are the whole board and nothing is cut at 1280.
- **A marketing card's face is id, one mark, title, channels** (#435): no priority, roi,
  release, questions or todo bar.
- **The channel tab strip scrolls sideways and never folds a tab into its mark**
  (correction on #479, reversing "four tabs only fit by dropping their labels"): every tab
  keeps mark, name, dot and cross, and the strip is cut under a fade instead.
- **A channel page is never an offer to draft it** (correction on #479): 改写到… already
  drafted it. Only `source` still offers 起草.
- **发布 became 标记已发布**, named for what the press does — it records the URL and posts
  nothing.
- **营销稿文案**：移除"改写各频道"；保留"记下"的语气，选区入口用"记条意见"，避免"记下这段"读成收藏原文；
  改写状态用"正在按 N 条意见修改"，提示用"修改期间暂不可编辑"。

- **Triage**: source groups contain three columns of lightweight cards; Add opens a small anchored composer, and dropped files are staged until the user submits.

## Deliveries on the card page

- **一个没有上限的重试只说"第几次"**：落地冲突的重开不设上限，所以卡片上不再写"第 2/3 次"这种
  分母；退避等待那一刻按运行重试的样子画 — 交付块里一条 peach 条，写下还剩多少秒、下一次是第几次、
  卡在哪个文件上，并说明等待期间不占合入位。标题下的那行仍是安静的一行文字，因为没有要用户做的事。
