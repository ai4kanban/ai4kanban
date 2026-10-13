import type { VsPlannotatorCopy } from "./types";

const es: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator: revisa borradores, ejecuta tareas",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "¿Quieres revisar los borradores clave y ejecutar tareas en paralelo? Compara los agentes especializados y el tablero de tareas de AI4Kanban con la revisión de planes, documentos y código de Plannotator.",
    social:
      "Plannotator lleva la revisión de planes, documentos y código a tus sesiones con agentes. AI4Kanban lleva a un tablero de tareas los borradores clave, la entrega en paralelo, la memoria y las tareas de seguimiento.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs. Plannotator",
    lead: "Plannotator te permite anotar los planes, documentos y código de tu agente de programación. AI4Kanban organiza las tareas en un tablero: agentes especializados integrados preparan los borradores clave para que los apruebes y luego ejecutan las tareas en paralelo, en segundo plano.",
  },
  both: {
    title: "Lo que ambos ofrecen",
    items: [
      "Revisar planes antes de ejecutar",
      "Devolver anotaciones al agente",
      "Trabajar con varios agentes de programación",
      "Ver diffs de código",
      "Gratuito y de código abierto",
    ],
  },
  theirs: {
    title: "Plannotator: revisa dentro de la sesión con tu agente",
    intro:
      "Plannotator se conecta a tu agente de programación mediante hooks y comandos. Los hooks de planes compatibles abren una revisión local en el navegador. Aprueba el plan o devuélvelo con anotaciones, consulta el diff del plan y continúa en la misma sesión.",
    more: [
      {
        title: "Revisa más que planes",
        body: "Anota Markdown, carpetas, URL, borradores HTML o el último mensaje del agente. Revisa cambios de código locales, PR de GitHub y MR de GitLab. Haz preguntas a la IA durante la revisión o ejecuta una revisión de código con IA que añade sus observaciones al diff.",
      },
      {
        title: "Comparte una revisión",
        body: "Comparte un enlace para que otras personas anoten y luego importa sus comentarios. Los contenidos pequeños van en fragmentos de URL; los grandes y el HTML usan enlaces cortos cifrados. El uso compartido de enlaces de la versión de código abierto sigue disponible, con soporte obsoleto. La colaboración en equipo se traslada a Workspaces, que el sitio aún marca como próximamente.",
      },
    ],
    links: ["Conoce Plannotator", "README de Plannotator"],
  },
  ours: {
    title: "AI4Kanban: revisa los borradores clave y avanza varias tareas",
    lead: "AI4Kanban organiza el trabajo de los agentes de programación en un tablero de tareas, con especialistas integrados en diseño UI, redacción y análisis de la competencia. Tú ayudas a planificar y apruebas los borradores clave; después, los agentes ejecutan en segundo plano. Las tareas sin dependencias pueden avanzar a la vez.",
    drafts: {
      title: "Revisa lo que querrías cambiar",
      body: "¿Te preocupa que la IA se tome libertades con una pantalla, un prompt o un texto? Lo que requiere tu decisión recibe primero un borrador, y los agentes construyen a partir del borrador aprobado. Además de planes y HTML, puedes previsualizar imágenes, diagramas y storyboards. Los agentes resuelven directamente el resto de los detalles.",
      art: ["Borrador", "Aprobar", "Ejecución"],
    },
    parallel: {
      title: "Avanza varias tareas a la vez",
      body: "El tablero reúne tareas, dependencias y progreso. Una vez definidos los requisitos, las tareas independientes se ejecutan en paralelo. Consulta los registros y los diffs de código desde cada tarjeta sin vigilar cada sesión durante la ejecución.",
      art: ["Login", "Precios", "Fix de API"],
    },
    memory: {
      title: "Explica menos la próxima vez",
      body: "Cada agente usa una memoria pensada para su trabajo para aprender tus preferencias y decisiones. Los agentes pueden compartir esa memoria. Al terminar un trabajo principal, proponen tareas de seguimiento para cubrir huecos y detectar omisiones.",
      art: { agents: ["Diseño UI", "Redacción"], shared: "Compartida · contexto del proyecto" },
    },
    custom: "También puedes crear tus propios agentes y flujos de trabajo.",
    tipLabel: "Nota",
    tip: "El flujo de desarrollo de software es gratuito. Los flujos de blog, carrusel para redes sociales, presentaciones y vídeo de producto requieren Pro.",
  },
  compare: {
    title: "Qué viene integrado",
    head: "Función",
    yes: "Incluido",
    no: "No incluido",
    how: {
      label: "Cómo se trabaja",
      theirs: "Abre una revisión en tu sesión actual con el agente",
      ours: "Inicia agentes desde tarjetas de tareas para que trabajen en segundo plano",
    },
    rows: {
      plans: { label: "Revisar planes y devolver comentarios antes de ejecutar" },
      html: { label: "Previsualizar borradores HTML" },
      images: { label: "Revisar borradores de imágenes y storyboards" },
      planDiff: { label: "Mostrar las diferencias entre versiones del plan" },
      askAi: {
        label: "Preguntar a la IA durante la revisión",
        theirs: "Preguntas en la vista de revisión",
        ours: "Conversación en la tarjeta",
      },
      codeDiff: { label: "Ver diffs de código", ours: "Pestaña Diff de la entrega" },
      aiReview: { label: "Observaciones de revisión con IA sobre diffs de código" },
      prs: { label: "Revisar PR de GitHub y MR de GitLab" },
      share: { label: "Compartir enlaces de revisión", theirs: "Soporte obsoleto en la versión OSS" },
      board: { label: "Tablero de tareas con dependencias y ejecución en paralelo" },
      agents: { label: "Agentes especializados y flujos de trabajo integrados" },
      memory: { label: "Memoria de preferencias y decisiones, compartida entre agentes" },
      followUps: { label: "Propuestas de seguimiento al terminar una tarea principal" },
    },
    note: "Se comparan las funciones integradas. El historial local de Plannotator y sus exportaciones a Obsidian o Bear guardan registros de revisión; no son la memoria que los agentes usan en tareas posteriores.",
  },
  decision: {
    title: "¿Cuál encaja con tu trabajo?",
    theirs: {
      name: "Elige Plannotator",
      body: "Quieres revisar planes, documentos y código en torno al agente que ya usas, comprobando cada versión. También necesitas revisar PR o compartir anotaciones.",
    },
    ours: {
      name: "Elige AI4Kanban",
      body: "Quieres avanzar varias tareas: aprobar los borradores clave de UI y textos, dejar que los agentes ejecuten y llevar tus preferencias y decisiones a las tareas siguientes.",
    },
  },
  start: {
    title: "¿Listo para coordinar varias tareas?",
    body: "Descarga AI4Kanban. Planifica con precisión, entrega con rapidez.",
    cta: "Descargar AI4Kanban",
  },
};

export default es;
