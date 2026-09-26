// 简体中文 — the training page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { TrainingCopy } from "./types";

const zh: TrainingCopy = {
  meta: {
    title: "AI4Kanban 项目实战指导 — 从首版发布到持续迭代",
    description:
      "围绕你自己的项目做一对一指导：确定首版范围，把需求拆成代理能一次做完的任务，建立能长期执行的验收流程。单次 $99，按月 $349。",
    socialTitle: "AI4Kanban 项目实战指导",
    social:
      "和 AI4Kanban 的作者一起过一遍你的项目：范围、任务拆解、代理执行与交付验收。",
  },

  hero: {
    eyebrow: "面向独立开发者",
    title: "AI4Kanban 项目实战指导",
    lead: "与 AI4Kanban 作者一起梳理你的项目，从明确需求、规划任务到检查交付结果。",
    cta: "查看可预约时间",
    shotAlt: "AI4Kanban 看板",
  },

  stuck: {
    heading: { eyebrow: "困境", title: "项目为什么迟迟不能发布" },
    items: [
      {
        lead: "开发了几个月，仍然没有用户",
        body: "功能不断增加，但注册、付费或持续使用的关键流程还不完整。",
      },
      {
        lead: "需求反复变化，开发不断返工",
        body: "首版范围不明确，代理依据不完整的需求开发，修改结果反而比最初开发更费时间。",
      },
      {
        lead: "迟迟无法发布新版本",
        body: "每次发布都在等更多功能完成，也因此更晚才能了解用户真正的需求。",
      },
    ],
  },

  outcome: {
    heading: { eyebrow: "交付目标", title: "从首版发布到持续迭代" },
    lead: "减少管理单项任务的时间，把更多精力用于推进项目。",
    metrics: [
      {
        value: "2–3",
        unit: "周",
        body: "从想法到可正式上线、供真实用户使用的版本。",
      },
      {
        value: "500",
        unit: "提交 / 30 人天",
        body: "1 个人完成传统 10 人团队的开发工作。",
      },
      {
        value: "1",
        unit: "次大版本 / 周",
        body: "每周发布产品改进，收集用户反馈并规划下一轮迭代。",
      },
    ],
    note: "AI4Kanban 的看板、桌面应用和网站均采用这套流程开发。",
  },

  guidance: {
    heading: { eyebrow: "项目实战", title: "指导内容" },
    points: [
      {
        lead: "梳理用户使用流程",
        body: "检查注册、付费和持续使用等关键环节，找出需要补齐的部分。",
      },
      { lead: "明确首版范围", body: "确定上线必需的功能，以及可以留到后续版本的需求。" },
      {
        lead: "拆解开发任务",
        body: "为每项任务明确目标和验收标准，让代理能一次完成，你也能一次检查完结果。",
      },
      {
        lead: "规划开发与验收",
        body: "开发前澄清需求，完成后检查结果，逐步建立稳定的发布节奏。",
      },
    ],
  },

  coach: {
    heading: { eyebrow: "导师介绍", title: "Tao Wu，AI4Kanban 作者" },
    body: "Tao Wu 拥有多年的数据库研发与产品管理经验。他开发了 AI4Kanban，帮助编程代理规划和管理开发任务，并用它推进 AI4Kanban 自身看板、桌面应用和网站的开发。",
    link: "阅读完整介绍（英文）→",
  },

  tiers: {
    heading: { eyebrow: "服务", title: "服务与价格" },
    lead: "单次指导聚焦一个具体问题，按月指导持续跟进项目开发与发布。",
    single: {
      eyebrow: "单次 · 60 分钟",
      name: "60 分钟一对一指导",
      body: "适合正在使用 AI4Kanban、需要改进项目规划或交付流程的开发者。",
      price: "$99",
      per: " / 次",
      rows: [
        {
          lead: "结合你的项目",
          body: "一起查看你的代码仓库和看板，针对当前问题提出改进建议。",
        },
        { lead: "指导成果", body: "问题分析、具体改进示范和后续行动清单。" },
        {
          lead: "需要准备",
          body: "项目背景、当前遇到的问题，以及未来两周希望达成的目标。",
        },
      ],
      cta: "预约单次指导",
    },
    monthly: {
      eyebrow: "按月 · 每周 1 次",
      name: "按月指导",
      body: "适合需要持续澄清需求、检查进展和调整开发计划的开发者。",
      price: "$349",
      per: " / 月",
      rows: [
        {
          lead: "每月 4 次指导",
          body: "每周回顾项目进展，根据实际情况调整首版范围。",
        },
        { lead: "明确下一步", body: "根据每周的交付结果，确定下一周的开发重点。" },
        { lead: "需要准备", body: "一个正在开发、计划持续推进的项目。" },
      ],
      cta: "预约按月指导",
    },
  },

  booking: {
    heading: { eyebrow: "预约", title: "从第一次对话开始" },
    thisWeek: "本周",
    zoneNote: "你的当地时间 · {zone}",
    loading: "正在识别你的时区……",
    zonePrompt: "无法自动识别时区。请选择时区，以查看当地时间的预约安排。",
    zoneLabel: "时区",
    empty: "本周暂无可预约时间，请下周再查看。",
    failed: "无法加载本周预约时间。",
    retry: "重试",
    open: "可预约",
    booked: "已预约",
    unavailable: "不可预约",
    legendHint: "选择可预约时间，填写预约资料",
    quietHours: "{from}–{to} · 不可预约",
    openAria: "{day} {time}，可预约",
    bookedAria: "{day} {time}，已预约",
    timeColumn: "时间",
    gridLabel: "本周排期，按小时排列，使用你的当地时间",
  },

  form: {
    back: "← 返回时间表",
    title: "填写预约资料",
    name: "姓名",
    email: "邮箱",
    project: "项目情况",
    projectHint: "介绍你的项目和当前遇到的问题。选填。",
    service: "服务",
    serviceSingle: "60 分钟一对一指导 · {price} / 次",
    serviceMonthly: "按月指导 · {price} / 月，4 次",
    submit: "确认预约",
    submitting: "正在预约……",
    privacy: "隐私说明",
    nameRequired: "请填写姓名。",
    emailRequired: "请填写邮箱，以便接收预约详情。",
    emailInvalid: "请填写有效的邮箱地址。",
    conflictTitle: "这个时间刚被预约了",
    conflictBody: "资料已保留。返回时间表选择其他时间。",
    conflictCta: "重新选时间",
    unknownTitle: "暂时无法确认预约结果",
    unknownBody: "资料已保留。重试会先检查这次预约，不会重复提交。",
    refusedTitle: "这次预约没有完成",
  },

  result: {
    eyebrow: "预约结果",
    title: "预约成功",
    lead: "已为你保留以下时间。",
    service: "服务",
    when: "时间",
    reference: "预约编号",
    next: "预约详情正在发送至 {email}。指导人会通过邮件联系你，并发送会议链接。",
    calendar: "添加到日历",
    cancel: "取消预约",
    cancelWarning: "取消后，这个时间将重新开放。",
    cancelConfirm: "确认取消",
    cancelling: "正在取消……",
    cancelledTitle: "预约已取消",
    cancelledLead: "这个时间已重新开放预约。",
    backToWeek: "返回本周时间表",
    manageLoading: "正在打开你的预约……",
    manageFailed: "无法打开预约信息，该预约可能已取消。",
  },
};

export default zh;
