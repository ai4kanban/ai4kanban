// 简体中文 — the contact page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { ContactCopy } from "./types";

const zh: ContactCopy = {
  meta: {
    title: "联系 AI4Kanban —— 技术支持与定制 agent",
    description:
      "获取 AI4Kanban 技术支持，或请我们按你的流程定制 agent 工作流。一个表单，通过邮件回复。",
    socialTitle: "联系 AI4Kanban",
  },
  eyebrow: "联系",
  title: "联系我们",
  lead: "获取 AI4Kanban 技术支持，或请我们按你的流程定制 agent。",
  reason: "需要什么帮助？",
  support: {
    name: "技术支持",
    body: "安装、使用或故障问题，请附上版本号和日志。",
  },
  customize: {
    name: "定制 agent",
    body: "按需求量身定制 agent 工作流。",
    price: "$15",
    per: " / 个 agent",
    note: "5 个 agent 的流程即 $75。报价与付款通过邮件确认。",
  },
  email: "邮箱",
  message: "内容",
  workflow: "描述你的流程",
  workflowHint: "有哪些步骤、用到哪些工具、每个 agent 负责什么。",
  submit: "发送",
  submitting: "正在发送…",
  privacy: "隐私说明",
  errors: {
    emailRequired: "请填写邮箱，我们会回复到这里。",
    emailInvalid: "邮箱格式不正确。",
    emailTooLong: "邮箱不能超过 200 个字符。",
    messageRequired: "请填写内容。",
    messageTooLong: "内容不能超过 5000 个字符。",
    workflowRequired: "请描述你想要的流程。",
    workflowTooLong: "流程描述不能超过 5000 个字符。",
  },
  limited: {
    title: "发送次数过多",
    body: "内容已保留。请稍后再试，或直接发邮件至 {support}。",
  },
  unknown: {
    title: "未能确认是否送达",
    body: "内容已保留。可以再发送一次，不会重复送达。",
  },
  failed: {
    title: "留言未能发送",
    body: "内容已保留。请重试，或直接发邮件至 {support}。",
  },
  sent: {
    title: "已收到你的留言",
    body: "我们会回复到 {email}。",
    another: "再发一条",
  },
  training: {
    title: "培训",
    body: "围绕你自己的项目一对一指导。",
    cta: "了解培训",
  },
};

export default zh;
