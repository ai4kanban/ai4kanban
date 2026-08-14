// Español — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const es: HomeCopy = {
  meta: {
    title:
      "AI4Kanban — El tablero de proyecto que planifica por sí solo y aprende de cada decisión",
    description:
      "Un tablero de proyecto dirigido por un agente que convierte los objetivos en ejecución continua: define tareas, aclara requisitos, fija prioridades y conserva cada decisión de producto en la memoria del proyecto.",
  },

  hero: {
    title: "Un tablero de proyecto que se planifica solo.",
    lead: "Reúne tus objetivos, tu código y la memoria del proyecto para gestionar el trabajo desde la planificación hasta la entrega. Tú tomas las decisiones de producto y das el visto bueno final.",
    ctaDownload: "Descargar la aplicación",
    ctaGithub: "Ver en GitHub ↗",
    shots: {
      board: {
        label: "Board",
        alt: "Tablero local de AI4Kanban: vista Board",
      },
      queue: {
        label: "Queue",
        alt: "Tablero local de AI4Kanban: vista Queue",
      },
      frontAria: "Vista {view} (actual)",
      flipAria: "Cambiar a la vista {view}",
    },
  },

  compare: {
    title: "Del seguimiento de tareas a la planificación autónoma",
    lead: "Los tableros tradicionales se limitan a registrar y seguir tareas, y toda la información debe introducirse a mano. AI4Kanban se apoya en tus objetivos a largo plazo y en las decisiones guardadas en la memoria del proyecto para planificar el trabajo y hacerlo avanzar por su cuenta.",
    columns: { classic: "Tablero tradicional", kanban: "AI4Kanban" },
    rows: [
      {
        dimension: "Entrada",
        classic: "Tareas detalladas escritas a mano",
        kanban: "Objetivos a largo plazo e ideas por definir",
      },
      {
        dimension: "Función principal",
        classic: "Registrar y seguir tareas",
        kanban: "Planificar e impulsar el trabajo de forma autónoma",
      },
      {
        dimension: "Tu papel",
        classic: "Mantener el tablero a mano",
        kanban: "Tomar decisiones y aprobar el resultado",
      },
    ],
  },

  loop: {
    title: "El trabajo sigue avanzando",
    lead: "Dale un objetivo o una idea por definir. El agente lee tu código y la memoria del proyecto, determina qué viene después, aclara los requisitos, descompone el trabajo, ordena dependencias y prioridades, y pasa a la ejecución.",
    steps: [
      {
        title: "Definir la siguiente tarea",
        body: "Usar el objetivo, el código y la memoria del módulo para decidir qué toca hacer a continuación.",
      },
      {
        title: "Aclarar los requisitos",
        body: "El agente resuelve todo lo que puede a partir del código y la memoria del proyecto, y solo te plantea las decisiones de producto que requieren tu criterio.",
      },
      {
        title: "Ejecutar",
        body: "Cuando los requisitos están lo bastante claros para empezar, el agente sigue el alcance y los pasos definidos en la tarea.",
      },
      {
        title: "Registrar las decisiones",
        body: "Guardar las decisiones de producto en la memoria del proyecto para que el siguiente ciclo de planificación y desarrollo pueda aprovecharlas.",
      },
    ],
  },

  memory: {
    title: "Aprende a medida que construyes",
    lead: "Las conversaciones terminan. Las decisiones de producto permanecen. AI4Kanban guarda los objetivos del proyecto y mantiene, módulo por módulo, un registro de las funciones entregadas, las decisiones de producto, los motivos por los que se descartaron ideas y las lecciones de diseño. Recupera ese contexto al planificar y aclarar trabajo nuevo.",
    cards: [
      {
        title: "No hace falta repetir lo mismo",
        body: "Las preferencias y restricciones ya establecidas pasan directamente a la planificación de la siguiente tarea.",
      },
      {
        title: "No vuelve a los mismos callejones sin salida",
        body: "Las direcciones descartadas y los problemas de diseño ya conocidos no se vuelven a proponer.",
      },
      {
        title: "Retoma el trabajo donde lo dejaste",
        body: "Antes de planificar algo nuevo, lee qué se ha entregado y comprueba el código actual.",
      },
    ],
    tree: {
      goal: "Objetivo del proyecto",
      module: "Uno por módulo",
      readme: "Funciones entregadas",
      decisions: "Decisiones de producto",
      rejected: "Motivos del descarte",
      redesign: "Lecciones de diseño",
    },
  },

  iterate: {
    title: "Impulsa la iteración continua del producto",
    lead: "Convierte señales externas en requisitos que mantienen en marcha el producto y cada nueva versión.",
    inputsLabel: "Entradas externas",
    inputs: [
      "Comentarios de usuarios",
      "Análisis de la competencia",
      "Informes del sector",
      "Conversaciones en Reddit",
    ],
    context: [
      "Historial de decisiones",
      "Requisitos y tareas",
      "Módulos del proyecto",
      "Historial de ejecuciones",
    ],
    otherAgents: "Otros agentes",
    storage: "Datos del proyecto",
    outputsLabel: "Resultados de la iteración",
    outputs: ["Mejoras de producto", "Nuevas versiones"],
  },

  start: {
    title: "Empieza con la aplicación del tablero",
    lead: "Descárgala, ábrela y apúntala a un proyecto. No hace falta instalar nada antes: ni Node, ni npx, ni terminal. Te pregunta las tres cosas que solo tú puedes responder, una por pantalla, y después lee tu base de código, establece el objetivo del proyecto y la memoria de cada módulo, y crea el primer conjunto de tareas.",
    notes: [
      "Planificación autónoma",
      "Local primero",
      "Independiente del agente",
    ],
    cta: "Descargar la aplicación",
    shotAlt:
      "La configuración guiada de la aplicación, preguntando qué es el proyecto y en qué vías se divide su trabajo",
    firstOpen:
      "Todavía no hay compilación firmada, así que macOS bloquea la primera apertura: arrastra la aplicación desde el `.dmg` y luego salta el aviso de que no se puede verificar. La página de descarga detalla cada paso, y también Windows y Linux.",
    terminal: {
      title: "O configúralo desde una terminal",
      body: "Un comando, desde la raíz de tu proyecto. Crea el tablero en `docs/kanban/` y no escribe nada más.",
      promptNote:
        "¿Prefieres que lo haga entero tu agente de código? Dale el prompt de instalación: lee el repositorio, elige las vías, ejecuta ese comando y completa el resto de la configuración.",
      promptLink: "Ver el prompt de instalación",
    },
  },
};

export default es;
