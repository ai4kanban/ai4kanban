// Français — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const fr: HomeCopy = {
  meta: {
    title: "Espace de travail avec agents pour indie hackers | AI4Kanban",
    description:
      "Du développement au marketing, AI4Kanban vous prépare des brouillons des parties qui demandent votre jugement. Relisez-les, puis laissez les agents gérer les détails de l’exécution.",
    socialTitle: "Inutile de gérer chaque détail.",
    social:
      "Relisez les parties qui demandent votre jugement. Laissez les agents s’occuper de l’exécution, du développement au marketing.",
    schema:
      "AI4Kanban est un espace de travail avec agents pour indie hackers. Six workflows intégrés repèrent les décisions qui demandent un jugement humain et préparent des brouillons à valider avant que les agents n’exécutent. Vous pouvez créer vos propres agents et workflows pour définir ce que vous relisez et ce que les agents prennent en charge.",
  },

  hero: {
    eyebrow: "Espace de travail avec agents pour indie hackers",
    title: "Inutile de gérer\nchaque détail.",
    lead:
      "Du développement au marketing, AI4Kanban vous prépare des brouillons des parties qui demandent votre jugement. Relisez, ajustez, et laissez les agents prendre le relais.",
    ctaDownload: "Télécharger",
    ctaGithub: "Voir sur GitHub ↗",
    image:
      "Enregistrement d’AI4Kanban : planifier une tâche, relire ses brouillons, puis confier le plan validé aux agents.",
  },

  handoff: {
    title: "Vous validez l’essentiel.\nLes agents font le reste.",
    body: [
      "AI4Kanban vous aide à clarifier votre idée. Chaque workflow vous prépare des brouillons des parties qui demandent votre avis. Relisez-les, ajustez-les, puis laissez les agents terminer le travail. Les tâches indépendantes avancent en même temps.",
    ],
    scene: {
      label:
        "Vous confiez une idée à AI4Kanban, qui la transforme en brouillons à relire. Une fois validés, AI4Kanban transmet les brouillons et leur contexte aux agents, qui prennent le relais.",
      idea: [
        "Lancer une offre Pro",
        "Ajouter le mode sombre",
        "Vidéo de 30 s de la v2",
        "Billet sur la v2",
        "Carrousel de 5 astuces",
      ],
      you: "Vous",
      board: "AI4Kanban",
      agent: "Agent",
      review: "Vous validez",
      build: "Les agents prennent le relais",
    },
  },

  workflows: {
    title: "Le bon workflow pour chaque travail",
    lead:
      "Commencez avec six workflows intégrés pour le développement et le contenu. Chacun précise ce que vous relisez avant que les agents prennent le relais. Vous pouvez aussi créer vos propres agents et workflows.",
    items: [
      {
        label: "Développement logiciel",
        body: "Relisez l’interface et les textes qui demandent votre avis. Les agents mettent en œuvre le plan validé.",
        image: "Brouillon de développement : maquette d’un écran clé.",
      },
      {
        label: "Clonage vidéo (vidéos créées par du code)",
        body: "Relisez l’analyse de la vidéo source et le storyboard de la recréation. Les agents recréent la vidéo et en font un modèle réutilisable.",
        image: "Brouillons de clonage vidéo : l’analyse de la source et le storyboard de la recréation.",
      },
      {
        label: "Vidéo produit",
        body: "Relisez le script et le storyboard. Les agents produisent la vidéo et sa couverture.",
        image: "Brouillon de vidéo produit : scènes et voix off dans un storyboard.",
      },
      {
        label: "Présentation",
        body: "Relisez le contenu et la mise en page des diapositives. Les agents produisent un fichier PowerPoint dont chaque diapositive est une image.",
        image: "Brouillon de présentation : contenu et mise en page de chaque diapositive.",
      },
      {
        label: "Publication pour les réseaux sociaux",
        body: "Relisez le texte des pages et le plan. Les agents créent les images et les légendes pour chaque plateforme.",
        image: "Brouillon de carrousel : le texte de chaque page et le plan du contenu.",
      },
      {
        label: "Article de blog",
        body: "Relisez le plan, le texte et les images. Les agents préparent l’article complet.",
        image: "Brouillon d’article de blog : l’article et ses images.",
      },
    ],
    links: { demo: "Essayer la démo", all: "Voir tous les agents et workflows" },
  },

  tools: {
    title: "Gardez les outils d'IA que vous utilisez déjà",
    body:
      "Connectez Claude Code et 7 autres outils, sur votre machine et avec vos propres abonnements. Choisissez un outil et un modèle pour chaque agent. AI4Kanban ne facture aucun frais de tokens supplémentaire.",
  },

  start: {
    title: "Apportez votre prochaine idée",
    lead: "Téléchargez l’application de bureau, ouvrez votre projet et clarifiez ce que vous voulez faire.",
    cta: "Télécharger",
    firstOpen:
      "L’application macOS n’est pas signée. Si macOS la bloque à la première ouverture, suivez les étapes de la page de téléchargement.",
  },
};

export default fr;
