import type { VsOrcaCopy } from "./types";

const es: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca: delega los detalles, conserva el control",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "¿Ya ejecutas agentes de programación en paralelo? Compara Orca con AI4Kanban: controla tú los detalles de la ejecución, o deja que los agentes los dirijan mientras tú marcas el rumbo.",
    social:
      "Orca añade una capa ligera sobre los agentes de programación. AI4Kanban te da un equipo listo para dirigir los detalles de la ejecución mientras tú conservas el control del rumbo y de las decisiones clave.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs. Orca",
    lead: "¿Ya ejecutas varios agentes de programación en paralelo? Orca reúne esas sesiones en un solo espacio de trabajo. AI4Kanban va más allá: los agentes dirigen los detalles de la ejecución mientras tú marcas el rumbo y tomas las decisiones clave.",
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
    title: "AI4Kanban: tú marcas el rumbo, los agentes se ocupan de los detalles",
    lead: "AI4Kanban es para quien está dispuesto a que los agentes dirijan los detalles de la ejecución mientras conserva el control del rumbo y de las decisiones clave. Los agentes especializados, los flujos de trabajo y la memoria están listos para usar, así que no tienes que diseñar los roles de los agentes ni ajustar sus prompts. Tú participas en la planificación y revisas los borradores clave; los agentes resuelven los detalles y llevan el trabajo a término.",
    drafts: {
      title: "Revisa los borradores clave antes de ejecutar",
      body: "¿Te preocupa que la IA se tome demasiadas libertades con una interfaz, un prompt o un texto? Revisa un borrador antes de aprobar la ejecución. Los borradores pueden ser imágenes, diagramas, HTML/TSX, diffs o storyboards. La revisión de borradores llega antes de la implementación para confirmar el rumbo; la revisión del código entregado se hace igual que siempre.",
      art: ["Borrador", "Aprobar", "Ejecución"],
    },
    memory: {
      title: "Lleva las decisiones a la siguiente tarea",
      body: "Cada agente tiene una receta de memoria pensada para su trabajo y aprende tus preferencias y decisiones para ese tipo de tarea. Los agentes pueden compartir memoria. Al terminar un trabajo principal, proponen tareas de seguimiento para cubrir huecos y detectar omisiones.",
      art: {
        agents: ["Diseño UI", "Redacción"],
        shared: "Compartida · proyecto",
      },
    },
    custom: "También puedes crear tus propios agentes y flujos de trabajo.",
    tipLabel: "Nota",
    tip: "El flujo de desarrollo de software es gratuito. Los flujos de blog, carrusel para redes sociales, presentaciones y vídeo de producto requieren Pro.",
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
        "Marcar el rumbo y tomar las decisiones clave",
        "Revisar los borradores importantes",
        "Dejar que los agentes dirijan los detalles de la ejecución",
      ],
      goalLabel: "El objetivo",
      goal: "Multiplicar otra vez por 10 la eficiencia, más allá de la programación en paralelo",
    },
  },
  start: {
    title: "Empieza con AI4Kanban",
    body: "Descarga AI4Kanban. Planifica con precisión, entrega con rapidez.",
    cta: "Descargar AI4Kanban",
  },
};

export default es;
