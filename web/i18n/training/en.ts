// English copy for the training page — the source of truth the Chinese file
// mirrors key for key. Writing rules: `i18n/index.ts`.
import type { TrainingCopy } from "./types";

const en: TrainingCopy = {
  meta: {
    title: "AI4Kanban hands-on project guidance — from first release to weekly iteration",
    description:
      "One-to-one guidance around your own project: scope a first release, break it into work coding agents can finish, and build an acceptance routine you can keep. $99 a session, $349 a month.",
    socialTitle: "AI4Kanban hands-on project guidance",
    social:
      "Work through your own project with the person who built AI4Kanban: scope, task breakdown, agent execution, and acceptance.",
  },

  hero: {
    eyebrow: "For solo developers",
    title: "AI4Kanban hands-on project guidance",
    lead: "Guidance around your own project, building the full routine from planning requirements to accepting delivery.",
    cta: "See open times",
    stepsTitle: "The guidance follows your project",
    steps: [
      "Map the product loop",
      "Fix the first release",
      "Organise building and checking",
      "Keep delivering and iterating",
    ],
  },

  stuck: {
    heading: { eyebrow: "Where it stalls", title: "Why the project never ships" },
    items: [
      {
        lead: "Months in, still nobody using it",
        body: "Features keep landing and the loop never closes — sign-up, payment, retention, one stretch of it is always missing.",
      },
      {
        lead: "One change and the last week is gone",
        body: "The first release was never scoped, the agent built to a vague description, and reworking it costs more than writing it did.",
      },
      {
        lead: "No rhythm to get behind",
        body: "Every version waits for one more thing before it goes out, and the longer it waits the less you dare ship it.",
      },
    ],
  },

  outcome: {
    heading: { eyebrow: "What it aims at", title: "From first release to weekly iteration" },
    lead: "Spend less effort per task, so you can carry more of the work forward.",
    metrics: [
      {
        value: "2–3",
        unit: "weeks",
        body: "From an idea to a version that is production-ready and can go to real users.",
      },
      {
        value: "500",
        unit: "commits / 30 person-days",
        body: "One person covering the ground a ten-person team used to cover.",
      },
      {
        value: "1",
        unit: "major release / week",
        body: "Ship an improvement every week, gather what users say, and plan the next round on it.",
      },
    ],
    note: "AI4Kanban's own board, desktop app and website are built this way — that is the worked example.",
  },

  guidance: {
    heading: { eyebrow: "Hands-on", title: "What a session covers" },
    points: [
      {
        lead: "Map the loop",
        body: "Find the stretch between arriving and staying that is broken.",
      },
      {
        lead: "Fix the first release",
        body: "Writing down what this version will not do saves more time than writing down what it will.",
      },
      {
        lead: "Break down the work",
        body: "Down to a size an agent finishes in one go and you accept in one go.",
      },
      {
        lead: "Organise building and checking",
        body: "A delivery rhythm you can keep, with rework caught before the work starts.",
      },
    ],
  },

  tiers: {
    heading: { eyebrow: "Services", title: "Services and prices" },
    lead: "A single session settles what is in the way now; monthly guidance follows the project through building and delivery.",
    single: {
      eyebrow: "Single · 60 minutes",
      name: "60-minute one-to-one session",
      body: "For developers already using AI4Kanban who are still hitting planning or delivery problems.",
      price: "$99",
      per: " / session",
      rows: [
        {
          lead: "On your real project",
          body: "No generic method — we look at the repository and the board you have now.",
        },
        {
          lead: "Three things to take away",
          body: "The bottleneck named, an improvement demonstrated, and a list of what to do next.",
        },
        {
          lead: "What to bring",
          body: "The project background, where it is stuck, and what you want it to look like in two weeks.",
        },
      ],
    },
    monthly: {
      eyebrow: "Monthly · once a week",
      name: "Monthly guidance",
      body: "For a project that needs its requirements, progress and plan looked at week after week.",
      price: "$349",
      per: " / month",
      rows: [
        {
          lead: "One month, four sessions",
          body: "Once a week: progress reviewed weekly, and the first release rescoped as the project moves.",
        },
        {
          lead: "Followed through",
          body: "Each delivery decides what the next week is aimed at.",
        },
        {
          lead: "What to bring",
          body: "A project you are working on and intend to keep working on.",
        },
      ],
    },
  },

  booking: {
    heading: { eyebrow: "Book", title: "This week's open times" },
    thisWeek: "This week",
    zoneNote: "Your local time · {zone}",
    loading: "Reading your timezone…",
    zonePrompt: "We could not read your timezone. Pick it so the times below are yours.",
    zoneLabel: "Timezone",
    empty: "No open times this week. Check again next week.",
    failed: "Could not load the week's times.",
    retry: "Try again",
    open: "Open",
    booked: "Booked",
    unavailable: "Not available",
    legendHint: "Pick an open hour to fill in your details",
    quietHours: "{from}–{to} · not available",
    openAria: "{day} at {time}, open",
    bookedAria: "{day} at {time}, booked",
    timeColumn: "Time",
    gridLabel: "This week's schedule, by hour, in your local time",
  },

  form: {
    back: "← Back to the week",
    title: "Your details",
    name: "Name",
    email: "Email",
    project: "About your project",
    projectHint: "What you are building and where it is stuck. Optional.",
    service: "Session",
    serviceSingle: "60-minute one-to-one session · {price} / session",
    serviceMonthly: "Monthly guidance · {price} / month, 4 sessions",
    submit: "Confirm booking",
    submitting: "Booking…",
    privacy: "Privacy",
    nameRequired: "Add a name so the coach knows who is coming.",
    emailRequired: "Add an email — the confirmation goes there.",
    emailInvalid: "That does not look like an email address.",
    conflictTitle: "That hour was just booked",
    conflictBody: "What you typed is kept. Go back and pick another one.",
    conflictCta: "Pick another time",
    unknownTitle: "We could not confirm the result",
    unknownBody:
      "What you typed is kept. Trying again checks this booking first — it will not book you twice.",
    refusedTitle: "The booking did not go through",
  },

  result: {
    eyebrow: "Booking",
    title: "You are booked",
    lead: "This time is held for you.",
    service: "Session",
    when: "When",
    reference: "Reference",
    next: "The details are on their way to {email}. Tao will email you to arrange it and send the meeting link.",
    calendar: "Add to calendar",
    cancel: "Cancel this booking",
    cancelWarning: "Cancelling opens this hour up again.",
    cancelConfirm: "Yes, cancel it",
    cancelling: "Cancelling…",
    cancelledTitle: "Booking cancelled",
    cancelledLead: "This hour is open for booking again.",
    backToWeek: "Back to this week",
    manageLoading: "Opening your booking…",
    manageFailed: "That link does not open a booking. It may have been cancelled already.",
  },
};

export default en;
