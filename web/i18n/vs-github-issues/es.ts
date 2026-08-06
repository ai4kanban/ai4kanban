// Español — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const es: VsGithubCopy = {
  meta: {
    title:
      "AI4Kanban vs. GitHub Issues — Cada trabajo requiere una herramienta distinta",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "Una comparación práctica entre el tablero basado en archivos de AI4Kanban y GitHub Issues: Markdown local frente a una API remota, consumo de tokens, facilidad de uso para los agentes, colaboración en equipo y situaciones en las que conviene utilizar cada herramienta.",
    social:
      "AI4Kanban no pretende sustituir a GitHub Issues: cada herramienta resuelve un cuello de botella diferente. Una comparación práctica sobre velocidad, tokens, agentes y equipos.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban no pretende sustituir a GitHub Issues. Cada herramienta resuelve un cuello de botella diferente. GitHub Issues es un sistema de referencia compartido y duradero que facilita la colaboración pública; AI4Kanban es un espacio de trabajo privado y local que un agente puede gestionar directamente. La elección depende de qué esté frenando realmente tu trabajo.",
    ours: {
      name: "AI4Kanban",
      body: "Markdown plano guardado en tu repositorio: un tablero local que los agentes pueden consultar y actualizar con rapidez.",
    },
    theirs: {
      name: "GitHub Issues",
      body: "Una base de datos alojada y accesible mediante API, diseñada como sistema de referencia compartido para un equipo o una comunidad.",
    },
  },
  summary: {
    heading: {
      eyebrow: "En resumen",
      title: "¿Por qué no usar simplemente GitHub Issues?",
    },
    lead: "Puedes hacerlo. Casi todo lo que permite AI4Kanban también se puede conseguir con GitHub Issues y la CLI `gh` o un servidor MCP de GitHub. La diferencia relevante es el coste operativo.",
    panel:
      "Para un agente, completar la misma tarea mediante GitHub Issues suele implicar **más datos**, **más llamadas a herramientas**, **mayor consumo de tokens** y **latencia de red adicional**. También puede exigir **instrucciones más explícitas** para que el agente recurra a una herramienta remota. AI4Kanban no ofrece el alcance colaborativo ni el catálogo de integraciones de GitHub; a cambio, prioriza un acceso local directo y rápido. Para un desarrollador independiente que trabaja principalmente con un agente, esa velocidad puede ser el recurso más valioso.",
  },
  comparison: {
    heading: {
      eyebrow: "Comparación directa",
      title: "AI4Kanban vs. GitHub Issues",
    },
    lead: "La siguiente tabla compara ambas herramientas en catorce aspectos. Un {check} indica una ventaja clara; un **guion** indica un compromiso que depende de lo que necesites. AI4Kanban destaca por la **velocidad y el acceso local**, mientras que GitHub Issues se adapta mejor al **crecimiento y a la colaboración entre varias personas**.",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "Almacenamiento",
        kanban:
          "Archivos Markdown planos en tu repositorio, versionados con Git.",
        issues:
          "Datos alojados en GitHub y accesibles mediante sus interfaces y API.",
      },
      offline: {
        dimension: "Acceso sin conexión",
        kanban:
          "Totalmente disponible porque el tablero se guarda en el disco.",
        issues:
          "Los datos de los issues requieren conexión de red y autenticación.",
      },
      agentReads: {
        dimension: "Cómo lo consulta un agente",
        kanban:
          "Directamente con herramientas del sistema de archivos como Read, Grep y Glob.",
        issues: "Mediante la CLI `gh` o llamadas remotas a través de MCP.",
      },
      tokenCost: {
        dimension: "Consumo de tokens por consulta",
        kanban:
          "Normalmente bajo, ya que `grep` puede devolver solo el contenido coincidente.",
        issues:
          "Normalmente mayor, porque el agente debe procesar definiciones de herramientas y respuestas JSON.",
      },
      latency: {
        dimension: "Latencia",
        kanban: "El acceso al disco local es prácticamente inmediato.",
        issues: "Cada solicitud debe esperar una respuesta de red.",
      },
      setup: {
        dimension: "Configuración",
        kanban:
          "Se instala mediante un prompt; el núcleo consta de un archivo de skill y un pequeño script.",
        issues:
          "Requiere una cuenta de GitHub, autenticación y configurar la CLI o MCP.",
      },
      lockIn: {
        dimension: "Dependencia de plataforma",
        kanban:
          "No depende de una plataforma alojada; el tablero es texto plano y viaja con el repositorio.",
        issues:
          "Los datos permanecen en GitHub salvo que se exporten o migren.",
      },
      metadata: {
        dimension: "Metadatos",
        kanban:
          "Se limita deliberadamente a elementos esenciales como la prioridad y el esfuerzo.",
        issues:
          "Ofrece campos completos para etiquetas, hitos, responsables y proyectos.",
      },
      concurrency: {
        dimension: "Uso simultáneo",
        kanban:
          "No dispone de control de concurrencia; dos personas pueden crear el mismo número de tarea, como #1894.",
        issues:
          "Los identificadores asignados por el servidor permiten un uso simultáneo seguro.",
      },
      history: {
        dimension: "Historial de decisiones",
        kanban:
          "Conserva las decisiones que afectan al trabajo futuro, como los motivos para descartar una idea o lo que ya se ha entregado.",
        issues:
          "Mantiene el historial completo de comentarios, ediciones y actividad.",
      },
      closing: {
        dimension: "Finalización del trabajo",
        kanban:
          "Una tarjeta se archiva cuando se han completado todos sus puntos.",
        issues:
          "Los issues pueden cerrarse automáticamente mediante pull requests y flujos de trabajo vinculados.",
      },
      search: {
        dimension: "Búsqueda a gran escala",
        kanban:
          "`grep` es rápido en un tablero pequeño, pero pierde comodidad a medida que crece.",
        issues:
          "La búsqueda de texto completo indexada y los filtros guardados están pensados para conjuntos de datos mayores.",
      },
      contributors: {
        dimension: "Colaboradores externos",
        kanban:
          "Se puede participar mediante commits sobre el Markdown, pero no existe una interfaz ligera para abrir tareas.",
        issues:
          "En repositorios públicos, los colaboradores pueden abrir issues, comentar y reaccionar sin enviar código.",
      },
      transparency: {
        dimension: "Transparencia",
        kanban:
          "Todas las tarjetas permanecen visibles en el repositorio; solo el centro de memoria se reduce a la información esencial.",
        issues:
          "Los issues son fáciles de compartir y se adaptan al flujo público habitual de las comunidades de código abierto.",
      },
    },
  },
  wins: {
    heading: {
      eyebrow: "Compromisos",
      title: "En qué destaca cada herramienta",
    },
    lead: "Ninguna es mejor en todos los casos. AI4Kanban está optimizado para que un desarrollador y un agente hagan avanzar el trabajo con rapidez. GitHub Issues está optimizado para mantener sincronizados a muchas personas y sistemas.",
    oursHeading: "AI4Kanban",
    theirsHeading: "GitHub Issues",
    ours: {
      tokenLight: {
        title: "Acceso local eficiente",
        body: "No necesita llamadas MCP ni depende de la red. El agente busca en Markdown local en lugar de recorrer una API remota, lo que reduce el consumo de tokens y la latencia y evita interrupciones de autenticación durante una tarea.",
      },
      agentsUseIt: {
        title: "Encaja con la forma de trabajar de los agentes",
        body: "Los agentes suelen recurrir a herramientas del sistema de archivos antes que a un gestor de issues remoto. Un tablero Markdown ya está disponible en el entorno que conocen, por lo que necesita menos instrucciones y deja menos margen para interpretar incorrectamente el estado de una tarea.",
      },
      offline: {
        title: "Portátil y disponible sin conexión",
        body: "El tablero es un conjunto de archivos planos en Git. Sigue funcionando sin conexión o cuando GitHub no está disponible. No depende de un SaaS ni de una plataforma concreta: al clonar el repositorio, el tablero completo se clona con él.",
      },
      memory: {
        title: "Memoria orientada a la siguiente decisión",
        body: "AI4Kanban conserva la información que debe guiar el trabajo futuro: por qué se descartó una idea, qué se ha entregado y qué separa el estado actual del objetivo. Así, el agente puede proponer avances útiles sin repetir trabajo completado o descartado.",
      },
    },
    theirs: {
      teams: {
        title: "Diseñado para coordinar equipos",
        body: "Los identificadores asignados por el servidor, las actualizaciones simultáneas seguras y los responsables hacen que GitHub Issues sea adecuado para flujos de trabajo con varias personas. AI4Kanban no dispone de una base de datos coordinadora, por lo que dos personas pueden crear por separado la tarea #1894 y provocar un conflicto.",
      },
      transparency: {
        title: "Accesible para una comunidad más amplia",
        body: "Los issues pueden ser públicos y compartirse mediante un enlace; además, los colaboradores externos pueden abrir incidencias, comentar y reaccionar. GitHub Issues es más adecuado cuando la participación abierta importa más que la velocidad local.",
      },
      fullContext: {
        title: "Historial completo de actividad",
        body: "AI4Kanban comprime deliberadamente la información antigua y reduce una tarjeta archivada a un resumen de una línea. GitHub Issues conserva comentarios, ediciones y referencias cruzadas como parte del registro.",
      },
      integration: {
        title: "Integraciones consolidadas",
        body: "GitHub Issues se integra con reglas de cierre mediante pull requests, enlaces a commits, proyectos, etiquetas, hitos, búsqueda indexada y un amplio ecosistema de herramientas de terceros.",
      },
    },
  },
  ergonomics: {
    heading: {
      eyebrow: "La diferencia clave",
      title: "Por qué los agentes trabajan bien con archivos",
    },
    lead: "La diferencia práctica aparece cuando un agente realiza el trabajo. Pídele que **«encuentre mis tareas abiertas de prioridad alta»** y cada herramienta seguirá un camino muy distinto.",
    issues: {
      title: "tú › agente + GitHub MCP",
      chip: "varias llamadas",
      lines: [
        "encuentra mis issues abiertos de prioridad alta",
        "list_issues(state:open, labels:high)",
        "4,2 KB de JSON — 18 issues con todos sus campos",
        "paginar, filtrar, resumir…",
        "renovar la autenticación · procesar límites de uso · reintentar",
      ],
      footer:
        "varias llamadas a herramientas · kilobytes de JSON · acceso a la red en cada ocasión",
    },
    kanban: {
      title: "tú › agente + AI4Kanban",
      chip: "una llamada",
      lines: [
        "encuentra mis tareas abiertas de prioridad alta",
        'grep -rl "Priority: high" docs/kanban/todo',
        "tres rutas de archivo",
        "listo — una llamada, sin red",
      ],
      footer: "una llamada a una herramienta · unas pocas rutas · todo en local",
    },
    note: "Esas operaciones adicionales se acumulan. Preguntar qué hacer a continuación, archivar una tarea o revisar el tablero exige otra interacción remota cuando la fuente es GitHub Issues. Cuando ambas opciones están disponibles, los modelos también suelen preferir las herramientas conocidas y de baja fricción del sistema de archivos, salvo que se les indique expresamente que utilicen el gestor remoto.",
  },
  decision: {
    heading: {
      eyebrow: "Cómo elegir",
      title: "¿Qué herramienta deberías usar?",
    },
    oursHeading: "Usa AI4Kanban cuando",
    theirsHeading: "Usa GitHub Issues cuando",
    ours: [
      "Trabajas solo o con uno o dos colaboradores de confianza.",
      "Impulsas el trabajo principalmente mediante un agente en la terminal.",
      "Valoras más el avance y una memoria concisa de las decisiones que un registro completo de actividad.",
      "Quieres mantener el tablero en Git, disponible sin conexión y fácil de trasladar.",
    ],
    theirs: [
      "Desarrollas en público y la transparencia del proceso es importante.",
      "Varias personas necesitan actualizar el backlog al mismo tiempo.",
      "Tu flujo depende de integraciones con pull requests y CI, proyectos o hitos.",
      "Quieres que colaboradores externos puedan abrir issues y participar en las conversaciones.",
    ],
    verdict:
      "AI4Kanban y GitHub Issues no son sustitutos directos. GitHub Issues proporciona un **sistema de referencia compartido**; AI4Kanban ofrece un **tablero local rápido que un agente puede gestionar directamente**. Si el cuello de botella es la coordinación entre personas, utiliza GitHub Issues. Si es la eficiencia con la que tú y un agente podéis hacer avanzar el trabajo, utiliza AI4Kanban.",
    note: "Muchos desarrolladores independientes utilizan ambos: GitHub Issues como gestor público de incidencias y AI4Kanban como espacio de trabajo privado que su agente consulta cada día.",
  },
};

export default es;
