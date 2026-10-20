import type { VsPlannotatorCopy } from "./types";

const es: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator: del borrador a la entrega",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "Compara AI4Kanban y Plannotator en revisión de borradores y código, flujos especializados, tareas en paralelo y cómo continúa el trabajo tras la aprobación.",
    social:
      "Compara AI4Kanban y Plannotator en revisión de borradores y código, flujos especializados, tareas en paralelo y cómo continúa el trabajo tras la aprobación.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs. Plannotator",
    lead: "Compara AI4Kanban y Plannotator en revisión de borradores y código, flujos especializados, tareas en paralelo y cómo continúa el trabajo tras la aprobación.",
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
    title: "AI4Kanban: del borrador al trabajo terminado",
    lead: "Los agentes preparan borradores de la interfaz, los textos o el guion que debes revisar. Tras aprobar lo esencial, el flujo completa la tarea. Hay flujos integrados para código, blogs y vídeos; las tareas independientes pueden ejecutarse en paralelo.",
    drafts: {
      title: "Revisa lo que querrías cambiar",
      body: "Las partes que necesitan tu criterio tienen un borrador primero. Revísalo y edítalo en la tarjeta; los agentes continúan desde la versión aprobada y resuelven los detalles dentro del alcance acordado. Corregir lo esencial aquí reduce lo que hay que rehacer después.",
      art: ["Borrador", "Aprobar", "Ejecución"],
    },
    parallel: {
      title: "Avanza varias tareas a la vez",
      body: "Organiza desarrollo y marketing en un mismo tablero, con borradores, decisiones y progreso en cada tarjeta. Una vez definidos los requisitos, las tareas independientes avanzan en paralelo; las que tienen dependencias siguen su orden.",
      art: ["Login", "Precios", "Fix de API"],
    },
    memory: {
      title: "Explica menos la próxima vez",
      body: "Cada agente recuerda las preferencias y decisiones relevantes para su trabajo y puede compartir el contexto del proyecto con otros agentes. Las tareas posteriores parten de lo ya acordado. Tras completar un trabajo principal, los agentes proponen próximos pasos que puedes aceptar, modificar o rechazar.",
      art: { agents: ["Diseño UI", "Redacción"], shared: "Compartida · contexto del proyecto" },
    },
    custom: "También puedes crear tus propios agentes y flujos de trabajo.",
    tipLabel: "Nota",
    tip: "El flujo de desarrollo de software es gratuito. Los flujos de blog, publicaciones para redes sociales, presentaciones, vídeo de producto y clonación de vídeos requieren Pro.",
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
      body: "Revisa borradores clave en la tarjeta y deja que los agentes terminen. Los flujos integrados cubren desarrollo y marketing, con tareas independientes en paralelo. Los agentes reutilizan tus preferencias para reducir las correcciones repetidas.",
    },
  },
  start: {
    title: "¿Listo para coordinar varias tareas?",
    body: "Descarga AI4Kanban. Planifica con precisión, entrega con rapidez.",
    cta: "Descargar AI4Kanban",
  },
};

export default es;
