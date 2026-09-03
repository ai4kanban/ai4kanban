// Español — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const es: HomeCopy = {
  meta: {
    title: "Gestor de proyectos con IA para agentes de código | AI4Kanban",
    description:
      "Convierte ideas vagas en planes ejecutables, reparte las tareas entre tus agentes de código y revisa solo las decisiones de producto que exigen criterio humano.",
    schema:
      "AI4Kanban es un gestor de proyectos con IA para agentes de código: open source y local. Convierte ideas vagas en tareas ordenadas por dependencias, coordina su ejecución en segundo plano, conserva las decisiones del proyecto y solo interrumpe cuando hace falta criterio humano o validación final.",
  },

  hero: {
    title: "Entrega sin vigilar a tus agentes de código.",
    lead: "AI4Kanban convierte ideas vagas en trabajo listo para construir, lo ejecuta con tus agentes y solo te pide decisiones de producto.",
    ctaDownload: "Descargar",
    ctaGithub: "Ver en GitHub ↗",
    shots: {
      board: {
        label: "Board",
        alt: "Tablero local de AI4Kanban: vista Board",
      },
      card: {
        label: "Card",
        alt: "Tablero local de AI4Kanban: una tarjeta y su especificación",
      },
      frontAria: "Vista {view} (actual)",
      flipAria: "Cambiar a la vista {view}",
    },
  },

  loop: {
    title: "El trabajo sigue avanzando",
    lead: "Dale un objetivo o una idea por definir. El agente lee tu código y la memoria del proyecto, determina qué viene después, aclara los requisitos, descompone el trabajo, ordena dependencias y prioridades, y pasa a la ejecución.",
    steps: [
      {
        title: "Definir tareas y dependencias",
        body: "El agente divide los objetivos grandes en tarjetas bien delimitadas y decide automáticamente cuáles pueden avanzar en paralelo y cuáles deben esperar, para que cada tarea se complete dentro de su propio contexto.",
      },
      {
        title: "Aclarar los requisitos",
        body: "El agente convierte requisitos imprecisos en un plan viable. Responde la mayoría de las preguntas a partir de la memoria del proyecto y el código, y deja al criterio humano solo el gusto, la dirección comercial, el riesgo y el coste.",
      },
      {
        title: "Ejecutar",
        body: "Puedes coordinar varios agentes para ejecutar en paralelo las tareas preparadas. Cada entrega usa su propio Git worktree para aislar los cambios, y los conflictos activan una fase específica de resolución antes de integrar.",
      },
      {
        title: "Resolver las decisiones clave antes de implementar",
        body: "Puedes crear tus propias Spec Skills o usar las incluidas: una skill de selección tecnológica compara las opciones técnicas y una skill de diseño de interfaz ofrece varios mockups funcionales entre los que elegir.",
      },
      {
        title: "Solicitar aprobación solo cuando sea necesario",
        body: "AI4Kanban mantiene el trabajo en marcha en segundo plano y solo informa cuando hace falta una decisión de producto o aprobar una entrega. Como un jefe de proyecto, reduce al mínimo la atención que requiere de ti.",
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
    internalLabel: "Entradas internas",
    internal: ["Hoja de ruta del producto"],
    board: {
      columns: ["Listo para empezar", "Sin preparar"],
      ready: "listo",
    },
    storage: "Datos del proyecto",
    outputsLabel: "Resultados de la iteración",
    outputs: ["Mejoras de producto", "Nuevas versiones"],
  },

  start: {
    title: "Empieza con la aplicación de escritorio",
    lead: "Descarga la aplicación, abre un proyecto y responde tres preguntas. Lee el código, escribe el objetivo del proyecto y la memoria por módulo, y propone las primeras tareas.",
    notes: [
      "Planificación autónoma",
      "Local primero",
      "Independiente del agente",
    ],
    cta: "Descargar",
    firstOpen:
      "Las compilaciones no están firmadas, así que macOS bloquea la primera apertura: arrastra la aplicación desde el `.dmg` y luego acepta el aviso. La página de descarga tiene los pasos completos para macOS, Windows y Linux.",
    command:
      "La aplicación incluye la CLI `akb` y añade las skills del agente de código al abrir un proyecto. Ninguna de las dos está pensada para instalarse por separado.",
  },
};

export default es;
