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
    note: "Lanzar ejecuciones sigue necesitando Claude Code, Codex, Cursor, OpenCode o DeepSeek Harness en la máquina.",
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
  command: {
    title: "El comando `akb`",
    body: "La app lleva `akb` dentro — el comando con el que un agente de código maneja el tablero — y la primera vez que se abre te ofrece ponerlo en tu PATH. En macOS escribe un enlace en `/usr/local/bin/akb` y pide tu contraseña de administrador para hacerlo. En Windows el instalador pone la propia carpeta de la app en tu PATH, y eso solo llega a las terminales que abras después. Nada se copia fuera de la app, así que actualizar la app actualiza el comando.",
    later: "Decir que no no cuesta nada: el botón te espera en **Configuration → Skill**. En Linux no se ofrece, porque el AppImage se descomprime en un sitio nuevo cada vez que se ejecuta; ahí `npm install -g ai4kanban` sigue siendo el camino.",
  },
};

export default es;
