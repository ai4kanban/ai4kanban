import type { VsOrcaCopy } from "./types";

const es: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca: revisa borradores y delega detalles",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "Compara AI4Kanban y Orca en control de sesiones, flujos especializados, revisión de borradores y el trabajo necesario para coordinar la ejecución.",
    social:
      "Compara AI4Kanban y Orca en control de sesiones, flujos especializados, revisión de borradores y el trabajo necesario para coordinar la ejecución.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs. Orca",
    lead: "Compara AI4Kanban y Orca en control de sesiones, flujos especializados, revisión de borradores y el trabajo necesario para coordinar la ejecución.",
  },
  both: {
    title: "Lo que ambos ofrecen",
    items: [
      "Varios agentes de programación",
      "Sesiones en paralelo",
      "Worktrees de Git aislados",
      "Revisión de diffs de código",
    ],
  },
  orca: {
    title: "Orca: una capa ligera sobre los agentes de programación",
    intro:
      "Orca añade una capa ligera sobre los agentes de programación: reúne sesiones en paralelo, terminales, worktrees, edición y revisión en un solo espacio de trabajo, y conserva la experiencia de usar esos agentes.",
    introLink: "Conoce Orca",
    introEnd: ".",
    body: [
      "Es adecuado para quien quiere dirigir cada sesión de agente y participar en los detalles de la ejecución, desde asignar tareas hasta revisar y fusionar cambios. Cuánta autonomía tiene cada agente sigue dependiendo de ti.",
      "Su orquestación por CLI ofrece tareas, asignación y puntos de aprobación. Tú o tu agente coordinador redactáis las especificaciones de las tareas y definís el proceso.",
    ],
  },
  codex: {
    title: "Ya incluido en la app de escritorio de Codex",
    lead: "Parte de lo que añade Orca ya está en herramientas de programación como la app de escritorio de Codex.",
    items: [
      "Sesiones en paralelo y worktrees",
      "Revisión de diffs y PR",
      "Navegador",
      "Control desde el móvil y SSH",
    ],
    agents:
      "Codex ejecuta los modelos de OpenAI; Orca ejecuta Codex, Claude Code y otros agentes de programación de línea de comandos.",
    sources: {
      worktrees: "Worktrees de Codex",
      review: "Revisión de código",
      browser: "Navegador",
      remote: "Conexiones remotas",
      orcaFeatures: "Funciones de Orca",
    },
  },
  compare: {
    yes: "Incluido",
    no: "No incluido",
    rows: {
      planning:
        "Los agentes planifican cada tarea contigo y solo te piden las decisiones clave",
      team: "Agentes especializados y flujos de trabajo listos para usar",
      drafts:
        "Revisión de borradores antes de ejecutar: imágenes, HTML/TSX, storyboards",
      memory: "Memoria de tus preferencias, compartida entre agentes",
      tools: "Navegador integrado, SSH y control desde el móvil",
    },
  },
  ours: {
    title: "AI4Kanban: revisa borradores y delega los detalles",
    lead: "Los agentes preparan borradores de la interfaz, los textos o el guion que debes revisar. Tras aprobar lo esencial, el flujo completa la tarea. Hay flujos integrados para código, blogs y vídeos; las tareas independientes pueden ejecutarse en paralelo.",
    drafts: {
      title: "Revisa los borradores clave antes de ejecutar",
      body: "Las partes que necesitan tu criterio tienen un borrador primero. Revísalo y edítalo en la tarjeta; los agentes continúan desde la versión aprobada y resuelven los detalles dentro del alcance acordado. Corregir lo esencial aquí reduce lo que hay que rehacer después.",
      art: ["Borrador", "Aprobar", "Ejecución"],
    },
    memory: {
      title: "Lleva las decisiones a la siguiente tarea",
      body: "Cada agente recuerda las preferencias y decisiones relevantes para su trabajo y puede compartir el contexto del proyecto con otros agentes. Las tareas posteriores parten de lo ya acordado. Tras completar un trabajo principal, los agentes proponen próximos pasos que puedes aceptar, modificar o rechazar.",
      art: {
        agents: ["Diseño UI", "Redacción"],
        shared: "Compartida · proyecto",
      },
    },
    custom: "También puedes crear tus propios agentes y flujos de trabajo.",
    tipLabel: "Nota",
    tip: "El flujo de desarrollo de software es gratuito. Los flujos de blog, carrusel para redes sociales, presentaciones, vídeo de producto y clonación de vídeos requieren Pro.",
  },
  decision: {
    title: "¿Cómo quieres trabajar?",
    ifYou: "si quieres",
    theirs: {
      name: "Elige Orca",
      points: [
        "Gestionar tú cada sesión de agente de programación",
        "Participar de cerca en los detalles de la ejecución",
      ],
      onlyLabel: "Solo en Orca",
      only: [
        "Navegador",
        "Trabajo remoto por SSH",
        "Control desde el móvil",
        "Un prompt para varios agentes",
      ],
      link: "Ver las funciones de Orca",
    },
    ours: {
      name: "Elige AI4Kanban",
      points: [
        "Agentes y flujos listos para código, blogs y vídeos",
        "Ajustar los detalles clave en un borrador antes de terminar el trabajo",
        "Reutilizar tus preferencias para reducir las correcciones en tareas futuras",
      ],
      goalLabel: "El objetivo",
      goal: "Avanza con desarrollo y marketing, con menos trabajo que rehacer",
    },
  },
  start: {
    title: "Empieza con AI4Kanban",
    body: "Descarga AI4Kanban. Planifica con precisión, entrega con rapidez.",
    cta: "Descargar AI4Kanban",
  },
};

export default es;
