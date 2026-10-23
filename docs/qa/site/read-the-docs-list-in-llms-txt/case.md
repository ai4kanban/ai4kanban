# AI 从 llms.txt 找到文档页

## Setup

- **站点**：官网（`web/`，main `deebba29`，0.11.2）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4331`）；脚本是 [llms.mjs](llms.mjs)，只发请求、不开浏览器。
- **读者**：替用户读网站的 AI（ChatGPT、Claude、Perplexity 等），先读 `/llms.txt`，再顺着链接去读文档页。

## Steps

1. 读 `/llms.txt` 的 `## Documentation` 一节。
   返回 200、`text/plain`。开头一句说每个文档页都有「Copy page」按钮能拿到原始 Markdown，下面依次 13 条：Documentation overview、Your first card、Draft review、Memory、Follow-ups、Workflows、The daily loop、Chat、Agents、Runs and runtimes、Triage、Local and Cloud boards、Multi-runtime support，各带一句描述，链接都指向 `https://wildcrane.ai/docs…`；第一条 Documentation overview 是「Set up WildCrane, review key drafts before execution, and deliver development and marketing work with six built-in workflows.」，Workflows 一条也写「let WildCrane match your request」，列表里没有旧名；Agents 一条是「Find the agents included with your board, give them rules, set schedules and create your own helpers.」。官网构建成功。这些描述是否与各页一致见第 2 步。
   [llms.log](llms.log)

2. 依次打开这 13 条链接。
   都返回 200，页面上都有「Copy page」按钮，13 条描述都与该页的 meta description 一字不差；标签页标题都带 WildCrane（如 `/docs` 是「WildCrane docs — an agent workspace for indie hackers」）。名字大多与左侧文档栏一致；不一致的三处：Documentation overview（文档栏写「Documentation」）、Local and Cloud boards（「Local and Cloud」）、Multi-runtime support（「Multi-runtime」）。大标题有 6 页与 `llms.txt` 的名字不同，如 `/docs` 是「WildCrane documentation」、Agents 是「Configure your agents」。
   [llms.log](llms.log)

3. 把 `llms.txt` 的文档列表和 `/docs` 左侧文档栏对一遍。
   文档栏 13 页，`llms.txt` 一页不缺，顺序也相同。
   [llms.log](llms.log)

## Feedback

- **改名改得干净**：`llms.txt` 的链接全指向 `wildcrane.ai`，描述、各页标签标题都写 WildCrane，AI 读到的不会是旧名。
- **列表齐全、描述可信**：13 页与文档栏一一对应，描述和页面 meta 一字不差，AI 顺着读不会漏页、也不会被过时的摘要误导。
- **同一页仍有三个名字**：`llms.txt`、文档栏和大标题常各说各的（「Documentation overview」/「Documentation」/「WildCrane documentation」），AI 按名字引用、用户按标题找，偶尔会以为点错了页。
