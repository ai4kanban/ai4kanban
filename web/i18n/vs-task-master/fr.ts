// Français — the Taskmaster comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const fr: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Taskmaster : moins de guidage et de reprises avec des agents IA",
    socialTitle: "AI4Kanban vs. Taskmaster",
    description: "AI4Kanban ajoute à la gestion des tâches des workflows spécialisés, l’approbation des brouillons et la mémoire des préférences. Découvrez comment il réduit les reprises par rapport à Taskmaster.",
    social: "AI4Kanban découpe et gère les tâches, vous laisse approuver des brouillons d’UI, de prompts ou de textes avant l’exécution, et réutilise vos préférences et décisions dans la suite du travail. Taskmaster n’intègre ni approbation des brouillons ni mémoire des préférences.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nTaskmaster",
    lead: "Workflows spécialisés, approbation des brouillons et mémoire des préférences intégrés : guidez vos agents avec moins d’effort et réduisez les reprises.",
    sharedLabel: "Les deux proposent",
    setup: {
      heading: "Des agents et workflows spécialisés, prêts à l’emploi",
      ours: "Les agents et workflows intégrés couvrent le développement logiciel, les blogs, les carrousels pour réseaux sociaux, les présentations et les vidéos produit. Vous pouvez aussi créer vos propres agents et workflows.",
      theirs: "Centré sur les tâches de code. Aucun agent ni workflow spécialisé intégré pour le design d’UI, la rédaction ou la production de contenu.",
      art: {
        ours: [
          "Design UI",
          "Prompts",
          "Rédaction",
        ],
        theirs: {
          title: "Workflows spécialisés",
          fields: [
            "Design UI",
            "Rédaction",
            "Production de contenu",
          ],
          slot: "Non intégré",
        },
      },
      shared: [
        {
          title: "Découpage des tâches et dépendances",
          body: [
            "AI4Kanban découpe le travail en cartes et sous-tâches, et les dépendances fixent l’ordre d’exécution.",
            "Taskmaster peut générer des tâches et sous-tâches à partir d’un PRD et gérer leurs dépendances.",
          ],
        },
        {
          title: "Intégration CLI",
          body: [
            "AI4Kanban fournit une CLI que les agents de code peuvent appeler. Il n’a pas de serveur MCP.",
            "Taskmaster fournit une CLI et un serveur MCP.",
          ],
        },
      ],
    },
    drafts: {
      heading: "Relire les brouillons clés avant l’implémentation",
      ours: "Choisissez l’UI, les prompts, les textes ou les autres parties clés à relire. Les agents préparent des brouillons à prévisualiser et modifier, puis s’appuient sur ce que vous approuvez.",
      theirs: "Vous pouvez relire descriptions de tâches, détails d’implémentation et stratégies de test. Aucun workflow intégré ne permet de prévisualiser et d’approuver les brouillons des livrables clés avant l’exécution.",
      art: {
        ours: [
          "Brouillon clé",
          "Approuver la direction",
          "Exécuter la tâche",
        ],
        theirs: {
          title: "Détails de la tâche",
          fields: [
            "Exigences",
            "Implémentation",
            "Stratégie de test",
          ],
          slot: "Détails en texte",
        },
      },
      shared: [
      ],
    },
    memory: {
      heading: "Vos préférences, reprises à la tâche suivante",
      ours: "Les designers retiennent vos préférences de design ; les rédacteurs, vos choix de formulation. Les agents peuvent aussi partager le contexte du projet.",
      theirs: "Il stocke des règles et des notes de tâche. Aucun système de mémoire n’apprend automatiquement vos préférences à partir de vos modifications et refus pour les tâches suivantes.",
      art: {
        ours: {
          agents: [
            "Designer UI",
            "Rédacteur",
          ],
          notes: [
            "Préférences de design",
            "Choix de formulation",
          ],
          shared: "Contexte de projet partagé",
        },
        theirs: {
          title: "Règles et notes de tâche",
          fields: [
            "Contraintes du projet",
            "Notes d’avancement",
            "Contexte ajouté",
          ],
          slot: "Règles et notes seulement",
        },
      },
      shared: [
        {
          title: "Règles modifiables",
          body: [
            "Les agents spécialisés d’AI4Kanban ont des règles de rôle modifiables.",
            "Taskmaster fournit des fichiers de règles pour différents éditeurs.",
          ],
        },
        {
          title: "Garder le contexte du travail",
          body: [
            "AI4Kanban conserve sur la carte les plans, les conversations et les journaux d’exécution.",
            "Taskmaster conserve descriptions de tâches, détails d’implémentation et notes de sous-tâches.",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "Différences clés",
      title: "Comparer en détail",
    },
    lead: "Voyez quels workflows, étapes de relecture et intégrations chaque produit inclut.",
    ourLabel: "AI4Kanban",
    theirLabel: "Taskmaster",
    rows: {
      startingPoint: {
        dimension: "Agents et workflows intégrés",
        kanban: "Agents et workflows spécialisés intégrés pour le développement et le contenu. Créez vos propres agents et workflows. Les workflows de contenu nécessitent Pro.",
        taskMaster: "Workflows de code pour exécuter les tâches, tester et nettoyer le code. Aucun agent ni workflow spécialisé intégré pour le design, la rédaction ou la production de contenu.",
      },
      planning: {
        dimension: "Découpage des tâches et dépendances",
        kanban: "AI4Kanban découpe le travail en cartes et sous-tâches, et les dépendances fixent l’ordre d’exécution.",
        taskMaster: "Taskmaster peut générer des tâches et sous-tâches à partir d’un PRD et gérer leurs dépendances.",
      },
      drafts: {
        dimension: "Relecture des brouillons clés avant l’exécution",
        kanban: "Brouillons image, schéma, HTML/TSX, diff et storyboard. Le contenu clé approuvé rejoint les exigences d’exécution.",
        taskMaster: "Vous pouvez relire descriptions de tâches, détails d’implémentation et stratégies de test. Aucun workflow intégré ne permet de prévisualiser et d’approuver les brouillons des livrables clés avant l’exécution.",
      },
      discussion: {
        dimension: "Discussion sur une tâche",
        kanban: "Discutez des exigences et révisez les plans avec les agents sur la carte. Les conversations restent sur la carte.",
        taskMaster: "Pas d’interface de discussion par tâche intégrée. Les tâches se discutent dans le chat d’agent d’outils comme Cursor.",
      },
      memory: {
        dimension: "Mémoire des préférences",
        kanban: "Les agents retiennent vos préférences de design, vos choix de formulation et d’autres décisions, et peuvent partager le contexte du projet.",
        taskMaster: "Il stocke des règles et des notes de tâche. Aucun système de mémoire n’apprend automatiquement vos préférences à partir de vos modifications et refus pour les tâches suivantes.",
      },
      followUps: {
        dimension: "Suggestions après la livraison",
        kanban: "Les agents proposent du travail de suivi après une tâche principale. Vous l’acceptez, le modifiez ou le refusez.",
        taskMaster: "next sélectionne seulement des tâches existantes. Aucun workflow intégré ne propose automatiquement de nouvelles tâches de suivi après la livraison.",
      },
      interface: {
        dimension: "Tableau et interface",
        kanban: "Un tableau de bureau autonome pour les cartes, les brouillons, les conversations et l’état des exécutions.",
        taskMaster: "Le tableau Kanban visuel officiel est une extension VS Code. La gestion des tâches de base fonctionne aussi via CLI/MCP.",
      },
      execution: {
        dimension: "Exécution et validation",
        kanban: "Exécutez des cartes indépendantes en parallèle en arrière-plan, ou utilisez les dépendances pour les exécuter dans l’ordre. Les tâches de développement utilisent des git worktrees isolés et les vérifications requises.",
        taskMaster: "loop lance une nouvelle session Claude Code à chaque itération, termine une tâche à la fois et exécute tests et vérifications de types.",
      },
      testFirst: {
        dimension: "Workflow test-first intégré",
        kanban: "Les tâches de développement exécutent les vérifications requises. Pas de workflow RED → GREEN → COMMIT intégré.",
        taskMaster: "autopilot guide chaque sous-tâche par un test qui échoue, l’implémentation jusqu’à ce que les tests passent, puis un commit. Il suit les phases et vérifie les résultats de test signalés.",
      },
      research: {
        dimension: "Recherche",
        kanban: "Les agents peuvent faire des recherches avec les outils disponibles dans Claude Code, Codex ou un autre outil d’exécution. Pas de commande de recherche dédiée ni de réglage de modèle de recherche.",
        taskMaster: "research accepte le contexte des tâches et des fichiers, utilise un modèle de recherche configuré à part et peut enregistrer les résultats dans une tâche ou un fichier de recherche.",
      },
      reach: {
        dimension: "CLI et MCP",
        kanban: "Une CLI que des outils de code comme Claude Code et Codex peuvent appeler. Pas de serveur MCP.",
        taskMaster: "CLI et MCP, pour les éditeurs et agents de code compatibles MCP.",
      },
      license: {
        dimension: "Licence",
        kanban: "Apache-2.0, avec usage commercial, hébergement et intégration autorisés.",
        taskMaster: "MIT avec Commons Clause, qui interdit de vendre Taskmaster lui-même et de le proposer comme service hébergé.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Recommandation",
      title: "Lequel choisir ?",
    },
    oursHeading: "Choisissez AI4Kanban si vous",
    theirsHeading: "Choisissez Taskmaster si vous",
    ours: [
      "Voulez des agents et workflows spécialisés intégrés, ou créer les vôtres.",
      "Voulez approuver les brouillons clés d’UI, de prompts ou de textes avant l’exécution complète.",
      "Voulez que les tâches suivantes réutilisent vos préférences et suggèrent un travail de suivi utile.",
    ],
    theirs: [
      "Voulez gérer vos tâches via MCP dans votre éditeur ou agent de code actuel.",
      "Voulez une commande de recherche dédiée, avec le contexte des tâches et un modèle de recherche à part.",
      "Voulez un workflow intégré qui guide le code par des tests qui échouent, des tests qui passent et des commits.",
    ],
    verdict: "Choisissez AI4Kanban pour **les workflows spécialisés, l’approbation des brouillons et la mémoire des préférences** ; choisissez Taskmaster pour **l’intégration MCP, une commande de recherche dédiée et un workflow de code test-first intégré**.",
    note: "Cette page compare la version open source de Taskmaster. Hamster est un produit hébergé de la même équipe ; ses fonctions d’équipe sortent du cadre de ce comparatif.",
  },
};

export default fr;
