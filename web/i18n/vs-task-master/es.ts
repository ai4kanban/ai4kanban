// Español — the Taskmaster comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const es: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Taskmaster: menos guía y menos retrabajo con agentes de IA",
    socialTitle: "AI4Kanban vs. Taskmaster",
    description: "AI4Kanban añade flujos especializados, aprobación de borradores y memoria de preferencias a la gestión de tareas. Descubre cómo reduce el retrabajo frente a Taskmaster.",
    social: "AI4Kanban desglosa y gestiona tareas, te deja aprobar borradores de UI, prompts o textos antes de ejecutarlos y reutiliza tus preferencias y decisiones en el trabajo futuro. Taskmaster no incluye aprobación de borradores ni memoria de preferencias.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nTaskmaster",
    lead: "Los flujos especializados, la aprobación de borradores y la memoria de preferencias incluidos te ayudan a guiar a los agentes con menos esfuerzo y a reducir el retrabajo.",
    sharedLabel: "Ambos ofrecen",
    setup: {
      heading: "Agentes y flujos especializados, listos para usar",
      ours: "Los agentes y flujos incluidos cubren desarrollo de software, blogs, carruseles para redes sociales, presentaciones y vídeos de producto. También puedes crear tus propios agentes y flujos.",
      theirs: "Centrado en tareas de programación. No incluye agentes ni flujos especializados para diseño de UI, redacción o producción de contenido.",
      art: {
        ours: [
          "Diseño UI",
          "Prompts",
          "Redacción",
        ],
        theirs: {
          title: "Flujos especializados",
          fields: [
            "Diseño UI",
            "Redacción",
            "Producción de contenido",
          ],
          slot: "No incluido",
        },
      },
      shared: [
        {
          title: "Desglose de tareas y dependencias",
          body: [
            "AI4Kanban divide el trabajo en tarjetas y subtareas, y las dependencias deciden el orden de ejecución.",
            "Taskmaster puede generar tareas y subtareas a partir de un PRD y gestionar sus dependencias.",
          ],
        },
        {
          title: "Integración por CLI",
          body: [
            "AI4Kanban ofrece una CLI que los agentes de programación pueden llamar. No tiene servidor MCP.",
            "Taskmaster ofrece una CLI y un servidor MCP.",
          ],
        },
      ],
    },
    drafts: {
      heading: "Revisa los borradores clave antes de implementar",
      ours: "Elige la UI, los prompts, los textos u otras partes clave que quieras revisar. Los agentes preparan borradores que puedes previsualizar y editar, y luego trabajan a partir de lo que apruebas.",
      theirs: "Puedes revisar descripciones de tareas, detalles de implementación y estrategias de prueba. No hay un flujo integrado para previsualizar y aprobar borradores de los resultados clave antes de ejecutar.",
      art: {
        ours: [
          "Borrador clave",
          "Aprobar el rumbo",
          "Ejecutar la tarea",
        ],
        theirs: {
          title: "Detalles de la tarea",
          fields: [
            "Requisitos",
            "Implementación",
            "Estrategia de prueba",
          ],
          slot: "Detalles en texto",
        },
      },
      shared: [
      ],
    },
    memory: {
      heading: "Lleva tus preferencias a la siguiente tarea",
      ours: "Los diseñadores recuerdan tus preferencias de diseño; los redactores, tus elecciones de redacción. Los agentes también pueden compartir el contexto del proyecto.",
      theirs: "Guarda reglas y notas de tareas. No tiene un sistema de memoria que aprenda automáticamente preferencias de tus ediciones y rechazos para tareas futuras.",
      art: {
        ours: {
          agents: [
            "Diseñador UI",
            "Redactor",
          ],
          notes: [
            "Preferencias de diseño",
            "Decisiones de redacción",
          ],
          shared: "Contexto compartido del proyecto",
        },
        theirs: {
          title: "Reglas y notas de tareas",
          fields: [
            "Restricciones del proyecto",
            "Notas de progreso",
            "Contexto añadido",
          ],
          slot: "Solo reglas y notas",
        },
      },
      shared: [
        {
          title: "Reglas editables",
          body: [
            "Los agentes especializados de AI4Kanban tienen reglas de rol editables.",
            "Taskmaster ofrece archivos de reglas para distintos editores.",
          ],
        },
        {
          title: "Conservar el contexto del trabajo",
          body: [
            "AI4Kanban guarda en la tarjeta los planes, las conversaciones y los registros de ejecución.",
            "Taskmaster conserva descripciones de tareas, detalles de implementación y notas de subtareas.",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "Diferencias clave",
      title: "Compara los detalles",
    },
    lead: "Mira qué flujos, pasos de revisión e integraciones incluye cada producto.",
    ourLabel: "AI4Kanban",
    theirLabel: "Taskmaster",
    rows: {
      startingPoint: {
        dimension: "Agentes y flujos incluidos",
        kanban: "Agentes y flujos especializados incluidos para desarrollo y contenido. Crea tus propios agentes y flujos. Los flujos de contenido requieren Pro.",
        taskMaster: "Flujos de programación para ejecutar tareas, probar y limpiar código. No incluye agentes ni flujos especializados para diseño, redacción o producción de contenido.",
      },
      planning: {
        dimension: "Desglose de tareas y dependencias",
        kanban: "AI4Kanban divide el trabajo en tarjetas y subtareas, y las dependencias deciden el orden de ejecución.",
        taskMaster: "Taskmaster puede generar tareas y subtareas a partir de un PRD y gestionar sus dependencias.",
      },
      drafts: {
        dimension: "Revisión de borradores clave antes de ejecutar",
        kanban: "Borradores de imagen, diagrama, HTML/TSX, diff y storyboard. El contenido clave aprobado pasa a formar parte de los requisitos de ejecución.",
        taskMaster: "Puedes revisar descripciones de tareas, detalles de implementación y estrategias de prueba. No hay un flujo integrado para previsualizar y aprobar borradores de los resultados clave antes de ejecutar.",
      },
      discussion: {
        dimension: "Chat sobre una tarea",
        kanban: "Comenta requisitos y revisa planes con los agentes en la tarjeta. Las conversaciones se quedan en la tarjeta.",
        taskMaster: "No incluye una interfaz de chat por tarea. Las tareas se comentan en el chat del agente de herramientas como Cursor.",
      },
      memory: {
        dimension: "Memoria de preferencias",
        kanban: "Los agentes recuerdan tus preferencias de diseño, tus elecciones de redacción y otras decisiones, y pueden compartir el contexto del proyecto.",
        taskMaster: "Guarda reglas y notas de tareas. No tiene un sistema de memoria que aprenda automáticamente preferencias de tus ediciones y rechazos para tareas futuras.",
      },
      followUps: {
        dimension: "Sugerencias tras la entrega",
        kanban: "Los agentes proponen trabajo de seguimiento al terminar una tarea principal. Tú lo aceptas, lo cambias o lo descartas.",
        taskMaster: "next solo selecciona tareas existentes. No hay un flujo integrado que proponga automáticamente nuevas tareas de seguimiento tras la entrega.",
      },
      interface: {
        dimension: "Tablero e interfaz",
        kanban: "Un tablero de escritorio independiente para tarjetas, borradores, conversaciones y estado de las ejecuciones.",
        taskMaster: "El tablero Kanban visual oficial es una extensión de VS Code. La gestión de tareas básica también funciona por CLI/MCP.",
      },
      execution: {
        dimension: "Ejecución y validación",
        kanban: "Ejecuta tarjetas independientes en paralelo en segundo plano, o usa dependencias para ejecutarlas en orden. Las tareas de desarrollo usan git worktrees aislados y las comprobaciones necesarias.",
        taskMaster: "loop inicia una nueva sesión de Claude Code en cada iteración, completa una tarea cada vez y ejecuta pruebas y comprobaciones de tipos.",
      },
      testFirst: {
        dimension: "Flujo test-first incluido",
        kanban: "Las tareas de desarrollo ejecutan las comprobaciones necesarias. No incluye un flujo RED → GREEN → COMMIT.",
        taskMaster: "autopilot guía cada subtarea por una prueba que falla, la implementación hasta que las pruebas pasan y un commit. Sigue las fases y comprueba los resultados de prueba informados.",
      },
      research: {
        dimension: "Investigación",
        kanban: "Los agentes pueden investigar con las herramientas disponibles en Claude Code, Codex u otra herramienta de ejecución. Sin comando de investigación dedicado ni ajuste de modelo de investigación.",
        taskMaster: "research acepta contexto de tareas y archivos, usa un modelo de investigación configurado aparte y puede guardar los resultados en una tarea o en un archivo de investigación.",
      },
      reach: {
        dimension: "CLI y MCP",
        kanban: "Una CLI que pueden llamar herramientas de programación como Claude Code y Codex. Sin servidor MCP.",
        taskMaster: "CLI y MCP, para usarlo con editores y agentes de programación compatibles con MCP.",
      },
      license: {
        dimension: "Licencia",
        kanban: "Apache-2.0, que permite uso comercial, alojamiento e integración.",
        taskMaster: "MIT con Commons Clause, que restringe vender Taskmaster en sí y ofrecerlo como servicio alojado.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Recomendación",
      title: "¿Cuál deberías elegir?",
    },
    oursHeading: "Elige AI4Kanban si",
    theirsHeading: "Elige Taskmaster si",
    ours: [
      "Quieres agentes y flujos especializados incluidos, o crear los tuyos.",
      "Quieres aprobar borradores clave de UI, prompts o textos antes de la ejecución completa.",
      "Quieres que las tareas futuras reutilicen tus preferencias y sugieran trabajo de seguimiento útil.",
    ],
    theirs: [
      "Quieres gestionar tareas por MCP desde tu editor o agente de programación actual.",
      "Quieres un comando de investigación dedicado, con contexto de tareas y un modelo de investigación aparte.",
      "Quieres un flujo integrado que guíe la programación por pruebas que fallan, pruebas que pasan y commits.",
    ],
    verdict: "Elige AI4Kanban por **los flujos especializados, la aprobación de borradores y la memoria de preferencias**; elige Taskmaster por **la integración MCP, un comando de investigación dedicado y un flujo de programación test-first incluido**.",
    note: "Esta página compara la versión de código abierto de Taskmaster. Hamster es un producto alojado del mismo equipo; sus funciones de equipo quedan fuera de esta comparativa.",
  },
};

export default es;
