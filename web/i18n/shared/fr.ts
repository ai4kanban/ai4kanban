// Français — the chrome every page shares, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const fr: SharedCopy = {
  nav: {
    install: "Installation",
    recipes: "Recettes",
    compare: "Comparatifs",
    compareMore: "D'autres comparatifs bientôt…",
    github: "GitHub ↗",
  },
  footer: {
    github: "GitHub",
    docs: "Documentation",
    recipes: "Recipes",
    comparisons: "Comparisons",
    license: "Licence Apache 2.0",
    credit: "créé par Tao Wu",
    x: "Tao Wu sur X",
    origin: "Généralisé à partir d'une skill conçue pour",
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
  cta: { install: "Installer ai4kanban", github: "Voir sur GitHub ↗" },
};

export default fr;
