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
    eyebrow: "Gestor de proyectos con IA para agentes de código",
    title: "Convierte ideas vagas en software entregado, sin vigilar agentes.",
    lead: "AI4Kanban planifica el trabajo, lo ejecuta con tus agentes de código y solo te pide decisiones de producto y la validación final.",
    ctaDownload: "Descargar",
    ctaGithub: "Ver en GitHub ↗",
    flow: [
      "Tu idea en bruto",
      "Un plan ordenado por dependencias",
      "La decisión que solo tú puedes tomar",
      "Los agentes trabajando en segundo plano",
    ],
    flowAlt:
      "Una idea en bruto se convierte en un plan ordenado por dependencias, una decisión de producto vuelve para que la responda una persona y el resto del trabajo corre en segundo plano en tus agentes de código.",
  },

  why: {
    title: "Programar se volvió rápido. Decidir el producto es el cuello de botella.",
    body: "Los agentes construyen bien lo que está bien definido. Lo vago acaba en desvíos, retrabajo y una cola de conversaciones larguísimas que nadie tiene tiempo de leer. AI4Kanban se sitúa por encima de tus agentes de código: fija qué construir antes de que arranque nada y solo devuelve lo que una persona tiene que decidir.",
  },

  steps: {
    title: "De una idea en bruto a un cambio integrado",
    items: [
      {
        title: "Empieza con una idea en bruto",
        body: "Describe el resultado en una frase. AI4Kanban lee tu código, divide el objetivo en tareas acotadas y las ordena por dependencias para que el trabajo independiente avance en paralelo.",
      },
      {
        title: "Aprueba solo lo que te necesita",
        body: "Los detalles rutinarios se resuelven con el código y la memoria del proyecto. El gusto, la dirección de negocio, el riesgo y el coste vuelven como una pregunta breve con una respuesta recomendada. Cada respuesta pasa a la memoria del proyecto, así que el siguiente plan te pide menos.",
      },
      {
        title: "Deja correr a los agentes",
        body: "Las tareas listas se ejecutan en segundo plano, cada una en su propio worktree de Git, y los conflictos pasan por una resolución dedicada antes de integrarse. Te avisamos cuando una entrega espera tu validación.",
      },
    ],
  },

  trust: {
    title: "Aprende tu proyecto y se queda en tu repositorio",
    lead: "Las decisiones de producto, las vías descartadas y las lecciones de diseño sobreviven a la conversación que las originó: cuanto más avanza el proyecto, más autonomía hay y menos revisión hace falta.",
    items: [
      {
        title: "Apache-2.0",
        body: "Open source. Libre de usar, modificar y redistribuir.",
      },
      {
        title: "Local primero",
        body: "El tablero y su memoria son Markdown en `docs/kanban/`, versionado en Git.",
      },
      {
        title: "Tu agente de código",
        body: "Claude Code, Codex, Cursor, OpenCode, Kimi Code, DeepSeek Harness y ZCode.",
      },
    ],
  },

  start: {
    title: "Empieza con la aplicación de escritorio",
    lead: "Descarga la aplicación, abre un proyecto y responde tres preguntas. Lee el código, escribe el objetivo del proyecto y la memoria por módulo, y propone las primeras tareas.",
    cta: "Descargar",
    firstOpen:
      "Las compilaciones no están firmadas, así que macOS bloquea la primera apertura: arrastra la aplicación desde el `.dmg` y luego acepta el aviso. La página de descarga tiene los pasos completos para macOS, Windows y Linux.",
    command:
      "La aplicación incluye la CLI `akb` y añade las skills del agente de código al abrir un proyecto. Ninguna de las dos está pensada para instalarse por separado.",
  },
};

export default es;
