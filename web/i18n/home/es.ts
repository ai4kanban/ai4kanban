// Español — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const es: HomeCopy = {
  meta: {
    title: "Gestión de proyectos con IA para agentes | AI4Kanban",
    description:
      "Impulsa proyectos más ambiciosos con AI4Kanban. Tu gestor de proyectos con IA asigna tareas a los agentes, sigue su progreso y te trae decisiones clave y resultados.",
    schema:
      "AI4Kanban es un gestor de proyectos con IA de código abierto que prioriza el uso local y ayuda a emprendedores independientes, creadores y equipos pequeños a abordar proyectos más grandes con un equipo de agentes. Asigna tareas, sigue el progreso y revisa los resultados en el flujo de desarrollo. Tú marcas el rumbo, tomas las decisiones clave y das la aprobación final. Incluye flujos de desarrollo de producto y vídeo de demostración; otros trabajos requieren añadir sus propios flujos y agentes.",
  },

  hero: {
    title: "Tú marcas el rumbo. La IA dirige el equipo.",
    lead: "Del desarrollo de producto al marketing de contenidos, tu gestor de proyectos con IA dirige a tus agentes para que puedas hacer realidad proyectos más ambiciosos.",
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
    title: "Menos seguimiento. Más entregas.",
    lead: "Delega la planificación, el seguimiento y la coordinación. Centra tu atención en el producto que quieres crear.",
    steps: [
      {
        title: "De una idea vaga a un plan detallado.",
        body: "Describe lo que quieres crear. AI4Kanban lee tu código y la memoria del proyecto, concreta los requisitos y organiza las tareas en el orden adecuado. Recibes un plan que tus agentes pueden ejecutar.",
      },
      {
        title: "Toma unas pocas decisiones antes de empezar.",
        body: "Las preguntas que necesitan tu criterio llegan con opciones y una recomendación. Elige el rumbo antes de escribir código, cuando cambiar aún cuesta poco.",
      },
      {
        title: "Haz avanzar más trabajo a la vez.",
        body: "Las tareas independientes se ejecutan en paralelo con tus agentes, sin esperar a que termine una para empezar la siguiente. AI4Kanban gestiona las dependencias y coordina el trabajo.",
      },
      {
        title: "Analiza los requisitos a tu manera.",
        body: "¿Quieres comparar opciones técnicas o probar un prototipo funcional antes de elegir un rumbo? Usa los agentes de especificación incluidos o añade los tuyos para que analicen los requisitos con tu método.",
      },
      {
        title: "Los agentes resuelven los detalles. Tú apruebas.",
        body: "La mayoría de los detalles se resuelven a partir del código y las decisiones anteriores. El trabajo avanza en segundo plano y recibes las decisiones de producto y las entregas pendientes de aprobación en la aplicación o en Slack.",
      },
      {
        title: "Tú decides qué funciona sin ti.",
        body: "Algunas tareas las inicias tú: hablar de una idea, ordenar el tablero, corregir un plan que no acertó. Repasar la memoria de las conversaciones viene activado y se ejecuta a diario. El resto espera a que lo actives: aprobar entregas, responder preguntas pendientes, proponer el siguiente paso. Cada una usa la herramienta de ejecución, el modelo y las instrucciones que le des.",
      },
    ],
  },

  memory: {
    title: "Te conoce mejor con cada avance",
    lead: "Tus preferencias, decisiones e ideas descartadas se incorporan al siguiente plan. A medida que crece la memoria del proyecto, tus agentes tienen más contexto para trabajar y tú tienes menos que explicar.",
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
      planner: "La memoria del planificador",
      readme: "Funciones entregadas",
      decisions: "Decisiones de producto",
      rejected: "Motivos del descarte",
      redesign: "Lecciones de diseño",
    },
  },

  iterate: {
    title: "Convierte los comentarios en mejoras del producto",
    lead: "Los comentarios de usuarios, el análisis de la competencia y las conversaciones del sector ayudan a decidir qué construir a continuación. AI4Kanban convierte esa información en tareas alineadas con los objetivos de tu producto, listas para tus agentes.",
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
    lead: "Descarga la aplicación, abre un proyecto y responde tres preguntas. Lee el código, escribe el objetivo del proyecto y la memoria del planificador, y propone las primeras tareas.",
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
