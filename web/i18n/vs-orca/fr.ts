import type { VsOrcaCopy } from "./types";

const fr: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca : validez puis déléguez les détails",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "Comparez AI4Kanban et Orca sur le contrôle des sessions, les workflows spécialisés, les brouillons et le travail de coordination pendant l’exécution.",
    social:
      "Comparez AI4Kanban et Orca sur le contrôle des sessions, les workflows spécialisés, les brouillons et le travail de coordination pendant l’exécution.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs. Orca",
    lead: "Comparez AI4Kanban et Orca sur le contrôle des sessions, les workflows spécialisés, les brouillons et le travail de coordination pendant l’exécution.",
  },
  both: {
    title: "Ce que les deux proposent",
    items: [
      "Plusieurs agents de code",
      "Sessions en parallèle",
      "Worktrees Git isolés",
      "Relecture des diffs de code",
    ],
  },
  orca: {
    title: "Orca : une fine couche autour des agents de code",
    intro:
      "Orca ajoute une fine couche autour des agents de code : sessions en parallèle, terminaux, worktrees, édition et relecture réunis dans un seul espace de travail, sans changer l’expérience d’utilisation de ces agents.",
    introLink: "Découvrir Orca",
    introEnd: ".",
    body: [
      "Il convient à ceux qui veulent piloter chaque session d’agent et rester impliqués dans les détails d’exécution, de l’attribution des tâches à la relecture et à la fusion des modifications. Le degré d’autonomie de chaque agent reste votre choix.",
      "Son orchestration en CLI fournit des tâches, une répartition et des points d’approbation. C’est vous, ou votre agent coordinateur, qui rédigez les spécifications des tâches et définissez le processus.",
    ],
  },
  codex: {
    title: "Déjà dans l’application de bureau Codex",
    lead: "Une partie de ce qu’ajoute Orca existe déjà dans des outils de code comme l’application de bureau Codex.",
    items: [
      "Sessions en parallèle et worktrees",
      "Relecture des diffs et des PR",
      "Navigateur",
      "Pilotage mobile et SSH",
    ],
    agents:
      "Codex exécute les modèles d’OpenAI ; Orca exécute Codex, Claude Code et d’autres agents de code en ligne de commande.",
    sources: {
      worktrees: "Worktrees Codex",
      review: "Relecture de code",
      browser: "Navigateur",
      remote: "Connexions à distance",
      orcaFeatures: "Fonctionnalités d’Orca",
    },
  },
  compare: {
    yes: "Inclus",
    no: "Non inclus",
    rows: {
      planning:
        "Les agents planifient chaque tâche avec vous et ne vous demandent que les décisions clés",
      team: "Agents spécialisés et workflows prêts à l’emploi",
      drafts:
        "Relecture de brouillons avant exécution : images, HTML/TSX, storyboards",
      memory: "Mémoire de vos préférences, partagée entre les agents",
      tools: "Navigateur intégré, SSH et pilotage mobile",
    },
  },
  ours: {
    title: "AI4Kanban : validez les brouillons, déléguez les détails",
    lead: "Les spécialistes préparent les brouillons d'interface, de textes ou de script à valider. Une fois ces parties approuvées, le workflow mène la tâche à terme. Code, articles et vidéos sont intégrés ; les tâches indépendantes peuvent avancer en parallèle.",
    drafts: {
      title: "Relire les brouillons clés avant l’exécution",
      body: "Les parties qui demandent votre jugement font d'abord l'objet d'un brouillon. Relisez-le et modifiez-le sur la carte ; les agents poursuivent à partir de la version validée et règlent les détails dans le périmètre convenu. Corriger les points clés à ce stade limite les reprises ultérieures.",
      art: ["Brouillon", "Approuver", "Exécution"],
    },
    memory: {
      title: "Reporter les décisions sur la tâche suivante",
      body: "Chaque agent retient les préférences et décisions utiles à son travail et peut partager le contexte du projet avec les autres agents. Les tâches suivantes partent de ce qui a déjà été convenu. Après un travail principal, les agents proposent des suites que vous pouvez accepter, modifier ou refuser.",
      art: {
        agents: ["Design UI", "Rédaction"],
        shared: "Partagée · projet",
      },
    },
    custom: "Vous pouvez aussi créer vos propres agents et workflows.",
    tipLabel: "Astuce",
    tip: "Tous les workflows intégrés et personnalisés sont gratuits.",
  },
  decision: {
    title: "Comment voulez-vous travailler ?",
    ifYou: "si vous voulez",
    theirs: {
      name: "Choisir Orca",
      points: [
        "Gérer vous-même chaque session d’agent de code",
        "Rester au plus près des détails d’exécution",
      ],
      onlyLabel: "Uniquement dans Orca",
      only: [
        "Navigateur",
        "Travail à distance via SSH",
        "Pilotage mobile",
        "Un prompt envoyé à plusieurs agents",
      ],
      link: "Voir les fonctionnalités d’Orca",
    },
    ours: {
      name: "Choisir AI4Kanban",
      points: [
        "Des agents et workflows prêts pour le code, les articles et les vidéos",
        "Corriger les détails clés sur un brouillon avant la réalisation",
        "Réutiliser vos préférences pour limiter les corrections des tâches suivantes",
      ],
      goalLabel: "L’objectif",
      goal: "Faites avancer développement et marketing en limitant les reprises",
    },
  },
  start: {
    title: "Commencer avec AI4Kanban",
    body: "Téléchargez AI4Kanban. Planifiez avec précision, livrez rapidement.",
    cta: "Télécharger AI4Kanban",
  },
};

export default fr;
