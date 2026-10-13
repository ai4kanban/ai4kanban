# Redesign

Design mistakes to avoid when writing a site card: the mistake, then the design we want.

## Storage

- ❌ **Choosing KV for a small feature without checking existing storage** → ✅ prefer the existing D1 stack, counting shared maintenance, not just initial code.

## Getting started

- ❌ **Keeping a terminal install beside the download, even demoted** → ✅ download is the only way in (the app installs `akb`); the setup prompt lives in the READMEs and npm, never the landing page.

## Comparison pages

- ❌ **An either/or of things at different levels (reviewing drafts vs running an agent team)** → ✅ state the shared goal, then compare on the same dimensions.
- ❌ **Narrowing a comparison to coding because launch messaging starts with developers** → ✅ the scope follows what both products do.
- ❌ **Leaving a rival's capability "unverified", or claiming it lacks one** → ✅ check its docs and source first; write the gap precisely.
- ❌ **同名功能就判平手**（如对手的「建任务」只是执行中拆子任务，不是交付后建议跟进） → ✅ 比到机制：谁触发、何时发生、用户是否审批。
- ❌ **对比表两栏都写成各自的做法，读起来像双赢** → ✅ 每行一项功能，一方没有就留空或画短横。

## Copy work

- ❌ **把定位文档里的示例、没做的功能或编造的记忆写进页面** → ✅ 每项能力和示例都对照产品与真实记录核实。
- ❌ **插图和截图交给界面设计师** → ✅ 交给插图 Agent；界面设计师只排版。
- ❌ **落地页卡片只写文案** → ✅ 落地页以图为主，页面结构逐段写清哪些信息是图、哪些是文字。
- ❌ **Changing a page's composition, sections or interactions while revising its message** → ✅ copy work changes copy only, unless the user approves more.
- ❌ **Leaving the privacy and terms pages to explain a feature** → ✅ give the feature its own page; legal pages state only the promise and link to it.
- ❌ **Training copy drifting into product introduction and disclaimers** → ✅ lead with project guidance and outcomes; omit unsolicited qualifications.
