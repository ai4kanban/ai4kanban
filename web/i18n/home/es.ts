// Español — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const es: HomeCopy = {
  meta: {
    title: "Revisa el borrador antes de que los agentes se pongan manos a la obra | AI4Kanban",
    description:
      "AI4Kanban prepara los borradores clave de las tareas de tu tablero. Tú revisas lo importante, los agentes se encargan de los detalles y sacas adelante más trabajo por tu cuenta.",
    socialTitle: "Revisa el borrador. Deja el resto a los agentes.",
    social: "Un tablero kanban para agentes de IA que te muestra primero los borradores clave y deja que los agentes terminen el resto.",
    schema:
      "AI4Kanban es un tablero kanban para agentes de IA, de código abierto y que prioriza el uso local. Prepara los borradores clave de cada tarea —un prototipo de interfaz, un borrador de textos, un guion gráfico, ilustraciones— para que fijes primero el rumbo; después, agentes especializados terminan el resto dentro del alcance acordado. Abarca el desarrollo de producto y la creación de contenido, y se conecta con 8 herramientas como Claude Code y Codex, que se ejecutan en tu equipo con tus propias suscripciones.",
  },

  hero: {
    title: "Revisa el borrador. Deja el resto a los agentes.",
    lead: "AI4Kanban prepara los borradores clave de las tareas de tu tablero. Tú revisas lo importante, los agentes se encargan de los detalles y una sola persona saca adelante más trabajo.",
    ctaDownload: "Descargar",
    ctaGithub: "Ver en GitHub ↗",
    image:
      "Grabación del tablero de demostración de AI4Kanban: planificar tareas, revisar los borradores de una tarjeta y pasar el trabajo a los agentes.",
  },

  drafts: {
    title: "Revisa los borradores clave. Acierta con el rumbo.",
    lead: "Los agentes ponen los borradores clave en la tarjeta de la tarea. Revísalos y ajústalos antes de que empiece el resto del trabajo.",
    kinds: [
      { label: "Prototipo de interfaz", body: "Revisa la disposición y las interacciones." },
      { label: "Borrador de textos", body: "Confirma el mensaje y la redacción." },
      { label: "Guion gráfico", body: "Revisa cada plano y su locución." },
      { label: "Ilustraciones", body: "Comprueba qué muestra cada ilustración." },
    ],
    closing:
      "No tienes que detallarlo todo. Una vez aprobados los borradores clave, los agentes terminan el resto dentro del alcance acordado.",
  },

  agents: {
    title: "Tus comentarios pasan a la siguiente tarea.",
    body: [
      "Un agente de diseño prepara prototipos, un agente de textos pule la redacción y un agente de guion planifica el contenido. AI4Kanban incluye 5 flujos de trabajo y más de 10 agentes especializados que se reparten el trabajo por tarea y recuerdan las preferencias y decisiones que has dejado claras.",
      "Por ejemplo, si pides «titulares más directos», el agente de textos aplica ese comentario a los borradores siguientes. La próxima tarea parte de lo que ya habéis acordado, así que nunca lo explicas desde cero.",
    ],
    pro: "Los vídeos de producto, las presentaciones, los carruseles y las entradas de blog requieren Pro.",
    image: "Das una indicación una vez; el agente la recuerda y todos los borradores siguientes la aplican.",
  },

  followUps: {
    title: "Deja que los agentes detecten lo que se te escapó.",
    body: [
      "Cuando las tareas se acumulan, encontrar cada hueco no debería depender solo de ti. Los agentes en segundo plano revisan el progreso de forma periódica, y un agente de QA prueba los cambios recientes como lo haría un usuario.",
      "Un estado de error olvidado o una prueba que falta pueden convertirse en una sugerencia de seguimiento en tu tablero. Tú la aceptas, la revisas o la rechazas, y los agentes continúan.",
    ],
    image: "El agente de QA detecta un hueco y te entrega un seguimiento para aceptarlo o descartarlo.",
  },

  parallel: {
    title: "Muchas cosas a la vez. Las decisiones clave siguen siendo tuyas.",
    body: [
      "Un cambio de producto, un artículo de lanzamiento, un vídeo de presentación: no hace falta terminar uno para empezar el siguiente. Las tareas independientes pasan a los agentes en paralelo; tú revisas los borradores clave en las tarjetas, tomas las decisiones y reservas tu atención para lo siguiente que merece la pena.",
      "AI4Kanban se ocupa del desglose de tareas, las prioridades, el seguimiento y las notificaciones, para que no tengas que coordinar el trabajo entre varios chats.",
    ],
    shots: {
      board: { label: "Board", alt: "Tablero de AI4Kanban: vista Board" },
      card: { label: "Card", alt: "Tablero de AI4Kanban: los detalles y requisitos de una tarjeta" },
      frontAria: "Vista {view} (actual)",
      flipAria: "Cambiar a la vista {view}",
    },
  },

  tools: {
    title: "Sigue usando las herramientas de IA que ya conoces.",
    body: "Conecta Claude Code, Codex y otras; se ejecutan en tu equipo con tus propias suscripciones. Hay 8 herramientas compatibles, cada agente puede elegir su herramienta y su modelo, y AI4Kanban no cobra tarifas adicionales por tokens.",
  },

  start: {
    title: "Escribe una idea. Mira primero el borrador.",
    lead: "Abre un proyecto y escribe lo que quieres hacer. Empieza por el primer borrador clave, fija el rumbo y deja el resto a los agentes.",
    cta: "Descargar",
    firstOpen:
      "Las versiones no están firmadas, así que macOS bloquea la primera apertura: arrastra la aplicación desde el `.dmg` y elige continuar en el aviso. La página de descarga tiene los pasos completos para macOS, Windows y Linux.",
    command: "¿Prefieres la línea de comandos? Ejecuta `npx ai4kanban@latest install` en tu proyecto.",
  },
};

export default es;
