# AI 从 llms.txt 找到文档页

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4331`）；脚本是 [llms.mjs](llms.mjs)，只发请求、不开浏览器。
- **读者**：替用户读网站的 AI（ChatGPT、Claude、Perplexity 等），先读 `/llms.txt`，再顺着链接去读文档页。

## Steps

1. 读 `/llms.txt` 的 `## Documentation` 一节。
   返回 200、`text/plain`。开头一句说每个文档页都有「Copy page」按钮能拿到原始 Markdown，下面依次 13 条：Documentation overview、Your first card、Draft review、Memory、Follow-ups、Workflows、The daily loop、Chat、Agents、Runs and runtimes、Triage、Local and Cloud boards、Multi-runtime support，各带一句描述；Follow-ups 一条是「Catch omissions after delivery and check changed features without repeating every check yourself. …」。
   [llms.log](llms.log)

2. 依次打开这 13 条链接。
   都返回 200，页面上都有「Copy page」按钮，13 条描述都与该页的 meta description 一字不差。名字大多与左侧文档栏一致；不一致的三处：Documentation overview（文档栏写「Documentation」）、Local and Cloud boards（「Local and Cloud」）、Multi-runtime support（「Multi-runtime」）。除 Documentation overview 外，还有六页的大标题和名字不同，如「Follow-ups」页是「Review follow-up suggestions」、「Agents」页是「The agents that work your board」。
   [llms.log](llms.log)

3. 把 `llms.txt` 的文档列表和 `/docs` 左侧文档栏对一遍。
   文档栏 13 页，`llms.txt` 一页不缺，顺序也相同。
   [llms.log](llms.log)

## Feedback

- **列表终于全了**：文档栏 13 页全在 `llms.txt`，顺序一致，AI 回答「Agents 有哪些」「Triage 怎么分流」「交付后的跟进建议怎么关」不用再自己爬文档栏；新的 Follow-ups 页和页面同一次上线。
- **描述不会再漂**：13 条描述与页面逐字相同，而且构建时会比对，改了页面描述忘改 `llms.txt` 就构建失败，AI 引用到的说法和页面不会对不上。
- **同一页仍有三个名字**：`llms.txt`、文档栏和大标题常各说各的（「Follow-ups」/「Follow-ups」/「Review follow-up suggestions」、「Local and Cloud boards」/「Local and Cloud」），AI 按名字引用、用户按标题找，偶尔会以为点错了页。
