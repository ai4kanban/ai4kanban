# What the user chose for `ui-design`

One line per durable choice the user made about these designs.

## Layout

- **布局要平衡**：内容短时把操作放到详情对侧或提示条内，不让一侧空出一大片。
- **后果说明收成名称旁的小标签**：「与 X 共用」这类说明不占整行，细节放悬停提示，腾出的行给操作。
- **悬停才出现的行内操作不预留位置**：平时文字用满整行，悬停时才截断到操作前。
- **下拉框保持小**：选项只写名称，当前项的勾放在行尾；只在名称看不出差别时才加一行面向用户的说明（如「适合速度优先于质量」），不出现内部说法；底部提示压成一句短话（如「更换后将重新规划。」）。
- **示例问题只作启发**：轮播展示，不做成可点的按钮。
- **加载骨架只画首屏看得到的**：桌面一排、张数等于该分类的列数；手机两张，露出第二张边缘。
- **文件路径不显示成文字**：用复制图标，点击复制绝对路径。
- **Compare 两边完整并列**：横版上下、竖版左右，不做分割线或叠加。
- **视频对比共用一条播放条**：放在两段视频下方，不用浏览器自带控件；进度条按镜头分段，反馈按镜头号说而不是时间点。
- **Compare 的 B 侧可以是脚本**：新版还没出片时，原片拆解与复刻脚本同镜号并排、随播放切镜，细节默认收起。

## Runtimes

- **A runtime is the whole bundle, under a name the user typed**: 运行时 is the bundle, 连接器 is the CLI, 模型 is only the model id inside it; nothing calls the bundle a model.
- **Global default is the first row, not a badge**: it cannot be deleted or renamed, and picking it clears a pick.
- **连接器 is picked from a grid of harnesses inside the row**, never a dropdown.
- **Long settings fold behind 高级设置**; 测试连接, 删除 and the login-or-install line stay outside.
- **A deletion names what it takes with it in the confirmation.**
- **状态 is 未登录 / 未安装 in words**, one at a time, never shown by dimming.
- **Runtime comparison tables head columns with the logo alone**: the name goes in the hover tip.

## Agents and background work

- **Background work gets no control**: show something only once an update is ready or failed; nothing while checking or downloading.
- **定期整理是「立即整理」旁的小控件**：点开才设周期；菜单只含预设，选中即保存，自定义才展开数值、单位和时间。
- **周期菜单是周期 agent 的唯一控件**：按钮只写周期，失败只让按钮显示警示；菜单顶部写「下次运行」、不列上次运行，停用放菜单末尾；工作流里沿用看板级的同一菜单。
- **自建 Agent 只填名称、阶段、指令、运行时**：名称可用中文，内部标识自动生成；指令就是整份 AGENT.md，新增键不加表单字段。
- **空着的阶段不标「可选」**：空着就是没有，只放「＋ 设置 Agent」按钮；新建的执行 agent 默认名「<工作流名> executor」，用户可改。
- **复制来的 agent 画成复制后的样子**：沿用来源的运行时和规则原文，标明「复制自 X」，并说明单独保存、改动不影响来源。

## Boards and cards

- **多份方案时「全部规划」「全部开始」是主操作**：每份方案自己的操作弱化成同一行的文字按钮，不用复选框。
- **测试用例两层浏览**：模块网格 → 用例网格 → 用例页。
- **无上限的重试只说「第几次」**：不写分母；退避等待说明不占合入位，无需用户操作。
- **Triage source groups hold columns of lightweight cards**; Add opens a small composer in place, and dropped files are staged until submit.
- **分镜一次只看一镜**：顶部时间线选镜，不横向滚动、不用侧栏索引；幻灯片同样逐页看。
- **竖版页面（如 3:4 轮播）横排成页面带**：按原比例并排，手机上一页并露出下一页边缘，不另放缩略图条。
- **卡片阶段只在卡片页显示**：看板卡片不显示；阶段、当前状态和下一步操作（如批准）合成元数据栏下方的一个区块；不加「第 N 步」提示。
- **新卡只把描边换成强调色**：不加底色、「新」标签、浮层或视野外的定位按钮；打开后恢复原样。

## The Runs office

- **An immersive scene fills the dialog without a header**: history on one side, a selected bot's log on the other; role names and harness logos stay visible.
- **Bots share one work pose**, with role-specific actions only where a visible difference is needed.

## The public site

- **桌面顶栏只留少数入口**：次要页面收进一个「资源」下拉，长列表（如对比页）和语言切换只放页脚。
- **使用场景页不重复下载与 GitHub 按钮**。
- **动效页不显示来源**：动效拿来就用，不列原站和采集时间；来源只对视频这类复刻作品有意义。
- **模板详情的使用侧栏只放标题、一句说明、提示词预览和复制按钮**：不放下载引导、Pro 说明和定价链接。
- **免费／Pro 标记叠在封面图左上角**：不与标题挤在一行。
- **首页的工作流一种一张卡**：配该工作流自己的草稿，直接用卡片页真实的草稿组件，不手绘缩影、不放 agent 头像；演示内容只做一套英文版、各语言共用；草稿自己播放或在 2–3 页间循环翻页；手机上纵向滚动驱动卡片左移，不做手动横滑；不用表格。
- **落地页讲流程用小图并排**：每步一张、配标题和一行说明，不另加步骤条或流程正文；图照真实界面画，首屏可用自动播放的录屏。
- **滚动切换的板块**：条目常驻不动，只有一个高亮框随滚动滑过、配图同步切换；不做逐张盖上的纵向轮播。
- **对比页一眼看出赢家**：每个主题一张卡，两栏各一句结论，赢家靠底色暗示、不写「胜出」；「两者都支持」逐项说双方怎么做；选择建议用两张同结构的「如果你希望」卡。

## Pricing and numbers

- **定价画具体金额和计费周期**，不留「待定 / 面议」。
- **Usage dashboard shows production data only**: no development data or environment switch.
- **统计时段最短 30 天**；趋势图的点可悬停看当日各线数值。
