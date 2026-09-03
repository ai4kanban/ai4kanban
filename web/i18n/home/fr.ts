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
    title: "Faire avancer le travail",
    lead: "Donnez-lui un objectif ou une idée encore floue. L’agent lit votre code et la mémoire du projet, détermine la prochaine étape, clarifie les exigences, découpe le travail, ordonne les dépendances et les priorités, puis passe à l’exécution.",
    steps: [
      {
        title: "Définir les tâches et leurs dépendances",
        body: "L’agent découpe les grands objectifs en cartes bien délimitées et décide automatiquement lesquelles avancent en parallèle et lesquelles doivent attendre, afin que chaque tâche tienne dans son propre contexte.",
      },
      {
        title: "Clarifier les exigences",
        body: "L’agent transforme des exigences floues en plan réalisable. Il répond à la plupart des questions à partir du code et de la mémoire du projet, et réserve au jugement humain les choix de goût, d’orientation commerciale, de risque et de coût.",
      },
      {
        title: "Exécuter",
        body: "Vous pouvez coordonner plusieurs agents pour exécuter en parallèle les tâches prêtes. Chaque livraison utilise son propre Git worktree afin d’isoler les modifications, et les conflits déclenchent une phase de résolution dédiée avant l’intégration.",
      },
      {
        title: "Trancher les décisions clés avant l’implémentation",
        body: "Créez vos propres Spec Skills ou utilisez celles qui sont intégrées : une skill de sélection technologique compare les options techniques, tandis qu’une skill de conception d’interface propose plusieurs maquettes fonctionnelles.",
      },
      {
        title: "Ne demander une validation que lorsque nécessaire",
        body: "AI4Kanban fait avancer le travail en arrière-plan et ne vous sollicite que pour une décision produit ou la validation d’une livraison. Comme un chef de projet, il réduit au minimum l’attention qu’il vous demande.",
      },
    ],
  },

  memory: {
    title: "Apprend au fil du projet",
    lead: "Les conversations se terminent. Les décisions produit restent. AI4Kanban conserve les objectifs du projet et tient, module par module, la liste des fonctionnalités livrées, des décisions produit, des raisons qui ont motivé les refus et des enseignements de conception. Il réutilise ce contexte pour planifier et clarifier les nouveaux travaux.",
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
    title: "Piloter l’itération continue du produit",
    lead: "Transformer les signaux externes en exigences qui font progresser le produit et chaque nouvelle version.",
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
