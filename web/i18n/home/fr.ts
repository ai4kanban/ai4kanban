// Français — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const fr: HomeCopy = {
  meta: {
    title: "Espace de travail avec agents pour indie hackers | AI4Kanban",
    description:
      "Des agents spécialisés préparent les brouillons essentiels au développement et au marketing. Vous les validez, ils terminent le travail : moins de temps à vérifier et corriger le résultat.",
    socialTitle: "Voyez le brouillon. Laissez les agents faire le reste.",
    social:
      "Des agents spécialisés pour le développement et le marketing. Validez les brouillons clés, puis confiez-leur la suite, avec moins de vérifications et de corrections après coup.",
    schema:
      "AI4Kanban est un espace de travail local et open source pour indie hackers. Ses agents spécialisés partagent le contexte du projet dans 6 workflows de développement et de contenu. Ils préparent les brouillons des parties qui demandent votre jugement, puis terminent le travail à partir de ce que vous validez, afin de réduire le temps passé à vérifier et corriger le résultat. Les tâches indépendantes avancent en parallèle ; préférences et décisions sont conservées et les agents proposent des suites utiles. Utilisez vos outils d'IA et vos abonnements.",
  },

  hero: {
    eyebrow: "Un espace de travail avec agents pour les indie hackers",
    title: "Voyez le brouillon.\nLaissez les agents faire le reste.",
    lead:
      "Du développement au marketing, AI4Kanban vous prépare des brouillons des parties qui demandent votre jugement. Relisez, ajustez, et laissez les agents prendre le relais, sans avoir à gérer chaque détail.",
    ctaDownload: "Télécharger",
    ctaGithub: "Voir sur GitHub ↗",
    image:
      "Enregistrement du tableau de démonstration d'AI4Kanban : planifier les tâches, relire les brouillons d'une carte, puis confier le travail aux agents.",
  },

  workflows: {
    title: "Développez le produit. Faites avancer le marketing.",
    lead:
      "Avec 6 workflows intégrés, des agents spécialisés partagent le contexte de votre projet et prennent en charge le développement et le marketing, sans vous demander de constituer une équipe. Ils préparent les brouillons des seules parties clés qui demandent votre jugement, puis terminent le travail à partir de ce que vous validez, pour réduire les vérifications et les corrections après coup.",
    items: [
      {
        label: "Développement logiciel",
        image: "Brouillon de développement : maquette d’un écran clé.",
      },
      { label: "Article de blog", image: "Brouillon d’article de blog : l’article et ses images." },
      {
        label: "Vidéo produit",
        image: "Brouillon de vidéo produit : scènes et voix off dans un storyboard.",
      },
      {
        label: "Présentation",
        image:
          "Brouillon de présentation : aperçu du contenu et de la mise en page des diapositives.",
      },
      {
        label: "Publication en carrousel",
        image: "Brouillon de carrousel : textes des pages et plan du contenu.",
      },
      {
        label: "Clonage vidéo (vidéos créées par du code)",
        image:
          "Brouillons de réplique vidéo : découpage de la source et storyboard de la réplique.",
      },
    ],
    links: {
      demo: "Essayer la démo",
      coding: "Découvrir le workflow de développement",
      all: "Voir tous les agents et workflows",
    },
  },

  parallel: {
    title: "Faites avancer les tâches indépendantes en parallèle",
    body: [
      "Réunissez le développement produit et le marketing sur un même tableau. Les tâches indépendantes peuvent avancer en parallèle ; celles qui dépendent d'autres tâches suivent leur ordre.",
      "Chaque carte conserve ses brouillons, décisions et progrès. Revenez-y lorsqu'une décision vous revient et confiez l'exécution aux agents, sans multiplier les relais entre conversations.",
    ],
    shots: {
      board: { label: "Board", alt: "Le tableau AI4Kanban : vue Board" },
      card: { label: "Card", alt: "Le tableau AI4Kanban : les détails et exigences d'une carte" },
      frontAria: "Vue {view} (actuelle)",
      flipAria: "Passer à la vue {view}",
    },
  },

  agents: {
    title: "Reprenez là où vous vous êtes mis d'accord",
    body: [
      "Vos préférences et décisions servent aux tâches suivantes. Chaque agent retient ce qui compte pour son travail et peut partager ce contexte avec les autres agents.",
      "Le brouillon suivant part de ces acquis communs, pour que vous consacriez votre temps à ce qui doit changer cette fois-ci.",
    ],
    image:
      "Vous donnez une consigne une fois ; l'agent la retient et chaque brouillon suivant la respecte.",
  },

  followUps: {
    title: "Terminez un travail. Repérez la suite utile.",
    body: [
      "Une fois un travail principal terminé, les agents proposent des suites pour repérer les manques et les prochaines étapes utiles.",
      "Les suggestions reviennent sur votre tableau. Acceptez-les, modifiez-les ou refusez-les avant de décider quoi entreprendre.",
    ],
    image: "L'agent QA repère un oubli et vous remet un suivi à accepter ou à ignorer.",
  },

  tools: {
    title: "Gardez les outils d'IA que vous utilisez déjà",
    body:
      "Connectez Claude Code, Codex et 6 autres outils, qui tournent sur votre machine avec vos propres abonnements. Choisissez l'outil et le modèle de chaque agent. AI4Kanban ne facture aucun supplément pour les tokens.",
  },

  start: {
    title: "Commencez par votre première tâche",
    lead:
      "Téléchargez l’application de bureau, ouvrez un projet et décrivez ce que vous voulez faire. Validez les brouillons qui demandent votre jugement, puis confiez la suite aux agents.",
    cta: "Télécharger",
    firstOpen:
      "Les versions ne sont pas signées, donc macOS bloque la première ouverture : glissez l'app depuis le `.dmg`, puis choisissez de continuer dans l'avertissement. La page de téléchargement détaille les étapes pour macOS, Windows et Linux.",
    command:
      "Vous préférez la ligne de commande ? Lancez `npx ai4kanban@latest install` dans votre projet.",
  },
};

export default fr;
