// The training page's copy (#683). English and Chinese only, which is why this
// folder is not in `SiteCopy` — it has no Spanish, Japanese or French file, and
// a shape that claimed five would be a lie the compiler enforced.
//
// Writing rules are `i18n/index.ts`'s, unchanged.
import type { Heading, PageMeta } from "@/i18n/types";

/** A metric on the delivery-goals row: a number, its unit, and the line under it. */
export type Metric = { value: string; unit: string; body: string };

/** A lead-in phrase and the sentence that finishes it — the page's one list shape. */
export type Point = { lead: string; body: string };

/** One of the two services. */
export type Tier = {
  /** The small monospace line above the name: what it is and how often. */
  eyebrow: string;
  name: string;
  /** Who it is for. */
  body: string;
  /** `$99` — the figure, never localised. */
  price: string;
  /** ` / session`, ` / month`. */
  per: string;
  rows: Point[];
  /** Scrolls to the week with this service chosen on the form. */
  cta: string;
};

export type TrainingCopy = {
  meta: PageMeta;
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    /** Scrolls to the week. */
    cta: string;
    /** The board screenshot beside the offer. */
    shotAlt: string;
  };
  /** Why a project does not ship. */
  stuck: { heading: Heading; items: Point[] };
  /** What the work is aimed at. */
  outcome: {
    heading: Heading;
    lead: string;
    metrics: Metric[];
    /** The one case: this project's own development. */
    note: string;
  };
  /** What a session covers. */
  guidance: { heading: Heading; points: Point[] };
  /** Who runs the sessions. `link` goes to /builder, which is English only. */
  coach: { heading: Heading; body: string; link: string };
  /** The two services and their prices. */
  tiers: { heading: Heading; lead: string; single: Tier; monthly: Tier };
  /** The week, the form, and every state either can be in. */
  booking: {
    heading: Heading;
    thisWeek: string;
    /** `{zone}` — the IANA name, e.g. `America/New_York`. */
    zoneNote: string;
    /** Shown while the browser is still telling us what zone it is in. */
    loading: string;
    /** No zone at all: the visitor picks one. */
    zonePrompt: string;
    zoneLabel: string;
    /** The week holds no open hour. */
    empty: string;
    /** The availability read failed. Never "fully booked". */
    failed: string;
    retry: string;
    /** Cell and legend words. */
    open: string;
    booked: string;
    unavailable: string;
    legendHint: string;
    /** The collapsed run of hours nothing is offered in. `{from}`, `{to}`. */
    quietHours: string;
    /** Read out, not shown: `{day}`, `{time}`. */
    openAria: string;
    bookedAria: string;
    /** Column and row headers. */
    timeColumn: string;
    /** The grid itself, for a screen reader. */
    gridLabel: string;
  };
  form: {
    back: string;
    title: string;
    /** The chosen hour, restated above the fields. */
    name: string;
    email: string;
    project: string;
    projectHint: string;
    service: string;
    /** The two options in the service picker. `{price}` is the figure. */
    serviceSingle: string;
    serviceMonthly: string;
    submit: string;
    submitting: string;
    privacy: string;
    /** Beside the field, when it is empty or malformed. */
    nameRequired: string;
    emailRequired: string;
    emailInvalid: string;
    /** Somebody took the hour while this form was open. */
    conflictTitle: string;
    conflictBody: string;
    conflictCta: string;
    /** The submit's result is unknown. Retrying is safe and says so. */
    unknownTitle: string;
    unknownBody: string;
    /** Anything else the service refused, with its own sentence under it. */
    refusedTitle: string;
  };
  result: {
    eyebrow: string;
    title: string;
    lead: string;
    service: string;
    when: string;
    reference: string;
    /** What happens next. Never a claim that mail arrived. */
    next: string;
    calendar: string;
    /** The cancel disclosure, its warning, and its confirming button. */
    cancel: string;
    cancelWarning: string;
    cancelConfirm: string;
    cancelling: string;
    /** The cancelled page. */
    cancelledTitle: string;
    cancelledLead: string;
    backToWeek: string;
    /** Opening the manage link. */
    manageLoading: string;
    manageFailed: string;
  };
};
