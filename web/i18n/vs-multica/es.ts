import type { VsMulticaCopy } from "./types";

const es: VsMulticaCopy = {
  meta: {
    title:
      "AI4Kanban vs. Multica: gestión de proyectos con IA o plataforma multiagente",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "AI4Kanban ofrece gestión de proyectos con IA lista para usar. Multica es una plataforma general para crear y operar equipos de agentes.",
    social:
      "Ambos ejecutan tareas con agentes, pero cubren necesidades distintas: uno gestiona proyectos; el otro sirve para crear equipos de agentes.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nMultica",
    lead: "Ambos productos ejecutan tareas con agentes. **AI4Kanban ofrece gestión de proyectos con IA lista para usar; Multica es una plataforma multiagente de propósito general.**",
    ours: {
      name: "AI4Kanban",
      body: "Las personas marcan la dirección, aportan ideas y toman las decisiones clave. Los agentes descubren tareas, aclaran requisitos, fijan prioridades, ejecutan el trabajo e incorporan lo aprendido a la memoria del proyecto.",
    },
    theirs: {
      name: "Multica",
      body: "Creas varios agentes y configuras sus responsabilidades, Skills y entornos de ejecución. Después gestionas desde un solo lugar el reparto, la ejecución, los reintentos, la revisión y la colaboración.",
    },
    oursDiagramAlt:
      "AI4Kanban permite que personas y agentes planifiquen y ejecuten en torno a un objetivo común.",
    theirsDiagramAlt:
      "Multica permite configurar y operar varios agentes.",
    oursDiagramTop: "las personas marcan el rumbo · deciden",
    oursDiagramBottom: "los agentes planifican · aclaran · ejecutan",
    theirsDiagramTop: "varios agentes + Skills + entornos",
    theirsDiagramBottom: "repartir · asignar · colaborar · supervisar",
  },
  boundary: {
    heading: { eyebrow: "Posicionamiento", title: "Dos productos, dos necesidades" },
    lead: "AI4Kanban ayuda a personas y agentes a gestionar juntos un proyecto. Multica ayuda a crear, organizar y ejecutar varios agentes.",
    stages: {
      discover: "Marcar el rumbo",
      refine: "Aclarar con IA",
      prioritize: "Avanzar juntos",
      assign: "Crear agentes",
      run: "Configurar equipos",
      review: "Gestionar tareas",
    },
    oursLabel: "AI4Kanban",
    theirsLabel: "Multica",
    oursJob: "Gestiona el proyecto",
    theirsJob: "Opera los agentes",
  },
  backlog: {
    heading: {
      eyebrow: "De serie",
      title: "¿Qué trae cada uno?",
    },
    lead: "Los dos están completos desde el primer día, pero completos en cosas distintas. AI4Kanban trae la gestión del proyecto; Multica trae la maquinaria para ejecutar agentes.",
    ours: {
      label: "AI4Kanban",
      title: "Gestión de proyectos, lista para funcionar",
      items: [
        "Un método de trabajo para personas e IA",
        "Un tablero con el ciclo completo de la tarjeta",
        "Memoria del proyecto guardada en el repositorio",
      ],
    },
    theirs: {
      label: "Multica",
      title: "Infraestructura de agentes, lista para funcionar",
      items: [
        "Identidades de agente, Instructions y Skills",
        "Squads, chat y colas de tareas",
        "Automatización, reintentos e historial de ejecución",
      ],
    },
  },
  comparison: {
    heading: { eyebrow: "Diferencias clave", title: "Lo que de verdad importa" },
    lead: "Un {check} indica la opción más adecuada para ese uso; un **guion** señala una decisión con ventajas e inconvenientes.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Enfoque del producto",
        kanban:
          "Un flujo completo de gestión de proyectos para personas y agentes, listo para usar.",
        multica:
          "Un espacio general para equipos multiagente; cada usuario define roles y flujos.",
      },
      backlog: {
        dimension: "Gestión proactiva",
        kanban:
          "Los agentes leen el proyecto y su memoria para proponer, concretar y priorizar tareas.",
        multica:
          "Se puede crear con agentes, Skills y Autopilots, pero requiere configuración propia.",
      },
      refinement: {
        dimension: "Definición de requisitos",
        kanban:
          "Completa el contexto desde el código y el historial, y deja a las personas solo las decisiones de producto.",
        multica:
          "No incluye un flujo de definición de proyecto; hay que añadirlo a las instrucciones del agente o a una Skill.",
      },
      memory: {
        dimension: "Memoria a largo plazo",
        kanban:
          "Las decisiones, los motivos de rechazo y las lecciones de rediseño alimentan la planificación futura.",
        multica:
          "Las Skills conservan métodos de trabajo; los comentarios y el historial guardan el proceso de ejecución.",
      },
      execution: {
        dimension: "Gestión de la ejecución",
        kanban:
          "Puede lanzar Claude Code o Codex sobre una tarjeta y gestionar todo su ciclo, desde la propuesta hasta el archivo.",
        multica:
          "Ejecuta varios agentes en paralelo con colas, reintentos, replay, costes, controles de revisión y enlaces con PR y CI.",
      },
      teams: {
        dimension: "Colaboración",
        kanban:
          "Local-first, pensado para desarrolladores individuales y equipos pequeños que colaboran con git.",
        multica:
          "Espacios multiusuario, roles, Squads, comentarios, permisos y notificaciones.",
      },
      storage: {
        dimension: "Despliegue y almacenamiento",
        kanban:
          "Tarjetas y memoria viven en el repositorio; no requiere base de datos, cuenta ni servidor de tablero.",
        multica:
          "Usa PostgreSQL, un servidor y un daemon local; puede ser alojado o autogestionado.",
      },
      license: {
        dimension: "Licencia",
        kanban:
          "Apache-2.0, incluido el uso comercial, el alojamiento y la integración.",
        multica:
          "Código disponible; la Multica License restringe los servicios alojados y la integración comercial.",
      },
    },
  },
  memory: {
    heading: { eyebrow: "Memoria a largo plazo", title: "Recuerdan cosas distintas" },
    lead: "Los dos guardan notas entre ejecuciones. Guardan notas distintas.",
    ours: {
      eyebrow: "Criterio del proyecto",
      title: "Por qué se tomó una decisión",
      examples: ["decisions.md", "rejected.md", "redesign.md"],
      question: "¿Por qué el tablero dejó de proponer la idea X?",
      answer:
        "`rejected.md` conserva el motivo del rechazo. Sin nuevas pruebas, la idea no vuelve.",
    },
    theirs: {
      eyebrow: "Método de trabajo",
      title: "Cómo debe trabajar un agente",
      examples: ["Instructions", "SKILL.md", "historial de ejecución"],
      question: "¿Cómo debe realizar este agente una revisión de seguridad?",
      answer:
        "Adjunta una Skill con los pasos, los archivos y los requisitos de la revisión.",
    },
    note: "",
  },
  horizon: {
    heading: {
      eyebrow: "Configuración propia",
      title: "¿Qué debes añadir en Multica?",
    },
    lead: "En Multica puedes crear un agente de gestión de proyectos. Crearlo es lo rápido; después te tocan estas cuatro preguntas, y volver a responderlas cada vez que el proyecto cambia.",
    visionLabel: "Lo construyes tú",
    visionTitle: "El comportamiento de gestión",
    items: [
      "Cómo entiende el objetivo del proyecto",
      "Cómo encuentra el trabajo que vale la pena",
      "Cómo aclara un requisito impreciso",
      "Qué recuerda entre una ejecución y otra",
    ],
    note: "",
  },
  wins: {
    heading: { eyebrow: "Puntos fuertes", title: "Elige según tu necesidad" },
    lead: "AI4Kanban ofrece una solución concreta, completa y lista para usar. Multica es una plataforma amplia y flexible para operar varios agentes.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "Gestión de proyectos lista para usar",
        body: "No hace falta diseñar antes un agente de gestión. Tras instalarlo, personas y agentes pueden planificar, aclarar y ejecutar con un mismo método.",
      },
      rejectionMemory: {
        title: "Las ideas rechazadas no reaparecen",
        body: "Las decisiones anteriores influyen en la siguiente planificación y evitan repetir debates.",
      },
      repoNative: {
        title: "Todo vive en git",
        body: "Tarjetas y memoria son legibles y comparables, sin otro servicio de tablero que mantener.",
      },
    },
    theirs: {
      operations: {
        title: "Control completo de la ejecución",
        body: "Incluye colas, reintentos, replay, revisión, costes y enlaces con PR y CI.",
      },
      teams: {
        title: "Preparado para personas y varios agentes",
        body: "Espacios, roles, Squads, comentarios, permisos y notificaciones conviven en una plataforma.",
      },
      runtimeReach: {
        title: "Mayor compatibilidad de entornos",
        body: "Un daemon local conecta muchas CLI de agentes. AI4Kanban admite hoy Claude Code y Codex.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Recomendación", title: "¿Cuál deberías elegir?" },
    oursHeading: "Elige AI4Kanban si",
    theirsHeading: "Elige Multica si",
    ours: [
      "Quieres una forma lista para usar de gestionar un proyecto entre personas y agentes.",
      "Necesitas agentes en la planificación, la definición y la ejecución.",
      "Quieres que decisiones y rechazos influyan en los planes futuros.",
      "Prefieres un sistema ligero, nativo del repositorio y sin otro servicio.",
    ],
    theirs: [
      "Necesitas crear y operar varios agentes con funciones distintas.",
      "Necesitas compartir espacio, incidencias e historial entre personas y agentes.",
      "Necesitas reintentos, replay, costes o integraciones con PR y CI.",
      "Puedes definir tu propio agente de gestión, sus Skills y sus flujos.",
    ],
    verdict:
      "Elige AI4Kanban si buscas **gestión de proyectos con IA lista para usar**. Elige Multica si buscas **una plataforma general para crear y operar un equipo multiagente**. Ambos ejecutan tareas con agentes: uno se centra en gestionar proyectos; el otro, en operar varios agentes.",
    note: "",
  },
};

export default es;
