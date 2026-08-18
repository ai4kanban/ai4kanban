// Español — the Task Master comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const es: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Task Master — escribir la especificación o que te la pregunten",
    socialTitle: "AI4Kanban vs. Task Master",
    description:
      "Compara AI4Kanban y Task Master (Taskmaster). Task Master divide el PRD que ya escribiste en un backlog ordenado. AI4Kanban parte de una idea vaga y pregunta hasta que la tarjeta se puede construir.",
    social:
      "Task Master necesita un PRD para poder ayudarte. AI4Kanban parte de una sola frase y te pregunta el resto. Descubre qué punto de partida encaja con tu forma de trabajar.",
  },
  hero: {
    badge: "Comparación",
    title: "AI4Kanban vs.\nTask Master",
    lead: "Ambos le dan al agente de código una lista de tareas en lugar de una ventana de chat. Task Master toma el documento de requisitos que escribiste y lo divide en un backlog ordenado. AI4Kanban empieza un paso antes: le das una frase imprecisa y pregunta hasta que hay algo que merece construirse.",
    ours: {
      name: "AI4Kanban",
      body: "Un tablero Markdown en tu repositorio. El agente propone trabajo, pregunta lo que no puede resolver y archiva lo entregado.",
    },
    theirs: {
      name: "Task Master",
      body: "Un motor de tareas para cualquier editor con IA. Analiza un PRD, lo expande en subtareas y va vaciando el backlog.",
    },
    oursDiagramAlt:
      "Una frase imprecisa entra en AI4Kanban, que devuelve las preguntas que no puede responder solo y entrega una tarjeta terminada.",
    theirsDiagramAlt:
      "Un documento de requisitos terminado entra en Task Master y vuelve dividido en tareas numeradas en orden de dependencia.",
    oursDiagramTop: "entra una frase imprecisa",
    oursDiagramBottom: "pregunta y luego escribe la tarjeta",
    theirsDiagramTop: "entra el documento que escribiste",
    theirsDiagramBottom: "tareas numeradas, en orden de dependencia",
  },
  summary: {
    heading: {
      eyebrow: "En resumen",
      title: "La diferencia está en lo que tienes que aportar.",
    },
    lead: "Task Master —escrito `Taskmaster` en su propia documentación— es el gestor de tareas más conocido para agentes de código, y cumple bien su función. Lee un documento de requisitos, lo divide en tareas con dependencias, puntúa la complejidad de cada una, expande las más pesadas en subtareas y te entrega la siguiente tarea sin bloqueos. Si ya escribes especificaciones, eso es casi todo lo que necesitas.",
    panel:
      "AI4Kanban da por hecho que todavía no tienes la especificación. Le das una frase. Lee el código y la memoria del proyecto, resuelve lo que puede por su cuenta, te pregunta solo lo que queda realmente abierto y repite hasta que la tarjeta es lo bastante concreta para construirla. **Las preguntas son el producto.** El tablero es donde quedan las respuestas.",
    note: "Comprobado el 10 de agosto de 2026: la última versión de Task Master es la 0.43.1 (31 de marzo de 2026) y el commit más reciente en `main` es del 23 de abril de 2026, mientras el mismo equipo desarrolla Hamster, un espacio de planificación alojado. El paquete se sigue instalando unas 78 000 veces al mes: es una herramienta muy usada con un repositorio tranquilo, no un proyecto abandonado.",
  },
  start: {
    heading: {
      eyebrow: "Día uno",
      title: "Qué tienes que aportar antes de que cualquiera de los dos sirva",
    },
    lead: "El objetivo es el mismo: una tarea que un agente de código pueda terminar sin adivinar. Cada herramienta pide algo distinto al empezar, y ahí está casi toda la comparación.",
    ours: {
      label: "AI4Kanban",
      title: "Basta con una frase",
      steps: [
        "Di la idea a grandes rasgos. Sin formato, sin documento, sin plantilla.",
        "El agente lee el código y las decisiones anteriores del proyecto, resuelve lo que puede y te pregunta solo lo que sigue abierto.",
        "Escribe la tarjeta, la coloca frente al resto del tablero por valor y dependencia, y guarda tus respuestas para la próxima vez.",
      ],
    },
    theirs: {
      label: "Task Master",
      title: "Primero, un documento escrito",
      steps: [
        "Escribe el documento de requisitos. Su guía sugiere redactarlo junto a un modelo de chat y guardarlo como `.taskmaster/docs/prd.txt`.",
        "`parse-prd` lo divide en tareas con dependencias, `expand` las desglosa en subtareas y `analyze-complexity` puntúa cuáles hay que desglosar más.",
        "`next` te entrega la tarea de mayor prioridad que nada esté bloqueando.",
      ],
    },
    note: "Ninguno de los dos caminos es difícil. Pero cuando el documento es vago, Task Master divide un documento vago: siempre puedes ejecutar `update-task` con más contexto, y el modelo de investigación puede ir a documentarse, pero nada en el bucle te pregunta qué querías decir en realidad.",
  },
  comparison: {
    heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. Task Master" },
    lead: "Un {check} marca la opción más clara para esa necesidad; un **guion** significa que depende de cómo trabajes. Task Master es más fuerte en **alcance, ejecución por lotes e investigación en vivo**. AI4Kanban es más fuerte en **llegar de una idea vaga a una especificación real y conservar lo decidido**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Task Master",
    rows: {
      startingPoint: {
        dimension: "De dónde sale una tarea",
        kanban:
          "Una frase imprecisa tuya, o una propuesta que el agente hace por su cuenta tras leer el código y el tablero.",
        taskMaster:
          "Un documento de requisitos que escribes primero y se analiza en tareas. También puedes añadir tareas de una en una desde un prompt.",
      },
      vagueRequest: {
        dimension: "Cuando la petición es vaga",
        kanban:
          "Un bucle de refinamiento responde lo que la memoria y el código permiten, te pregunta el resto y no da la tarjeta por lista mientras quede una pregunta abierta.",
        taskMaster:
          "Las tareas salen tan concretas como entró el documento. Puedes actualizar una tarea, expandirla o enviar al modelo de investigación a consultar algo.",
      },
      board: {
        dimension: "Qué es el tablero en disco",
        kanban:
          "Un archivo Markdown por tarjeta bajo `docs/kanban/`, más archivos de memoria en texto plano. Un diff se lee como una frase.",
        taskMaster:
          "Un único `.taskmaster/tasks/tasks.json` con todas las tareas y subtareas; `generate` también puede escribir un archivo de texto por tarea.",
      },
      setup: {
        dimension: "Qué hay que configurar",
        kanban:
          "Un prompt. Sin servidor MCP, sin claves de API, sin configurar modelos: piensa el propio modelo de tu agente de código.",
        taskMaster:
          "Un servidor MCP o la CLI, más los modelos principal, de investigación y de reserva. Los proveedores Claude Code y Codex no piden clave extra; la mayoría de los demás sí.",
      },
      execution: {
        dimension: "Ejecutar el trabajo",
        kanban:
          "Tu agente implementa la tarjeta y la archiva. No hay ejecutor por lotes ni un flujo de pruebas obligatorio.",
        taskMaster:
          "`loop` lanza sesiones nuevas de Claude Code una tras otra, con presets para pruebas, linting y duplicación; `autopilot` conduce un ciclo TDD rojo-verde-commit en su propia rama.",
      },
      memory: {
        dimension: "Qué se conserva",
        kanban:
          "Memoria por módulo: decisiones, ideas rechazadas, correcciones de diseño y trabajo entregado, leídos antes de la siguiente propuesta, así que un no sigue siendo un no.",
        taskMaster:
          "Notas con marca de tiempo añadidas a las subtareas, archivos de investigación guardados y etiquetas que mantienen separadas varias listas de tareas.",
      },
      reach: {
        dimension: "Dónde funciona",
        kanban:
          "Claude Code, Codex, Cursor y OpenCode hoy. El tablero son archivos planos, así que otro entorno no necesita un formato nuevo, solo integración.",
        taskMaster:
          "Cursor, Windsurf, VS Code, Claude Code, Codex, Kiro, Amazon Q y más, por MCP o CLI, con más de quince proveedores de modelos.",
      },
      teams: {
        dimension: "Más de una persona",
        kanban:
          "La colaboración es git: rama, revisión del plan en un pull request, merge. Nada se sincroniza en tiempo real.",
        taskMaster:
          "El tablero de código abierto también es local, pero el mismo equipo vende Hamster, un espacio alojado con briefs compartidos y sincronización, desde 40 dólares por creador al mes.",
      },
      license: {
        dimension: "Licencia",
        kanban:
          "Apache-2.0. Úsalo, bifúrcalo, vende algo construido con él: sin condiciones adicionales.",
        taskMaster:
          "MIT con la Commons Clause: gratis para uso personal, comercial y académico, pero no puedes vender Task Master en sí ni ofrecerlo como servicio alojado.",
      },
    },
  },
  boardShape: {
    heading: {
      eyebrow: "En disco",
      title: "Un archivo JSON, o un archivo por tarjeta",
    },
    lead: "Los dos tableros viven en tu repositorio, así que ambos se versionan con el código. Lo que cambia es lo que un diff le enseña a una persona.",
    oursLabel: "AI4Kanban",
    theirsLabel: "Task Master",
    oursCaption:
      "Una tarjeta, un archivo Markdown. Un pull request muestra el plan cambiando en palabras que puedes leer y discutir.",
    theirsCaption:
      "Un archivo contiene todo el backlog. El diff muestra JSON: exacto, y no escrito para leerse.",
    note: "Task Master añadió bloqueo de archivos entre procesos en la 0.42.0 para que dos procesos escribiendo a la vez no pierdan datos. Los archivos separados no comparten esa contención: dos ejecuciones solo chocan si editan la misma tarjeta.",
  },
  wins: {
    heading: { eyebrow: "Contrapartidas", title: "Dónde gana cada uno" },
    lead: "Task Master llega más lejos, aguanta más tiempo sin ti y sabe ir a informarse. AI4Kanban es más estrecho a propósito: se gana su sitio en la parte del trabajo que ocurre antes de que exista una tarea.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Task Master",
    ours: {
      asksFirst: {
        title: "Pregunta antes de construir",
        body: "El agente convierte una frase imprecisa en preguntas, responde lo que puede con el código y las decisiones pasadas, y te deja solo lo que nadie más puede resolver.",
      },
      diffablePlan: {
        title: "El plan es prosa legible",
        body: "Cada tarjeta es un archivo Markdown. Revisas un plan igual que revisas código: en un diff, con palabras, antes de que se escriba nada.",
      },
      moduleMemory: {
        title: "Recuerda lo que rechazaste",
        body: "Decisiones, ideas descartadas y correcciones de diseño se guardan por módulo y se leen antes de la siguiente propuesta, así el tablero deja de sugerir lo mismo dos veces.",
      },
      nothingToWire: {
        title: "Nada que montar",
        body: "Sin servidor MCP, sin claves de API, sin roles de modelo que configurar, sin esquemas de herramientas en cada conversación. Un prompt lo instala en un repositorio.",
      },
    },
    theirs: {
      everywhere: {
        title: "Funciona casi en todas partes",
        body: "Cursor, Windsurf, VS Code, Claude Code, Codex, Kiro y más, por MCP o CLI, contra más de quince proveedores de modelos, incluidos los locales.",
      },
      research: {
        title: "Trae investigación incorporada",
        body: "Un rol de investigación dedicado puede aportar información actual mientras se escriben o expanden las tareas, y guarda lo encontrado junto a ellas.",
      },
      batchRuns: {
        title: "Puede trabajar mientras duermes",
        body: "`loop` lanza una sesión nueva por tarea con presets para pruebas, linting, duplicación y malos olores de código; `autopilot` ejecuta un ciclo TDD estricto en su propia rama.",
      },
      proven: {
        title: "Es el que la gente ya conoce",
        body: "Unas 28 000 estrellas en GitHub y unas 78 000 instalaciones de npm al mes, con documentación, un Discord y años de flujos de trabajo compartidos que copiar.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La decisión", title: "¿Cuál encaja con tu forma de trabajar?" },
    oursHeading: "Elige AI4Kanban cuando",
    theirsHeading: "Elige Task Master cuando",
    ours: [
      "Tus ideas empiezan como una frase y escribir la especificación es lo que te frena.",
      "Quieres revisar el plan y su razonamiento en un diff, junto al código.",
      "Quieres que el tablero recuerde decisiones y rechazos y deje de preguntar lo mismo.",
      "Prefieres no levantar otro servidor MCP, guardar más claves de API ni configurar modelos.",
    ],
    theirs: [
      "Ya escribes documentos de requisitos y quieres dividirlos y ordenarlos bien.",
      "Trabajas en Cursor, Windsurf, VS Code o Kiro y quieres el tablero en el editor.",
      "Quieres ejecuciones autónomas por lotes o un flujo estricto de pruebas primero, sin montar nada.",
      "Quieres investigación en vivo dentro de la planificación, o un proveedor de modelos que nosotros no cubrimos.",
    ],
    verdict:
      "Task Master empieza donde termina tu especificación. AI4Kanban empieza antes: su trabajo es justo el tramo entre una idea vaga y una tarea que merezca entregarse a un agente. Si escribes buenos documentos, Task Master hará más cosas hoy. Si esos documentos son lo que nunca llega a escribirse, ese hueco es lo primero que hay que resolver.",
    note: "No son excluyentes: un PRD escrito a partir de una tarjeta refinada de AI4Kanban se analiza perfectamente. Pero un solo tablero debe ser el dueño del estado de las tareas, o acabarás manteniendo dos.",
  },
};

export default es;
