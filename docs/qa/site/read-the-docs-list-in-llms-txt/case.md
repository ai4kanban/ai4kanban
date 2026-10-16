# AI 从 llms.txt 找到文档页

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4331`）；脚本是 [llms.mjs](llms.mjs)，只发请求、不开浏览器。
- **读者**：替用户读网站的 AI（ChatGPT、Claude、Perplexity 等），先读 `/llms.txt`，再顺着链接去读文档页。

## Steps

1. 读 `/llms.txt` 的 `## Documentation` 一节。
   返回 200、`text/plain`。开头一句说每个文档页都有「Copy page」按钮能拿到原始 Markdown，下面依次五条：Documentation overview、Your first card、Draft review、The daily loop、Multi-runtime support，各带一句描述。
   [llms.log](llms.log)

2. 依次打开这五条链接。
   都返回 200，页面上都有「Copy page」按钮。「Your first card」「Draft review」「The daily loop」「Multi-runtime support」与左侧文档栏里的叫法一致（文档栏把后者简写成「Multi-runtime」）；「Draft review」页的大标题是「Review drafts before execution」。除 The daily loop 外，每条描述都与该页的 meta description 一字不差。
   [llms.log](llms.log)

3. 把 `llms.txt` 的文档列表和 `/docs` 左侧文档栏对一遍。
   文档栏有十页；`llms.txt` 只列了其中五页，没有 Chat、Agents、Runs、Triage、Local and cloud boards。
   [llms.log](llms.log)

## Feedback

- **新页跟上了**：「Your first card」和「Draft review」上线即进了 `llms.txt`，排序也和文档栏一样，AI 能按新手顺序读下去；改名后的 Multi-runtime support 条目和页面一致了。
- **The daily loop 的描述过时**：`llms.txt` 还写着「plan and close a release」，页面本身早已不讲发布，也没写页面现在有的「check what it leaves you, and finish it」；AI 引用时会说出一个已经不存在的功能。
- **列表只有一半**：文档栏的十页里有五页不在 `llms.txt`，AI 想回答「Agents 有哪些」「Triage 怎么分流」时得自己去爬文档栏。
- **同一页两个名字**：AI 说「Draft review」，用户点进去看到的大标题是「Review drafts before execution」，对不上号会让人以为点错了页。
