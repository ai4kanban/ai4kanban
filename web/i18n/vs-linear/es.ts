// Español — the Linear comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsLinearCopy } from "./types";

const es: VsLinearCopy = {
  meta: {
    title: "AI4Kanban vs. Linear — planificación en el repo o coordinación de equipos",
    socialTitle: "AI4Kanban vs. Linear",
    description:
      "Compara AI4Kanban y Linear: un sistema de planificación integrado en el repo para agentes de código frente a una plataforma colaborativa de desarrollo de producto para equipos y agentes.",
    social:
      "Linear coordina el trabajo de toda la organización. AI4Kanban convierte peticiones incompletas en planes listos para implementar dentro del repo. Descubre qué modelo encaja con tu forma de trabajar.",
  },
  hero: {
    badge: "Comparación",
    title: "AI4Kanban vs.\nLinear",
    lead: "Linear ofrece a los equipos un sistema compartido para planificar y entregar producto. AI4Kanban sitúa el sistema de planificación del agente de código dentro del repo. Uno coordina una organización; el otro convierte peticiones incompletas en trabajo listo para implementar sin separar el plan del código.",
    ours: {
      name: "AI4Kanban",
      body: "Un tablero Markdown en el repo, diseñado para el refinamiento dirigido por el agente.",
    },
    theirs: {
      name: "Linear",
      body: "Un espacio alojado donde personas y agentes coordinan el desarrollo de producto.",
    },
    oursDiagramAlt:
      "Una nota vaga entra en AI4Kanban y sale como una especificación con sus criterios de aceptación, guardada junto al código.",
    theirsDiagramAlt:
      "El trabajo de un equipo entra en Linear y sale como una lista común que muestra quién lleva cada cosa y en qué punto está.",
    oursDiagramTop: "entra una idea vaga",
    oursDiagramBottom:
      "sale una spec que puedes construir, junto al código",
    theirsDiagramTop: "entra el trabajo de todo un equipo",
    theirsDiagramBottom:
      "sale una lista común: quién lleva qué y cómo va",
  },
  summary: {
    heading: {
      eyebrow: "La versión corta",
      title: "Ambos admiten agentes, pero organizan el trabajo a distinto nivel.",
    },
    lead: "Linear es una plataforma completa de desarrollo de producto. Sus agentes pueden utilizar el contexto del espacio de trabajo, las incidencias se pueden delegar a agentes de código y MCP permite conectar agentes externos. Coding Sessions también puede ejecutar Claude Code o Codex y devolver un pull request para revisión.",
    panel:
      "AI4Kanban responde a una necesidad más concreta: **planificar con un agente de código dentro del repo**. Convierte una petición incompleta en preguntas, decisiones, dependencias y una tarjeta lista para implementar. El plan y su historial permanecen como Markdown revisable junto al código.",
  },
  comparison: {
    heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. Linear" },
    lead: "Un {check} señala la opción más adecuada para una necesidad concreta; una **raya** indica que la respuesta depende de tu flujo de trabajo. Linear destaca en **coordinación de equipos, planificación de cartera, integraciones y ejecución gestionada de agentes**. AI4Kanban destaca en **refinamiento dentro del repo, portabilidad e historial de planificación en git**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Linear",
    rows: {
      bestFit: {
        dimension: "Para quién encaja mejor",
        kanban: "Desarrolladores independientes y equipos pequeños que planifican y entregan trabajo mediante un agente de código.",
        linear: "Organizaciones de producto e ingeniería que coordinan personas, proyectos y agentes.",
      },
      sourceOfTruth: {
        dimension: "Dónde reside el plan",
        kanban: "Markdown en el repo del proyecto, versionado junto con el código.",
        linear: "Un espacio compartido de Linear accesible mediante sus aplicaciones, su API y su MCP server.",
      },
      refinement: {
        dimension: "De idea en bruto a tarea lista",
        kanban: "Un proceso guiado investiga la petición, registra las decisiones y se detiene cuando la tarjeta es lo bastante concreta para implementarla.",
        linear: "Linear Agent puede redactar, resumir, actualizar y acotar incidencias; el resultado de la implementación sigue dependiendo de la calidad de la incidencia.",
      },
      agentModel: {
        dimension: "Modelo de agentes",
        kanban: "El entorno de programación que elijas lee y escribe el tablero; actualmente se admiten Claude Code, Codex, Cursor, OpenCode, DeepSeek Harness y ZCode.",
        linear: "Linear Agent, app users instalables, incidencias delegadas, instrucciones para agentes y un MCP server alojado.",
      },
      execution: {
        dimension: "Código y revisión",
        kanban: "El entorno que elijas implementa la tarjeta preparada; la revisión continúa en tu flujo de git habitual.",
        linear: "Coding Sessions ejecuta Claude Code o Codex en la nube, abre un pull request e incorpora los diffs y la revisión a Linear.",
      },
      collaboration: {
        dimension: "Colaboración humana",
        kanban: "Adecuado para la colaboración por git en equipos pequeños, pero no está diseñado para que muchas personas editen el tablero a la vez.",
        linear: "Un espacio en tiempo real con responsables, comentarios, equipos privados, invitados, notificaciones y permisos.",
      },
      portfolio: {
        dimension: "Amplitud de planificación",
        kanban: "Tarjetas, dependencias, prioridades, ROI, releases e historial de planificación por módulo.",
        linear: "Incidencias, proyectos, ciclos, iniciativas, hitos, cronologías, triage, insights y peticiones de clientes.",
      },
      setup: {
        dimension: "Primeros pasos",
        kanban: "Se instala en un repo con un prompt; el tablero no necesita cuenta, base de datos ni servicio alojado.",
        linear: "Crea un espacio, invita al equipo y configura las integraciones y el acceso de agentes que necesites.",
      },
      portability: {
        dimension: "Portabilidad",
        kanban: "Al clonar el repo, el tablero, las decisiones y el historial vienen incluidos. La planificación también funciona sin conexión.",
        linear: "Los datos residen en Linear; los administradores pueden exportar las incidencias a CSV o recuperarlas mediante la API.",
      },
      pricing: {
        dimension: "Precio",
        kanban: "Código abierto con licencia Apache-2.0; solo pagas las herramientas de agente de código que elijas.",
        linear: "Free incluye 250 incidencias y 2 equipos. Con facturación anual, Basic cuesta 10 $ por usuario al mes y Business, 16 $. Coding Sessions también consume AI credits.",
      },
    },
  },
  model: {
    heading: {
      eyebrow: "La diferencia fundamental",
      title: "Contexto del repo frente a contexto de la organización",
    },
    lead: "La cuestión no es si el producto admite agentes, sino **dónde debe residir el contexto de planificación**: junto al código en el repo o en un espacio compartido por toda la organización.",
    ours: {
      name: "AI4Kanban — el plan permanece junto al código",
      is: "Antes de modificar el plan, el agente consulta el código, las decisiones anteriores, los enfoques descartados y el trabajo terminado. Refina la petición hasta resolver cada cuestión pendiente o asignártela con claridad.",
      isnt: "No es una suite de colaboración para toda la organización. Su valor reside en un contexto de planificación duradero, versionado con el código y disponible en cada clon.",
    },
    theirs: {
      name: "Linear — un espacio común para la organización",
      is: "Las incidencias pertenecen a equipos y los proyectos pueden abarcar varios. Los ciclos, las iniciativas, las cronologías, los documentos, los comentarios y las peticiones de clientes crean un contexto compartido en el que también trabajan los agentes, con los mismos permisos.",
      isnt: "Esa amplitud puede resultar innecesaria para un desarrollador independiente cuyo principal reto es convertir una petición incompleta en un plan de implementación fiable.",
    },
    note: "Ambos pueden convivir, pero solo uno debe ser la referencia para el estado de las tareas. Para un desarrollador independiente, mantener el mismo trabajo en dos sitios suele añadir más proceso que valor.",
  },
  wins: {
    heading: { eyebrow: "Compromisos", title: "Dónde gana cada uno" },
    lead: "Linear aporta amplitud, coordinación y ejecución gestionada. AI4Kanban mantiene la planificación dirigida por el agente junto al código, fácil de revisar y disponible entre sesiones.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Linear",
    ours: {
      roughToReady: {
        title: "Refina las peticiones antes de implementarlas",
        body: "El agente investiga, plantea preguntas, registra decisiones y divide el trabajo antes de considerar la tarjeta un plan de implementación.",
      },
      repoMemory: {
        title: "Conserva el historial del plan junto al código",
        body: "Las decisiones, los enfoques descartados, las dependencias y las tarjetas son archivos de texto que admiten diff y que puede consultar la siguiente sesión del agente.",
      },
      anyHarness: {
        title: "Funciona con el entorno de programación que elijas",
        body: "El tablero no está ligado a un runtime de agentes propietario. Claude Code, Codex, Cursor, OpenCode, DeepSeek Harness y ZCode ya son compatibles, y el formato de archivo abierto permite utilizar otros entornos.",
      },
      noSaas: {
        title: "No requiere otro servicio de gestión de proyectos",
        body: "El tablero no añade espacios, licencias, autenticación, bases de datos ni capas de sincronización que administrar. Simplemente forma parte del repo.",
      },
    },
    theirs: {
      teamSystem: {
        title: "Diseñado para la colaboración en equipo",
        body: "Incluye edición simultánea, responsables claros, permisos, comentarios, equipos privados, invitados, notificaciones y una interfaz pulida.",
      },
      agentPlatform: {
        title: "Ofrece agentes y ejecución gestionados",
        body: "Linear Agent, app users, MCP, incidencias delegadas, Coding Sessions, diffs y revisión de pull requests comparten el mismo contexto del espacio de trabajo.",
      },
      planningDepth: {
        title: "Permite planificar productos a gran escala",
        body: "Los proyectos, ciclos, iniciativas, hitos, cronologías, triage, insights y peticiones de clientes permiten planificar mucho más allá de un solo repo.",
      },
      integrations: {
        title: "Conecta el trabajo de toda la organización",
        body: "GitHub, GitLab, Slack, Teams, herramientas de soporte, APIs, webhooks y búsqueda conectan la planificación con el resto del trabajo de la organización.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La decisión", title: "¿Cuál encaja con tu flujo de trabajo?" },
    oursHeading: "Elige AI4Kanban si",
    theirsHeading: "Elige Linear si",
    ours: [
      "Un desarrollador independiente o un equipo pequeño planifica y entrega el trabajo mediante un agente de código.",
      "Las peticiones suelen estar incompletas y convertirlas en planes fiables es el cuello de botella.",
      "Quieres versionar las tareas, las decisiones y el historial de planificación junto con el código.",
      "Prefieres elegir tu entorno de programación en lugar de adoptar el runtime de una herramienta de proyecto.",
    ],
    theirs: [
      "Muchas personas necesitan crear, asignar, debatir y actualizar el trabajo a la vez.",
      "Tu planificación depende de ciclos, iniciativas, cronologías, triage, peticiones de clientes o informes.",
      "Quieres sesiones de programación gestionadas en la nube y revisión de diffs dentro del espacio de proyecto.",
      "Necesitas integraciones, permisos, controles de seguridad y soporte para toda la organización.",
    ],
    verdict:
      "Elige Linear si la parte difícil es coordinar personas, proyectos y agentes en toda la organización. Elige AI4Kanban si el reto es proporcionar a un agente de código suficiente contexto duradero para convertir una petición incompleta en trabajo fiable. Lo decisivo no es la longitud de la lista de funciones, sino dónde debe vivir tu proceso de planificación.",
    note: "AI4Kanban propone otro modelo de planificación; no sustituye a Linear función por función.",
  },
};

export default es;
