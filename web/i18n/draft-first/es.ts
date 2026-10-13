import type { DraftFirstCopy } from "./types";

const es: DraftFirstCopy = {
  meta: {
    title: "draft-first: revisa los borradores de la IA antes de construir",
    description:
      "Menos retrabajo. Tu agente de programación prepara primero borradores de las pantallas, los prompts y los textos, y construye a partir de los que confirmas.",
  },
  schema:
    "draft-first es una skill para Claude Code, Codex, Cursor, OpenCode y otros agentes de programación. Presenta para su revisión borradores de pantallas, prompts con salidas de ejemplo, textos, imágenes, elección de librerías y comparativas con la competencia. Cuando los revisas y confirmas, el agente implementa las pantallas, los textos y las opciones elegidas, con menos suposiciones durante la construcción.",
  hero: {
    title: ["Revisa el borrador.", "Luego construye."],
    lead: "Tu agente de programación prepara borradores de las pantallas, los prompts y los textos. Tú los revisas y corriges; después construye a partir de la versión que confirmas.",
    update: "Vuelve a ejecutarlo para actualizar.",
    worksWith: "Compatible con",
    alt: "Una página de revisión de draft-first: se elimina un borrador, otro recibe una nota y la página se confirma.",
  },
  drafts: {
    title: "Borradores de lo que importa",
    lead: "¿Tu IA sigue fallando en los detalles? Revisa los borradores de las partes clave, corrígelos y confírmalos, y deja que construya a partir de ellos.",
    kinds: [
      ["Pantallas", "mira cómo quedará la página."],
      ["Prompts", "lee el prompt y las salidas de ejemplo."],
      ["Textos", "lee lo que ha escrito tu IA."],
      ["Imágenes", "mira las imágenes antes de elegir una."],
    ],
    more: "También prepara borradores de elección de librerías y comparativas con la competencia.",
    closing: "El resto, déjaselo a tu agente.",
  },
  review: {
    title: "Ajusta el borrador. Luego construye a partir de él.",
    actions: [
      ["Eliminar", "Quita una opción que no quieres."],
      ["Nota", "Deja comentarios en un borrador."],
      ["Confirmar", "Guarda la versión a partir de la cual construirá tu agente."],
    ],
    export: "Exporta una imagen o un único archivo HTML para compartir. El archivo HTML se abre en el navegador; no se sube nada.",
    workflow: ["Para el método detrás de estos borradores, lee sobre ", "draft-first development", " (en inglés)."],
  },
  helpers: {
    title: "Tú decides qué lleva borrador",
    lead: "Incluye seis agentes de borradores. ¿Quieres un guion gráfico antes de que tu IA haga un vídeo? Añade .draft-first/helpers/storyboard.md con instrucciones para describir la imagen y la narración de cada escena.",
    example: "Ejemplo: un agente de guion gráfico para vídeo",
    file: ".draft-first/helpers/storyboard.md",
    description: "Un vídeo que se crea o se modifica.",
    body: "Enumera las escenas en orden, con una línea para lo que ve el espectador y otra para la narración.",
  },
  upgrade: {
    title: "¿Demasiadas tareas? Llévalas a AI4Kanban.",
    lead: "Pasa tus borradores a un tablero de AI4Kanban para planificar, revisar y ejecutar varias tareas en un solo lugar.",
    cards: [
      ["Recuerda tus preferencias", "Los agentes reutilizan tus preferencias y decisiones, así que la próxima vez explicas menos."],
      ["Tareas en paralelo", "Las tareas independientes se ejecutan a la vez; las que dependen de otras esperan sus resultados."],
      ["No se escapa ningún seguimiento", "Al terminar una tarea, los agentes proponen el trabajo pendiente como tareas de seguimiento."],
    ],
    explore: "Descubre AI4Kanban",
    download: "Descarga AI4Kanban",
  },
  faq: {
    title: "Preguntas frecuentes",
    items: [
      ["¿Dónde se guardan mis borradores?", "En .draft-first/, en la raíz del proyecto. Contiene los borradores, las notas y los archivos confirmados que usa tu agente para construir."],
      ["¿Qué agentes son compatibles?", "Cualquier agente de programación que lea skills de .claude/skills/ o .agents/skills/."],
      [
        "¿Cómo lo desinstalo?",
        "Elimina las carpetas draft-first de .claude/skills/ y .agents/skills/. Para borrar también los borradores del proyecto, haz una copia de lo que quieras conservar y elimina .draft-first/ de ese proyecto.",
      ],
    ],
  },
};

export default es;
