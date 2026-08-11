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
    title: "Abre el tablero como una aplicación.",
    lead: "El mismo tablero, en una ventana. No hace falta instalar nada antes: ni Node, ni npx, ni una terminal que dejar abierta. La primera vez te pregunta qué carpeta de proyecto abrir y la recuerda.",
    cta: "Descargar para tu sistema",
    note: "Lanzar ejecuciones sigue necesitando tu agente de código en la máquina: Claude Code o Codex. La aplicación lee tu propio entorno de shell al arrancar, así que encuentra un agente instalado de la forma habitual.",
  },

  builds: {
    title: "Qué versión llevarte",
    lead: "Una publicación, tres sistemas, y ninguno firmado todavía. macOS es el que probamos en cada versión; Windows y Linux se compilan y publican sin probar hasta que alguien nos diga lo contrario.",
    columns: { system: "Sistema", file: "Archivo", signed: "Firmado", tested: "Probado" },
    yes: "Sí",
    no: "No",
    systems: ["macOS (Apple Silicon, Intel)", "Windows", "Linux"],
  },

  unsigned: {
    title: "Abrirlo la primera vez",
    lead: "En esta publicación ninguna versión va firmada, así que todos los sistemas avisan la primera vez que la abres. Firmar la de Mac es lo siguiente en la lista. Hasta entonces, esto es lo que hay que pulsar: una vez por sistema y nunca más.",
    mac: {
      title: "macOS",
      steps: [
        "Abre el `.dmg` y arrastra **AI4Kanban** a tu carpeta Aplicaciones.",
        "Haz doble clic. macOS dice *Apple no ha podido verificar que “AI4Kanban” esté libre de malware*: pulsa **Listo**. Todavía no se abrirá, y es lo normal.",
        "Abre **Ajustes del Sistema → Privacidad y seguridad**, baja hasta **Seguridad** y, junto a *Se ha bloqueado “AI4Kanban” para proteger el Mac*, pulsa **Abrir igualmente**.",
        "Desbloquea con Touch ID o tu contraseña y pulsa **Abrir igualmente** una vez más. La app se abre, y a partir de ahí se abre directamente.",
      ],
    },
    windows: {
      title: "Windows",
      body: "SmartScreen dice *Windows protegió su PC*. Pulsa **Más información** y luego **Ejecutar de todas formas**.",
    },
    linux: {
      title: "Linux",
      body: "Dale permiso de ejecución y ábrelo: `chmod +x AI4Kanban-*.AppImage` y después `./AI4Kanban-*.AppImage`.",
    },
  },

  using: {
    title: "Después de abrirla",
    items: [
      {
        title: "Un proyecto a la vez",
        body: "La primera vez te pregunta qué carpeta abrir y la recuerda. La ruta de la cabecera abre otra, y una carpeta sin tablero también vale: ahí te ofrece crear uno.",
      },
      {
        title: "Actualizar lo decides tú",
        body: "La aplicación nunca se actualiza sola. Cuando hay una versión más nueva lo dice, con un enlace a esta página. Cerrar la ventana termina el tablero y todas sus ejecuciones.",
      },
    ],
  },

  deprecated: {
    title: "La forma antigua: levantarlo tú",
    body: "`npx ai4kanban-ui` sigue sirviendo el tablero en el navegador, pero esa vía está obsoleta. Sigue funcionando y el paquete queda congelado en lugar de retirado, así que una instalación existente arranca igual, pero ahí no llegará ninguna versión nueva. Las páginas no desaparecen: la aplicación son esas mismas páginas en una ventana, y llegar al tablero desde otro dispositivo sigue necesitando un servidor. Lo obsoleto es pedirte que levantes uno y abras un navegador.",
  },
};

export default es;
