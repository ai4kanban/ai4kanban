import type { VsMulticaCopy } from "./types";

const fr: VsMulticaCopy = {
  meta: {
    title:
      "AI4Kanban vs. Multica : gestion de projet par l’IA ou plateforme multi-agents",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "AI4Kanban offre une gestion de projet par l’IA prête à l’emploi. Multica est une plateforme généraliste pour créer et piloter des équipes d’agents.",
    social:
      "Les deux permettent à des agents d’exécuter des tâches, mais répondent à des besoins distincts : l’un gère le projet, l’autre fournit la plateforme de l’équipe d’agents.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nMultica",
    lead: "Les deux produits permettent à des agents d’exécuter des tâches. **AI4Kanban offre une gestion de projet par l’IA prête à l’emploi ; Multica est une plateforme multi-agents généraliste.**",
    ours: {
      name: "AI4Kanban",
      body: "Les personnes fixent le cap, apportent les idées et tranchent les décisions clés. Les agents identifient les tâches, clarifient les besoins, établissent les priorités, exécutent le travail et versent les enseignements dans la mémoire du projet.",
    },
    theirs: {
      name: "Multica",
      body: "Vous créez plusieurs agents et configurez leurs responsabilités, leurs Skills et leur environnement d’exécution. Vous gérez ensuite au même endroit la répartition, l’exécution, les relances, la revue et la collaboration.",
    },
    oursDiagramAlt:
      "Vous dites ce que vous voulez et le tableau planifie et exécute le travail lui-même : aucun agent à créer, nommer ou répartir.",
    theirsDiagramAlt:
      "Multica fournit la plateforme, pas l’équipe : chaque agent, c’est vous qui le créez, et chaque exécution vous revient pour être répartie, surveillée et relancée.",
    oursDiagramTop: "vous dites ce que vous voulez",
    oursDiagramBottom:
      "le tableau planifie et exécute — aucun agent à configurer",
    theirsDiagramTop: "chaque agent, c’est vous qui le créez",
    theirsDiagramBottom:
      "ensuite vous répartissez, surveillez et relancez",
  },
  boundary: {
    heading: {
      eyebrow: "Positionnement",
      title: "Deux produits, deux besoins",
    },
    lead: "AI4Kanban aide les personnes et l’IA à gérer un projet ensemble. Multica aide les équipes à créer, organiser et exécuter plusieurs agents.",
    stages: {
      discover: "Fixer le cap",
      refine: "Clarifier avec l’IA",
      prioritize: "Avancer ensemble",
      assign: "Créer les agents",
      run: "Configurer l’équipe",
      review: "Piloter les tâches",
    },
    oursLabel: "AI4Kanban",
    theirsLabel: "Multica",
    oursJob: "Gère le projet",
    theirsJob: "Pilote les agents",
  },
  backlog: {
    heading: {
      eyebrow: "Prêt à l’emploi",
      title: "Que contient chaque produit ?",
    },
    lead: "Les deux sont complets dès le premier jour, mais pas sur le même terrain. AI4Kanban livre la gestion de projet ; Multica livre la mécanique qui fait tourner les agents.",
    ours: {
      label: "AI4Kanban",
      title: "La gestion de projet, prête à tourner",
      items: [
        "Une méthode de travail commune aux personnes et à l’IA",
        "Un tableau couvrant tout le cycle d’une carte",
        "Une mémoire du projet conservée dans le dépôt",
      ],
    },
    theirs: {
      label: "Multica",
      title: "L’infrastructure d’agents, prête à tourner",
      items: [
        "Identités d’agent, Instructions et Skills",
        "Squads, chat et files de tâches",
        "Automatisation, relances et historique d’exécution",
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "Différences clés",
      title: "Ce qui compte vraiment",
    },
    lead: "Un {check} indique la solution la plus adaptée au besoin ; un **tiret** signale un compromis.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Positionnement",
        kanban:
          "Un workflow complet de gestion de projet pour les personnes et l’IA, prêt à l’emploi.",
        multica:
          "Un espace de travail généraliste pour équipes multi-agents ; l’utilisateur définit les rôles et les workflows.",
      },
      backlog: {
        dimension: "Gestion proactive",
        kanban:
          "Les agents lisent le projet et sa mémoire, puis proposent, précisent et priorisent les tâches.",
        multica:
          "Possible avec des agents, Skills et Autopilots, mais à configurer soi-même.",
      },
      refinement: {
        dimension: "Clarification des besoins",
        kanban:
          "Complète le contexte depuis le code et l’historique, puis ne soumet aux personnes que les arbitrages produit.",
        multica:
          "Aucun workflow de clarification prêt à l’emploi ; il faut le définir dans les instructions de l’agent ou une Skill.",
      },
      memory: {
        dimension: "Mémoire à long terme",
        kanban:
          "Les décisions, motifs de rejet et enseignements de refonte alimentent directement les plans suivants.",
        multica:
          "Les Skills conservent les méthodes ; les commentaires et l’historique gardent la trace de l’exécution.",
      },
      execution: {
        dimension: "Gestion de l’exécution",
        kanban:
          "Peut lancer Claude Code, Codex, Cursor ou OpenCode sur une carte et suivre tout son cycle, de la proposition à l’archivage.",
        multica:
          "Exécute plusieurs agents en parallèle avec files, relances, replay, mesure des coûts, contrôles de revue et liens PR et CI.",
      },
      teams: {
        dimension: "Collaboration",
        kanban:
          "Local-first, adapté aux développeurs individuels et aux petites équipes qui collaborent avec git.",
        multica:
          "Espaces multiutilisateurs, rôles, Squads, commentaires, droits et notifications.",
      },
      storage: {
        dimension: "Déploiement et stockage",
        kanban:
          "Cartes et mémoire vivent dans le dépôt ; aucune base de données, aucun compte ni serveur de tableau.",
        multica:
          "Utilise PostgreSQL, un serveur et un daemon local ; disponible en version hébergée ou autogérée.",
      },
      license: {
        dimension: "Licence",
        kanban:
          "Apache-2.0, y compris pour l’usage commercial, l’hébergement et l’intégration.",
        multica:
          "Code source consultable ; la Multica License limite les services hébergés et l’intégration commerciale.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Mémoire à long terme",
      title: "Deux mémoires, deux usages",
    },
    lead: "Les deux gardent des notes d’une exécution à l’autre. Pas les mêmes notes.",
    ours: {
      eyebrow: "Jugement du projet",
      title: "Pourquoi une décision a été prise",
      examples: ["decisions.md", "rejected.md", "redesign.md"],
      question: "Pourquoi le tableau ne propose-t-il plus l’idée X ?",
      answer:
        "`rejected.md` conserve le motif du rejet. Sans nouvel élément, l’idée ne revient pas.",
    },
    theirs: {
      eyebrow: "Méthode de travail",
      title: "Comment un agent doit travailler",
      examples: ["Instructions", "SKILL.md", "historique d’exécution"],
      question: "Comment cet agent doit-il mener une revue de sécurité ?",
      answer:
        "Associez une Skill contenant les étapes, les fichiers et les exigences de la revue.",
    },
    note: "",
  },
  horizon: {
    heading: {
      eyebrow: "À construire",
      title: "Que faut-il ajouter dans Multica ?",
    },
    lead: "Vous pouvez créer un agent chef de projet sur Multica. Le créer est la partie rapide ; restent ces quatre questions, à trancher puis à retrancher à chaque évolution du projet.",
    visionLabel: "À vous de construire",
    visionTitle: "Le comportement de gestion de projet",
    items: [
      "Comment il comprend l’objectif du projet",
      "Comment il repère le travail qui en vaut la peine",
      "Comment il clarifie un besoin flou",
      "Ce qu’il retient d’une exécution à l’autre",
    ],
    note: "",
  },
  wins: {
    heading: {
      eyebrow: "Points forts",
      title: "Choisissez selon votre besoin",
    },
    lead: "AI4Kanban offre une solution ciblée, complète et prête à l’emploi. Multica est une plateforme généraliste et flexible pour piloter plusieurs agents.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "Gestion de projet prête à l’emploi",
        body: "Inutile de concevoir d’abord un agent chef de projet. Dès l’installation, personnes et agents peuvent planifier, clarifier et exécuter selon une même méthode.",
      },
      rejectionMemory: {
        title: "Les idées rejetées ne reviennent pas",
        body: "Les décisions passées façonnent les plans suivants et évitent de répéter les mêmes discussions.",
      },
      repoNative: {
        title: "Tout vit dans git",
        body: "Cartes et mémoire sont lisibles et comparables, sans service de tableau supplémentaire à exploiter.",
      },
    },
    theirs: {
      operations: {
        title: "Contrôle complet de l’exécution",
        body: "Files, relances, replay, revues, mesure des coûts et liens PR et CI sont intégrés.",
      },
      teams: {
        title: "Conçu pour les personnes et plusieurs agents",
        body: "Espaces, rôles, Squads, commentaires, droits et notifications sont réunis dans une seule plateforme.",
      },
      runtimeReach: {
        title: "Compatibilité plus large",
        body: "Un daemon local relie de nombreuses CLI d’agents. AI4Kanban prend aujourd’hui en charge Claude Code, Codex, Cursor et OpenCode.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Recommandation", title: "Lequel choisir ?" },
    oursHeading: "Choisissez AI4Kanban si",
    theirsHeading: "Choisissez Multica si",
    ours: [
      "Vous voulez une méthode prête à l’emploi pour gérer un projet avec des personnes et l’IA.",
      "Vous avez besoin d’agents pour la planification, la clarification et l’exécution.",
      "Vous voulez que décisions et rejets influencent les plans suivants.",
      "Vous préférez un système léger, natif du dépôt et sans service supplémentaire.",
    ],
    theirs: [
      "Vous devez créer et piloter plusieurs agents aux rôles distincts.",
      "Personnes et agents doivent partager espace, issues et historique d’exécution.",
      "Vous avez besoin de relances, replay, coûts ou intégrations PR et CI.",
      "Vous pouvez définir votre propre agent de gestion, ses Skills et ses workflows.",
    ],
    verdict:
      "Choisissez AI4Kanban pour une **gestion de projet par l’IA prête à l’emploi**. Choisissez Multica pour une **plateforme généraliste où créer et piloter une équipe multi-agents**. Les deux permettent à des agents d’exécuter des tâches : l’un gère le projet, l’autre pilote plusieurs agents.",
    note: "",
  },
};

export default fr;
