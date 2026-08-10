// Español — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const es: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — planificación en el repositorio o runtime de agentes integrado",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "Comparativa entre el tablero Markdown de AI4Kanban, integrado en el repositorio, y Hermes Agent Kanban, de Nous Research. El primero mantiene la planificación portátil y revisable; el segundo aporta una cola SQLite compartida, un despachador y un runtime multiagente.",
    social:
      "Dos sistemas kanban para agentes, dos decisiones de arquitectura: un tablero Markdown portátil que funciona con cualquier agente de programación o una cola duradera y compartida integrada en el runtime de Hermes.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Ambos productos ofrecen un kanban para agentes, pero trazan el límite de la arquitectura en lugares distintos. AI4Kanban conserva el tablero como una *capa de proyecto* portátil dentro del repositorio; Hermes Agent Kanban lo integra en el runtime de Hermes.",
    ours: {
      name: "AI4Kanban",
      body: "Un tablero Markdown que vive junto al código. Puedes cambiar el agente que trabaja con él sin migrar ni reconstruir el tablero.",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "El tablero, el despachador y los agentes con nombre funcionan como un único sistema Hermes duradero.",
    },
    oursDiagramAlt:
      "El kanban es un tablero Markdown en la base; el runtime del agente, la ejecución y el mantenimiento son una capa intercambiable apilada encima.",
    theirsDiagramAlt:
      "Un runtime de Hermes integrado, con el tablero SQLite, el despachador y los agentes con nombre fundidos dentro.",
    taskLayer: "capa de tareas · ejecución + mantenimiento",
    boardLayer: "kanban · archivos Markdown (git)",
  },
  summary: {
    heading: {
      eyebrow: "La versión corta",
      title: "La diferencia práctica",
    },
    lead: "Los dos productos resuelven gran parte del mismo problema, pero en capas distintas. AI4Kanban es **un sistema de planificación portátil para el entorno de agentes que ya utilizas**. Hermes Kanban es **una cola operativa dentro de Hermes**, diseñada para coordinar varios workers y recuperar trabajo interrumpido.",
    oursHeading: "AI4Kanban — la planificación pertenece al proyecto",
    theirsHeading: "Hermes Kanban — la ejecución pertenece al runtime",
    ours: [
      "Markdown plano en tu repo: cada cambio de tarea o de plan es un diff revisable.",
      "Sin infraestructura: nada que instalar, nada que mantener encendido.",
      "La ejecución la pone el entorno que ya usas: Claude Code, Codex, Cursor, incluso Hermes.",
    ],
    theirs: [
      "Una cola SQLite duradera en ~/.hermes/kanban.db, compartida por muchos agentes con nombre y por personas.",
      "Un despachador reparte las tareas listas entre agentes y recupera las ejecuciones caídas.",
      "Atado a la pila Hermes / Nous y a sus herramientas kanban_*.",
    ],
    whenLabel: "Cómo elegir",
    when: "Elige AI4Kanban si quieres la planificación **versionada junto al código**, prefieres conservar tu entorno de agentes actual o no necesitas un servicio de orquestación dedicado. Elige Hermes Kanban si **Hermes ya es tu entorno operativo** y quieres aprovechar su despachador, sus perfiles con nombre, sus controles desde chat y su modelo de recuperación. También difiere la persistencia: AI4Kanban se apoya en archivos y git; Hermes guarda el estado de la cola en SQLite.",
  },
  harness: {
    heading: {
      eyebrow: "Compatibilidad de entornos",
      title: "¿Qué agentes pueden ejecutar el tablero?",
    },
    lead: "Es la diferencia más clara. AI4Kanban utiliza archivos normales del repositorio, por lo que **cualquier agente capaz de leer y editar el proyecto puede usar el tablero**, incluido Hermes. Hermes Kanban se expone mediante las herramientas `kanban_*` del runtime y, por tanto, es específico de Hermes.",
    oursSub: "cualquier agente que lea archivos",
    theirsSub: "solo Hermes",
    supported: "compatible",
    notSupported: "no compatible",
    note: "AI4Kanban también funciona con Windsurf, OpenCode, Gemini CLI y otras herramientas que puedan leer los archivos del proyecto. Hermes Kanban solo está disponible a través del runtime de Hermes.",
  },
  comparison: {
    heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. Hermes Kanban" },
    lead: "Un {check} indica una ventaja clara; un **guion**, una contrapartida. AI4Kanban prioriza la portabilidad y la sencillez operativa. Hermes prioriza la ejecución coordinada y recuperable entre varios agentes.",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      whatItIs: {
        dimension: "Qué es",
        kanban:
          "Una capa kanban basada en archivos: el tablero es Markdown plano en tu repo.",
        hermes:
          "Una función kanban del runtime de agentes Hermes: un tablero SQLite duradero.",
      },
      infrastructure: {
        dimension: "Infraestructura",
        kanban:
          "Ninguna propia: el tablero son solo archivos Markdown en tu repo.",
        hermes:
          "Un gateway en marcha, una base de datos SQLite y un bucle despachador.",
      },
      whereBoardLives: {
        dimension: "Dónde vive el tablero",
        kanban:
          "En tu repo, bajo control de versiones: cada cambio de tarea o de plan es un diff revisable.",
        hermes:
          "En una base SQLite en ~/.hermes/kanban.db; los cambios van a un registro de eventos, no a diffs.",
      },
      setup: {
        dimension: "Puesta en marcha",
        kanban: "Un prompt: un archivo de skill y un script pequeño.",
        hermes:
          "Instalar el runtime de Hermes, configurar perfiles y levantar el gateway.",
      },
      parallelRuns: {
        dimension: "Ejecuciones paralelas y programadas",
        kanban:
          "Lo lleva tu entorno: Claude Code lanza subagentes en paralelo cuando arrancas algo; los trabajos programados viven en una carpeta recurring/.",
        hermes:
          "Lo lleva el runtime: el despachador coge las tareas listas por su cuenta y lanza un proceso por tarea.",
      },
      crashRecovery: {
        dimension: "Recuperación ante caídas",
        kanban:
          "No hay cola por tarea: una ejecución que muere a medias simplemente se repite en el siguiente ciclo programado.",
        hermes:
          "Una cola duradera recupera sola el trabajo en vuelo: TTL de reserva, latidos, reclamación de reservas caducadas y reintentos.",
      },
      decomposition: {
        dimension: "Descomposición de tareas",
        kanban:
          "Una tarjeta se parte en pendientes y en un grafo de tareas (grupo, bloqueos, relacionadas) con las dependencias resueltas mientras se escribe.",
        hermes:
          "El despachador ejecuta solo un descompositor LLM que abre una tarea en un grafo de subtareas dirigidas a especialistas.",
      },
      reviewMemory: {
        dimension: "Revisión y memoria",
        kanban:
          "La memoria se poda a por-qué-se-rechazó y qué-se-entregó para que el agente proponga hacia delante: curada, no un registro completo.",
        hermes:
          "Guarda un registro de eventos completo, solo de anexado, y el historial de cada intento para auditoría.",
      },
      dashboard: {
        dimension: "Panel gráfico",
        kanban:
          "Un tablero web local donde las acciones de una tarjeta (implementar, revisar, archivar) le pasan el trabajo a un agente.",
        hermes:
          "Un tablero web en vivo con arrastrar y soltar y un panel lateral, además de control desde apps de chat.",
      },
      scale: {
        dimension: "Escala y alcance",
        kanban: "Encaja mejor con una persona o un equipo pequeño que trabaja en un único repositorio.",
        hermes:
          "Escala a muchos agentes repartidos en muchos tableros: multiinquilino y con control desde Discord / Slack / correo / SMS.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Memoria vs. auditoría",
      title: "Dos tipos de historial con fines distintos",
    },
    lead: "AI4Kanban conserva **contexto de planificación** para que las propuestas futuras respeten decisiones anteriores. Hermes conserva un **registro de ejecución** para que los operadores puedan investigar y reconstruir lo sucedido. Ambos son útiles, pero para fines distintos.",
    ours: {
      heading: "AI4Kanban",
      verdict: "Conserva decisiones, no cada evento.",
      body: "Cuatro archivos pequeños, **podados a propósito**: `archive.md` (qué se entregó), `rejected.md` (qué descartamos y por qué), `redesign.md` (errores de diseño a no repetir), `memory.md` (lo que aprendieron los barridos anteriores). El agente los lee todos antes de proponer o escribir una tarjeta; el historial completo es cosa de git.",
      q: "¿Por qué la idea X no está en el tablero?",
      a: "Una línea en `rejected.md`: la idea y por qué se descartó. Las ideas muertas siguen muertas.",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "Conserva el rastro completo de la ejecución.",
      body: "Cada cambio de estado cae en un **registro de solo anexado**; cada intento conserva su código de salida y toda la salida del proceso. Está hecho para auditar y recuperarse de caídas, no para guiar la idea siguiente.",
      q: "¿Qué pasó con la tarea 42 esta noche?",
      a: "`claimed → crashed → reclaimed → completed`, con los registros de cada intento ahí para leer.",
    },
    note: "La memoria curada orienta la siguiente decisión; el registro de auditoría explica la última ejecución. Ninguno sustituye al otro.",
  },
  autonomy: {
    heading: {
      eyebrow: "Nivel de autonomía",
      title: "¿Cuánta autonomía le das al agente?",
    },
    lead: 'Hermes Kanban está pensado para una ejecución **"escribe una frase y déjalo trabajar"**. AI4Kanban utiliza **autonomía con revisión**: guardas una idea incompleta, `refine` la desarrolla hasta convertirla en requisitos concretos y la implementación espera tu aprobación.',
    stops: {
      traditional: {
        level: "Sin autonomía",
        term: "Lo lleva la persona",
        heading: "Kanban tradicional",
        detail:
          "Piensas cada tarea y la descompones tú; Trello o Jira solo lo anotan.",
      },
      kanban: {
        level: "Autonomía revisada",
        term: "El agente propone, la persona aprueba",
        heading: "AI4Kanban",
        detail:
          "Cada `refine` escarba en las piezas que faltan y rellena requisitos. Tú revisas antes de que se construya nada.",
      },
      hermes: {
        level: "Autonomía total",
        term: "Ejecución desatendida",
        heading: "Hermes Kanban",
        detail:
          "Entra una línea, sale un árbol de tareas: descompuesto y trabajado sin supervisión hasta terminar. El `/goal` de Claude Code hace la misma apuesta.",
      },
    },
    scaleLeft: "Planificas tú todo",
    scaleMiddle: "El agente planifica, tú apruebas",
    scaleRight: "Planifica todo el agente",
    worstCaseLabel: "El riesgo de cada nivel",
    worstCaseTheirs:
      "**Ejecución desatendida:** un malentendido inicial puede propagarse por todo el árbol de tareas antes de que una persona revise el resultado.",
    worstCaseOurs:
      "**Autonomía revisada:** un plan Markdown defectuoso llega a revisión, pero la implementación todavía no ha empezado.",
    note: "Una pasada de refinement completa las lagunas, separa las ideas relacionadas en sus propias tarjetas, reconoce el trabajo ya terminado y convierte las decisiones de criterio en preguntas. Cuando se resuelven, la tarjeta pasa a **ready** para la revisión final y la implementación.",
  },
  gui: {
    heading: { eyebrow: "Los paneles", title: "Dos tableros, dos funciones" },
    lead: "Ambos ofrecen una interfaz web. El tablero de AI4Kanban es una **superficie de control del trabajo del proyecto**: las acciones de una tarjeta inician ejecuciones de agentes. El de Hermes es una **vista operativa del despachador**: muestra el estado actual de la flota de agentes.",
    ours: {
      heading: "AI4Kanban — tablero local",
      body: "Un tablero web local sobre los archivos Markdown. Las acciones de una tarjeta (*implementar, revisar, archivar*) le pasan el trabajo a un agente, y ves su registro llegando en directo, con pausas para preguntarte.",
      alt: "El tablero web local de AI4Kanban: un tablero claro con columnas Blockers, UI, Skill, Docs y Distribution y un botón para crear tareas.",
    },
    theirs: {
      heading: "Hermes Kanban — vista en vivo del despachador",
      body: "Un tablero en vivo que sigue el registro de eventos: arrastrar y soltar entre columnas, un panel lateral con el historial de ejecuciones e insignias de estado de salida, y el mismo tablero manejable desde Discord, Slack o SMS.",
      alt: "El panel Kanban de Hermes Agent: un tablero oscuro con columnas Triage, Todo, Scheduled y Ready y una barra de orquestación.",
    },
  },
  wins: {
    heading: { eyebrow: "Compromisos", title: "Dónde gana cada uno" },
    lead: "La mejor opción depende del modelo operativo. AI4Kanban reduce la infraestructura al mínimo y mantiene portátil la planificación. Hermes Kanban aporta una cola compartida y duradera para coordinar ejecuciones desatendidas. Ambos admiten trabajo en paralelo, orquestación y un panel; las ventajas siguientes son las que realmente los diferencian.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "Sin servicio de tablero que operar",
        body: "Sin base de datos, sin gateway, sin demonio. Más allá del agente que ya ejecutas, el tablero son archivos Markdown: nada extra que instalar ni mantener vivo, y funciona en un avión.",
      },
      diffable: {
        title: "Planificación que viaja con el código",
        body: "El tablero vive en el repo y viaja con él, bajo el control de versiones que uses. Cada cambio de tarea o de plan es un diff revisable: sin SQLite fuera de tu proyecto, sin registro de eventos que consultar y sin atarte a una pila de agentes concreta.",
      },
      selfPruning: {
        title: "Memoria orientada a decisiones futuras",
        body: "Registra por qué se descartó una idea y qué se entregó, así el agente propone hacia delante en vez de resucitar trabajo muerto. Solo guarda lo que guía la tarea siguiente, no un registro de auditoría completo.",
      },
      onePrompt: {
        title: "Encaja en el entorno de agentes que ya usas",
        body: "Un archivo de skill y un script pequeño: sin perfiles que configurar ni despachador que afinar. Encuentra a cualquier agente que lea archivos donde ya está, Hermes incluido.",
      },
    },
    theirs: {
      manyAgents: {
        title: "Una cola compartida por agentes con nombre",
        body: "Un único tablero duradero donde varios agentes con nombre, y personas, toman tareas y se pasan el trabajo. El despachador sondea las tareas listas y lanza el agente asignado a cada una. El tablero de AI4Kanban lo lleva el único entorno en el que estés.",
      },
      selfHealing: {
        title: "Recuperación automática del trabajo en curso",
        body: "La cola sigue cada tarea a través de las caídas: TTL de reserva, latidos, reclamación de reservas caducadas, reintentos y cortacircuitos. Un proceso puede morir a medias y el tablero recupera la tarea y la reintenta. Los archivos de AI4Kanban también son duraderos, pero una ejecución muerta simplemente espera al siguiente ciclo programado.",
      },
      autoDecompose: {
        title: "Descomposición y asignación automáticas",
        body: "Sueltas una tarea en bruto y el descompositor LLM del despachador la abre en un grafo de subtareas, cada una dirigida a un agente especialista, sin desglose manual. AI4Kanban parte una tarjeta en pendientes y en un grafo de tareas cuidado a mano.",
      },
      fleetReach: {
        title: "Operaciones multiagente a escala",
        body: "Hecho para muchos agentes repartidos en muchos tableros, multiinquilino y con control desde Discord, Telegram, Slack, correo y SMS. AI4Kanban es un tablero individual y austero que se queda en tu repo y tu terminal.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La decisión", title: "¿Cuál deberías usar?" },
    oursHeading: "Elige AI4Kanban si",
    theirsHeading: "Elige Hermes Kanban si",
    ours: [
      "Quieres versionar y revisar las tareas y los planes junto al código.",
      "Prefieres un tablero portátil, disponible sin conexión y sin servicios que operar.",
      "Quieres elegir entre Claude Code, Codex, Cursor, Hermes u otro entorno de agentes.",
      "Trabajas solo o en un equipo pequeño y valoras una capa de planificación específica.",
    ],
    theirs: [
      "Hermes ya es tu runtime principal y tienes configurados los perfiles, el gateway y el control desde chat.",
      "Necesitas una cola duradera compartida por varios agentes con nombre y personas.",
      "Necesitas recuperar automáticamente el trabajo interrumpido.",
      "Quieres que el despachador descomponga las tareas y las asigne a agentes especialistas.",
      "Operas muchos agentes en varios tableros y canales de comunicación.",
    ],
    verdict:
      "Elige AI4Kanban si necesitas una **capa de planificación integrada en el repositorio e independiente del runtime de agentes**. Elige Hermes Agent Kanban si necesitas una **cola compartida y duradera con despacho, recuperación y coordinación multiagente integrados**. La decisión no depende de qué tablero tenga más funciones, sino de si la planificación debe pertenecer al proyecto o al runtime.",
    note: "También pueden complementarse: utiliza AI4Kanban para definir y revisar el trabajo en git, y después ejecuta el trabajo compartido y aprobado mediante la cola duradera de Hermes.",
  },
};

export default es;
