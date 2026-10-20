// Español — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const es: HomeCopy = {
  meta: {
    title: "Espacio de trabajo con agentes para desarrolladores independientes | AI4Kanban",
    description:
      "Del desarrollo al marketing, AI4Kanban te prepara borradores de las partes que necesitan tu criterio. Revísalos y deja los detalles de la ejecución a los agentes.",
    socialTitle: "No tienes que supervisar cada detalle.",
    social:
      "Revisa las partes que necesitan tu criterio. Deja la ejecución a los agentes, del desarrollo al marketing.",
    schema:
      "AI4Kanban es un espacio de trabajo con agentes para desarrolladores independientes. Seis flujos integrados identifican las decisiones que requieren criterio humano y preparan borradores para aprobar antes de que los agentes ejecuten. Puedes crear tus propios agentes y flujos que definan qué revisas tú y qué hacen los agentes.",
  },

  hero: {
    eyebrow: "Espacio de trabajo con agentes para desarrolladores independientes",
    title: "No tienes que supervisar\ncada detalle.",
    lead:
      "Del desarrollo al marketing, AI4Kanban te prepara borradores de las partes que necesitan tu criterio. Revisa, ajusta y deja que los agentes sigan desde ahí.",
    ctaDownload: "Descargar",
    ctaGithub: "Ver en GitHub ↗",
    image:
      "Grabación de AI4Kanban: planificar una tarea, revisar sus borradores y pasar el plan aprobado a los agentes.",
  },

  handoff: {
    title: "Tú revisas las partes clave.\nLos agentes hacen el resto.",
    body: [
      "AI4Kanban te ayuda a aclarar tu idea. Cada flujo te prepara borradores de las partes que necesitan tu opinión. Revísalos y ajústalos, y deja que los agentes completen el trabajo. Las tareas que no dependen entre sí avanzan a la vez.",
    ],
    scene: {
      label:
        "Le das una idea a AI4Kanban, que la convierte en borradores para que los revises. Cuando los apruebas, AI4Kanban pasa los borradores y su contexto a los agentes, que se encargan del trabajo.",
      idea: [
        "Lanzar un plan Pro",
        "Añadir modo oscuro",
        "Vídeo de 30 s de la v2",
        "Blog sobre la v2",
        "Carrusel de 5 consejos",
      ],
      you: "Tú",
      board: "AI4Kanban",
      agent: "Agente",
      review: "Tú revisas",
      build: "Los agentes siguen",
    },
  },

  workflows: {
    title: "El flujo adecuado para cada trabajo",
    lead:
      "Empieza con seis flujos integrados para desarrollo y contenido. Cada uno deja claro qué revisas antes de que los agentes se encarguen. También puedes crear tus propios agentes y flujos.",
    items: [
      {
        label: "Desarrollo de software",
        body: "Revisa la interfaz y los textos que necesitan tu opinión. Los agentes implementan el plan aprobado.",
        image: "Borrador de desarrollo: prototipo de una pantalla clave.",
      },
      {
        label: "Clonación de vídeo (vídeos generados con código)",
        body: "Revisa el análisis del vídeo original y el guion gráfico de la recreación. Los agentes recrean el vídeo y crean una plantilla reutilizable.",
        image: "Borradores de clonación de vídeo: el análisis del original y el guion gráfico de la recreación.",
      },
      {
        label: "Vídeo de producto",
        body: "Revisa el guion y el guion gráfico. Los agentes producen el vídeo y la portada.",
        image: "Borrador de vídeo de producto: escenas y voz en off en un guion gráfico.",
      },
      {
        label: "Presentación",
        body: "Revisa el contenido y el diseño de cada diapositiva. Los agentes crean un archivo PowerPoint con cada diapositiva como imagen.",
        image: "Borrador de presentación: contenido y diseño de cada diapositiva.",
      },
      {
        label: "Publicación en carrusel",
        body: "Revisa el texto de cada página y el esquema. Los agentes crean las imágenes y los textos para cada plataforma.",
        image: "Borrador de carrusel: el texto de cada página y el esquema del contenido.",
      },
      {
        label: "Artículo de blog",
        body: "Revisa el esquema, el texto y las imágenes. Los agentes preparan el artículo completo.",
        image: "Borrador de blog: el artículo y sus imágenes.",
      },
    ],
    links: { demo: "Probar la demo", all: "Ver todos los agentes y flujos" },
  },

  tools: {
    title: "Sigue usando las herramientas de IA que ya conoces",
    body:
      "Conecta Claude Code y otras 7 herramientas, en tu equipo y con tus propias suscripciones. Elige herramienta y modelo para cada agente. AI4Kanban no cobra tarifas adicionales por tokens.",
  },

  start: {
    title: "Trae tu próxima idea",
    lead: "Descarga la aplicación de escritorio, abre tu proyecto y aclara lo que quieres hacer.",
    cta: "Descargar",
    firstOpen:
      "La aplicación para macOS no está firmada. Si macOS la bloquea al abrirla por primera vez, sigue los pasos de la página de descarga.",
  },
};

export default es;
