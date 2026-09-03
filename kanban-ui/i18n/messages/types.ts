/** The few sentences the server writes itself, outside any component — `lib/`, and
 *  the handful of refusals in `app/actions.ts` a person can actually land on. */
export type MessagesCopy = {
  rules: {
    /** No usable copy of the board's rules — the two ways that happens, and the
     *  one command that fixes both. */
    none: string;
    noneLookedIn: (paths: string) => string;
    tooOld: (path: string) => string;
    installIt: string;
    /** The rules loaded here predate one thing the board asks of them. Each names
     *  what is missing, and every one ends in the same line that fixes them all. */
    tooOldForCloud: string;
    tooOldForChat: string;
    tooOldForHandChecks: string;
    tooOldForScores: string;
    tooOldForMemory: string;
    tooOldForArchive: string;
    /** The line every `tooOldFor…` above ends with. */
    updateIt: string;
  };
  /** A copy of the rules that predates one thing the board asks of it. Each names
   *  what is missing and the command that fixes it. */
  tooOld: {
    autoDelivery: string;
    diffApproval: string;
    silenceLimit: string;
    deliveries: string;
    worktrees: string;
    flowRule: string;
    language: string;
    skillInstall: string;
    specSkillSwitch: string;
    specSkillSetting: string;
  };
  /** The refusals a server action gives back to the screen that called it. The rest
   *  of `app/actions.ts` guards its own arguments and stays English: nothing a person
   *  does can reach one. */
  actions: {
    noSuchCard: string;
    emptyChat: string;
    goalFirst: string;
    nothingTicked: string;
  };
  run: { noProcess: string };
  chat: { busy: string; sendFailed: string; clearFailed: string; pickFailed: string };
  /** What a `<Mockup>` tag says when the file behind it can't be drawn. Each names
   *  the `src` the card gave. */
  mockup: {
    notAMockup: (src: string) => string;
    outside: (src: string) => string;
    missing: (src: string) => string;
    notDrawn: (src: string, why: string) => string;
    /** The reasons a `.tsx` mockup wouldn't draw, which fill `why` above. */
    importsOther: (id: string) => string;
    cannotImport: (id: string) => string;
    noDefault: string;
    tooSlow: (seconds: number) => string;
    noStylesheet: string;
  };
};
