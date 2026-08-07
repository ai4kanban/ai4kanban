import type { VsMulticaCopy } from "./types";

const fr: VsMulticaCopy = {
  meta: {
    title:
      "AI4Kanban vs. Multica — décider du travail ou piloter la flotte d’agents",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "Comparez AI4Kanban et Multica sur la découverte et la clarification des tâches, la mémoire des décisions, l’exécution par agents, les équipes, l’infrastructure et la licence.",
    social:
      "Les deux placent des agents de code sur un kanban. AI4Kanban décide quel travail doit exister ; Multica décide quel agent l’exécute.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nMultica",
    lead: "Les deux produits placent des agents de code sur un kanban. La vraie frontière est **le moment où l’agent entre en scène** : AI4Kanban intervient en amont pour décider et préciser la tâche ; Multica prend une issue déjà créée et pilote son exécution.",
    ours: {
      name: "AI4Kanban",
      body: "Une boucle de planification dans votre dépôt. L’agent propose du travail, développe les idées vagues, ordonne le tableau et retient les décisions passées.",
    },
    theirs: {
      name: "Multica",
      body: "Un système d’exploitation de projet pour équipes humaines et agents. Assignez une issue, puis mettez en file, distribuez, observez, relancez et révisez l’exécution.",
    },
    oursDiagramAlt:
      "AI4Kanban lit le projet et transforme une idée émergente en carte prête.",
    theirsDiagramAlt:
      "Multica reçoit une issue prête et la distribue à un environnement d’agent.",
    oursDiagramTop: "lire le projet · trouver le travail",
    oursDiagramBottom: "idée vague → carte prête",
    theirsDiagramTop: "issue prête + responsable",
    theirsDiagramBottom: "distribuer · exécuter · réviser",
  },
  boundary: {
    heading: {
      eyebrow: "La ligne de partage",
      title: "Le même tableau. Deux côtés du prêt.",
    },
    lead: "Le kanban n’est que la surface. AI4Kanban se concentre sur les décisions **avant qu’une tâche soit prête**. Multica se concentre sur la mécanique **après que la tâche est prête**. Les produits peuvent se rejoindre au passage de relais sans former le même système.",
    stages: {
      discover: "Découvrir",
      refine: "Préciser",
      prioritize: "Prioriser",
      assign: "Assigner",
      run: "Exécuter",
      review: "Réviser",
    },
    oursLabel: "AI4Kanban · décider du travail",
    theirsLabel: "Multica · piloter le travail",
    handoffLabel: "prêt",
    principle:
      "**Multica décide quel agent exécute une tâche. AI4Kanban décide quelles tâches doivent exister.** C’est la réponse courte la plus utile à « n’est-ce pas la même idée ? ».",
  },
  backlog: {
    heading: {
      eyebrow: "Le test du backlog",
      title: "Que se passe-t-il avant Todo ?",
    },
    lead: "Le propre modèle de tâches de Multica rend la frontière concrète : une issue en **Backlog ne déclenche aucun agent**. C’est un parking jusqu’à ce qu’une personne décide que le travail est réel et le fasse avancer. Dans AI4Kanban, le tableau encore incomplet est précisément l’endroit où l’agent planifie.",
    ours: {
      label: "Backlog actif",
      title: "L’agent développe la carte",
      body: "L’agent lit le code et la mémoire du module avant de traiter la demande comme un travail réel.",
      steps: [
        "Proposer ou recueillir une idée incomplète",
        "Résoudre le contexte et révéler les vraies décisions",
        "Ordonner une carte réalisable par valeur et dépendances",
      ],
      state: "agent éveillé",
    },
    theirs: {
      label: "Backlog en attente",
      title: "L’agent attend Todo",
      body: "La personne fournit la description et les critères d’acceptation ; l’assignation ne lance l’exécution qu’après admission du travail.",
      steps: [
        "Une personne rédige ou accepte l’issue",
        "Une personne déplace Backlog → Todo",
        "Le daemon met en file et distribue au responsable",
      ],
      state: "agent en veille",
    },
    note: "Multica propose bien quick-create, mais il s’agit d’un transcripteur en un seul passage : il transforme du texte libre en issue, puis s’arrête. Il n’examine pas le code, ne pose pas de question et ne consigne aucune hypothèse.",
  },
  comparison: {
    heading: {
      eyebrow: "Face-à-face",
      title: "Les produits livrés, pas les slogans",
    },
    lead: "Un {check} indique la solution la plus nette pour cette dimension ; un **tiret** signale un choix d’architecture. Ce comparatif reconnaît la plateforme opérationnelle réellement livrée par Multica et la distingue de sa vision future.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Point de départ du produit",
        kanban:
          "Avant la tâche : examiner le projet, proposer du travail et décider ce qui mérite le tableau.",
        multica:
          "Après la création de la tâche : recevoir une issue, un responsable, une priorité et des consignes d’exécution.",
      },
      backlog: {
        dimension: "Comportement du Backlog",
        kanban:
          "L’agent développe activement les cartes incomplètes et peut proposer un travail que personne n’a demandé.",
        multica:
          "Un parking. Une issue en Backlog ne réveille pas l’agent qui lui est assigné.",
      },
      refinement: {
        dimension: "De l’idée vague au plan concret",
        kanban:
          "Une boucle de clarification lit le code et la mémoire, explicite les hypothèses et ne demande que les décisions produit encore ouvertes.",
        multica:
          "Les descriptions sont du texte libre ; la personne doit fournir fichiers, contraintes, résultat attendu et critères d’acceptation.",
      },
      memory: {
        dimension: "Ce qui s’accumule",
        kanban:
          "Décisions, enseignements de refonte, travail livré et motifs de rejet façonnent la proposition suivante.",
        multica:
          "Les Skills réutilisables conservent les méthodes ; l’activité et l’historique conservent la traçabilité d’exécution.",
      },
      execution: {
        dimension: "Pilotage des exécutions",
        kanban:
          "Confie l’implémentation à l’environnement de code choisi ; pas de relance, replay, coût en tokens ou gestion de flotte natifs.",
        multica:
          "Met en file, distribue, diffuse, mesure, relance, rejoue, applique les contrôles de revue et relie PR et CI.",
      },
      teams: {
        dimension: "Équipes humaines et agents",
        kanban:
          "Local-first, adapté à une personne ou une petite équipe qui collabore avec git.",
        multica:
          "Espaces multiutilisateurs, rôles, squads, boîtes de réception, commentaires, droits et notifications.",
      },
      storage: {
        dimension: "Stockage et infrastructure",
        kanban:
          "Markdown dans le dépôt ; sans base de données, compte, serveur de tableau ni dépendance MCP.",
        multica:
          "PostgreSQL + pgvector, serveur Go, daemon local, OAuth et déploiement hébergé ou autogéré.",
      },
      license: {
        dimension: "Licence",
        kanban:
          "Apache License 2.0, y compris pour l’usage commercial, l’hébergement et l’intégration.",
        multica:
          "Multica License à code visible, avec restrictions sur les services hébergés et l’intégration commerciale.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Deux mémoires",
      title: "Comment faire et pourquoi nous l’avons décidé",
    },
    lead: "Les deux systèmes accumulent du savoir, mais sur des axes différents. Les Multica Skills enseignent **comment réaliser un type de travail**. La mémoire par module d’AI4Kanban consigne **ce que ce projet a décidé et écarté**.",
    ours: {
      eyebrow: "Jugement du projet",
      title: "AI4Kanban retient le veto",
      body: "L’agent lit des fichiers concis du dépôt avant de proposer ou préciser le travail. L’objectif n’est pas une transcription exhaustive, mais d’éviter que la prochaine décision répète une ancienne erreur.",
      examples: ["rejected.md", "redesign.md", "memory.md"],
      question: "Pourquoi le tableau ne propose-t-il plus l’idée X ?",
      answer:
        "`rejected.md` conserve l’idée et son motif ; elle reste donc absente tant qu’un nouvel élément ne change pas la décision.",
    },
    theirs: {
      eyebrow: "Méthode de travail",
      title: "Multica retient le mode opératoire",
      body: "Les Skills sont des paquets `SKILL.md` rédigés ou importés, puis partagés entre agents. Les commentaires et l’historique expliquent une exécution, mais le travail terminé ne devient pas automatiquement une mémoire de décisions.",
      examples: ["SKILL.md", "commentaires", "historique d’exécution"],
      question: "Comment cet agent doit-il mener une revue de sécurité ?",
      answer:
        "Associez une Skill réutilisable contenant la procédure, les fichiers et les consignes propres à ce type de travail.",
    },
    note: "La distinction oppose procédure et jugement. Un mode opératoire améliore l’exécution ; un registre de rejets empêche de reproposer le mauvais travail.",
  },
  horizon: {
    heading: {
      eyebrow: "Vision et produit",
      title: "Le chevauchement se rapproche",
    },
    lead: "Le `VISION.md` de Multica remonte en amont. Il décrit des agents qui structurent l’intention, rassemblent le contexte, rendent l’incertitude explicite et relient décisions et résultats. Cette thèse est bien plus proche de celle d’AI4Kanban aujourd’hui que ne l’est le produit Multica actuel.",
    shippedLabel: "Livré aujourd’hui",
    visionLabel: "Direction déclarée",
    shippedTitle: "Exécuter une issue",
    shippedBody:
      "Backlog attend. Le daemon demande au responsable de lire l’issue et de la réaliser. La clarification intervient après le code, par revue et corrections.",
    visionTitle: "Développer l’intention",
    visionBody:
      "Les futurs agents doivent transformer l’intention en travail structuré et séparer les faits connus des décisions encore nécessaires.",
    marker: "surveiller cet écart",
    note: "C’est une menace concurrentielle réelle, pas une raison d’attribuer des fonctions non livrées. La comparaison honnête oppose les produits livrés tout en nommant clairement la direction annoncée.",
  },
  wins: {
    heading: {
      eyebrow: "Arbitrages",
      title: "Là où chacun devance clairement l’autre",
    },
    lead: "Ce n’est pas un concours de fonctionnalités. AI4Kanban est volontairement plus petit et intervient plus tôt dans le cycle. Multica couvre beaucoup plus de terrain dès que le travail entre en exécution.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "L’agent aide à décider du travail",
        body: "Il propose depuis le contexte du projet, transforme les demandes floues en cartes réalisables et les ordonne par valeur et dépendances avant exécution.",
      },
      rejectionMemory: {
        title: "Les idées rejetées le restent",
        body: "La mémoire des décisions et refontes façonne la planification suivante, afin que l’agent ne repropose pas une direction déjà écartée.",
      },
      repoNative: {
        title: "Toute la planification tient dans git",
        body: "Cartes et mémoire sont des fichiers lisibles et comparables près du code, sans service de tableau à exploiter et sous conditions Apache-2.0 simples.",
      },
    },
    theirs: {
      operations: {
        title: "Un véritable plan de contrôle d’exécution",
        body: "Replay, relances, contrôles de revue, liens PR et CI, mesure des tokens, webhooks, pièces jointes et vues opérationnelles sont déjà livrés.",
      },
      teams: {
        title: "Conçu pour le travail multiutilisateur",
        body: "Espaces, rôles, squads, discussions en fil, notifications, droits et identités persistantes permettent une véritable organisation d’humains et d’agents.",
      },
      runtimeReach: {
        title: "Une compatibilité bien plus large",
        body: "Multica prend en charge une vingtaine de CLI d’agents via des daemons locaux et des environnements cloud. AI4Kanban intègre aujourd’hui Claude Code et Codex.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Le choix", title: "Lequel utiliser ?" },
    oursHeading: "Choisissez AI4Kanban si",
    theirsHeading: "Choisissez Multica si",
    ours: [
      "Le frein est de décider et préciser le bon travail, pas de le distribuer.",
      "Vous voulez qu’un agent propose des tâches depuis le code et la mémoire du projet.",
      "Vous voulez que rejets et décisions de conception façonnent les plans futurs.",
      "Vous préférez un petit système natif du dépôt, sans infrastructure de tableau.",
      "Des conditions Apache-2.0 simples comptent pour ce que vous construisez.",
    ],
    theirs: [
      "Les tâches existent déjà et le frein est leur exécution fiable.",
      "Plusieurs personnes et agents nommés ont besoin d’un espace opérationnel commun.",
      "Vous avez besoin de relances, replay, mesure des coûts, liens PR et CI ou contrôles de revue.",
      "Vous voulez de nombreux environnements d’agents, des squads, du chat, des webhooks et un accès mobile.",
      "Vous acceptez d’exploiter ou d’acheter une plateforme avec serveur.",
    ],
    verdict:
      "Choisissez AI4Kanban pour **décider et développer le travail avant qu’il soit prêt**. Choisissez Multica pour **assigner et piloter le travail une fois prêt**. Si vous avez besoin des deux, la jointure est simple : AI4Kanban produit la carte approuvée, puis une issue Multica est créée pour l’exécution.",
    note: "Les deux peuvent se compléter, mais ne maintenez pas deux sources de vérité actives pour le même état de tâche. Fixez un point de passage clair.",
  },
};

export default fr;
