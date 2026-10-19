# AI 从 llms.txt 找到文档页

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4331`）；脚本是 [llms.mjs](llms.mjs)，只发请求、不开浏览器。
- **读者**：替用户读网站的 AI（ChatGPT、Claude、Perplexity 等），先读 `/llms.txt`，再顺着链接去读文档页。

## Steps

1. 读 `/llms.txt` 的 `## Documentation` 一节。
   返回 200、`text/plain`。开头一句说每个文档页都有「Copy page」按钮能拿到原始 Markdown，下面依次 13 条：Documentation overview、Your first card、Draft review、Memory、Follow-ups、Workflows、The daily loop、Chat、Agents、Runs and runtimes、Triage、Local and Cloud boards、Multi-runtime support，各带一句描述；第一条 Documentation overview 是「Set up AI4Kanban, review key drafts before execution, and deliver development and marketing work with six built-in workflows.」，和改版后的文档首页同一句；Follow-ups 一条是「Catch omissions after delivery and check changed features without repeating every check yourself. …」。
   未能取证：`main`（01ddb6ac）上官网构建失败——#1728 改了 Agents 页的描述，`llms.txt` 里还是旧句，构建比对时报「"agents" description differs from its frontmatter」后中止，没有站点可读；已报待筛选。 [build.log](build.log)

2. 依次打开这 13 条链接。
   都返回 200，页面上都有「Copy page」按钮，13 条描述都与该页的 meta description 一字不差；`/docs` 的标签页标题是「AI4Kanban docs — an agent workspace for indie hackers」。名字大多与左侧文档栏一致；不一致的三处：Documentation overview（文档栏写「Documentation」）、Local and Cloud boards（「Local and Cloud」）、Multi-runtime support（「Multi-runtime」）。除 Documentation overview 外，还有六页的大标题和名字不同，如「Follow-ups」页是「Review follow-up suggestions」、「Agents」页是「Configure your agents」。
   未能取证：同第 1 步，构建失败。 [build.log](build.log)

3. 把 `llms.txt` 的文档列表和 `/docs` 左侧文档栏对一遍。
   文档栏 13 页，`llms.txt` 一页不缺，顺序也相同。
   未能取证：同第 1 步，构建失败。 [build.log](build.log)

## Feedback

- **这次连页面都出不来**：#1728 改了 Agents 页的描述，`llms.txt` 没跟着改，构建时的逐字比对直接让整站构建失败。比对本身起了作用——错的描述不会上线——但代价是任何人都发不了站，直到有人补上这一行。
- **改描述要改两处**：页面 frontmatter 和 `llms.txt` 各写一遍，改文档的人很容易只改一处；要么构建时从 frontmatter 生成这一节，要么改文档的流程里提醒同步。
- **同一页仍有三个名字**：`llms.txt`、文档栏和大标题常各说各的（「Documentation overview」/「Documentation」/「AI4Kanban documentation」、「Agents」/「Agents」/「Configure your agents」），AI 按名字引用、用户按标题找，偶尔会以为点错了页。
