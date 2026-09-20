# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. A module's own entries live in its folder beside
this file. Read before writing or reviewing a card.

## Answering the user

- ❌ **把用户的提问当成修改指令，顺手改方案或写下记忆** → ✅ 问题就先回答；只有用户明确要求改动时
  才动方案、卡片和记忆。
- ❌ **用内部术语、文件路径和调用链回答「发生了什么」** → ✅ 先用用户的话说清结果和影响，代码位置
  只作佐证；看不懂的复盘等于没有复盘。

## Review

- ❌ **评审用「抽查」支撑「全部要求已完成」** → ✅ 从批准需求逐项反查实现，包括 diff 里完全没有
  出现的行为；勾完的 todo 和通过的检查不构成行为正确的证据。

## Where a rule lives

- ❌ **同一条规则逐个流程各写一句** → ✅ 规则和它的例外写在同一处，就写在诱因旁边；逐个添加正是
  漏掉某个流程的写法。
- ❌ **在启动提示里重复指南已经写过的指令** → ✅ 指南是唯一出处，提示只留指南没有的内容；重复的
  禁令会被放大成指南从未打算的限制。

## Eval collection

- ❌ **依赖团队进入用户环境逐案提取上下文** → ✅ 评测案例收集必须让合作用户及其本地 agent 自主
  完成，团队收到材料后独立复现。
