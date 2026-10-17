# AI 从 llms.txt 找到文档页

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4331`）；脚本是 [llms.mjs](llms.mjs)，只发请求、不开浏览器。
- **读者**：替用户读网站的 AI（ChatGPT、Claude、Perplexity 等），先读 `/llms.txt`，再顺着链接去读文档页。

## Steps

1. 读 `/llms.txt` 的 `## Documentation` 一节。
   返回 200、`text/plain`。开头一句说每个文档页都有「Copy page」按钮能拿到原始 Markdown，下面依次六条：Documentation overview、Your first card、Draft review、Memory、The daily loop、Multi-runtime support，各带一句描述。
   [llms.log](llms.log)

2. 依次打开这六条链接。
   都返回 200，页面上都有「Copy page」按钮。除 Documentation overview 外，每条的名字都与左侧文档栏一致（文档栏把 Multi-runtime support 简写成「Multi-runtime」）；「Draft review」页的大标题是「Review drafts before execution」，「Memory」页的大标题是「Carry preferences into the next task」。六条描述都与该页的 meta description 一字不差，The daily loop 的是「…add and refine cards, build one end to end, check what it leaves you, and finish it.」。
   [llms.log](llms.log)

3. 把 `llms.txt` 的文档列表和 `/docs` 左侧文档栏对一遍。
   文档栏有十一页；`llms.txt` 列了其中六页，没有 Chat、Agents、Runs、Triage、Local and cloud boards。
   [llms.log](llms.log)

## Feedback

- **描述终于全对上了**：The daily loop 不再提已删掉的发布功能，六条描述都与页面逐字一致，AI 引用 `llms.txt` 不会再说出不存在的功能。
- **新页上线即可见**：Memory 和页面同一次提交进了 `llms.txt`，排序也和文档栏一样，AI 按新手顺序读下去不会漏。
- **列表仍只有一半多**：文档栏十一页里 Chat、Agents、Runs、Triage、Local and cloud boards 五页不在 `llms.txt`，AI 想回答「Agents 有哪些」「Triage 怎么分流」时得自己去爬文档栏。
- **同一页两个名字**：「Draft review」和「Memory」进去看到的大标题分别是「Review drafts before execution」「Carry preferences into the next task」，AI 按名字引用、用户按标题找，对不上号会让人以为点错了页。
