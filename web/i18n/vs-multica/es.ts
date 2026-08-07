import type { VsMulticaCopy } from "./types";

const es: VsMulticaCopy = {
  meta: {
    title:
      "AI4Kanban vs. Multica: decidir el trabajo u operar la flota de agentes",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "Compara AI4Kanban y Multica en descubrimiento y definición de tareas, memoria de decisiones, ejecución por agentes, equipos, infraestructura y licencia.",
    social:
      "Ambos colocan agentes de programación en un kanban. AI4Kanban decide qué trabajo debe existir; Multica decide qué agente lo ejecuta.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nMultica",
    lead: "Ambos productos colocan agentes de programación en un kanban. La diferencia real es **cuándo entra el agente en escena**: AI4Kanban trabaja antes para decidir y definir la tarea; Multica recibe una incidencia ya creada y gestiona su ejecución.",
    ours: {
      name: "AI4Kanban",
      body: "Un ciclo de planificación dentro del repositorio. El agente propone trabajo, desarrolla ideas imprecisas, ordena el tablero y recuerda decisiones anteriores.",
    },
    theirs: {
      name: "Multica",
      body: "Un sistema de operaciones de proyecto para equipos humanos y de agentes. Asigna una incidencia y después encola, despacha, observa, reintenta y revisa la ejecución.",
    },
    oursDiagramAlt:
      "AI4Kanban lee el proyecto y convierte una idea incipiente en una tarjeta lista.",
    theirsDiagramAlt:
      "Multica recibe una incidencia lista y la despacha a un entorno de agente.",
    oursDiagramTop: "leer proyecto · encontrar trabajo",
    oursDiagramBottom: "idea vaga → tarjeta lista",
    theirsDiagramTop: "incidencia lista + responsable",
    theirsDiagramBottom: "despachar · ejecutar · revisar",
  },
  boundary: {
    heading: {
      eyebrow: "La línea divisoria",
      title: "El mismo tablero. Dos lados de «listo».",
    },
    lead: "El kanban es solo la superficie. AI4Kanban se concentra en las decisiones **antes de que una tarea esté lista**. Multica se concentra en la maquinaria **después de que la tarea esté lista**. Pueden encontrarse en el relevo sin ser el mismo sistema.",
    stages: {
      discover: "Descubrir",
      refine: "Definir",
      prioritize: "Priorizar",
      assign: "Asignar",
      run: "Ejecutar",
      review: "Revisar",
    },
    oursLabel: "AI4Kanban · decidir el trabajo",
    theirsLabel: "Multica · operar el trabajo",
    handoffLabel: "listo",
    principle:
      "**Multica decide qué agente ejecuta una tarea. AI4Kanban decide qué tareas deben existir.** Es la respuesta breve más útil a «¿no son la misma idea?».",
  },
  backlog: {
    heading: {
      eyebrow: "La prueba del backlog",
      title: "¿Qué ocurre antes de Todo?",
    },
    lead: "El propio modelo de tareas de Multica concreta la frontera: una incidencia en **Backlog no activa a ningún agente**. Es un aparcamiento hasta que una persona decide que el trabajo es real y lo hace avanzar. En AI4Kanban, el tablero que aún no está listo es precisamente donde el agente planifica.",
    ours: {
      label: "Backlog activo",
      title: "El agente desarrolla la tarjeta",
      body: "El agente lee el código y la memoria del módulo antes de considerar que la petición es trabajo real.",
      steps: [
        "Proponer o capturar una idea incompleta",
        "Resolver contexto y exponer las decisiones reales",
        "Ordenar una tarjeta construible por valor y dependencias",
      ],
      state: "agente despierto",
    },
    theirs: {
      label: "Backlog aparcado",
      title: "El agente espera a Todo",
      body: "La persona aporta la descripción y los criterios de aceptación; la asignación solo inicia la ejecución cuando el trabajo ha sido admitido.",
      steps: [
        "Una persona redacta o acepta la incidencia",
        "Una persona mueve Backlog → Todo",
        "El daemon encola y despacha al responsable",
      ],
      state: "agente dormido",
    },
    note: "Multica sí incluye quick-create, pero es un transcriptor de una sola pasada: convierte texto libre en una incidencia y termina. No inspecciona el código, no hace preguntas ni registra supuestos.",
  },
  comparison: {
    heading: {
      eyebrow: "Cara a cara",
      title: "Los productos entregados, no los eslóganes",
    },
    lead: "Un {check} marca el encaje más claro en esa dimensión; un **guion** indica una decisión arquitectónica. La comparación reconoce la plataforma operativa que Multica ya ha entregado y la separa de su visión futura.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Dónde empieza el producto",
        kanban:
          "Antes de la tarea: inspecciona el proyecto, propone trabajo y decide qué debe entrar en el tablero.",
        multica:
          "Después de que exista la tarea: recibe una incidencia, responsable, prioridad e instrucciones de ejecución.",
      },
      backlog: {
        dimension: "Comportamiento del Backlog",
        kanban:
          "El agente desarrolla activamente tarjetas inmaduras y puede proponer trabajo que nadie ha pedido.",
        multica:
          "Un aparcamiento. Una incidencia en Backlog no despierta al agente asignado.",
      },
      refinement: {
        dimension: "De idea vaga a plan concreto",
        kanban:
          "Un ciclo repetido de definición lee código y memoria, explicita los supuestos y solo pregunta por decisiones de producto pendientes.",
        multica:
          "Las descripciones son texto libre; se pide a la persona que aporte archivos, restricciones, resultados y criterios de aceptación.",
      },
      memory: {
        dimension: "Qué conocimiento se acumula",
        kanban:
          "Decisiones del proyecto, lecciones de rediseño, entregas y motivos de rechazo condicionan la siguiente propuesta.",
        multica:
          "Las Skills reutilizables conservan métodos de trabajo; la actividad y el historial conservan la trazabilidad de ejecución.",
      },
      execution: {
        dimension: "Operación de ejecuciones",
        kanban:
          "Entrega la implementación al entorno de programación elegido; no incluye reintentos, repetición, costes de tokens ni gestión de flotas.",
        multica:
          "Encola, despacha, transmite, mide, reintenta, repite, aplica controles de revisión y enlaza PR y CI.",
      },
      teams: {
        dimension: "Equipos humanos y de agentes",
        kanban:
          "Local primero y pensado para una persona o un equipo pequeño que colabora mediante git.",
        multica:
          "Espacios multiusuario, roles, squads, bandejas de entrada, comentarios, permisos y notificaciones.",
      },
      storage: {
        dimension: "Almacenamiento e infraestructura",
        kanban:
          "Markdown en el repositorio; sin base de datos, cuenta, servidor del tablero ni dependencia de MCP.",
        multica:
          "PostgreSQL + pgvector, servidor Go, daemon local, OAuth y despliegue alojado o autogestionado.",
      },
      license: {
        dimension: "Licencia",
        kanban:
          "Apache License 2.0, incluido el uso comercial, el alojamiento y la integración.",
        multica:
          "Multica License con código visible y restricciones para servicios alojados e integración comercial.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Dos tipos de memoria",
      title: "Cómo hacerlo frente a por qué se decidió",
    },
    lead: "Ambos sistemas acumulan conocimiento, pero en ejes distintos. Las Multica Skills enseñan **cómo realizar un tipo de trabajo**. La memoria por módulo de AI4Kanban registra **qué ha decidido y descartado este proyecto**.",
    ours: {
      eyebrow: "Criterio del proyecto",
      title: "AI4Kanban recuerda el veto",
      body: "El agente lee archivos compactos del repositorio antes de proponer o definir trabajo. No se busca guardar una transcripción completa, sino evitar que la siguiente decisión repita un error anterior.",
      examples: ["rejected.md", "redesign.md", "memory.md"],
      question: "¿Por qué el tablero dejó de proponer la idea X?",
      answer:
        "`rejected.md` guarda la idea y su justificación, así que no vuelve salvo que aparezcan pruebas nuevas.",
    },
    theirs: {
      eyebrow: "Método de trabajo",
      title: "Multica recuerda el procedimiento",
      body: "Las Skills son paquetes `SKILL.md` redactados a mano o importados y compartidos entre agentes. Los comentarios y el historial explican una ejecución, pero el trabajo terminado no se transforma automáticamente en memoria de decisiones.",
      examples: ["SKILL.md", "comentarios", "historial de ejecución"],
      question: "¿Cómo debe realizar este agente una revisión de seguridad?",
      answer:
        "Adjunta una Skill reutilizable con el procedimiento, los archivos y las instrucciones para ese tipo de trabajo.",
    },
    note: "La diferencia es procedimiento frente a criterio. Un procedimiento mejora la ejecución; un registro de rechazos evita que vuelva a proponerse el trabajo equivocado.",
  },
  horizon: {
    heading: {
      eyebrow: "Visión frente a producto",
      title: "El solapamiento se está acercando",
    },
    lead: "El `VISION.md` de Multica avanza hacia fases anteriores. Describe agentes que estructuran la intención, reúnen contexto, hacen explícita la incertidumbre y conectan decisiones con resultados. Esa tesis se acerca mucho más a la actual de AI4Kanban que el producto que Multica ofrece hoy.",
    shippedLabel: "Entregado hoy",
    visionLabel: "Dirección declarada",
    shippedTitle: "Ejecutar una incidencia",
    shippedBody:
      "Backlog espera. El daemon indica al responsable que lea la incidencia y la complete. La definición ocurre después de escribir código, mediante revisión y correcciones.",
    visionTitle: "Desarrollar la intención",
    visionBody:
      "Los futuros agentes deben convertir intención en trabajo estructurado y separar hechos conocidos de decisiones pendientes.",
    marker: "vigilar esta brecha",
    note: "Es una amenaza competitiva real, pero no justifica atribuir funciones aún no entregadas. La comparación honesta enfrenta producto entregado con producto entregado y señala con claridad la dirección declarada.",
  },
  wins: {
    heading: {
      eyebrow: "Decisiones",
      title: "Dónde va claramente por delante cada uno",
    },
    lead: "No es una competición por número de funciones. AI4Kanban es deliberadamente menor y actúa antes en el ciclo. Multica es mucho más amplio cuando el trabajo entra en ejecución.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "El agente ayuda a decidir el trabajo",
        body: "Propone desde el contexto del proyecto, convierte peticiones imprecisas en tarjetas construibles y las ordena por valor y dependencias antes de ejecutar.",
      },
      rejectionMemory: {
        title: "Las ideas rechazadas siguen rechazadas",
        body: "La memoria de decisiones y rediseños condiciona la planificación posterior, para que el agente no insista en una dirección ya descartada.",
      },
      repoNative: {
        title: "Toda la planificación cabe en git",
        body: "Tarjetas y memoria son archivos legibles y comparables junto al código, sin servicio de tablero y con condiciones Apache-2.0 puras.",
      },
    },
    theirs: {
      operations: {
        title: "Un auténtico plano de control de ejecución",
        body: "Repetición, reintentos, controles de revisión, enlaces con PR y CI, medición de tokens, webhooks, adjuntos y varias vistas operativas ya están entregados.",
      },
      teams: {
        title: "Diseñado para trabajo multiusuario",
        body: "Espacios, roles, squads, conversaciones por hilos, notificaciones, permisos e identidades persistentes sostienen una organización real de personas y agentes.",
      },
      runtimeReach: {
        title: "Compatibilidad mucho más amplia",
        body: "Multica admite alrededor de veinte CLI de agentes conectadas mediante daemons locales y entornos cloud. AI4Kanban integra hoy Claude Code y Codex.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La decisión", title: "¿Cuál deberías usar?" },
    oursHeading: "Elige AI4Kanban cuando",
    theirsHeading: "Elige Multica cuando",
    ours: [
      "El cuello de botella es decidir y definir el trabajo correcto, no despacharlo.",
      "Quieres que un agente proponga tareas desde el código y la memoria del proyecto.",
      "Quieres que rechazos y decisiones de diseño condicionen la planificación futura.",
      "Prefieres un sistema pequeño y nativo del repositorio, sin infraestructura de tablero.",
      "Las condiciones Apache-2.0 puras son importantes para lo que estás construyendo.",
    ],
    theirs: [
      "Las tareas ya existen y el cuello de botella es ejecutarlas con fiabilidad.",
      "Varias personas y agentes con nombre necesitan un espacio operativo compartido.",
      "Necesitas reintentos, repetición, costes, enlaces con PR y CI o controles de revisión.",
      "Quieres muchos entornos de agentes, squads, chat, webhooks y acceso móvil.",
      "Te encaja operar o comprar una plataforma respaldada por servidores.",
    ],
    verdict:
      "Elige AI4Kanban para **decidir y desarrollar el trabajo antes de que esté listo**. Elige Multica para **asignar y operar el trabajo después de que esté listo**. Si necesitas ambos, el relevo es sencillo: AI4Kanban produce la tarjeta aprobada y después se crea la incidencia de Multica para ejecutarla.",
    note: "Pueden complementarse, pero no mantengas dos fuentes de verdad activas para el mismo estado de tarea. Define un punto de relevo claro.",
  },
};

export default es;
