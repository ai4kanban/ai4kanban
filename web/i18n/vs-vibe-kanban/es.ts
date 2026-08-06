// Español — the Vibe Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsVibeCopy } from "./types";

const es: VsVibeCopy = {
  meta: {
    title:
      "AI4Kanban vs. Vibe Kanban: ¿planificación o ejecución multiagente?",
    socialTitle: "AI4Kanban vs. Vibe Kanban",
    description:
      "Bloop cerró en abril de 2026, pero Vibe Kanban continúa como proyecto de código abierto mantenido por la comunidad. Comparamos su espacio de trabajo multiagente con el flujo de planificación basado en archivos de AI4Kanban.",
    social:
      "AI4Kanban y Vibe Kanban resuelven problemas distintos: planificar el trabajo dentro del repositorio frente a ejecutar y revisar varios agentes de código.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nVibe Kanban",
    lead: "Vibe Kanban ejecuta varios agentes de código en paralelo y centraliza la revisión de sus resultados. AI4Kanban ayuda a un agente a convertir ideas en tareas bien definidas mediante archivos Markdown en el repositorio. Ambos incluyen un tablero, pero están diseñados para etapas distintas del desarrollo.",
    ours: {
      name: "AI4Kanban",
      body: "Un flujo basado en archivos para planificar y concretar tareas con un agente.",
    },
    theirs: {
      name: "Vibe Kanban",
      body: "Una aplicación local para ejecutar y revisar varios agentes.",
    },
  },
  summary: {
    heading: {
      eyebrow: "La versión corta",
      title: "Bloop cerró. Vibe Kanban continúa.",
    },
    lead: "Bloop, la empresa que creó Vibe Kanban, cerró en abril de 2026. Las suscripciones de pago terminaron, se retiraron los servicios remotos y el producto pasó a funcionar de forma totalmente local. Vibe Kanban sigue disponible con licencia Apache-2.0 y ahora lo mantiene la comunidad.",
    panel:
      "Elige AI4Kanban si quieres el **tablero de planificación** sin una base de datos ni una aplicación en ejecución permanente. Elige Vibe Kanban si necesitas **ejecutar varios agentes en paralelo** y revisar sus resultados desde una misma interfaz. AI4Kanban no sustituye las funciones de orquestación de Vibe Kanban.",
  },
  comparison: {
    heading: { eyebrow: "Cara a cara", title: "AI4Kanban vs. Vibe Kanban" },
    lead: "Un {check} señala la opción más sólida para un requisito concreto. Un **guion** indica una decisión de diseño, no una ventaja clara. AI4Kanban prioriza la **planificación y la portabilidad**; Vibe Kanban, la **ejecución en paralelo y la revisión integrada**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Vibe Kanban",
    rows: {
      whatFor: {
        dimension: "Función principal",
        kanban:
          "Definir, concretar y organizar tareas con un agente dentro del repositorio.",
        vibe: "Ejecutar varios agentes de código en paralelo y revisar sus resultados.",
      },
      orchestration: {
        dimension: "Orquestación multiagente",
        kanban: "No incluida. El agente o el entorno que ya utilizas ejecuta el trabajo.",
        vibe: "Una función central, con cada agente aislado en su propio worktree de git.",
      },
      review: {
        dimension: "Revisión de lo que produce el agente",
        kanban: "Se realiza en el agente, el entorno de desarrollo o las herramientas de revisión.",
        vibe: "Integrada, con diffs en línea, vistas previas y flujos de pull requests.",
      },
      planning: {
        dimension: "Planificación y definición",
        kanban:
          "Un proceso guiado convierte una idea inicial en una tarea lista para ejecutar.",
        vibe: "Se centra en encolar y seguir ejecuciones, no en completar los requisitos.",
      },
      onDisk: {
        dimension: "Almacenamiento",
        kanban: "Markdown guardado y versionado junto con el repositorio.",
        vibe: "Una base de datos SQLite local en un directorio de configuración.",
      },
      runsAs: {
        dimension: "Entorno de ejecución",
        kanban: "No requiere ningún servicio ni aplicación; el tablero son archivos.",
        vibe: "Una aplicación local con backend en Rust e interfaz web.",
      },
      setup: {
        dimension: "Puesta en marcha",
        kanban: "Un prompt instala un archivo de skill y un pequeño script auxiliar.",
        vibe: "Ejecuta `npx vibe-kanban` e instala y autentica cada CLI de agente.",
      },
      whichAgents: {
        dimension: "Compatibilidad con agentes",
        kanban:
          "Funciona con cualquier agente capaz de leer y escribir archivos del repositorio.",
        vibe: "Admite CLIs integradas como Claude Code, Codex, Gemini y otras.",
      },
      lockIn: {
        dimension: "Portabilidad",
        kanban: "El tablero Markdown viaja con el repositorio y no necesita exportación.",
        vibe: "Autoalojable bajo Apache-2.0 y con exportación de datos.",
      },
      maintenance: {
        dimension: "Mantenimiento",
        kanban: "Se mantiene activamente.",
        vibe: "Mantenido por la comunidad desde el cierre de Bloop en abril de 2026.",
      },
    },
  },
  purpose: {
    heading: {
      eyebrow: "La diferencia de fondo",
      title: "Planificar el trabajo o ejecutar los agentes",
    },
    lead: "Los productos cubren etapas distintas del flujo de trabajo. AI4Kanban ayuda a decidir **qué construir** y a preparar la tarea. Vibe Kanban permite **ejecutar ese trabajo con varios agentes** y revisar los resultados.",
    ours: {
      name: "AI4Kanban — planificar y concretar",
      is: "El agente lee y actualiza un tablero Markdown dentro del repositorio. Un proceso de definición transforma la idea inicial en una tarea específica y revisable, que apruebas antes de empezar a implementarla.",
      isnt: "No inicia agentes, crea worktrees ni muestra diffs. Esas funciones siguen correspondiendo al agente o al entorno de desarrollo.",
    },
    theirs: {
      name: "Vibe Kanban — ejecutar y revisar",
      is: "Una aplicación local que ejecuta varios agentes de código a la vez en worktrees de git independientes. Reúne la ejecución de tareas, la revisión de diffs y la vista previa en un único espacio de trabajo.",
      isnt: "Está pensada para gestionar ejecuciones, no para desarrollar una idea incompleta hasta convertirla en un plan de implementación detallado.",
    },
    note: "Si utilizabas Vibe Kanban sobre todo para organizar tareas, AI4Kanban ofrece una alternativa más sencilla e integrada en el repositorio. Si lo importante es la ejecución paralela y la revisión integrada, Vibe Kanban encaja mejor.",
  },
  wins: {
    heading: { eyebrow: "Compromisos", title: "Dónde gana cada uno" },
    lead: "Ninguno es mejor en todos los casos. AI4Kanban prioriza un flujo de planificación ligero y portátil; Vibe Kanban, la ejecución coordinada y la revisión de varios agentes.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Vibe Kanban",
    ours: {
      nothingRunning: {
        title: "Sin servicios que mantener",
        body: "El tablero es Markdown dentro del repositorio. No requiere aplicación web, base de datos ni servicio en segundo plano.",
      },
      planning: {
        title: "Definición estructurada de tareas",
        body: "El proceso de definición identifica la información que falta y convierte una idea inicial en una tarea concreta que puedes aprobar antes de implementarla.",
      },
      outlives: {
        title: "Portátil por diseño",
        body: "Los planes se guardan en git junto con el código. Al clonar el repositorio, el tablero se conserva sin migraciones ni exportaciones.",
      },
      anyAgent: {
        title: "Compatible con cualquier agente que trabaje con archivos",
        body: "Puede utilizarlo cualquier agente capaz de operar con archivos del repositorio, incluidos Claude Code, Codex, Cursor y futuras herramientas.",
      },
    },
    theirs: {
      parallel: {
        title: "Ejecuta muchos agentes a la vez",
        body: "Vibe Kanban distribuye tareas entre varios agentes de código y aísla cada ejecución en su propia rama y worktree de git.",
      },
      reviewInPlace: {
        title: "Ejecutar y revisar en un mismo sitio",
        body: "Los diffs en línea, la vista previa de la aplicación y los flujos de pull requests permiten revisar los resultados sin salir del espacio de trabajo.",
      },
      boardUi: {
        title: "Una interfaz visual específica",
        body: "La interfaz web está diseñada para iniciar tareas, seguir su progreso y cambiar de espacio de trabajo mientras los agentes se ejecutan.",
      },
      support: {
        title: "Amplia integración con agentes",
        body: "Admite de fábrica varias CLIs de agentes, entre ellas Claude Code, Codex, Gemini y otras.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La decisión", title: "¿Cuál deberías usar?" },
    oursHeading: "Elige AI4Kanban cuando",
    theirsHeading: "Elige Vibe Kanban cuando",
    ours: [
      "Quieres que un agente planifique y concrete el trabajo dentro del repositorio.",
      "Prefieres Markdown en git a una aplicación y una base de datos independientes.",
      "Quieres usar el tablero con cualquier agente de código que trabaje con archivos.",
      "Valoras más unos requisitos claros que la ejecución en paralelo.",
    ],
    theirs: [
      "Quieres ejecutar varios agentes de código en paralelo y en worktrees aislados.",
      "Necesitas diffs en línea y vistas previas desde una misma interfaz.",
      "Coordinar y revisar las ejecuciones es tu principal cuello de botella.",
      "Te parece adecuado utilizar un proyecto de código abierto mantenido por la comunidad.",
    ],
    verdict:
      "Elige AI4Kanban si necesitas un **flujo de planificación integrado en el repositorio** y sin un entorno de ejecución independiente. Elige Vibe Kanban si buscas **ejecución multiagente y revisión integrada**. La decisión depende de si el mayor límite está en planificar el trabajo o en coordinar su ejecución.",
    note: "El cierre de Bloop cambió el modelo de mantenimiento de Vibe Kanban, pero no la diferencia fundamental entre ambos productos.",
  },
};

export default es;
