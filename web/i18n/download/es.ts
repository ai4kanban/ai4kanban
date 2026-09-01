// Español — the download page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const es: DownloadCopy = {
  meta: {
    title: "Descargar AI4Kanban: el tablero como aplicación de escritorio",
    description:
      "Consigue AI4Kanban como aplicación de escritorio para macOS, Windows y Linux.",
    socialTitle: "Descargar AI4Kanban",
    social:
      "El tablero como aplicación de escritorio para macOS, Windows y Linux.",
  },

  hero: {
    title: "AI4Kanban para escritorio",
    lead: "Para macOS, Windows y Linux.",
    cta: "Descargar",
    ctaFor: "Descargar para {system}",
  },

  builds: {
    title: "Todas las descargas",
  },

  firstOpen: {
    title: "La primera vez",
    platformLabel: "Elige tu plataforma",
    mac: {
      steps: [
        "Abre el `.dmg` y arrastra **AI4Kanban** a Aplicaciones.",
        "Haz doble clic. macOS dice que no puede verificar la app: pulsa **Listo**. Todavía no se abrirá, y es lo normal.",
        "En **Ajustes del Sistema → Privacidad y seguridad**, baja hasta **Seguridad** y pulsa **Abrir igualmente**.",
        "Desbloquea y pulsa **Abrir igualmente** una vez más. A partir de ahí se abre directamente.",
      ],
    },
    windows: {
      body: "En SmartScreen: **Más información** y luego **Ejecutar de todas formas**.",
    },
    linux: {
      body: "`chmod +x AI4Kanban-*.AppImage` y después ejecútalo.",
    },
  },
  command: {
    title: "Usar `akb` en una terminal",
    mac: "Abre la app una vez y `akb` funciona en tu terminal.",
    windows: "Abre una terminal nueva y `akb` funciona.",
    linux: "Solo Linux pide un paso: `npm install -g ai4kanban`.",
  },
};

export default es;
