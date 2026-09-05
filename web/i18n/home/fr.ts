// Français — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const fr: HomeCopy = {
  meta: {
    title: "Chef de projet IA pour agents de code | AI4Kanban",
    description:
      "Transformez des idées floues en plans exécutables, confiez les tâches à vos agents de code et n'arbitrez que les décisions produit exigeant un jugement humain.",
    schema:
      "AI4Kanban est un chef de projet IA open source et local pour agents de code. Il transforme les idées floues en tâches ordonnées par dépendances, orchestre l'exécution en arrière-plan, conserve les décisions prises et ne sollicite les développeurs que pour un jugement humain ou la validation finale.",
  },

  hero: {
    title: "Livrez sans surveiller vos agents de code.",
    lead: "AI4Kanban transforme vos idées floues en travail prêt à réaliser, l'exécute avec vos agents et ne vous demande que les décisions produit.",
    ctaDownload: "Télécharger",
    ctaGithub: "Voir sur GitHub ↗",
    shots: {
      board: { label: "Board", alt: "Tableau local AI4Kanban : vue Board" },
      card: {
        label: "Card",
        alt: "Tableau local AI4Kanban : une carte et sa spécification",
      },
      frontAria: "Vue {view} (actuelle)",
      flipAria: "Passer à la vue {view}",
    },
  },

  loop: {
    title: "Moins de suivi. Plus de livraisons.",
    lead: "Confiez la planification, le suivi et la coordination à AI4Kanban. Gardez votre attention sur le produit que vous voulez créer.",
    steps: [
      {
        title: "Une idée floue devient un plan détaillé.",
        body: "Décrivez ce que vous voulez créer. AI4Kanban lit votre code et la mémoire du projet, précise les exigences et organise les tâches dans le bon ordre. Vous obtenez un plan que vos agents peuvent exécuter.",
      },
      {
        title: "Quelques choix avant de lancer le travail.",
        body: "Les questions qui demandent votre jugement arrivent avec des options et une recommandation. Choisissez la direction avant de coder, quand les changements coûtent encore peu.",
      },
      {
        title: "Faites avancer plusieurs tâches à la fois.",
        body: "Les tâches indépendantes avancent en parallèle avec vos agents, sans attendre que l’une se termine pour lancer la suivante. AI4Kanban gère les dépendances et coordonne le travail.",
      },
      {
        title: "Analysez les besoins à votre façon.",
        body: "Vous voulez comparer des options techniques ou essayer une maquette fonctionnelle avant de choisir une direction ? Utilisez les agents de spécification intégrés ou ajoutez les vôtres pour qu’ils analysent les besoins selon votre méthode.",
      },
      {
        title: "Les agents règlent les détails. Vous validez.",
        body: "La plupart des détails sont réglés à partir du code et des décisions passées. Le travail avance en arrière-plan ; les choix produit et les livraisons à valider vous parviennent dans l’application ou sur Slack.",
      },
    ],
  },

  memory: {
    title: "Vous comprend mieux au fil du projet",
    lead: "Vos préférences, vos décisions et les idées écartées alimentent le prochain plan. À mesure que la mémoire du projet s’enrichit, vos agents disposent de plus de contexte et vous avez moins à expliquer.",
    cards: [
      {
        title: "Plus besoin de vous répéter",
        body: "Les préférences et contraintes déjà établies alimentent directement la planification de la prochaine tâche.",
      },
      {
        title: "Ne plus retomber dans les mêmes impasses",
        body: "Les pistes écartées et les problèmes de conception connus ne sont plus proposés.",
      },
      {
        title: "Reprendre exactement où vous en étiez",
        body: "Avant de planifier de nouveaux travaux, il lit ce qui a déjà été livré et examine le code actuel.",
      },
    ],
    tree: {
      goal: "Objectif du projet",
      module: "Un par module",
      readme: "Fonctionnalités livrées",
      decisions: "Décisions produit",
      rejected: "Motifs de refus",
      redesign: "Enseignements de conception",
    },
  },

  iterate: {
    title: "Transformez les retours en améliorations produit",
    lead: "Les retours utilisateurs, l’analyse de la concurrence et les discussions du secteur aident à choisir la prochaine amélioration. AI4Kanban transforme ces informations en tâches adaptées à vos objectifs produit, prêtes à être confiées à vos agents.",
    inputsLabel: "Sources externes",
    inputs: [
      "Retours utilisateurs",
      "Analyse de la concurrence",
      "Études sectorielles",
      "Discussions sur Reddit",
    ],
    internalLabel: "Sources internes",
    internal: ["Feuille de route produit"],
    board: {
      columns: ["Prêt à démarrer", "Pas prêt"],
      ready: "prêt",
    },
    storage: "Données du projet",
    outputsLabel: "Résultats de l’itération",
    outputs: ["Améliorations produit", "Nouvelles versions"],
  },

  start: {
    title: "Commencez par l'application de bureau",
    lead: "Téléchargez l'application, ouvrez un projet et répondez à trois questions. Elle lit le code, écrit l'objectif du projet et la mémoire par module, puis propose les premières tâches.",
    notes: [
      "Planification autonome",
      "Local d’abord",
      "Indépendant de l’agent",
    ],
    cta: "Télécharger",
    firstOpen:
      "Les binaires ne sont pas signés : macOS bloque la première ouverture. Faites glisser l'application depuis le `.dmg`, puis passez l'avertissement. La page de téléchargement donne les étapes complètes pour macOS, Windows et Linux.",
    command:
      "L'application embarque la CLI `akb` et ajoute les skills de l'agent de code à l'ouverture d'un projet. Ni l'une ni les autres ne sont à installer séparément.",
  },
};

export default fr;
