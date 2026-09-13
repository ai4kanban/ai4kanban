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
    lead: "围绕你的项目，指导你建立从需求规划到交付验收的完整流程。",
    cta: "查看可约时间",
    stepsTitle: "指导围绕你的项目展开",
    steps: ["梳理产品闭环", "确定首版范围", "组织开发与验证", "持续交付与迭代"],
  },

  stuck: {
    heading: { eyebrow: "困境", title: "项目为什么迟迟不能发布" },
    items: [
      {
        lead: "做了几个月，还没有人用",
        body: "功能一直在加，闭环一直没合上——注册、付费、留存，总有一段是空的。",
      },
      {
        lead: "需求一改，前面白做",
        body: "首版范围没定死，代理照着模糊的描述写完，返工的代价比自己写还高。",
      },
      {
        lead: "节奏拉不起来",
        body: "每一版都要攒很久才敢发，攒得越久越不敢发，反馈也就越晚回来。",
      },
    ],
  },

  outcome: {
    heading: { eyebrow: "交付目标", title: "从首版发布到持续迭代" },
    lead: "减少每项任务占用的精力，让你能推进更多开发工作。",
    metrics: [
      {
        value: "2–3",
        unit: "周",
        body: "从想法到一个生产可用、能交到用户手上的版本。",
      },
      {
        value: "500",
        unit: "提交 / 30 人天",
        body: "1个人完成传统10人团队才能完成的开发进度",
      },
      {
        value: "1",
        unit: "次大版本 / 周",
        body: "每周发布产品改进，收集用户反馈并安排下一轮迭代。",
      },
    ],
    note: "AI4Kanban 自身的看板、桌面应用和网站，是这套工作方式的实践案例。",
  },

  guidance: {
    heading: { eyebrow: "项目实战", title: "指导内容" },
    points: [
      { lead: "梳理闭环", body: "找出从进入到留下之间断掉的那一段。" },
      { lead: "定首版范围", body: "写下这一版不做什么，比写下要做什么更省时间。" },
      { lead: "拆解任务", body: "拆到代理能一次做完、你能一次验完的粒度。" },
      { lead: "组织开发与验证", body: "建立可持续的交付节奏，把返工挡在开工之前。" },
    ],
  },

  tiers: {
    heading: { eyebrow: "服务", title: "服务与价格" },
    lead: "单次指导解决当前问题，按月指导跟进项目开发与交付。",
    single: {
      eyebrow: "单次 · 60 分钟",
      name: "60 分钟一对一上手指导",
      body: "适合已使用 AI4Kanban，希望解决规划或交付问题的开发者。",
      price: "$99",
      per: " / 次",
      rows: [
        { lead: "围绕你的真实项目", body: "不讲通用方法，看你现在的仓库和看板。" },
        { lead: "带走三样东西", body: "瓶颈分析、改进示范、后续行动清单。" },
        {
          lead: "需要准备",
          body: "项目背景、当前卡在哪、你希望两周后是什么样。",
        },
      ],
    },
    monthly: {
      eyebrow: "按月 · 每周 1 次",
      name: "持续陪跑",
      body: "适合需要持续梳理需求、检查进展和调整开发计划的项目。",
      price: "$349",
      per: " / 月",
      rows: [
        {
          lead: "一个月，4 次",
          body: "每周一次，按周看进展，随项目调整首版范围。",
        },
        { lead: "持续跟进", body: "根据每次交付结果，明确下一周的开发重点。" },
        { lead: "需要准备", body: "一个正在做、你打算做下去的项目。" },
      ],
    },
  },

  booking: {
    heading: { eyebrow: "预约", title: "本周可约时间" },
    thisWeek: "本周",
    zoneNote: "你当地的时间 · {zone}",
    loading: "正在读取你所在的时区……",
    zonePrompt: "没能读到你所在的时区。请选择，下方将按你的当地时间显示。",
    zoneLabel: "时区",
    empty: "本周暂无可约时间。下周再查看排期。",
    failed: "本周的时间表没能加载出来。",
    retry: "重试",
    open: "可预约",
    booked: "已预约",
    unavailable: "不可预约",
    legendHint: "点击可约时间填写资料",
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
    projectHint: "你在做什么、现在卡在哪。选填。",
    service: "服务",
    serviceSingle: "60 分钟一对一指导 · {price} / 次",
    serviceMonthly: "按月指导 · {price} / 月，4 次",
    submit: "确认预约",
    submitting: "正在预约……",
    privacy: "隐私说明",
    nameRequired: "请填写姓名，指导人需要知道是谁来。",
    emailRequired: "请填写邮箱，预约详情会发送到这里。",
    emailInvalid: "这看起来不像一个邮箱地址。",
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
    manageFailed: "这个链接打不开预约，可能已经取消了。",
  },
};

export default zh;
