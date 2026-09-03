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
    eyebrow: "Chef de projet IA pour agents de code",
    title: "Des idées floues jusqu'au logiciel livré, sans surveiller vos agents.",
    lead: "AI4Kanban planifie le travail, le fait exécuter par vos agents de code et ne vous demande que les décisions produit et la validation.",
    ctaDownload: "Télécharger",
    ctaGithub: "Voir sur GitHub ↗",
    flow: [
      "Votre idée brute",
      "Un plan ordonné par dépendances",
      "L'arbitrage que vous seul pouvez rendre",
      "Les agents qui tournent en arrière-plan",
    ],
    flowAlt:
      "Une idée brute devient un plan ordonné par dépendances, une décision produit revient à une personne, et le reste du travail tourne en arrière-plan sur vos agents de code.",
  },

  why: {
    title: "Coder est devenu rapide. Décider du produit est le goulot d'étranglement.",
    body: "Les agents construisent fidèlement ce qui est clair. Le flou, lui, produit des dérives, des reprises et une file de longues conversations que personne n'a le temps de lire. AI4Kanban se place au-dessus de vos agents de code : il fixe ce qu'il faut construire avant que rien ne démarre, et ne renvoie que ce qu'une personne doit trancher.",
  },

  steps: {
    title: "D'une idée brute à un changement intégré",
    items: [
      {
        title: "Partez d'une idée brute",
        body: "Décrivez le résultat en une phrase. AI4Kanban lit votre code, découpe l'objectif en tâches délimitées et les ordonne par dépendances, pour que le travail indépendant avance en parallèle.",
      },
      {
        title: "Ne validez que ce qui vous revient",
        body: "Les détails de routine sont tranchés à partir du code et de la mémoire du projet. Le goût, la direction commerciale, le risque et le coût reviennent sous forme d'une question courte assortie d'une réponse recommandée. Chaque réponse rejoint la mémoire du projet : le plan suivant vous en demande moins.",
      },
      {
        title: "Laissez tourner les agents",
        body: "Les tâches prêtes s'exécutent en arrière-plan, chacune dans son propre worktree Git, et les conflits passent par une résolution dédiée avant toute intégration. Vous êtes prévenu quand une livraison attend votre validation.",
      },
    ],
  },

  trust: {
    title: "Apprend votre projet, reste dans votre dépôt",
    lead: "Les décisions produit, les pistes écartées et les leçons de conception survivent à la conversation qui les a produites : plus le projet avance, plus l'autonomie grandit et moins la relecture pèse.",
    items: [
      {
        title: "Apache-2.0",
        body: "Open source. Libre d'utilisation, de modification et de redistribution.",
      },
      {
        title: "Local d'abord",
        body: "Le tableau et sa mémoire sont du Markdown sous `docs/kanban/`, versionné dans Git.",
      },
      {
        title: "Votre agent de code",
        body: "Claude Code, Codex, Cursor, OpenCode, Kimi Code, DeepSeek Harness et ZCode.",
      },
    ],
  },

  start: {
    title: "Commencez par l'application de bureau",
    lead: "Téléchargez l'application, ouvrez un projet et répondez à trois questions. Elle lit le code, écrit l'objectif du projet et la mémoire par module, puis propose les premières tâches.",
    cta: "Télécharger",
    firstOpen:
      "Les binaires ne sont pas signés : macOS bloque la première ouverture. Faites glisser l'application depuis le `.dmg`, puis passez l'avertissement. La page de téléchargement donne les étapes complètes pour macOS, Windows et Linux.",
    command:
      "L'application embarque la CLI `akb` et ajoute les skills de l'agent de code à l'ouverture d'un projet. Ni l'une ni les autres ne sont à installer séparément.",
  },
};

export default fr;
