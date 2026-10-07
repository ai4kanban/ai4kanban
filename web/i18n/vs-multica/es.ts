import type { VsMulticaCopy } from "./types";

const es: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica: avanza tus proyectos con agentes de IA",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "Compara AI4Kanban y Multica: los problemas que resuelve cada uno, el trabajo de configuración y revisión que te ahorran y cómo difieren en su forma de trabajar con agentes de IA.",
    social:
      "Ambos permiten crear y organizar varios equipos de agentes de IA que trabajan en paralelo. AI4Kanban incluye agentes, flujos de trabajo y gestión de memoria listos para usar, y reduce el esfuerzo de diseñar un equipo y ajustar sus prompts.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nMultica",
    lead: "AI4Kanban incluye agentes especializados y flujos de trabajo listos para usar: delega tu primer trabajo en 10 minutos. Los agentes trabajan en paralelo, los borradores te dejan controlar la calidad de cada entrega y siguen aprendiendo con el uso.",
    sharedLabel: "Ambos ofrecen",
    setup: {
      heading: "Empieza a trabajar sin diseñar antes el equipo",
      verdict:
        "Los agentes especializados vienen listos, así que delegas trabajo desde el primer día.",
      ours: "Los agentes especializados y flujos de trabajo incluidos cubren desarrollo de software, blogs, carruseles para redes sociales, presentaciones y vídeos de producto.",
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
        "¿Te preocupa que la IA se tome demasiadas libertades? Revisa un borrador antes de aprobar la ejecución",
      verdict: "Corrige el rumbo antes de ejecutar, no después.",
      ours: "En cualquier parte donde quieras controlar el rumbo, el sistema de borradores prepara una vista previa para que la apruebes antes de la ejecución y la entrega. AI4Kanban admite borradores de imagen, diagrama, HTML/TSX, diff y storyboard.",
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
        "Las preferencias y decisiones se guardan por tarea, así que no tienes que repetirlas.",
      ours: "Cada agente tiene una receta de memoria diseñada para su propio trabajo: aprende tus preferencias y decisiones para ese tipo de tarea, no lecciones genéricas. Los agentes también pueden compartir memoria entre sí.",
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
          "El desarrollo de software es gratis; los flujos de blog, carrusel para redes, presentación y vídeo de producto requieren Pro.",
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
      "Quieres agentes especializados y flujos de trabajo incluidos sin configurarlos desde cero; algunos flujos requieren Pro.",
      "Quieres revisar los borradores clave antes de ejecutar.",
      "Quieres que los agentes recuerden cambios y decisiones útiles aunque cambies de herramienta.",
      "Quieres planificación y propuestas de seguimiento incluidas, con margen para personalizar el flujo.",
    ],
    theirs: [
      "Necesitas espacios de trabajo multiusuario, permisos y notificaciones para todo un equipo que trabaja sobre issues compartidos.",
      "Necesitas gestión de la ejecución: colas, reintentos, repetición, seguimiento de costes y enlaces a PR y CI.",
      "Quieres configurar el runbook, el responsable y los disparadores de Autopilot para lanzar trabajo recurrente según un calendario o eventos externos.",
    ],
    verdict:
      "Elige AI4Kanban para **empezar con agentes especializados, aprobar los borradores clave antes de ejecutar y que tus decisiones se recuerden**. Elige Multica solo si **necesitas específicamente su espacio de trabajo multiusuario o su gestión de la ejecución**.",
    note: "",
  },
};

export default es;
