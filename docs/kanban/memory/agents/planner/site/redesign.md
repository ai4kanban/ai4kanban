# Redesign

Design mistakes to avoid when writing a site card: the mistake, then the design we want.

## Storage

- ❌ **Adding a new store for a small feature without checking what exists** → ✅ prefer the existing stack, counting shared maintenance, not just initial code.

## Getting started

- ❌ **Keeping a terminal install beside the download, even demoted** → ✅ download is the only way in (the app installs `akb`); the setup prompt lives in the READMEs and npm, never the landing page or the docs, where user-facing steps (adding or switching a project) go through the app's UI, never npm or `akb` commands.

## Comparison pages

- ❌ **An either/or of things at different levels (reviewing drafts vs running an agent team)** → ✅ state the shared goal, then compare on the same dimensions.
- ❌ **Narrowing a comparison to coding because launch messaging starts with developers** → ✅ the scope follows what both products do.
- ❌ **Leaving a rival's capability "unverified", or claiming it lacks one** → ✅ check its docs and source first; write the gap precisely.
- ❌ **同名功能就判平手**（如对手的「建任务」只是执行中拆子任务，不是交付后建议跟进） → ✅ 比到机制：谁触发、何时发生、用户是否审批。
- ❌ **对比表两栏都写成各自的做法，看不出有没有差异** → ✅ 每行一项能力，两边先写「有」或「无」，做法不同才补半句；双方都有的不写成差异。

## Copy work

- ❌ **把定位文档里的示例、没做的功能或编造的记忆写进页面** → ✅ 每项能力和示例都对照产品与真实记录核实。
- ❌ **Changing a page's composition, sections or interactions while revising its message** → ✅ copy work changes copy only, unless the user approves more.
- ❌ **定位调整给每页都排改写**（博客简介、培训页、coding 页、定价页导语硬塞新卖点） → ✅ 只改页面里真正介绍产品的那句，保留各页原主线；没得改就不改。
- ❌ **新一轮文案推翻已确认的 UI 稿** → ✅ 已确认的 UI 稿是基准，另一种语言按它对齐。
- ❌ **Leaving the privacy and terms pages to explain a feature** → ✅ give the feature its own page; legal pages state only the promise and link to it.
- ❌ **Training copy drifting into product introduction and disclaimers** → ✅ lead with project guidance and outcomes; omit unsolicited qualifications.
- ❌ **按内容契合度推荐 SEO 关键词，没查搜索量** → ✅ 先有搜索量证据再推荐；拿不出就不定关键词。

## Pictures

- ❌ **落地页卡片只写文案** → ✅ 落地页以图为主，页面结构逐段写清哪些信息是图、哪些是文字。
- ❌ **插图和截图交给界面设计师** → ✅ 交给插图 Agent；界面设计师只排版。
- ❌ **配图画产品里没有的界面、用虚构示例任务，或留着旧布局** → ✅ 只用真实、认得出的界面（截图或 React 复刻），示例取自 AI4Kanban 自己的工作；产品一改，图和配文跟着改。
