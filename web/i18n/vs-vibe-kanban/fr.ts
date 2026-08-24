// Français — the Vibe Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsVibeCopy } from "./types";

const fr: VsVibeCopy = {
  meta: {
    title:
      "AI4Kanban vs. Vibe Kanban — planification ou exécution multi-agents ?",
    socialTitle: "AI4Kanban vs. Vibe Kanban",
    description:
      "Bloop a fermé en avril 2026, mais Vibe Kanban continue comme projet open source maintenu par la communauté. Comparaison de son espace multi-agents avec le processus de planification en fichiers d'AI4Kanban.",
    social:
      "AI4Kanban et Vibe Kanban répondent à des besoins distincts : planifier le travail dans le dépôt ou exécuter et relire plusieurs agents de code.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nVibe Kanban",
    lead: "Vibe Kanban exécute plusieurs agents de code en parallèle et centralise la relecture de leurs résultats. AI4Kanban aide un agent à transformer des idées en tâches bien définies, dans des fichiers Markdown conservés avec le dépôt. Les deux proposent un tableau, mais interviennent à des étapes différentes du développement.",
    ours: {
      name: "AI4Kanban",
      body: "Un processus en fichiers pour planifier et préciser le travail avec un agent.",
    },
    theirs: {
      name: "Vibe Kanban",
      body: "Une application locale pour exécuter et relire plusieurs agents.",
    },
    oursDiagramAlt:
      "Une carte traverse trois colonnes en se précisant à chaque fois, jusqu’à dire ce que « terminé » veut dire ; n’importe quel agent de code peut alors la prendre.",
    theirsDiagramAlt:
      "Une tâche déjà définie est confiée à plusieurs agents en même temps, et plusieurs versions du même travail reviennent pour être comparées.",
    oursDiagramTop: "précisez le travail avant de l’exécuter",
    oursDiagramBottom:
      "ensuite, n’importe quel agent de code s’en charge",
    theirsDiagramTop: "une tâche, plusieurs agents en même temps",
    theirsDiagramBottom: "comparez les résultats et gardez le meilleur",
  },
  summary: {
    heading: {
      eyebrow: "En bref",
      title: "Bloop a fermé. Vibe Kanban continue.",
    },
    lead: "Bloop, l'entreprise à l'origine de Vibe Kanban, a fermé en avril 2026. Les abonnements payants ont pris fin, les services distants ont été retirés et le produit est passé à un fonctionnement entièrement local. Vibe Kanban reste disponible sous licence Apache-2.0 et sa maintenance est désormais assurée par la communauté.",
    panel:
      "Choisissez AI4Kanban si vous voulez le **tableau de planification** sans base de données ni application à laisser tourner. Choisissez Vibe Kanban si vous devez **exécuter plusieurs agents en parallèle** et relire leurs résultats dans une même interface. AI4Kanban ne remplace pas les fonctions d'orchestration de Vibe Kanban.",
  },
  comparison: {
    heading: { eyebrow: "Face à face", title: "AI4Kanban vs. Vibe Kanban" },
    lead: "Un {check} désigne l'option la plus adaptée à un besoin précis. Un **tiret** indique un choix de conception plutôt qu'un avantage net. AI4Kanban privilégie la **planification et la portabilité** ; Vibe Kanban, l'**exécution parallèle et la relecture intégrée**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Vibe Kanban",
    rows: {
      whatFor: {
        dimension: "Fonction principale",
        kanban:
          "Définir, préciser et organiser les tâches avec un agent dans le dépôt.",
        vibe: "Exécuter plusieurs agents de code en parallèle et relire leurs résultats.",
      },
      orchestration: {
        dimension: "Orchestration multi-agents",
        kanban: "Chaque livraison est construite sur sa propre branche, dans son propre worktree git : plusieurs avancent en parallèle sans toucher à votre copie de travail.",
        vibe: "Une fonction centrale, avec chaque agent isolé dans son propre worktree git.",
      },
      review: {
        dimension: "Relecture de la sortie de l'agent",
        kanban: "Assurée par l'agent, l'environnement de développement ou les outils de revue.",
        vibe: "Intégrée, avec diffs en ligne, aperçus en direct et workflows de pull request.",
      },
      planning: {
        dimension: "Planification et définition",
        kanban:
          "Un processus guidé transforme une idée initiale en tâche prête à être exécutée.",
        vibe: "Axé sur la mise en file et le suivi des exécutions, pas sur la définition du besoin.",
      },
      onDisk: {
        dimension: "Stockage",
        kanban: "Du Markdown stocké et versionné avec le dépôt.",
        vibe: "Une base SQLite locale dans un répertoire de configuration.",
      },
      runsAs: {
        dimension: "Exécution",
        kanban: "Aucun service ni application : le tableau se compose de fichiers.",
        vibe: "Une application locale avec un backend Rust et une interface web.",
      },
      setup: {
        dimension: "Mise en place",
        kanban: "Un prompt installe un fichier de skill et un petit script auxiliaire.",
        vibe: "Lancez `npx vibe-kanban`, puis installez et authentifiez chaque CLI d'agent.",
      },
      whichAgents: {
        dimension: "Compatibilité avec les agents",
        kanban:
          "Fonctionne avec tout agent capable de lire et d'écrire les fichiers du dépôt.",
        vibe: "Prend en charge des CLI intégrées comme Claude Code, Codex, Gemini et d'autres.",
      },
      lockIn: {
        dimension: "Portabilité",
        kanban: "Le tableau Markdown voyage avec le dépôt, sans étape d'export.",
        vibe: "Auto-hébergeable sous Apache-2.0, avec export des données.",
      },
      maintenance: {
        dimension: "Maintenance",
        kanban: "Activement entretenu.",
        vibe: "Assurée par la communauté depuis la fermeture de Bloop en avril 2026.",
      },
    },
  },
  purpose: {
    heading: {
      eyebrow: "La vraie différence",
      title: "Planifier le travail ou exécuter les agents",
    },
    lead: "Les deux produits interviennent à des étapes différentes. AI4Kanban aide à décider **quoi construire** et à préparer la tâche. Vibe Kanban sert à **exécuter ce travail avec plusieurs agents** et à relire les résultats.",
    ours: {
      name: "AI4Kanban — planifier et préciser",
      is: "L'agent lit et met à jour un tableau Markdown dans le dépôt. Un processus de définition transforme l'idée initiale en tâche précise et révisable, que vous validez avant le début de l'implémentation.",
      isnt: "Il n'affiche pas les diffs et ne crée pas de pull requests. Ces fonctions restent à la charge de l'agent ou de l'environnement de développement.",
    },
    theirs: {
      name: "Vibe Kanban — exécuter et relire",
      is: "Une application locale qui exécute plusieurs agents de code simultanément dans des worktrees git distincts. Elle réunit l'exécution des tâches, la relecture des diffs et l'aperçu en direct dans un même espace de travail.",
      isnt: "Elle est conçue pour gérer les exécutions, pas pour transformer une idée incomplète en plan d'implémentation détaillé.",
    },
    note: "Si vous utilisiez surtout Vibe Kanban pour organiser les tâches, AI4Kanban offre une solution plus simple et directement intégrée au dépôt. Si l'exécution parallèle et la relecture intégrée sont prioritaires, Vibe Kanban reste plus adapté.",
  },
  wins: {
    heading: { eyebrow: "Compromis", title: "Où chacun l'emporte" },
    lead: "Aucun n'est meilleur dans tous les cas. AI4Kanban privilégie un processus de planification léger et portable ; Vibe Kanban, l'exécution coordonnée et la relecture de plusieurs agents.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Vibe Kanban",
    ours: {
      nothingRunning: {
        title: "Aucun service à maintenir",
        body: "Le tableau est en Markdown dans le dépôt. Il ne nécessite ni application web, ni base de données, ni service en arrière-plan.",
      },
      planning: {
        title: "Définition structurée des tâches",
        body: "Le processus repère les informations manquantes et transforme une idée initiale en tâche concrète, à valider avant l'implémentation.",
      },
      outlives: {
        title: "Portable par conception",
        body: "Les plans sont stockés dans git avec le code concerné. Le tableau accompagne chaque clone du dépôt, sans migration ni export.",
      },
      anyAgent: {
        title: "Compatible avec tout agent capable de traiter des fichiers",
        body: "Tout agent capable de travailler avec les fichiers du dépôt peut utiliser le tableau, notamment Claude Code, Codex, Cursor et les futurs outils.",
      },
    },
    theirs: {
      parallel: {
        title: "Fait tourner de nombreux agents à la fois",
        body: "Vibe Kanban répartit les tâches entre plusieurs agents de code et isole chaque exécution dans sa propre branche et son propre worktree git.",
      },
      reviewInPlace: {
        title: "Exécuter et relire au même endroit",
        body: "Les diffs en ligne, les aperçus de l'application et les workflows de pull request permettent de contrôler les résultats sans quitter l'espace de travail.",
      },
      boardUi: {
        title: "Une interface visuelle dédiée",
        body: "L'interface web est conçue pour lancer des tâches, suivre leur progression et passer d'un espace de travail à l'autre pendant l'exécution.",
      },
      support: {
        title: "De nombreuses intégrations d'agents",
        body: "Plusieurs CLI d'agents sont prises en charge d'origine, dont Claude Code, Codex, Gemini et d'autres.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Le choix", title: "Lequel utiliser ?" },
    oursHeading: "Choisissez AI4Kanban si",
    theirsHeading: "Choisissez Vibe Kanban si",
    ours: [
      "Vous voulez qu'un agent planifie et précise les tâches directement dans le dépôt.",
      "Vous préférez du Markdown dans git à une application et une base distinctes.",
      "Vous voulez utiliser le tableau avec tout agent de code capable de traiter des fichiers.",
      "Vous accordez plus d'importance à des exigences claires qu'à l'exécution parallèle.",
    ],
    theirs: [
      "Vous voulez exécuter plusieurs agents de code en parallèle dans des worktrees isolés.",
      "Vous avez besoin de diffs en ligne et d'aperçus dans une même interface.",
      "La coordination et la relecture des exécutions constituent votre principal frein.",
      "Vous acceptez d'utiliser un projet open source maintenu par la communauté.",
    ],
    verdict:
      "Choisissez AI4Kanban pour un **processus de planification intégré au dépôt**, sans environnement d'exécution distinct. Choisissez Vibe Kanban pour l'**exécution multi-agents et la relecture intégrée**. Le bon choix dépend de ce qui vous freine le plus : la planification du travail ou la coordination de son exécution.",
    note: "La fermeture de Bloop a changé le mode de maintenance de Vibe Kanban, mais pas la différence fondamentale entre les deux produits.",
  },
};

export default fr;
