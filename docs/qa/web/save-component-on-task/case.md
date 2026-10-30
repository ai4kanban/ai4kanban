# 所有者在任务页保存组件里的修改

## Setup

- 本地云端栈（见 README「如何运行取证」），以 `artifact-sdk/examples/subtitles` 发布为 `@alice/subtitles` 的
  字幕编辑器，任务 `#3` 的卡片引用一份字幕。工作区 Acme 里 alice 是所有者、bob 是成员。
- `<hash>.wildcraneusercontent.com` 用本地 TLS 服务代替（见 README），这份组件的文件由它直接提供，CSP 与 Worker 相同；
  编辑器里的输入和点击在 iframe 内执行。

## Steps

1. alice 打开任务页。
   预期：字幕编辑器可编辑，有「添加一行」和「保存」。
   证据：[01-owner-editor.png](01-owner-editor.png)
2. 把第二行改成「一句话开始一个任务（已校对）」。
   预期：输入框显示新内容。
   证据：[02-edited.png](02-edited.png)
3. 点「保存」。
   预期：显示「已保存」，编辑器保持新内容；产物多一版，卡片跟到新版。
   证据：[03-saving.png](03-saving.png)、[03-after-save.png](03-after-save.png)、
   [03-after-save-10s.png](03-after-save-10s.png)、[03-versions.log](03-versions.log)（未通过：第 2 版已写入，但编辑器
   立刻退回旧内容，也不显示「已保存」，已提交待筛选）
4. 刷新页面。
   预期：编辑器是保存后的内容。
   证据：[04-reopened.png](04-reopened.png)
5. 把一行改成 201 个字，点「保存」。
   预期：编辑器提示「内容格式不符合要求，无法保存。」，内容留着，版本不增加。
   证据：[05-typed.png](05-typed.png)、[05-too-long.png](05-too-long.png)、[05-versions.log](05-versions.log)
6. bob 打开同一任务。
   预期：内容可读，输入框禁用，没有保存。
   证据：[06-member.png](06-member.png)
7. alice 当前在她只是成员的工作区 Beta，从分享链接打开这个任务。
   预期：切到 Acme，编辑器可编辑。
   证据：[07-from-other-workspace.png](07-from-other-workspace.png)

## Feedback

任务页能改能存，权限也分得清，成员只读，切工作区后也对。但保存这一步是坏的：点完内容退回原样，用户只会以为没存上，
再改一遍就是在旧内容上存。提示「内容格式不符合要求」没说哪一行、超了多少。保存后任务页没有任何「已是新版本」的提示。
