import type { VsMulticaCopy } from "./types";

const fr: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica : faire avancer vos projets avec des agents IA",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "Comparez AI4Kanban et Multica : les problèmes que chacun résout, le travail de configuration et de relecture qu’ils vous évitent, et leurs façons différentes de travailler avec des agents IA.",
    social:
      "Les deux permettent de créer et d’organiser plusieurs équipes d’agents IA qui travaillent en parallèle. AI4Kanban fournit des agents, des workflows et une gestion de la mémoire prêts à l’emploi, et réduit l’effort de conception d’équipe et de réglage des prompts.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nMultica",
    lead: "AI4Kanban est livré avec des agents spécialisés et des workflows prêts à l’emploi : confiez votre premier travail en 10 minutes. Les agents travaillent en parallèle, les brouillons vous laissent maîtriser la qualité de chaque livraison, et ils continuent d’apprendre à l’usage.",
    sharedLabel: "Les deux proposent",
    setup: {
      heading: "Commencer sans concevoir l’équipe au préalable",
      verdict:
        "Les agents spécialisés sont prêts : vous confiez du travail dès le premier jour.",
      ours: "Les agents spécialisés et workflows intégrés couvrent le développement logiciel, les blogs, les carrousels pour réseaux sociaux, les présentations et les vidéos produit.",
      theirs:
        "Hormis le coordinateur Mika, vous créez et configurez vous-même chaque agent spécialisé",
      art: {
        ours: ["Design UI", "Prompts", "Rédaction"],
        theirs: {
          title: "Nouvel agent",
          fields: ["Nom", "Instructions", "Skills"],
          slot: "À créer vous-même",
        },
      },
      shared: [
        {
          title: "Agents personnalisés",
          body: [
            "AI4Kanban vous laisse modifier les rôles intégrés ou ajouter vos propres agents.",
            "L’Agent Builder de Multica aide à créer des rôles, puis à configurer leurs Instructions et Skills.",
          ],
        },
        {
          title: "Agents en parallèle",
          body: [
            "AI4Kanban fait avancer plusieurs cartes à la fois avec des outils comme Claude Code ou Codex.",
            "Multica exécute des agents en parallèle, avec files d’attente, relances et suivi des coûts.",
          ],
        },
      ],
    },
    drafts: {
      heading:
        "Peur que l’IA prenne trop de libertés ? Relisez un brouillon avant d’approuver l’exécution",
      verdict: "Corrigez la direction avant l’exécution, pas après.",
      ours: "Pour toute partie dont vous voulez garder la direction, le système de brouillons prépare un aperçu à approuver avant l’exécution et la livraison. AI4Kanban prend en charge les brouillons image, schéma, HTML/TSX, diff et storyboard.",
      theirs: "Le processus de relecture des brouillons est à construire vous-même",
      art: {
        ours: ["Brouillon", "Approuver", "Exécuter"],
        theirs: {
          title: "Approbation des brouillons",
          fields: ["Qui le prépare", "Quand attendre", "Comment le transmettre"],
          slot: "À construire vous-même",
        },
      },
      shared: [
        {
          title: "Aperçus",
          body: [
            "AI4Kanban affiche sur la carte les brouillons image, schéma, HTML/TSX, diff et storyboard.",
            "Multica prévisualise le HTML, recueille des annotations et compare les versions.",
          ],
        },
        {
          title: "Discussion de la tâche",
          body: [
            "AI4Kanban discute et révise le plan dans le chat de la carte.",
            "Multica discute du travail avec les agents dans les commentaires de l’issue.",
          ],
        },
      ],
    },
    memory: {
      heading: "Faudra-t-il tout réexpliquer ?",
      verdict:
        "Préférences et décisions sont retenues par tâche : inutile de les répéter.",
      ours: "Chaque agent a une recette de mémoire conçue pour son propre métier : il apprend vos préférences et décisions pour ce type de tâche, pas des leçons génériques. Les agents peuvent aussi partager leur mémoire.",
      theirs:
        "La mémoire à long terme dépend de l’outil d’agent, à vérifier et configurer vous-même",
      art: {
        ours: {
          agents: ["Design UI", "Rédaction"],
          notes: ["Préférences de design", "Choix de formulation"],
          shared: "Partagée · projet",
        },
        theirs: {
          title: "Mémoire à long terme",
          fields: ["Quel outil", "Où elle est gardée", "Quand la relire"],
          slot: "À configurer vous-même",
        },
      },
      shared: [
        {
          title: "Méthodes enregistrées",
          body: [
            "AI4Kanban donne à chaque agent des règles de rôle modifiables.",
            "Multica conserve les méthodes dans les Instructions et les Skills.",
          ],
        },
        {
          title: "Historique des tâches",
          body: [
            "AI4Kanban garde le plan, le chat et le journal d’exécution sur chaque carte.",
            "Multica garde les commentaires et l’historique des exécutions.",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: { eyebrow: "Différences clés", title: "Comparer en détail" },
    lead: "Un {check} indique le côté le plus fort sur chaque ligne.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Agents et workflows intégrés",
        kanban:
          "Agents spécialisés et workflows intégrés, avec des rôles que vous pouvez modifier ou ajouter.",
        kanbanTip:
          "Le développement logiciel est gratuit ; les workflows blog, carrousel, présentation et vidéo produit nécessitent Pro.",
        multica:
          "Mika est inclus. Vous créez les agents spécialisés vous-même ou avec Agent Builder, puis leur donnez des Instructions et des Skills.",
      },
      refinement: {
        dimension: "Relire les brouillons avant exécution",
        kanban:
          "Pour toute partie dont vous voulez garder la direction, le système de brouillons prépare un aperçu à approuver avant l’exécution et la livraison. AI4Kanban prend en charge les brouillons image, schéma, HTML/TSX, diff et storyboard.",
        multica:
          "Aperçu HTML, annotations et comparaison de versions. Vous définissez quel agent prépare chaque brouillon et quand une approbation est requise avant l’exécution.",
      },
      memory: {
        dimension: "Retenir modifications et décisions",
        kanban:
          "Chaque agent a une recette de mémoire conçue pour son propre métier : il apprend vos préférences et décisions pour ce type de tâche, pas des leçons génériques. Les agents peuvent aussi partager leur mémoire.",
        multica:
          "La mémoire à long terme dépend de l’outil d’agent. Les agents qui utilisent Hermes gardent chacun une mémoire entre les tâches dans l’environnement local ; elle ne se synchronise pas automatiquement entre machines. Les instructions et l’historique des tâches sont aussi conservés.",
      },
      backlog: {
        dimension: "Après la livraison",
        kanban:
          "Quand vous terminez un travail principal, les agents proposent d’eux-mêmes des suites pour combler les manques et les oublis.",
        multica:
          "Pour obtenir des propositions de suite, demandez-les dans les instructions de la tâche. Autopilot s’exécute seul une fois son runbook, son responsable et ses déclencheurs planifiés ou webhook configurés.",
      },
      license: {
        dimension: "Licence",
        kanban:
          "Apache-2.0, y compris pour l’usage commercial, l’hébergement et l’intégration.",
        multica:
          "Code source consultable ; la Multica License limite les services hébergés et l’intégration commerciale.",
      },
      execution: {
        dimension: "Gestion de l’exécution",
        kanban:
          "Exécutez les cartes avec Claude Code, Codex, Cursor, OpenCode, DeepSeek Harness, ZCode ou Grok Build, plusieurs cartes à la fois.",
        multica:
          "Exécute plusieurs agents en parallèle, avec files d’attente, relances, rejeu, suivi des coûts, étapes de revue et liens PR et CI.",
      },
      teams: {
        dimension: "Travail en équipe",
        kanban:
          "Pour les personnes et petites équipes qui organisent leurs tâches dans un dépôt, avec agents et workflows personnalisables.",
        multica:
          "Espaces de travail multi-utilisateurs, rôles, Squads, commentaires, permissions et notifications.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Recommandation", title: "Lequel choisir ?" },
    oursHeading: "Choisissez AI4Kanban si",
    theirsHeading: "Choisissez Multica si",
    ours: [
      "Vous voulez des agents spécialisés et des workflows intégrés sans tout configurer de zéro ; certains workflows nécessitent Pro.",
      "Vous voulez relire les brouillons clés avant l’exécution.",
      "Vous voulez que les agents retiennent les modifications et décisions utiles, même en changeant d’outil.",
      "Vous voulez la planification et les propositions de suite incluses, avec la liberté d’adapter le workflow.",
    ],
    theirs: [
      "Vous avez besoin d’espaces multi-utilisateurs, de permissions et de notifications pour toute une équipe travaillant sur des issues partagées.",
      "Vous avez besoin de gestion de l’exécution : files d’attente, relances, rejeu, suivi des coûts, liens PR et CI.",
      "Vous voulez configurer le runbook, le responsable et les déclencheurs d’Autopilot pour lancer un travail récurrent selon un calendrier ou des événements externes.",
    ],
    verdict:
      "Choisissez AI4Kanban pour **démarrer avec des agents spécialisés, approuver les brouillons clés avant l’exécution et faire retenir vos décisions**. Choisissez Multica seulement si vous **avez précisément besoin de son espace multi-utilisateurs ou de sa gestion de l’exécution**.",
    note: "",
  },
};

export default fr;
