// Français — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const fr: HomeCopy = {
  meta: {
    title:
      "AI4Kanban — Le tableau projet qui planifie en autonomie et apprend de chaque décision",
    description:
      "Un tableau projet piloté par un agent qui transforme les objectifs en exécution continue : il définit les tâches, clarifie les exigences, fixe les priorités et conserve chaque décision produit dans la mémoire du projet.",
  },

  hero: {
    title: "Un tableau projet qui planifie en autonomie.",
    lead: "Il réunit vos objectifs, votre code et la mémoire du projet pour piloter le travail, de la planification à la livraison. Vous arbitrez les choix produit et donnez la validation finale.",
    ctaDownload: "Télécharger l’application",
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

  compare: {
    title: "Du suivi des tâches à la planification autonome",
    lead: "Les tableaux classiques se contentent d’enregistrer et de suivre les tâches, toutes saisies à la main. AI4Kanban s’appuie sur vos objectifs à long terme et sur les décisions déjà conservées dans la mémoire du projet pour planifier le travail et le faire avancer en autonomie.",
    columns: { classic: "Tableau classique", kanban: "AI4Kanban" },
    rows: [
      {
        dimension: "Entrée",
        classic: "Tâches détaillées rédigées à la main",
        kanban: "Objectifs à long terme et idées à préciser",
      },
      {
        dimension: "Rôle principal",
        classic: "Enregistrer et suivre les tâches",
        kanban: "Planifier et faire avancer le travail en autonomie",
      },
      {
        dimension: "Votre rôle",
        classic: "Tenir le tableau à jour manuellement",
        kanban: "Arbitrer et valider le résultat",
      },
    ],
  },

  loop: {
    title: "Faire avancer le travail",
    lead: "Donnez-lui un objectif ou une idée encore floue. L’agent lit votre code et la mémoire du projet, détermine la prochaine étape, clarifie les exigences, découpe le travail, ordonne les dépendances et les priorités, puis passe à l’exécution.",
    steps: [
      {
        title: "Définir la prochaine tâche",
        body: "S’appuyer sur l’objectif, le code et la mémoire du module pour déterminer la suite.",
      },
      {
        title: "Clarifier les exigences",
        body: "L’agent tranche tout ce que le code et la mémoire du projet permettent d’établir, puis ne vous soumet que les arbitrages produit qui exigent votre jugement.",
      },
      {
        title: "Exécuter",
        body: "Dès que les exigences sont assez claires pour commencer, l’agent suit le périmètre et les étapes définis dans la tâche.",
      },
      {
        title: "Consigner les décisions",
        body: "Inscrire les décisions produit dans la mémoire du projet afin que le prochain cycle de planification et de développement puisse s’appuyer dessus.",
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
    otherAgents: "Autres agents",
    storage: "Données du projet",
    outputsLabel: "Résultats de l’itération",
    outputs: ["Améliorations produit", "Nouvelles versions"],
  },

  start: {
    title: "Commencez par l’application",
    lead: "Téléchargez-la, ouvrez-la, pointez-la vers un projet. Rien à installer au préalable : ni Node, ni npx, ni terminal. Elle vous pose les trois questions auxquelles vous seul pouvez répondre, une par écran, puis lit votre base de code, établit l’objectif du projet et la mémoire de chaque module, et crée les premières tâches.",
    notes: [
      "Planification autonome",
      "Local d’abord",
      "Indépendant de l’agent",
    ],
    cta: "Télécharger l’application",
    firstOpen:
      "Aucune version n’est encore signée, donc macOS bloque la première ouverture : glissez l’application depuis le `.dmg`, puis passez l’avertissement indiquant qu’elle ne peut pas être vérifiée. La page de téléchargement détaille chaque étape, ainsi que Windows et Linux.",
    terminal: {
      title: "Ou configurez-le depuis un terminal",
      body: "Une commande, à la racine de votre projet. Elle crée le tableau dans `docs/kanban/` et n’écrit rien d’autre.",
      promptNote:
        "Vous préférez que votre agent de code s’en charge entièrement ? Donnez-lui le prompt d’installation : il lit le dépôt, choisit les pistes, exécute cette commande et termine le reste de la configuration.",
      promptLink: "Voir le prompt d’installation",
    },
  },
};

export default fr;
