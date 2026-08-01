// The shape of the site's copy, in one place.
//
// `en.ts` is the source of truth; `zh.ts`, `es.ts`, `ja.ts`, and `fr.ts` each
// declare `const copy: SiteCopy`, so a key English adds and a language hasn't
// translated yet is a build error rather than a silently missing sentence.
//
// Only *words* live here. Structure that isn't language — emoji, which side
// wins a comparison row, a track's colour — stays in the component modules and
// is joined to this copy by key.

/** Page `<title>` / description, plus the share-card variants when they differ. */
export type PageMeta = {
  title: string;
  description: string;
  /** Share-card title, when the full one is too long. Defaults to `title`. */
  socialTitle?: string;
  /** Share-card description. Defaults to `description`. */
  social?: string;
};

/** A numbered section's eyebrow + H2. The number itself isn't copy. */
export type Heading = { eyebrow: string; title: string };

export type TitleBody = { title: string; body: string };
export type LabelBody = { label: string; body: string };

// ── keys shared with the component modules ──────────────────────────────────

export type FeatureKey =
  | "breakDown"
  | "clarify"
  | "alwaysOn"
  | "traceable"
  | "proposes"
  | "selfEvolving"
  | "orders"
  | "lifecycle";

export type BoardRowKey =
  | "whatsNext"
  | "addTask"
  | "refine"
  | "review"
  | "done"
  | "badIdea";

export type UiActionKey =
  | "implement"
  | "edit"
  | "refine"
  | "resolve"
  | "archive"
  | "reject";

export type RecurringExampleKey = "competitors" | "listening" | "boardReview";

export type LadderKey = "ask" | "agent" | "script";

export type InputSourceKey = "project" | "outside" | "you";

export type SoloTrackKey = "growth" | "validation" | "building";

export type LoopStageKey = "propose" | "decide" | "learn";

export type LearnFileKey = "memory" | "archive" | "rejected" | "redesign";

export type ThroughputSeriesKey =
  | "total"
  | "completed"
  | "created"
  | "rejected";

export type VsGithubRowKey =
  | "storage"
  | "offline"
  | "agentReads"
  | "tokenCost"
  | "latency"
  | "setup"
  | "lockIn"
  | "metadata"
  | "concurrency"
  | "history"
  | "closing"
  | "search"
  | "contributors"
  | "transparency";

export type VsGithubKanbanWinKey =
  | "tokenLight"
  | "agentsUseIt"
  | "offline"
  | "memory";

export type VsGithubIssuesWinKey =
  | "teams"
  | "transparency"
  | "fullContext"
  | "integration";

export type VsHermesRowKey =
  | "whatItIs"
  | "infrastructure"
  | "whereBoardLives"
  | "setup"
  | "parallelRuns"
  | "crashRecovery"
  | "decomposition"
  | "reviewMemory"
  | "dashboard"
  | "scale";

export type VsHermesKanbanWinKey =
  | "noInfra"
  | "diffable"
  | "selfPruning"
  | "onePrompt";

export type VsHermesWinKey =
  | "manyAgents"
  | "selfHealing"
  | "autoDecompose"
  | "fleetReach";

export type VsHermesStopKey = "traditional" | "kanban" | "hermes";

export type VsVibeRowKey =
  | "whatFor"
  | "orchestration"
  | "review"
  | "planning"
  | "onDisk"
  | "runsAs"
  | "setup"
  | "whichAgents"
  | "lockIn"
  | "maintenance";

export type VsVibeKanbanWinKey =
  | "nothingRunning"
  | "planning"
  | "outlives"
  | "anyAgent";

export type VsVibeWinKey = "parallel" | "reviewInPlace" | "boardUi" | "support";

export type VsLinearRowKey =
  | "bestFit"
  | "sourceOfTruth"
  | "refinement"
  | "agentModel"
  | "execution"
  | "collaboration"
  | "portfolio"
  | "setup"
  | "portability"
  | "pricing";

export type VsLinearKanbanWinKey =
  | "roughToReady"
  | "repoMemory"
  | "anyHarness"
  | "noSaas";

export type VsLinearWinKey =
  | "teamSystem"
  | "agentPlatform"
  | "planningDepth"
  | "integrations";

// ── the copy itself ─────────────────────────────────────────────────────────

/** Chrome that every page shares: nav, footer, copy button, switcher. */
export type SharedCopy = {
  nav: {
    install: string;
    usage: string;
    boardUi: string;
    features: string;
    recipes: string;
    compare: string;
    /** The muted line closing the Compare menu. */
    compareMore: string;
    github: string;
  };
  footer: {
    license: string;
    /** Sentence before the dist0 link, e.g. "Generalized from a skill built for". */
    origin: string;
  };
  code: { copy: string; copied: string; copyAria: string; copiedAria: string };
  language: { label: string };
  /** The "vs" separator between two product chips. */
  vs: string;
  /** The accent eyebrow above a comparison page's closing verdict. */
  bottomLine: string;
  cta: { install: string; github: string };
};

export type HomeCopy = {
  meta: PageMeta;
  hero: {
    badge: string;
    /** `\n` marks the line break in the H1. */
    title: string;
    lead: string;
    ctaInstall: string;
    ctaGithub: string;
  };
  quickview: {
    caption: string;
    taskView: string;
    fileView: string;
    /** `{view}` is replaced by the view's name. */
    frontAria: string;
    flipAria: string;
  };
  features: Record<FeatureKey, TitleBody>;
  featuresNote: string;
  install: { heading: Heading; lead: string; note: string };
  board: {
    heading: Heading;
    lead: string;
    terminal: string;
    rows: Record<BoardRowKey, { say: string; does: string }>;
  };
  ui: {
    heading: Heading;
    lead: string;
    optional: string;
    started: string;
    actionsLead: string;
    actions: Record<UiActionKey, LabelBody>;
    shots: {
      board: { label: string; alt: string };
      detail: { label: string; alt: string };
    };
    /** `{view}` is replaced by the shot's label. */
    frontAria: string;
    flipAria: string;
  };
  presets: {
    heading: Heading;
    lead: string;
    tracks: Record<SoloTrackKey, { body: string }>;
    note: string;
  };
  advanced: {
    heading: Heading;
    lead: string;
    recurring: {
      title: string;
      body: string;
      examples: Record<RecurringExampleKey, LabelBody>;
      ladderLead: string;
      ladder: Record<LadderKey, { label: string }>;
      ladderNote: string;
    };
    group: { title: string; body: string };
    memory: {
      title: string;
      body: string;
      hubLabel: string;
      files: Record<LearnFileKey, { body: string }>;
      loop: {
        aria: string;
        centerCaption: string;
        stepLabel: string;
        stages: Record<LoopStageKey, LabelBody>;
        sources: Record<InputSourceKey, LabelBody>;
      };
    };
    metrics: {
      title: string;
      body: string;
      chart: {
        aria: string;
        series: Record<ThroughputSeriesKey, string>;
        caption: string;
      };
    };
  };
};

/** The two-chip header every comparison page opens with. */
export type VsHero = {
  badge: string;
  /** `\n` marks the line break in the H1. */
  title: string;
  lead: string;
  ours: { name: string; body: string };
  theirs: { name: string; body: string };
};

/** The closing "which should you use?" section. */
export type VsDecision = {
  heading: Heading;
  oursHeading: string;
  theirsHeading: string;
  ours: string[];
  theirs: string[];
  verdict: string;
  note: string;
};

export type VsGithubCopy = {
  meta: PageMeta;
  hero: VsHero;
  summary: { heading: Heading; lead: string; panel: string };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsGithubRowKey,
      { dimension: string; kanban: string; issues: string }
    >;
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsGithubKanbanWinKey, TitleBody>;
    theirs: Record<VsGithubIssuesWinKey, TitleBody>;
  };
  ergonomics: {
    heading: Heading;
    lead: string;
    issues: {
      title: string;
      chip: string;
      lines: string[];
      footer: string;
    };
    kanban: { title: string; chip: string; lines: string[]; footer: string };
    note: string;
  };
  decision: VsDecision;
};

export type VsHermesCopy = {
  meta: PageMeta;
  hero: VsHero & {
    /** Alt text for the two layering diagrams. */
    oursDiagramAlt: string;
    theirsDiagramAlt: string;
    /** Labels drawn inside the diagrams. */
    taskLayer: string;
    boardLayer: string;
    runtimeLabel: string;
  };
  summary: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: string[];
    theirs: string[];
    whenLabel: string;
    when: string;
  };
  harness: {
    heading: Heading;
    lead: string;
    oursSub: string;
    theirsSub: string;
    supported: string;
    notSupported: string;
    note: string;
  };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsHermesRowKey,
      { dimension: string; kanban: string; hermes: string }
    >;
  };
  memory: {
    heading: Heading;
    lead: string;
    ours: { heading: string; verdict: string; body: string; q: string; a: string };
    theirs: {
      heading: string;
      verdict: string;
      body: string;
      q: string;
      a: string;
    };
    note: string;
  };
  autonomy: {
    heading: Heading;
    lead: string;
    stops: Record<
      VsHermesStopKey,
      { level: string; term: string; heading: string; detail: string }
    >;
    scaleLeft: string;
    scaleMiddle: string;
    scaleRight: string;
    worstCaseLabel: string;
    worstCaseTheirs: string;
    worstCaseOurs: string;
    note: string;
  };
  gui: {
    heading: Heading;
    lead: string;
    ours: { heading: string; body: string; alt: string };
    theirs: { heading: string; body: string; alt: string };
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsHermesKanbanWinKey, TitleBody>;
    theirs: Record<VsHermesWinKey, TitleBody>;
  };
  decision: VsDecision;
};

export type VsVibeCopy = {
  meta: PageMeta;
  hero: VsHero;
  summary: { heading: Heading; lead: string; panel: string };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsVibeRowKey,
      { dimension: string; kanban: string; vibe: string }
    >;
  };
  purpose: {
    heading: Heading;
    lead: string;
    ours: { name: string; is: string; isnt: string };
    theirs: { name: string; is: string; isnt: string };
    note: string;
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsVibeKanbanWinKey, TitleBody>;
    theirs: Record<VsVibeWinKey, TitleBody>;
  };
  decision: VsDecision;
};

export type VsLinearCopy = {
  meta: PageMeta;
  hero: VsHero;
  summary: { heading: Heading; lead: string; panel: string };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsLinearRowKey,
      { dimension: string; kanban: string; linear: string }
    >;
  };
  model: {
    heading: Heading;
    lead: string;
    ours: { name: string; is: string; isnt: string };
    theirs: { name: string; is: string; isnt: string };
    note: string;
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsLinearKanbanWinKey, TitleBody>;
    theirs: Record<VsLinearWinKey, TitleBody>;
  };
  decision: VsDecision;
};

export type SiteCopy = {
  shared: SharedCopy;
  home: HomeCopy;
  vsGithub: VsGithubCopy;
  vsHermes: VsHermesCopy;
  vsVibe: VsVibeCopy;
  vsLinear: VsLinearCopy;
};
