# Redesign

Design mistakes to avoid when writing a card: the mistake, then the design we want. A module's
own entries live in its folder beside this file.

## Answering the user

- ❌ **用内部术语、文件路径和调用链回答「发生了什么」** → ✅ 先用用户的话说清结果和影响，代码只作佐证。

## Review

- ❌ **用抽查支撑「全部要求已完成」** → ✅ 从批准需求逐项反查实现，包括 diff 里没出现的行为；勾完的 todo 和通过的检查不算证据。

## Where a rule lives

- ❌ **同一条规则逐个流程各写一句** → ✅ 规则和例外写在诱因旁的一处。
- ❌ **照一张卡的症状给指南补规则** → ✅ 只改通用的根因规则，症状规则会误伤合理用法。
- ❌ **在启动提示里重复指南的指令** → ✅ 指南是唯一出处，重复的禁令会被放大成指南没打算的限制。

## Eval collection

- ❌ **靠团队进入用户环境逐案提取上下文** → ✅ 合作用户及其本地 agent 自主提交，团队独立复现。

## skill

- ❌ **拆出助手 agent，却仍让主导者替它定细节、读它的产物、写它的记忆** → ✅ 主导者只说要证明什么并读回报，其余细节和记忆都归助手。
- ❌ **给工作流记忆加需要持续维护的索引或清单（文章索引、素材清单）** → ✅ 每次从源头现读，记忆只存推不出来的偏好。

## marketing

- ❌ **介绍功能时讲它怎么演变而来** → ✅ 只写它现在的样子。
