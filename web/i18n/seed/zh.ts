// Chinese copy for the seed partner page. Mirrors `en.ts` key for key.
import type { SeedCopy } from "./types";

const zh: SeedCopy = {
  meta: {
    title: "成为 AI4Kanban 种子伙伴",
    description: "与我们分享经你脱敏的会话，帮助改进 AI4Kanban。获得接纳后享 6 个月 Pro，到期不自动收费。",
  },
  title: "成为种子伙伴",
  email: "邮箱",
  github: "GitHub 用户名",
  githubHint: "Pro 会赠送到这个账户。",
  use: "你打算如何使用 AI4Kanban？",
  useHint: "一两句话即可。",
  submit: "提交申请",
  submitting: "正在提交…",
  privacy: "隐私说明",
  errors: {
    emailRequired: "请填写邮箱，我们会回复到这里。",
    emailInvalid: "邮箱格式不正确。",
    emailTooLong: "邮箱不能超过 200 个字符。",
    githubRequired: "请填写 GitHub 用户名。",
    githubInvalid: "GitHub 用户名格式不正确。",
    useRequired: "请简单说说你打算如何使用。",
    useTooLong: "内容不能超过 5000 个字符。",
  },
  limited: {
    title: "提交次数过多",
    body: "内容已保留。请稍后再试，或直接发邮件至 {support}。",
  },
  unknown: {
    title: "未能确认是否送达",
    body: "内容已保留。可以再提交一次，不会重复送达。",
  },
  failed: {
    title: "申请未能提交",
    body: "内容已保留。请重试，或直接发邮件至 {support}。",
  },
  sent: {
    title: "已收到你的申请",
    body: "每份申请均人工审核，我们会回复到 {email}。",
  },
};

export default zh;
