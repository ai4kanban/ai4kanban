// Español — the chrome every page shares, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { SharedCopy } from "./types";

const es: SharedCopy = {
  nav: {
    download: "Descargar",
    docs: "Documentación",
    blog: "Blog",
    compare: "Comparativas",
    menu: "Menú",
  },
  footer: {
    groups: {
      product: "Producto",
      learn: "Aprender",
      project: "Proyecto",
      legal: "Legal",
    },
    github: "GitHub",
    docs: "Documentation",
    recipes: "Recipes",
    blog: "Blog",
    cloud: "Cloud",
    changelog: "Changelog",
    builder: "Builder",
    privacy: "Privacy",
    terms: "Terms",
    credit: "creado por Tao Wu",
    x: "Tao Wu en X",
  },
  code: {
    copy: "Copiar",
    copied: "Copiado",
    copyAria: "Copiar al portapapeles",
    copiedAria: "Copiado",
  },
  language: { label: "Idioma" },
  vs: "vs",
  bottomLine: "En resumen",
  cta: { install: "Instalar AI4Kanban", github: "Ver en GitHub ↗" },
};

export default es;
