// Español — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const es: VsGithubCopy = {
  meta: {
    title:
      "AI4Kanban frente a GitHub Issues: tablero local para agentes o gestor colaborativo",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "Compara AI4Kanban y GitHub Issues en almacenamiento, coste para el agente, coordinación del equipo, historial y participación externa.",
    social:
      "AI4Kanban facilita el trabajo local entre un desarrollador y un agente. GitHub Issues facilita la coordinación de un equipo o una comunidad.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban y GitHub Issues resuelven necesidades de coordinación distintas. AI4Kanban mantiene el tablero en el repositorio para que el desarrollador y el agente trabajen directamente sobre él. GitHub Issues ofrece a un equipo o una comunidad un servicio compartido para registrar y debatir el trabajo. La elección depende de qué pese más en tu día a día: la eficiencia local con un agente o la coordinación entre varias personas.",
    ours: {
      name: "AI4Kanban",
      body: "Un tablero Markdown guardado junto al código, que el agente puede consultar y actualizar directamente.",
    },
    theirs: {
      name: "GitHub Issues",
      body: "Un sistema de tareas alojado para compartir trabajo, conversaciones y estados con un equipo o una comunidad.",
    },
    oursDiagramAlt:
      "El código y el tablero son carpetas del mismo repositorio, así que el agente actualiza el trabajo allí donde lee el código.",
    theirsDiagramAlt:
      "Tus archivos están en una ventana y la incidencia es una página de github.com en otra, así que sincronizar ambas es tarea tuya.",
    oursDiagramTop: "tu tablero vive en el repositorio",
    oursDiagramBottom: "el agente lee el código y actualiza el tablero",
    theirsDiagramTop:
      "las incidencias están en un servidor; tu código no",
    theirsDiagramBottom: "ideal para un equipo — tú los mantienes al día",
  },
  comparison: {
    heading: {
      eyebrow: "Comparación esencial",
      title: "¿Espacio local o servicio compartido?",
    },
    lead: "La diferencia de fondo es dónde reside el tablero. Esa decisión determina el coste de acceso para el agente, cómo se coordina el trabajo simultáneo, qué historial se conserva y cómo participa la comunidad.",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "Dónde reside el trabajo",
        kanban:
          "El tablero se guarda como Markdown en el repositorio. El agente puede leerlo y actualizarlo directamente, incluso sin conexión.",
        issues:
          "Las tareas se alojan en GitHub. El agente necesita conexión y debe acceder mediante la CLI `gh` o MCP.",
      },
      tokenCost: {
        dimension: "Coste para el agente",
        kanban:
          "La búsqueda local puede devolver solo el texto relevante, con menos contexto y una respuesta más rápida.",
        issues:
          "Las operaciones remotas también obligan a procesar definiciones de herramientas y respuestas JSON, y cada solicitud depende de la red; por eso suelen consumir más tokens.",
      },
      concurrency: {
        dimension: "Colaboración simultánea",
        kanban:
          "No hay un servidor que coordine los cambios, así que dos personas pueden crear el mismo número de tarea y provocar un conflicto.",
        issues:
          "El servidor asigna identificadores y sincroniza las actualizaciones, lo que permite trabajar en equipo de forma segura.",
      },
      history: {
        dimension: "Historial que se conserva",
        kanban:
          "Conserva las decisiones y los resultados que afectan al trabajo futuro, mientras resume los detalles más antiguos.",
        issues:
          "Mantiene el registro completo de comentarios, ediciones, referencias cruzadas y actividad.",
      },
      contributors: {
        dimension: "Participación externa",
        kanban:
          "Los colaboradores necesitan acceso al repositorio y participan modificando archivos Markdown.",
        issues:
          "En un repositorio público, cualquiera puede abrir un issue, comentar o reaccionar sin enviar código.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Cómo elegir",
      title: "¿Qué herramienta encaja con tu forma de trabajar?",
    },
    oursHeading: "AI4Kanban encaja mejor si",
    theirsHeading: "GitHub Issues encaja mejor si",
    ours: [
      "Trabajas solo o con uno o dos colaboradores habituales.",
      "Usas principalmente un agente desde el terminal para avanzar las tareas.",
      "Prefieres avanzar con rapidez y conservar solo el contexto necesario para decidir antes que registrar toda la actividad.",
      "Quieres que el tablero permanezca en Git, funcione sin conexión y viaje con el repositorio.",
    ],
    theirs: [
      "Varias personas necesitan asignar y actualizar tareas al mismo tiempo.",
      "El proyecto se desarrolla en público y la transparencia del proceso es importante.",
      "Tu flujo depende de pull requests, CI, proyectos, hitos o automatizaciones.",
      "Quieres que colaboradores externos puedan abrir issues y participar en las conversaciones.",
    ],
    verdict:
      "No son sustitutos directos. GitHub Issues es un **sistema compartido para gestionar tareas en equipo**; AI4Kanban es un **tablero local que un agente puede manejar directamente**. Elige GitHub Issues si el principal obstáculo es coordinar al equipo. Elige AI4Kanban si necesitas avanzar con más eficiencia junto a un agente.",
    note: "También pueden convivir: usa GitHub Issues para el equipo o el público y AI4Kanban como espacio de trabajo local del agente.",
  },
};

export default es;
