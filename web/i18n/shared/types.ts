/** Chrome that every page shares: nav, footer, copy button, switcher. */
export type SharedCopy = {
  nav: {
    /** The download page — the header's one way in, where the board app is
     *  handed out. The landing page's setup prompt has no nav slot: see
     *  `components/Header.tsx`. */
    download: string;
    recipes: string;
    compare: string;
    github: string;
    /** Only read out loud: the label on the phone header's menu button. */
    menu: string;
  };
  footer: {
    github: string;
    docs: string;
    recipes: string;
    comparisons: string;
    license: string;
    credit: string;
    /** Label for the X link on the credit line. */
    x: string;
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
