// Español — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const es: VsHermesCopy = {
  meta: {
    title: "AI4Kanban vs. Hermes Kanban: borradores antes de ejecutar",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description: "Compara AI4Kanban y Hermes Kanban en flujos especializados, revisión de borradores, control desde chats, tareas en paralelo y seguimiento.",
    social: "Compara AI4Kanban y Hermes Kanban en flujos especializados, revisión de borradores, control desde chats, tareas en paralelo y seguimiento.",
  },
  hero: {
    badge: "Comparativa",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Compara AI4Kanban y Hermes Kanban en flujos especializados, revisión de borradores, control desde chats, tareas en paralelo y seguimiento.",
    sharedLabel: "Ambos ofrecen",
    setup: {
      heading: "Agentes y flujos especializados, listos para usar",
      ours: "Los agentes especializados y los flujos integrados cubren el desarrollo del producto y el contenido de marketing. Usa el flujo adecuado para cada tarea sin diseñar el equipo desde cero. También puedes crear agentes y flujos personalizados.",
      theirs: "Los workers son perfiles de Hermes que configuras con un modelo y skills. No incluye flujos especializados para diseño de UI, redacción o producción de contenido.",
      art: {
        ours: [
          "Diseño UI",
          "Prompts",
          "Redacción",
        ],
        theirs: {
          title: "Perfil de worker",
          fields: [
            "Nombre",
            "Modelo",
            "Skills",
          ],
          slot: "Lo configuras tú",
        },
      },
      shared: [
        {
          title: "Desglose de tareas y dependencias",
          body: [
            "AI4Kanban divide el trabajo en tarjetas y subtareas, y las dependencias deciden el orden de ejecución.",
            "Hermes Kanban divide una tarea de una línea en tareas hijas y ejecuta cada una cuando terminan sus tareas padre.",
          ],
        },
        {
          title: "Ejecuciones en paralelo en git worktrees",
          body: [
            "AI4Kanban ejecuta tarjetas independientes a la vez, cada una en su propio git worktree.",
            "Hermes Kanban ejecuta tareas en paralelo, con un git worktree por tarea.",
          ],
        },
      ],
    },
    drafts: {
      heading: "Revisa los borradores clave antes de implementar",
      ours: "Las partes que necesitan tu criterio tienen un borrador primero. Revísalo y edítalo en la tarjeta; los agentes continúan desde la versión aprobada y resuelven los detalles dentro del alcance acordado. Corregir lo esencial aquí reduce lo que hay que rehacer después.",
      theirs: "Las tareas parten de una especificación en texto. Su documentación no describe una previsualización ni una aprobación de borradores clave antes de ejecutar.",
      art: {
        ours: [
          "Borrador clave",
          "Aprobar el rumbo",
          "Ejecutar la tarea",
        ],
        theirs: {
          title: "Especificación de la tarea",
          fields: [
            "Objetivo",
            "Enfoque",
            "Criterios de aceptación",
          ],
          slot: "Solo texto",
        },
      },
      shared: [
        {
          title: "Una especificación escrita",
          body: [
            "Las tarjetas de AI4Kanban recogen el alcance y los pasos de construcción.",
            "Hermes Kanban puede reescribir una tarea como objetivo, enfoque y criterios de aceptación.",
          ],
        },
        {
          title: "Comentarios sobre la tarea",
          body: [
            "AI4Kanban recoge tus cambios en el chat de la tarjeta y actualiza el plan.",
            "Hermes Kanban hace llegar tus notas al worker en los comentarios de la tarea.",
          ],
        },
      ],
    },
    questions: {
      heading: "Define los requisitos y deja que los agentes ejecuten",
      verdict: "Aprueba los borradores clave para reducir correcciones y comprueba la entrega según los requisitos acordados.",
      ours: "Planifica con los agentes y define los requisitos y borradores clave que necesitan tu decisión. Después, los agentes resuelven los detalles de ejecución y las tareas independientes pueden avanzar en paralelo. Vuelves para tomar decisiones y comprobar las entregas, sin vigilar cada sesión mientras se ejecuta.",
      theirs: "Planificación ligera, ejecución rápida: el trabajo empieza en cuanto se desglosa, el listón se ajusta sobre la marcha y las correcciones se hacen en el worktree. Es una forma válida de trabajar, pero depende de que vayas revisando mientras se ejecuta, lo que limita cuánto trabajo puedes entregar en un día.",
      art: {
        ours: [
          "Aclarar",
          "Aprobar puntos clave",
          "Ejecutar",
        ],
        theirs: {
          title: "Tarea en curso",
          fields: [
            "Empezar",
            "Ajustar el listón",
            "Corregir en el worktree",
          ],
          slot: "Revisar mientras se ejecuta",
        },
      },
      shared: [
        {
          title: "Agentes que aprenden mientras trabajan",
          body: [
            "Los agentes especializados de AI4Kanban anotan los borradores que devuelves o rechazas, y las tarjetas terminadas se revisan para extraer decisiones y preferencias.",
            "Cada perfil de Hermes guarda notas de memoria y escribe sus propias skills a partir de lo que aprende, incluidas tus correcciones.",
          ],
        },
        {
          title: "Historial de la tarea",
          body: [
            "AI4Kanban guarda en la tarjeta los planes, las conversaciones y los registros de ejecución.",
            "Hermes Kanban guarda en la tarea un hilo de comentarios y el historial de ejecuciones.",
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
    lead: "Un {check} marca el lado más fuerte en cada fila.",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      startingPoint: {
        dimension: "Agentes y flujos incluidos",
        kanban: "Agentes y flujos especializados incluidos para desarrollo y contenido. Crea los tuyos. Los flujos de contenido requieren Pro.",
        hermes: "Perfiles de Hermes de uso general que configuras tú. No incluye flujos especializados para diseño de UI, redacción o producción de contenido.",
      },
      planning: {
        dimension: "Antes de empezar el trabajo",
        kanban: "La planificación resuelve lo que puede y te pregunta lo que sigue abierto. No se construye nada hasta que tú lo inicias.",
        hermes: "Un modelo divide la tarea en un grafo de tareas sin preguntarte; las tareas hijas empiezan solas salvo que lo desactives.",
      },
      drafts: {
        dimension: "Revisión de borradores clave antes de ejecutar",
        kanban: "Borradores de imagen, diagrama, HTML/TSX, diff y storyboard. El contenido aprobado pasa a formar parte de los requisitos de ejecución.",
        hermes: "Una especificación en texto con objetivo, enfoque y criterios de aceptación. Su documentación no incluye previsualización de borradores antes de ejecutar.",
      },
      questions: {
        dimension: "Preguntas para ti",
        kanban: "Se plantean al planificar o a mitad de la construcción, cada una con opciones y una respuesta recomendada; solo espera el trabajo que depende de ella, y continúa en cuanto respondes.",
        hermes: "Un worker pausa toda la tarea con un motivo por escrito; tú comentas, la desbloqueas y el worker vuelve a empezar.",
      },
      memory: {
        dimension: "Qué recuerdan los agentes",
        kanban: "Cada agente especializado anota los borradores que devuelves o rechazas; las tarjetas terminadas se revisan para extraer decisiones y preferencias.",
        hermes: "Cada perfil guarda notas de memoria y escribe sus propias skills a partir de lo que aprende, incluidas tus correcciones.",
      },
      followUps: {
        dimension: "Trabajo tras la entrega",
        kanban: "Los agentes revisan lo entregado y sugieren trabajo de seguimiento con sus motivos; un agente de QA prueba a diario los cambios recientes. Las sugerencias esperan en la bandeja de revisión hasta que decidas.",
        hermes: "Los workers crean tareas hijas para dividir el trabajo en curso. El seguimiento tras la entrega es una tarea nueva que creas tú.",
      },
      landing: {
        dimension: "Integrar el trabajo en paralelo",
        kanban: "Cada construcción terminada se rebasa y se fusiona por turnos; un agente resuelve los conflictos.",
        hermes: "Los worktrees se conservan tras la tarea. La fusión de vuelta no está documentada; los conflictos pasan a una tarea de reconciliación aparte.",
      },
      recurring: {
        dimension: "Trabajo recurrente",
        kanban: "Los agentes programados se ejecutan con la frecuencia que elijas.",
        hermes: "Inicios programados puntuales. El trabajo recurrente necesita tu propio cron.",
      },
      harness: {
        dimension: "Ejecutar Claude Code o Codex",
        kanban: "Claude Code, Codex, Cursor, OpenCode y otros agentes de programación ejecutan el trabajo directamente, con tus propias suscripciones; elige uno por agente.",
        hermes: "Los workers son agentes de Hermes; una skill incluida permite que uno llame a Claude Code o Codex desde el terminal.",
      },
      interface: {
        dimension: "Tablero e interfaz",
        kanban: "Una app de escritorio para tarjetas, borradores, conversaciones y estado de las ejecuciones.",
        hermes: "Una CLI, un panel web y un plugin para la app de escritorio.",
      },
      review: {
        dimension: "Comprobar el trabajo",
        kanban: "Claude Code o Codex ejecutan pruebas y comprueban los requisitos mientras construyen; AI4Kanban no añade una segunda revisión, para no probar de más.",
        hermes: "Un perfil revisor comprueba cada criterio de aceptación y ejecuta pruebas, y devuelve el trabajo hasta que lo supera.",
      },
      chat: {
        dimension: "Control desde apps de chat",
        kanban: "Las notificaciones, Slack y Lark requieren Cloud, que está en vista previa solo por invitación.",
        hermes: "Gestiona el tablero con /kanban desde Telegram, Discord, Slack, WhatsApp, Signal y más, con notificaciones de tareas.",
      },
      recovery: {
        dimension: "Recuperación de ejecuciones fallidas",
        kanban: "Los errores del proveedor se reintentan automáticamente. Una ejecución detenida espera a que la reanudes.",
        hermes: "Los latidos recuperan las tareas atascadas, y una tarea que sigue fallando queda en espera.",
      },
      api: {
        dimension: "API y extensiones",
        kanban: "Una CLI que llaman los agentes de programación. Sin API pública.",
        hermes: "Una API REST y WebSocket, además de hooks de plugins para eventos de tareas.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Recomendación",
      title: "¿Cuál deberías elegir?",
    },
    oursHeading: "Elige AI4Kanban si",
    theirsHeading: "Elige Hermes Kanban si",
    ours: [
      "Quieres agentes y flujos listos para código, blogs y vídeos.",
      "Quieres ajustar los detalles clave en un borrador antes de terminar el trabajo.",
      "Quieres reutilizar tus preferencias para reducir las correcciones en tareas futuras.",
    ],
    theirs: [
      "Ya usas Hermes Agent y quieres el tablero dentro de él.",
      "Quieres gestionar tareas desde Telegram, Slack, Discord u otras apps de chat.",
      "Quieres recuperación automática de tareas atascadas y una API sobre la que construir.",
    ],
    verdict: "Elige AI4Kanban para **usar flujos especializados listos y revisar borradores clave para rehacer menos**; elige Hermes Kanban por **el control desde apps de chat, la recuperación automática y una API**.",
    note: "Comparado con la documentación de Hermes Agent v0.21.6, revisada en octubre de 2026.",
  },
};

export default es;
