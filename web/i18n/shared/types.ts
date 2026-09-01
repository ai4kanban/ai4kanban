/** Chrome that every page shares: nav, footer, copy button, switcher. */
export type SharedCopy = {
  nav: {
    /** The download page — the header's one way in, where the board app is
     *  handed out. The landing page's setup prompt has no nav slot: see
     *  `components/Header.tsx`. */
    download: string;
    /** The documentation index. English-only. */
    docs: string;
    /** The blog index. English-only, like the docs. */
    blog: string;
    compare: string;
    github: string;
    /** Only read out loud: the label on the phone header's menu button. */
    menu: string;
  };
  footer: {
    /** Headings over the four link columns. */
    groups: {
      product: string;
      learn: string;
      project: string;
      legal: string;
    };
    /** Only read out loud: the label on the GitHub mark. */
    github: string;
    docs: string;
    recipes: string;
    blog: string;
    /** The Cloud page. English-only, like the blog. */
    cloud: string;
    /** The GitHub releases page. */
    changelog: string;
    /** The builder page. English-only, like the blog. */
    builder: string;
    /** The privacy page. English-only, like the blog. */
    privacy: string;
    /** The terms page. English-only, like the blog. */
    terms: string;
    credit: string;
    /** Label for the X link on the credit line. */
    x: string;
  };
  code: { copy: string; copied: string; copyAria: string; copiedAria: string };
  language: { label: string };
  /** The "vs" separator between two product chips. */
  vs: string;
  /** The accent eyebrow above a comparison page's closing verdict. */
  bottomLine: string;
  cta: { install: string; github: string };
};
