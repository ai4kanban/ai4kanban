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
    lead: "Work through your project with the creator of AI4Kanban, from planning requirements to reviewing completed work.",
    cta: "See available times",
    shotAlt: "The AI4Kanban board",
  },

  stuck: {
    heading: { eyebrow: "Where it stalls", title: "What's holding your project back?" },
    items: [
      {
        lead: "Months of work, but no users",
        body: "You keep adding features, but key steps such as sign-up, payment or continued use are still incomplete.",
      },
      {
        lead: "Changing requirements lead to rework",
        body: "Without a clear scope for the first release, agents work from incomplete requirements. Correcting the result can take longer than building it.",
      },
      {
        lead: "Releases keep getting delayed",
        body: "Each release waits for more features, so you wait longer to learn what users actually need.",
      },
    ],
  },

  outcome: {
    heading: { eyebrow: "Goals", title: "From first release to weekly iteration" },
    lead: "Spend less time managing individual tasks and more time moving your project forward.",
    metrics: [
      {
        value: "2–3",
        unit: "weeks",
        body: "Go from an idea to a production-ready version for real users.",
      },
      {
        value: "500",
        unit: "commits / 30 person-days",
        body: "One developer doing work that would traditionally require a team of ten.",
      },
      {
        value: "1",
        unit: "major release / week",
        body: "Release product improvements each week, gather user feedback and plan the next iteration.",
      },
    ],
    note: "AI4Kanban's board, desktop app and website are developed using this workflow.",
  },

  guidance: {
    heading: { eyebrow: "Hands-on", title: "What a session covers" },
    points: [
      {
        lead: "Review the user journey",
        body: "Identify gaps in how users sign up, pay and continue using your product.",
      },
      {
        lead: "Define the first release",
        body: "Decide which features are essential for launch and which can wait.",
      },
      {
        lead: "Break down tasks",
        body: "Give each task a clear goal and acceptance criteria, so an agent can complete it in one pass and you can review the result in one sitting.",
      },
      {
        lead: "Plan development and review",
        body: "Clarify requirements before development, review completed work and establish a regular release schedule.",
      },
    ],
  },

  coach: {
    heading: { eyebrow: "Your coach", title: "Tao Wu, creator of AI4Kanban" },
    body: "Tao Wu has years of experience in database engineering and product management. He created AI4Kanban to help coding agents plan and manage development tasks, and uses it to develop the product's own board, desktop app and website.",
    link: "Why I built AI4Kanban →",
  },

  tiers: {
    heading: { eyebrow: "Services", title: "Services and prices" },
    lead: "Book a single session to work through a specific problem, or choose monthly guidance for ongoing support as you develop and release your project.",
    single: {
      eyebrow: "Single · 60 minutes",
      name: "60-minute one-to-one session",
      body: "For developers using AI4Kanban who need help with project planning or delivery.",
      price: "$99",
      per: " / session",
      rows: [
        {
          lead: "Work on your project",
          body: "Review your repository and board together, with advice tailored to your current needs.",
        },
        {
          lead: "What you'll take away",
          body: "A clear assessment of the problem, a practical example of how to improve it and an action plan.",
        },
        {
          lead: "What to prepare",
          body: "Your project background, current challenges and goals for the next two weeks.",
        },
      ],
      cta: "Book a session",
    },
    monthly: {
      eyebrow: "Monthly · once a week",
      name: "Monthly guidance",
      body: "For developers who want ongoing help clarifying requirements, reviewing progress and updating their development plan.",
      price: "$349",
      per: " / month",
      rows: [
        {
          lead: "Four sessions per month",
          body: "Meet weekly to review progress and adjust the scope of your first release as needed.",
        },
        {
          lead: "Plan your next steps",
          body: "Use each week's results to set priorities for the following week.",
        },
        {
          lead: "What to prepare",
          body: "An active project you plan to continue developing.",
        },
      ],
      cta: "Book monthly guidance",
    },
  },

  booking: {
    heading: { eyebrow: "Book", title: "Start with a conversation" },
    nextSevenDays: "Next 7 days",
    zoneNote: "Your local time · {zone}",
    loading: "Detecting your timezone…",
    zonePrompt: "We couldn't detect your timezone. Select it to see available times in your local time.",
    zoneLabel: "Timezone",
    empty: "No appointments available in the next 7 days. Please check again in a few days.",
    failed: "We couldn't load the available times.",
    retry: "Try again",
    open: "Available",
    booked: "Booked",
    unavailable: "Not available",
    legendHint: "Select an available time to book",
    quietHours: "{from}–{to} · not available",
    openAria: "{day} at {time}, available",
    bookedAria: "{day} at {time}, booked",
    timeColumn: "Time",
    gridLabel: "Schedule for the next 7 days, by hour, in your local time",
  },

  form: {
    back: "← Back to available times",
    title: "Your details",
    name: "Name",
    email: "Email",
    project: "About your project",
    projectHint: "What you are building and where it is stuck. Optional.",
    service: "Service",
    serviceSingle: "60-minute one-to-one session · {price} / session",
    serviceMonthly: "Monthly guidance · {price} / month, 4 sessions",
    submit: "Confirm booking",
    submitting: "Booking…",
    privacy: "Privacy policy",
    nameRequired: "Please enter your name.",
    emailRequired: "Please enter an email address for your booking details.",
    emailInvalid: "Please enter a valid email address.",
    conflictTitle: "This time has just been booked",
    conflictBody: "Your details have been saved. Choose another time to continue.",
    conflictCta: "Pick another time",
    unknownTitle: "We couldn't confirm your booking",
    unknownBody:
      "Your details have been saved. Try again to check the booking status without making a duplicate booking.",
    refusedTitle: "The booking did not go through",
  },

  result: {
    eyebrow: "Booking",
    title: "Booking confirmed",
    lead: "The following time is reserved for you.",
    service: "Service",
    when: "Date and time",
    reference: "Booking reference",
    next: "Your booking details are being sent to {email}. Tao will contact you by email with the meeting link.",
    calendar: "Add to calendar",
    cancel: "Cancel this booking",
    cancelWarning: "Cancelling will make this time available to others.",
    cancelConfirm: "Confirm cancellation",
    cancelling: "Cancelling…",
    cancelledTitle: "Booking cancelled",
    cancelledLead: "This time is available for booking again.",
    backToWeek: "Back to available times",
    manageLoading: "Opening your booking…",
    manageFailed: "We couldn't open your booking. It may have been cancelled.",
  },
};

export default en;
