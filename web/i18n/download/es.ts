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
    title: "Descargar AI4Kanban",
    lead: "El tablero como aplicación de escritorio para macOS, Windows y Linux.",
    cta: "Descargar",
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
    body: "La app lleva `akb` dentro — el comando con el que un agente de código maneja el tablero — y la primera vez que se abre te ofrece ponerlo en tu PATH. macOS escribe un enlace en `/usr/local/bin/akb` y pide tu contraseña de administrador; Windows añade la carpeta de la app al PATH, y eso solo llega a las terminales que abras después. Nada se copia fuera, así que actualizar la app actualiza el comando.",
    later: "Si dices que no, el botón te espera en **Configuration → Setup**. En Linux no se ofrece: el AppImage se descomprime en un sitio nuevo cada vez, así que `npm install -g ai4kanban` sigue siendo el camino.",
  },
};

export default es;
