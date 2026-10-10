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

## Calling spec agents

- ❌ **以「只改一句」「不是新功能」为由跳过文档 agent** → ✅ 卡片只要改动用户文档的文字，就调 `copywriting`。

## Settings

- ❌ **保留一个用户不能选的设置或字段（如 spec agent 的 `output`）** → ✅ 用户不选就删掉，行为从已有信息推出。（#1574）
