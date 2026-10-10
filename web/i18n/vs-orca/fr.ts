import type { VsOrcaCopy } from "./types";

const fr: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca : déléguez les détails, gardez la main",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "Vous faites déjà tourner des agents de code en parallèle ? Comparez Orca et AI4Kanban : gardez la main sur les détails d’exécution, ou laissez les agents les conduire pendant que vous fixez le cap.",
    social:
      "Orca ajoute une fine couche autour des agents de code. AI4Kanban vous donne une équipe prête à conduire les détails d’exécution, pendant que vous gardez la main sur le cap et les décisions clés.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs. Orca",
    lead: "Vous faites déjà tourner plusieurs agents de code en parallèle ? Orca réunit ces sessions dans un seul espace de travail. AI4Kanban va plus loin : les agents conduisent les détails d’exécution, pendant que vous fixez le cap et prenez les décisions clés.",
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
    title: "AI4Kanban : vous fixez le cap, les agents gèrent les détails",
    lead: "AI4Kanban s’adresse à ceux qui acceptent de laisser les agents conduire les détails d’exécution tout en gardant la main sur le cap et les décisions clés. Agents spécialisés, workflows et mémoire sont prêts à l’emploi : inutile de concevoir les rôles des agents ou d’ajuster leurs prompts vous-même. Vous participez à la planification et relisez les brouillons clés ; les agents règlent les détails et mènent le travail à son terme.",
    drafts: {
      title: "Relire les brouillons clés avant l’exécution",
      body: "Vous craignez que l’IA prenne trop de libertés avec une interface, un prompt ou un texte ? Relisez un brouillon avant d’approuver l’exécution. Les brouillons peuvent être des images, des schémas, du HTML/TSX, des diffs ou des storyboards. La relecture des brouillons a lieu avant l’implémentation, pour valider la direction ; la relecture du code livré se fait comme d’habitude.",
      art: ["Brouillon", "Approuver", "Exécution"],
    },
    memory: {
      title: "Reporter les décisions sur la tâche suivante",
      body: "Chaque agent a une recette de mémoire conçue pour son métier, et apprend vos préférences et décisions pour ce type de tâche. Les agents peuvent partager leur mémoire. Une fois un travail principal terminé, ils proposent des suites pour combler les manques et repérer les oublis.",
      art: {
        agents: ["Design UI", "Rédaction"],
        shared: "Partagée · projet",
      },
    },
    custom: "Vous pouvez aussi créer vos propres agents et workflows.",
    tipLabel: "Astuce",
    tip: "Le workflow de développement logiciel est gratuit. Les workflows de blog, de carrousel pour réseaux sociaux, de présentation et de vidéo produit nécessitent Pro.",
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
        "Fixer le cap et prendre les décisions clés",
        "Relire les brouillons importants",
        "Laisser les agents conduire les détails d’exécution",
      ],
      goalLabel: "L’objectif",
      goal: "Encore 10× plus d’efficacité, au-delà du code en parallèle",
    },
  },
  start: {
    title: "Commencer avec AI4Kanban",
    body: "Téléchargez AI4Kanban. Planifiez avec précision, livrez rapidement.",
    cta: "Télécharger AI4Kanban",
  },
};

export default fr;
