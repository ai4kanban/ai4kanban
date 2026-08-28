// Français — the chrome every page shares, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const fr: SharedCopy = {
  nav: {
    download: "Télécharger",
    recipes: "Recettes",
    blog: "Blog",
    compare: "Comparatifs",
    github: "GitHub ↗",
    menu: "Menu",
  },
  footer: {
    github: "GitHub",
    docs: "Documentation",
    recipes: "Recipes",
    blog: "Blog",
    comparisons: "Comparisons",
    cloud: "Cloud",
    privacy: "Privacy",
    terms: "Terms",
    license: "Licence Apache 2.0",
    credit: "créé par Tao Wu",
    x: "Tao Wu sur X",
  },
  code: {
    copy: "Copier",
    copied: "Copié",
    copyAria: "Copier dans le presse-papiers",
    copiedAria: "Copié",
  },
  language: { label: "Langue" },
  vs: "vs",
  bottomLine: "En résumé",
  cta: { install: "Installer AI4Kanban", github: "Voir sur GitHub ↗" },
};

export default fr;
