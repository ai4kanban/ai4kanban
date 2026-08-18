// Español — the download page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const es: DownloadCopy = {
  meta: {
    title: "Descargar AI4Kanban: el tablero como aplicación de escritorio",
    description:
      "Consigue el tablero de AI4Kanban como aplicación para macOS, Windows y Linux. No hace falta instalar nada antes: ni Node, ni npx, ni terminal.",
    socialTitle: "Descargar AI4Kanban",
    social:
      "El tablero como aplicación para macOS, Windows y Linux. No hace falta instalar nada antes.",
  },

  hero: {
    title: "Descargar AI4Kanban",
    lead: "El tablero como aplicación para macOS, Windows y Linux. No hace falta instalar nada antes: ni Node, ni npx, ni terminal.",
    cta: "Descargar para {system}",
    ctaAny: "Descargar",
    note: "Lanzar ejecuciones sigue necesitando Claude Code, Codex, Cursor u OpenCode en la máquina.",
  },

  builds: {
    title: "Todas las descargas",
    note: "Nada va firmado todavía y solo probamos macOS en cada versión, así que todos los sistemas avisan la primera vez que lo abres.",
  },

  firstOpen: {
    title: "La primera vez",
    mac: {
      title: "macOS",
      steps: [
        "Abre el `.dmg` y arrastra **AI4Kanban** a Aplicaciones.",
        "Haz doble clic. macOS dice que no puede verificar la app: pulsa **Listo**. Todavía no se abrirá, y es lo normal.",
        "En **Ajustes del Sistema → Privacidad y seguridad**, baja hasta **Seguridad** y pulsa **Abrir igualmente**.",
        "Desbloquea y pulsa **Abrir igualmente** una vez más. A partir de ahí se abre directamente.",
      ],
    },
    windows: {
      title: "Windows",
      body: "En SmartScreen: **Más información** y luego **Ejecutar de todas formas**.",
    },
    linux: {
      title: "Linux",
      body: "`chmod +x AI4Kanban-*.AppImage` y después ejecútalo.",
    },
  },
};

export default es;
