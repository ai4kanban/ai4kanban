import type { VsMulticaCopy } from "./types";

const es: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica: agentes especializados listos",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "Compara AI4Kanban y Multica en agentes especializados, configuración de flujos, revisión de borradores, memoria de preferencias y colaboración en equipo.",
    social:
      "Compara AI4Kanban y Multica en agentes especializados, configuración de flujos, revisión de borradores, memoria de preferencias y colaboración en equipo.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nMultica",
    lead: "Compara AI4Kanban y Multica en agentes especializados, configuración de flujos, revisión de borradores, memoria de preferencias y colaboración en equipo.",
    sharedLabel: "Ambos ofrecen",
    setup: {
      heading: "Empieza a trabajar sin diseñar antes el equipo",
      verdict:
        "Usa los flujos integrados de desarrollo y marketing sin organizar cada traspaso de trabajo.",
      ours: "Los agentes especializados y los flujos integrados cubren el desarrollo del producto y el contenido de marketing. Usa el flujo adecuado para cada tarea sin diseñar el equipo desde cero. También puedes crear agentes y flujos personalizados.",
      theirs:
        "Salvo el coordinador Mika, creas y configuras tú cada agente especializado",
      art: {
        ours: ["Diseño UI", "Prompts", "Redacción"],
        theirs: {
          title: "Nuevo agente",
          fields: ["Nombre", "Instructions", "Skills"],
          slot: "Lo creas tú",
        },
      },
      shared: [
        {
          title: "Agentes personalizados",
          body: [
            "AI4Kanban te deja editar los roles incluidos o añadir tus propios agentes.",
            "El Agent Builder de Multica te ayuda a crear roles y luego configurar sus Instructions y Skills.",
          ],
        },
        {
          title: "Agentes en paralelo",
          body: [
            "AI4Kanban avanza varias tarjetas a la vez con herramientas como Claude Code o Codex.",
            "Multica ejecuta agentes en paralelo, con colas, reintentos y seguimiento de costes.",
          ],
        },
      ],
    },
    drafts: {
      heading:
        "Revisa los borradores clave antes de que los agentes continúen",
      verdict: "Corrige lo esencial en el borrador para reducir cambios tras la implementación.",
      ours: "Las partes que necesitan tu criterio tienen un borrador primero. Revísalo y edítalo en la tarjeta; los agentes continúan desde la versión aprobada y resuelven los detalles dentro del alcance acordado. Corregir lo esencial aquí reduce lo que hay que rehacer después.",
      theirs: "El proceso de revisión de borradores lo montas tú",
      art: {
        ours: ["Borrador", "Aprobar", "Ejecutar"],
        theirs: {
          title: "Aprobación de borradores",
          fields: ["Quién lo prepara", "Cuándo esperar", "Cómo se entrega"],
          slot: "Lo montas tú",
        },
      },
      shared: [
        {
          title: "Vistas previas",
          body: [
            "AI4Kanban muestra en la tarjeta borradores de imagen, diagrama, HTML/TSX, diff y storyboard.",
            "Multica previsualiza HTML, recoge anotaciones y compara versiones.",
          ],
        },
        {
          title: "Conversación sobre la tarea",
          body: [
            "AI4Kanban comenta y revisa el plan en el chat de la tarjeta.",
            "Multica comenta el trabajo con los agentes en los comentarios del issue.",
          ],
        },
      ],
    },
    memory: {
      heading: "¿Tendrás que explicarlo otra vez?",
      verdict:
        "Las tareas posteriores parten del contexto del proyecto, las preferencias y las decisiones que ya has definido.",
      ours: "Cada agente recuerda las preferencias y decisiones relevantes para su trabajo y puede compartir el contexto del proyecto con otros agentes. Las tareas posteriores parten de lo ya acordado para que tengas que repetir menos explicaciones.",
      theirs:
        "La memoria a largo plazo depende de la herramienta del agente; te toca revisarla y configurarla",
      art: {
        ours: {
          agents: ["Diseño UI", "Redacción"],
          notes: ["Preferencias de diseño", "Decisiones de redacción"],
          shared: "Compartida · proyecto",
        },
        theirs: {
          title: "Memoria a largo plazo",
          fields: ["Qué herramienta", "Dónde se guarda", "Cuándo se lee"],
          slot: "La configuras tú",
        },
      },
      shared: [
        {
          title: "Métodos guardados",
          body: [
            "AI4Kanban da a cada agente reglas de rol que puedes editar.",
            "Multica guarda los métodos en Instructions y Skills.",
          ],
        },
        {
          title: "Historial de tareas",
          body: [
            "AI4Kanban conserva el plan, el chat y el registro de ejecución en cada tarjeta.",
            "Multica conserva comentarios e historial de ejecuciones.",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: { eyebrow: "Diferencias clave", title: "Compara los detalles" },
    lead: "Un {check} marca el lado más fuerte en cada fila.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Agentes y flujos incluidos",
        kanban:
          "Agentes especializados y flujos de trabajo incluidos, con roles que puedes editar o añadir.",
        kanbanTip:
          "El desarrollo de software es gratis; los flujos de blog, carrusel para redes, presentación, vídeo de producto y clonación de vídeos requieren Pro.",
        multica:
          "Incluye a Mika. Creas los agentes especializados tú o con Agent Builder y les das Instructions y Skills.",
      },
      refinement: {
        dimension: "Revisar borradores antes de ejecutar",
        kanban:
          "En cualquier parte donde quieras controlar el rumbo, el sistema de borradores prepara una vista previa para que la apruebes antes de la ejecución y la entrega. AI4Kanban admite borradores de imagen, diagrama, HTML/TSX, diff y storyboard.",
        multica:
          "Previsualiza HTML, anota resultados y compara versiones. Tú defines qué agente prepara cada borrador y cuándo hace falta aprobación antes de ejecutar.",
      },
      memory: {
        dimension: "Recordar cambios y decisiones",
        kanban:
          "Cada agente tiene una receta de memoria diseñada para su propio trabajo: aprende tus preferencias y decisiones para ese tipo de tarea, no lecciones genéricas. Los agentes también pueden compartir memoria entre sí.",
        multica:
          "La memoria a largo plazo depende de la herramienta del agente. Los agentes que usan Hermes conservan cada uno memoria entre tareas en el entorno local; no se sincroniza automáticamente entre máquinas. También se guardan las instrucciones y el historial de tareas.",
      },
      backlog: {
        dimension: "Después de la entrega",
        kanban:
          "Cuando terminas un trabajo principal, los agentes proponen por su cuenta tareas de seguimiento para cubrir huecos y omisiones.",
        multica:
          "Para recibir propuestas de seguimiento, debes pedirlas en las instrucciones de la tarea. Autopilot se ejecuta solo después de configurar su runbook, responsable y disparadores por calendario o webhook.",
      },
      license: {
        dimension: "Licencia",
        kanban:
          "Apache-2.0, incluido el uso comercial, el alojamiento y la integración.",
        multica:
          "Código disponible; la Multica License restringe los servicios alojados y la integración comercial.",
      },
      execution: {
        dimension: "Gestión de la ejecución",
        kanban:
          "Ejecuta tarjetas con Claude Code, Codex, Cursor, OpenCode, DeepSeek Harness, ZCode o Grok Build, con varias tarjetas en curso a la vez.",
        multica:
          "Ejecuta varios agentes en paralelo, con colas, reintentos, repetición, seguimiento de costes, puertas de revisión y enlaces a PR y CI.",
      },
      teams: {
        dimension: "Colaboración en equipo",
        kanban:
          "Para personas y equipos pequeños que organizan tareas en un repositorio, con agentes y flujos personalizables.",
        multica:
          "Espacios de trabajo multiusuario, roles, Squads, comentarios, permisos y notificaciones.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Recomendación", title: "¿Cuál deberías elegir?" },
    oursHeading: "Elige AI4Kanban si",
    theirsHeading: "Elige Multica si",
    ours: [
      "Quieres agentes y flujos listos para usar en tu producto y marketing.",
      "Quieres aprobar los borradores que necesitan tu criterio antes de que los agentes continúen.",
      "Quieres reutilizar el contexto del proyecto, tus preferencias y tus decisiones en tareas posteriores.",
      "Quieres tareas independientes en paralelo y propuestas de seguimiento tras la entrega.",
    ],
    theirs: [
      "Necesitas espacios de trabajo multiusuario, permisos y notificaciones para todo un equipo que trabaja sobre issues compartidos.",
      "Necesitas gestión de la ejecución: colas, reintentos, repetición, seguimiento de costes y enlaces a PR y CI.",
      "Quieres configurar el runbook, el responsable y los disparadores de Autopilot para lanzar trabajo recurrente según un calendario o eventos externos.",
    ],
    verdict:
      "Elige AI4Kanban para **avanzar con tu producto y marketing usando flujos listos para usar**, revisar borradores clave y conservar tus preferencias para tareas posteriores. Elige Multica solo si **necesitas específicamente su espacio de trabajo multiusuario o su gestión de la ejecución**.",
    note: "",
  },
};

export default es;
