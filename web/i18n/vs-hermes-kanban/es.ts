// Español — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const es: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — un tablero de archivos ligero frente a un runtime duradero",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "Cómo se compara el tablero de archivos de ai4kanban con Hermes Agent Kanban, de Nous Research: dos tableros kanban para agentes que se solapan mucho, uno hecho de archivos planos y diffables que corren en cualquier agente (incluso Hermes), y otro que es una cola SQLite duradera y compartida de la que muchos agentes con nombre toman tareas.",
    social:
      "Dos tableros kanban para agentes que se solapan mucho. ai4kanban es un tablero ligero de archivos que corre en cualquier agente (incluso Hermes); Hermes empaqueta el mismo tablero con una cola duradera y compartida por muchos agentes con nombre.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Dos tableros kanban pensados para agentes, con mucho solape. La diferencia está en qué lugar de la pila ocupa el tablero: ai4kanban es una *capa de tablero* ligera sobre la que corres cualquier agente; Hermes Agent Kanban funde ese tablero dentro de su propio runtime.",
    ours: {
      name: "AI4Kanban",
      body: "Un tablero de Markdown plano en tu repo. El runtime, la ejecución e incluso el mantenimiento van encima: cambias de agente y el tablero sigue.",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "El tablero, el despachador y los agentes con nombre son un runtime integrado: duradero y todo incluido, pero el tablero no se separa de Hermes.",
    },
    oursDiagramAlt:
      "El kanban es un tablero Markdown en la base; el runtime del agente, la ejecución y el mantenimiento son una capa intercambiable apilada encima.",
    theirsDiagramAlt:
      "Un runtime de Hermes integrado, con el tablero SQLite, el despachador y los agentes con nombre fundidos dentro.",
    taskLayer: "capa de tareas · ejecución + mantenimiento",
    boardLayer: "kanban · archivos Markdown (git)",
    runtimeLabel: "Runtime de Hermes",
  },
  summary: {
    heading: {
      eyebrow: "La versión corta",
      title: "¿Y por qué no usar Hermes Kanban sin más?",
    },
    lead: "Buena pregunta: se solapan bastante. Los dos son tableros kanban desde los que un agente planifica y trabaja, así que piensa en ai4kanban como **una alternativa ligera a Hermes Kanban**: la misma idea de tablero, menos el runtime incluido. La diferencia está en lo que hay debajo.",
    oursHeading: "AI4Kanban — un tablero hecho de archivos",
    theirsHeading: "Hermes Kanban — un tablero dentro de un runtime",
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
    whenLabel: "Cuándo usar ai4kanban",
    when: "Elige ai4kanban cuando quieras el tablero **versionado junto a tu código**, cuando vayas a quedarte en un entorno que ya ejecutas, o cuando no quieras operar un runtime solo para tener un tablero de tareas. Tira de Hermes Kanban cuando **ya trabajes a fondo con Hermes**: su tablero se enchufa directo al despachador, los perfiles con nombre y el control desde chat que ya tienes montados. Al final los dos son colas duraderas; la de ai4kanban son archivos en git, la de Hermes son filas en SQLite.",
  },
  harness: {
    heading: {
      eyebrow: "Compatibilidad de entornos",
      title: "¿Qué agentes pueden ejecutar el tablero?",
    },
    lead: "La diferencia más clara de todas. El tablero de ai4kanban son archivos planos, así que **cualquier agente capaz de leer un repo puede ejecutarlo**, incluido el propio Hermes. El tablero de Hermes Kanban vive detrás de las herramientas `kanban_*` del runtime, así que solo puede Hermes.",
    oursSub: "cualquier agente que lea archivos",
    theirsSub: "solo Hermes",
    supported: "compatible",
    notSupported: "no compatible",
    note: "…y la fila de ai4kanban sigue y sigue: Windsurf, OpenCode, Gemini CLI, cualquier cosa que lea archivos. Hermes Kanban no deja puerta abierta a otros agentes.",
  },
  comparison: {
    heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. Hermes Kanban" },
    lead: "Un {check} es una victoria clara; un **guion** es un compromiso. ai4kanban gana en simplicidad y portabilidad, Hermes en la cola compartida y duradera y en escala; el resto queda en empate.",
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
        kanban: "Un tablero individual; grep se vuelve incómodo según crece.",
        hermes:
          "Escala a muchos agentes repartidos en muchos tableros: multiinquilino y con control desde Discord / Slack / correo / SMS.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Memoria vs. auditoría",
      title: "Qué recuerda cada tablero",
    },
    lead: "La diferencia esencial: la memoria de ai4kanban es una **entrada para planificar**, existe para que la propuesta siguiente sea más lista. El registro de Hermes es una **salida de la ejecución**, existe para poder reproducir el pasado.",
    ours: {
      heading: "AI4Kanban",
      verdict: "Recuerda conclusiones, olvida el resto.",
      body: "Cuatro archivos pequeños, **podados a propósito**: `archive.md` (qué se entregó), `rejected.md` (qué descartamos y por qué), `redesign.md` (errores de diseño a no repetir), `memory.md` (lo que aprendieron los barridos anteriores). El agente los lee todos antes de proponer o escribir una tarjeta; el historial completo es cosa de git.",
      q: "¿Por qué la idea X no está en el tablero?",
      a: "Una línea en `rejected.md`: la idea y por qué se descartó. Las ideas muertas siguen muertas.",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "Recuerda cada evento, no resume nada.",
      body: "Cada cambio de estado cae en un **registro de solo anexado**; cada intento conserva su código de salida y toda la salida del proceso. Está hecho para auditar y recuperarse de caídas, no para guiar la idea siguiente.",
      q: "¿Qué pasó con la tarea 42 esta noche?",
      a: "`claimed → crashed → reclaimed → completed`, con los registros de cada intento ahí para leer.",
    },
    note: "La memoria curada hace al agente más listo la próxima vez; el registro de auditoría hace el pasado reconstruible. Ninguno sustituye al otro.",
  },
  autonomy: {
    heading: {
      eyebrow: "Nivel de autonomía",
      title: "¿Cuánta autonomía le das al agente?",
    },
    lead: 'Hermes Kanban promete **"suelta una frase y vete"**, autonomía total. ai4kanban es **asistido por el agente**, y arranca antes que el modo plan: guardas una idea a medio formar en el tablero, `refine` la convierte en requisitos concretos y tú apruebas antes de que se escriba una línea de código.',
    stops: {
      traditional: {
        level: "Sin autonomía",
        term: "Lo lleva la persona",
        heading: "Kanban tradicional",
        detail:
          "Piensas cada tarea y la descompones tú; Trello o Jira solo lo anotan.",
      },
      kanban: {
        level: "Semiautonomía",
        term: "Asistido por el agente",
        heading: "AI4Kanban",
        detail:
          "Cada `refine` escarba en las piezas que faltan y rellena requisitos. Tú revisas antes de que se construya nada.",
      },
      hermes: {
        level: "Autonomía total",
        term: "Suéltalo y olvídate",
        heading: "Hermes Kanban",
        detail:
          "Entra una línea, sale un árbol de tareas: descompuesto y trabajado sin supervisión hasta terminar. El `/goal` de Claude Code hace la misma apuesta.",
      },
    },
    scaleLeft: "Planificas tú todo",
    scaleMiddle: "El agente planifica, tú apruebas",
    scaleRight: "Planifica todo el agente",
    worstCaseLabel: "El peor caso, por nivel",
    worstCaseTheirs:
      "**Suéltalo y olvídate:** un malentendido pequeño al principio se convierte en un árbol entero de tareas equivocadas, construidas y con los tokens ya gastados.",
    worstCaseOurs:
      "**Asistido por el agente:** una tarjeta Markdown equivocada, que pillas al revisarla, antes de que se construya nada.",
    note: "Un refine rellena los pasos que faltan, separa las ideas colaterales en tarjetas propias, marca los pendientes que ya aterrizaron y te deja a ti las decisiones de criterio en forma de preguntas. Cuando no queda ninguna, la tarjeta pasa a **ready**: la lees y la construyes.",
  },
  gui: {
    heading: { eyebrow: "Los paneles", title: "Interfaz gráfica del tablero" },
    lead: "Los dos traen tablero web, pero cumplen papeles distintos. El de ai4kanban es una **superficie de control para tu agente**: las acciones de una tarjeta lanzan ejecuciones. El de Hermes es una **ventana en vivo al despachador**: muestra qué está haciendo la flota ahora mismo.",
    ours: {
      heading: "AI4Kanban — tablero local",
      body: "Un tablero web local sobre los archivos Markdown. Las acciones de una tarjeta (*implementar, revisar, archivar*) le pasan el trabajo a un agente, y ves su registro llegando en directo, con pausas para preguntarte.",
      alt: "El tablero web local de ai4kanban: un tablero claro con columnas Blockers, UI, Skill, Docs y Distribution y un botón para crear tareas.",
    },
    theirs: {
      heading: "Hermes Kanban — vista en vivo del despachador",
      body: "Un tablero en vivo que sigue el registro de eventos: arrastrar y soltar entre columnas, un panel lateral con el historial de ejecuciones e insignias de estado de salida, y el mismo tablero manejable desde Discord, Slack o SMS.",
      alt: "El panel Kanban de Hermes Agent: un tablero oscuro con columnas Triage, Todo, Scheduled y Ready y una barra de orquestación.",
    },
  },
  wins: {
    heading: { eyebrow: "Compromisos", title: "Dónde gana cada uno" },
    lead: "Ninguno es mejor sin más. ai4kanban optimiza para un tablero ligero, hecho de archivos y sin infraestructura propia; Hermes Kanban optimiza para una cola de trabajo duradera y compartida contra la que muchos agentes corren sin supervisión. Las funciones del entorno (ejecuciones paralelas, orquestación, panel) están en ambos lados, así que no se listan aquí.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "Sin infraestructura propia",
        body: "Sin base de datos, sin gateway, sin demonio. Más allá del agente que ya ejecutas, el tablero son archivos Markdown: nada extra que instalar ni mantener vivo, y funciona en un avión.",
      },
      diffable: {
        title: "Archivos que puedes versionar y ver en diff",
        body: "El tablero vive en el repo y viaja con él, bajo el control de versiones que uses. Cada cambio de tarea o de plan es un diff revisable: sin SQLite fuera de tu proyecto, sin registro de eventos que consultar y sin atarte a una pila de agentes concreta.",
      },
      selfPruning: {
        title: "Memoria que se poda sola",
        body: "Registra por qué se descartó una idea y qué se entregó, así el agente propone hacia delante en vez de resucitar trabajo muerto. Solo guarda lo que guía la tarea siguiente, no un registro de auditoría completo.",
      },
      onePrompt: {
        title: "Se instala con un prompt",
        body: "Un archivo de skill y un script pequeño: sin perfiles que configurar ni despachador que afinar. Encuentra a cualquier agente que lea archivos donde ya está, Hermes incluido.",
      },
    },
    theirs: {
      manyAgents: {
        title: "Un tablero, muchos agentes con nombre",
        body: "Un único tablero duradero donde varios agentes con nombre, y personas, toman tareas y se pasan el trabajo. El despachador sondea las tareas listas y lanza el agente asignado a cada una. El tablero de ai4kanban lo lleva el único entorno en el que estés.",
      },
      selfHealing: {
        title: "Cola de tareas que se autorrepara",
        body: "La cola sigue cada tarea a través de las caídas: TTL de reserva, latidos, reclamación de reservas caducadas, reintentos y cortacircuitos. Un proceso puede morir a medias y el tablero recupera la tarea y la reintenta. Los archivos de ai4kanban también son duraderos, pero una ejecución muerta simplemente espera al siguiente ciclo programado.",
      },
      autoDecompose: {
        title: "Descompone tareas automáticamente",
        body: "Sueltas una tarea en bruto y el descompositor LLM del despachador la abre en un grafo de subtareas, cada una dirigida a un agente especialista, sin desglose manual. ai4kanban parte una tarjeta en pendientes y en un grafo de tareas cuidado a mano.",
      },
      fleetReach: {
        title: "Alcance y escala de flota",
        body: "Hecho para muchos agentes repartidos en muchos tableros, multiinquilino y con control desde Discord, Telegram, Slack, correo y SMS. ai4kanban es un tablero individual y austero que se queda en tu repo y tu terminal.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La decisión", title: "¿Cuál deberías usar?" },
    oursHeading: "Tira de ai4kanban cuando",
    theirsHeading: "Tira de Hermes Kanban cuando",
    ours: [
      "Quieres un tablero de archivos: cada cambio de tarea o de plan es un diff revisable.",
      "No quieres infraestructura propia: archivos planos, sin conexión, portátiles y sin ataduras.",
      "Lo quieres independiente del agente: Claude Code, Cursor, incluso el propio Hermes.",
      "Trabajas solo y valoras un tablero austero por encima de un motor incluido.",
    ],
    theirs: [
      "Ya trabajas a fondo con Hermes: perfiles, gateway y control desde chat ya montados.",
      "Quieres un único tablero duradero que compartan muchos agentes con nombre y también personas.",
      "Quieres una cola que recupere sola las tareas en vuelo tras una caída.",
      "Quieres que el despachador descomponga tareas solo y las dirija a especialistas.",
      "Ejecutas cargas de flota repartidas en muchos tableros y plataformas de chat.",
    ],
    verdict:
      "Se solapan más de lo que sugieren los nombres: los dos son tableros kanban para agentes. La división está en qué viene incluido: ai4kanban es un **tablero de archivos que deja la automatización a tu entorno**; Hermes Agent Kanban es ese mismo tablero **envuelto en una cola de trabajo duradera y compartida**. Si quieres un tablero que compartan muchos agentes y que sobreviva a las caídas, usa Hermes. Si quieres un tablero austero en tu repo que amplías solo cuando hace falta, usa ai4kanban.",
    note: "Hasta pueden convivir: ai4kanban como el sitio ligero donde planificas y podas en git, y Hermes como la cola duradera que ejecuta el trabajo pesado y compartido una vez que has decidido cuál es.",
  },
};

export default es;
