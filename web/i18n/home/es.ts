// Español — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const es: HomeCopy = {
  meta: {
    title: "Espacio de trabajo con agentes para desarrolladores independientes | AI4Kanban",
    description:
      "Los agentes especializados preparan borradores de lo esencial en desarrollo y marketing. Los revisas y ellos terminan el trabajo, para que dediques menos tiempo a comprobar y corregir el resultado.",
    socialTitle: "Revisa el borrador. Deja el resto a los agentes.",
    social:
      "Agentes especializados para desarrollo y marketing. Revisa los borradores clave y deja que terminen el trabajo, con menos que comprobar y corregir después.",
    schema:
      "AI4Kanban es un espacio de trabajo local y de código abierto para desarrolladores independientes. Sus agentes especializados comparten el contexto del proyecto en 6 flujos de desarrollo y contenido. Preparan borradores de las partes que necesitan tu criterio y terminan el trabajo a partir de lo que apruebas, para reducir el tiempo dedicado a comprobar y corregir el resultado. Las tareas independientes avanzan en paralelo; las preferencias y decisiones pasan a las siguientes tareas y los agentes proponen próximos pasos. Usa tus herramientas de IA y suscripciones.",
  },

  hero: {
    eyebrow: "Un espacio de trabajo con agentes para desarrolladores independientes",
    title: "Revisa el borrador.\nDeja el resto a los agentes.",
    lead:
      "Del desarrollo al marketing, AI4Kanban te prepara borradores de las partes que necesitan tu criterio. Revisa, ajusta y deja que los agentes sigan desde ahí, sin tener que supervisar cada detalle.",
    ctaDownload: "Descargar",
    ctaGithub: "Ver en GitHub ↗",
    image:
      "Grabación del tablero de demostración de AI4Kanban: planificar tareas, revisar los borradores de una tarjeta y pasar el trabajo a los agentes.",
  },

  workflows: {
    title: "Desarrolla el producto. Mantén el marketing en marcha.",
    lead:
      "Con 6 flujos integrados, los agentes especializados comparten el contexto de tu proyecto y se encargan del desarrollo y el marketing sin que tengas que organizar el equipo desde cero. Preparan borradores solo de las partes clave que necesitan tu criterio y terminan el trabajo a partir de lo que apruebas, para que dediques menos tiempo a comprobarlo y corregirlo después.",
    items: [
      {
        label: "Desarrollo de software",
        image: "Borrador de desarrollo: prototipo de una pantalla clave.",
      },
      { label: "Artículo de blog", image: "Borrador de blog: el artículo y sus imágenes." },
      {
        label: "Vídeo de producto",
        image: "Borrador de vídeo de producto: escenas y locución en un guion gráfico.",
      },
      {
        label: "Presentación",
        image: "Borrador de presentación: contenido y composición de las diapositivas.",
      },
      {
        label: "Publicación en carrusel",
        image: "Borrador de carrusel: textos de las páginas y esquema del contenido.",
      },
      {
        label: "Clonación de vídeo (vídeos generados con código)",
        image:
          "Borradores de clonación de vídeo: desglose del original y guion gráfico de la réplica.",
      },
    ],
    links: {
      demo: "Probar la demo",
      coding: "Explora el flujo de desarrollo",
      all: "Consulta todos los agentes y flujos",
    },
  },

  parallel: {
    title: "Avanza en paralelo con las tareas independientes",
    body: [
      "Reúne las tareas de desarrollo y marketing en un solo tablero. Las tareas independientes pueden avanzar en paralelo; las que dependen de otras siguen su orden.",
      "Cada tarjeta conserva sus borradores, decisiones y progreso. Vuelve a ella cuando haga falta tu criterio y deja la ejecución a los agentes, sin repetir traspasos entre conversaciones.",
    ],
    shots: {
      board: { label: "Board", alt: "Tablero de AI4Kanban: vista Board" },
      card: { label: "Card", alt: "Tablero de AI4Kanban: los detalles y requisitos de una tarjeta" },
      frontAria: "Vista {view} (actual)",
      flipAria: "Cambiar a la vista {view}",
    },
  },

  agents: {
    title: "Empieza la siguiente tarea con lo que ya habéis acordado",
    body: [
      "Tus preferencias y decisiones pasan a las siguientes tareas. Cada agente recuerda lo relevante para su trabajo y puede compartir ese contexto con otros agentes.",
      "El siguiente borrador parte de ese entendimiento compartido, para que dediques tu tiempo a lo que necesita cambiar esta vez.",
    ],
    image:
      "Das una indicación una vez; el agente la recuerda y todos los borradores siguientes la aplican.",
  },

  followUps: {
    title: "Termina una tarea. Detecta lo que viene después.",
    body: [
      "Al completar un trabajo principal, los agentes proponen tareas de seguimiento para detectar carencias y próximos pasos útiles.",
      "Las sugerencias vuelven al tablero. Acéptalas, modifícalas o recházalas antes de decidir qué abordar.",
    ],
    image:
      "El agente de QA detecta un hueco y te entrega un seguimiento para aceptarlo o descartarlo.",
  },

  tools: {
    title: "Sigue usando las herramientas de IA que ya conoces",
    body:
      "Conecta Claude Code, Codex y otras 6 herramientas, que se ejecutan en tu equipo con tus propias suscripciones. Elige herramienta y modelo para cada agente. AI4Kanban no cobra tarifas adicionales por tokens.",
  },

  start: {
    title: "Empieza con tu primera tarea",
    lead:
      "Descarga la aplicación de escritorio, abre un proyecto y escribe qué quieres hacer. Revisa los borradores que necesitan tu criterio y deja el resto en manos de los agentes.",
    cta: "Descargar",
    firstOpen:
      "Las versiones no están firmadas, así que macOS bloquea la primera apertura: arrastra la aplicación desde el `.dmg` y elige continuar en el aviso. La página de descarga tiene los pasos completos para macOS, Windows y Linux.",
    command:
      "¿Prefieres la línea de comandos? Ejecuta `npx ai4kanban@latest install` en tu proyecto.",
  },
};

export default es;
