// Français — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const fr: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — planification dans le dépôt ou runtime d'agents intégré",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "Comparaison entre le tableau Markdown d'AI4Kanban, intégré au dépôt, et Hermes Agent Kanban de Nous Research. Le premier rend la planification portable et révisable ; le second réunit une file SQLite partagée, un répartiteur et un runtime multi-agents.",
    social:
      "Deux kanbans pour agents, deux choix d'architecture : un tableau Markdown portable compatible avec tout agent de code, ou une file durable et partagée intégrée au runtime Hermes.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Les deux produits proposent un kanban aux agents, mais leur frontière d'architecture diffère. AI4Kanban conserve le tableau comme *couche projet* portable dans le dépôt ; Hermes Agent Kanban l'intègre au runtime Hermes.",
    ours: {
      name: "AI4Kanban",
      body: "Un tableau Markdown conservé avec le code. Vous pouvez changer l'agent qui l'exécute sans migrer ni reconstruire le tableau.",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "Le tableau, le répartiteur et les agents nommés fonctionnent dans un même système Hermes durable.",
    },
    oursDiagramAlt:
      "Le kanban est un tableau Markdown tout en bas ; le runtime de l'agent, l'exécution et la maintenance forment une couche interchangeable empilée par-dessus.",
    theirsDiagramAlt:
      "Un runtime Hermes intégré, avec le tableau SQLite, le répartiteur et les agents nommés fondus à l'intérieur.",
    taskLayer: "couche tâches · exécution + maintenance",
    boardLayer: "kanban · fichiers Markdown (git)",
  },
  summary: {
    heading: {
      eyebrow: "En bref",
      title: "La différence concrète",
    },
    lead: "Les deux produits répondent largement au même besoin, mais à des niveaux différents. AI4Kanban est **un système de planification portable pour l'environnement d'agents que vous utilisez déjà**. Hermes Kanban est **une file opérationnelle dans Hermes**, conçue pour coordonner plusieurs workers et reprendre le travail interrompu.",
    oursHeading: "AI4Kanban — la planification appartient au projet",
    theirsHeading: "Hermes Kanban — l'exécution appartient au runtime",
    ours: [
      "Du Markdown brut dans votre dépôt : chaque changement de tâche ou de plan se relit dans un diff.",
      "Aucune infrastructure : rien à installer, rien à maintenir allumé.",
      "L'exécution vient de l'environnement que vous utilisez déjà : Claude Code, Codex, Cursor, et même Hermes.",
    ],
    theirs: [
      "Une file SQLite durable dans ~/.hermes/kanban.db, partagée par de nombreux agents nommés et par des humains.",
      "Un répartiteur confie les tâches prêtes aux agents et récupère les exécutions qui ont planté.",
      "Lié à la pile Hermes / Nous et à ses outils kanban_*.",
    ],
    whenLabel: "Comment choisir",
    when: "Choisissez AI4Kanban si vous voulez une planification **versionnée avec le code**, si vous préférez conserver votre environnement d'agents actuel ou si vous n'avez pas besoin d'un service d'orchestration dédié. Choisissez Hermes Kanban si **Hermes est déjà votre environnement d'exploitation** et que vous souhaitez son répartiteur, ses profils nommés, son pilotage par chat et son modèle de reprise. La persistance diffère également : AI4Kanban s'appuie sur des fichiers et git ; Hermes stocke l'état de la file dans SQLite.",
  },
  harness: {
    heading: {
      eyebrow: "Environnements compatibles",
      title: "Quels agents peuvent faire tourner le tableau ?",
    },
    lead: "C'est la distinction la plus nette. AI4Kanban utilise des fichiers ordinaires du dépôt : **tout agent capable de lire et modifier le projet peut utiliser le tableau**, y compris Hermes. Hermes Kanban est exposé par les outils `kanban_*` du runtime et reste donc propre à Hermes.",
    oursSub: "n'importe quel agent qui lit des fichiers",
    theirsSub: "Hermes uniquement",
    supported: "compatible",
    notSupported: "non compatible",
    note: "AI4Kanban fonctionne aussi avec Windsurf, OpenCode, Gemini CLI et les autres outils capables de lire les fichiers du projet. Hermes Kanban n'est accessible que par le runtime Hermes.",
  },
  comparison: {
    heading: { eyebrow: "Face à face", title: "AI4Kanban vs. Hermes Kanban" },
    lead: "Un {check} signale un avantage net ; un **tiret**, un compromis. AI4Kanban privilégie la portabilité et la simplicité d'exploitation. Hermes privilégie l'exécution coordonnée et récupérable entre plusieurs agents.",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      whatItIs: {
        dimension: "Ce que c'est",
        kanban:
          "Une couche kanban en fichiers : le tableau, c'est du Markdown brut dans votre dépôt.",
        hermes:
          "Une fonction kanban du runtime d'agents Hermes : un tableau SQLite durable.",
      },
      infrastructure: {
        dimension: "Infrastructure",
        kanban:
          "Aucune en propre : le tableau, ce ne sont que des fichiers Markdown dans votre dépôt.",
        hermes:
          "Une passerelle en fonctionnement, une base SQLite et une boucle de répartition.",
      },
      whereBoardLives: {
        dimension: "Où vit le tableau",
        kanban:
          "Dans votre dépôt, sous contrôle de version : chaque changement de tâche ou de plan se relit dans un diff.",
        hermes:
          "Dans une base SQLite à ~/.hermes/kanban.db ; les changements vont dans un journal d'événements, pas dans des diffs.",
      },
      setup: {
        dimension: "Mise en place",
        kanban: "Un prompt : un fichier de skill et un petit script.",
        hermes:
          "Installer le runtime Hermes, configurer les profils, lancer la passerelle.",
      },
      parallelRuns: {
        dimension: "Exécutions parallèles et planifiées",
        kanban:
          "C'est votre environnement qui mène : Claude Code lance des sous-agents en parallèle quand vous démarrez quelque chose ; les travaux planifiés vivent dans un dossier recurring/.",
        hermes:
          "C'est le runtime qui mène : le répartiteur prend de lui-même les tâches prêtes et lance un processus par tâche.",
      },
      crashRecovery: {
        dimension: "Reprise après plantage",
        kanban:
          "Pas de file par tâche : une exécution qui meurt en cours repasse simplement au prochain créneau planifié.",
        hermes:
          "Une file durable récupère seule le travail en cours : TTL de prise, battements de cœur, reprise des prises expirées, nouvelles tentatives.",
      },
      decomposition: {
        dimension: "Découpage des tâches",
        kanban:
          "Une carte se découpe en points à cocher et en graphe de tâches (groupe, bloquée-par, liée), les dépendances étant démêlées à l'écriture.",
        hermes:
          "Le répartiteur lance seul un découpeur LLM qui déploie une tâche en un graphe de sous-tâches confiées à des spécialistes.",
      },
      reviewMemory: {
        dimension: "Relecture et mémoire",
        kanban:
          "La mémoire est élaguée au pourquoi-c'est-écarté et au quoi-a-été-livré, pour que l'agent propose vers l'avant : sélectionnée, pas un journal complet.",
        hermes:
          "Conserve un journal d'événements complet en ajout seul et l'historique de chaque tentative, pour l'audit.",
      },
      dashboard: {
        dimension: "Interface de pilotage",
        kanban:
          "Un tableau web local où les actions d'une carte (implémenter, relire, archiver) confient le travail à un agent.",
        hermes:
          "Un tableau web en direct avec glisser-déposer et un tiroir latéral, plus le pilotage depuis des applis de chat.",
      },
      scale: {
        dimension: "Échelle et portée",
        kanban: "Convient surtout à une personne ou une petite équipe travaillant dans un même dépôt.",
        hermes:
          "Monte à de nombreux agents répartis sur de nombreux tableaux : multi-locataire, pilotable depuis Discord / Slack / e-mail / SMS.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Mémoire vs. audit",
      title: "Deux formes d'historique, deux usages",
    },
    lead: "AI4Kanban conserve le **contexte de planification** afin que les propositions suivantes tiennent compte des décisions antérieures. Hermes conserve une **trace d'exécution** afin de comprendre et reconstituer ce qui s'est passé. Les deux sont utiles, mais pas pour le même objectif.",
    ours: {
      heading: "AI4Kanban",
      verdict: "Conserve les décisions, pas chaque événement.",
      body: "Quatre petits fichiers, **élagués volontairement**, un dossier par module : `readme.md` (ce qui a été livré), `decisions.md` (les décisions prises, et pourquoi), `rejected.md` (ce qu'on a écarté, et pourquoi), `redesign.md` (les erreurs de conception à ne pas refaire). `goal.md` vit seul, en haut du dossier mémoire. L'agent les lit tous avant de proposer ou d'écrire une carte ; l'historique complet, c'est l'affaire de git.",
      q: "Pourquoi l'idée X n'est-elle pas sur le tableau ?",
      a: "Une ligne dans `rejected.md` : l'idée, et pourquoi elle a été écartée. Les idées mortes restent mortes.",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "Conserve la trace complète des exécutions.",
      body: "Chaque changement d'état atterrit dans un **journal en ajout seul** ; chaque tentative garde son code de sortie et toute la sortie du processus. C'est fait pour l'audit et la reprise après plantage, pas pour orienter l'idée suivante.",
      q: "Qu'est-il arrivé à la tâche 42 cette nuit ?",
      a: "`claimed → crashed → reclaimed → completed`, avec les journaux de chaque tentative à lire.",
    },
    note: "La mémoire sélectionnée éclaire la prochaine décision ; le journal d'audit explique la dernière exécution. Aucun ne remplace l'autre.",
  },
  autonomy: {
    heading: {
      eyebrow: "Niveau d'autonomie",
      title: "Quelle autonomie donner à l'agent ?",
    },
    lead: "Hermes Kanban vise une exécution **« une phrase suffit, puis vous pouvez partir »**. AI4Kanban adopte une **autonomie soumise à validation** : vous consignez une idée incomplète, `refine` la transforme en exigences concrètes, puis l'implémentation attend votre accord.",
    stops: {
      traditional: {
        level: "Aucune autonomie",
        term: "Mené par l'humain",
        heading: "Kanban classique",
        detail:
          "Vous pensez chaque tâche et vous la découpez ; Trello ou Jira ne fait que l'enregistrer.",
      },
      kanban: {
        level: "Autonomie contrôlée",
        term: "L'agent propose, l'humain valide",
        heading: "AI4Kanban",
        detail:
          "Chaque `refine` creuse les pièces manquantes et complète les exigences. Vous relisez avant que quoi que ce soit soit construit.",
      },
      hermes: {
        level: "Autonomie totale",
        term: "Exécution sans surveillance",
        heading: "Hermes Kanban",
        detail:
          "Une ligne en entrée, un arbre de tâches en sortie : découpé et traité sans surveillance jusqu'au bout. Le `/goal` de Claude Code fait le même pari.",
      },
    },
    scaleLeft: "Vous planifiez tout",
    scaleMiddle: "L'agent planifie, vous validez",
    scaleRight: "L'agent planifie tout",
    worstCaseLabel: "Le risque à chaque niveau",
    worstCaseTheirs:
      "**Exécution sans surveillance :** un malentendu initial peut se propager dans tout l'arbre de tâches avant une première relecture humaine.",
    worstCaseOurs:
      "**Autonomie contrôlée :** un plan Markdown imparfait arrive en relecture, mais l'implémentation n'a pas encore commencé.",
    note: "Un passage de refinement comble les lacunes, sépare les idées voisines dans leurs propres cartes, reconnaît le travail déjà terminé et transforme les arbitrages en questions. Une fois ces questions résolues, la carte passe en **ready** pour validation finale et implémentation.",
  },
  gui: {
    heading: { eyebrow: "Les interfaces", title: "Deux tableaux, deux rôles" },
    lead: "Les deux proposent une interface web. Celle d'AI4Kanban est une **surface de commande du travail projet** : les actions d'une carte lancent les agents. Celle d'Hermes est une **vue opérationnelle du répartiteur** : elle affiche l'état actuel de la flotte d'agents.",
    ours: {
      heading: "AI4Kanban — tableau local",
      body: "Un tableau web local posé sur les fichiers Markdown. Les actions d'une carte (*implémenter, relire, archiver*) confient le travail à un agent, et vous voyez son journal défiler avec des questions au passage.",
      alt: "Le tableau web local d'AI4Kanban : un tableau clair avec les colonnes Blockers, UI, Skill, Docs et Distribution et un bouton pour créer une tâche.",
    },
    theirs: {
      heading: "Hermes Kanban — vue en direct du répartiteur",
      body: "Un tableau en direct qui suit le journal d'événements : glisser-déposer entre colonnes, un tiroir latéral avec l'historique des exécutions et des badges de statut de sortie, et le même tableau pilotable depuis Discord, Slack ou SMS.",
      alt: "Le tableau de bord Kanban d'Hermes Agent : un tableau sombre avec les colonnes Triage, Todo, Scheduled et Ready et une barre d'orchestration.",
    },
  },
  wins: {
    heading: { eyebrow: "Compromis", title: "Où chacun l'emporte" },
    lead: "Le meilleur choix dépend de votre mode d'exploitation. AI4Kanban réduit l'infrastructure au minimum et garde la planification portable. Hermes Kanban fournit une file partagée durable pour coordonner les exécutions sans surveillance. Les deux prennent en charge le parallélisme, l'orchestration et une interface ; les avantages ci-dessous sont ceux qui les distinguent réellement.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "Aucun service de tableau à exploiter",
        body: "Pas de base de données, pas de passerelle, pas de démon. À part l'agent que vous faites déjà tourner, le tableau n'est qu'un ensemble de fichiers Markdown : rien de plus à installer ni à maintenir en vie, et ça marche dans un avion.",
      },
      diffable: {
        title: "Une planification qui voyage avec le code",
        body: "Le tableau vit dans le dépôt et voyage avec lui, sous le contrôle de version que vous utilisez. Chaque changement de tâche ou de plan se relit dans un diff : pas de SQLite en dehors de votre projet, pas de journal d'événements à interroger, aucun enfermement dans une pile d'agents.",
      },
      selfPruning: {
        title: "Une mémoire pensée pour les décisions à venir",
        body: "Elle consigne pourquoi une idée a été écartée et ce qui a été livré, pour que l'agent propose vers l'avant au lieu de ressortir du travail mort. Elle ne garde que ce qui oriente la tâche suivante, pas un journal d'audit complet.",
      },
      onePrompt: {
        title: "S'intègre à votre environnement d'agents",
        body: "Un fichier de skill et un petit script : aucun profil à configurer, aucun répartiteur à régler. Elle rejoint n'importe quel agent qui lit des fichiers là où il est déjà, Hermes compris.",
      },
    },
    theirs: {
      manyAgents: {
        title: "Une file partagée entre agents nommés",
        body: "Un unique tableau durable sur lequel plusieurs agents nommés, et des humains, prennent des tâches et se passent le travail. Le répartiteur surveille les tâches prêtes et lance pour chacune l'agent assigné. Le tableau d'AI4Kanban, lui, est mené par le seul environnement dans lequel vous êtes.",
      },
      selfHealing: {
        title: "Reprise automatique du travail en cours",
        body: "La file suit chaque tâche à travers les plantages : TTL de prise, battements de cœur, reprise des prises expirées, nouvelles tentatives et coupe-circuits. Un processus peut mourir en cours et le tableau reprend la tâche et la réessaie. Les fichiers d'AI4Kanban sont durables aussi, mais une exécution morte attend simplement le prochain créneau planifié.",
      },
      autoDecompose: {
        title: "Découpage et routage automatiques",
        body: "Vous lâchez une tâche brute et le découpeur LLM du répartiteur la déploie en un graphe de sous-tâches, chacune confiée à un agent spécialiste, sans découpage manuel. AI4Kanban, lui, découpe une carte en points à cocher et en graphe de tâches entretenu à la main.",
      },
      fleetReach: {
        title: "Exploitation multi-agents à grande échelle",
        body: "Conçu pour de nombreux agents répartis sur de nombreux tableaux, multi-locataire, pilotable depuis Discord, Telegram, Slack, e-mail et SMS. AI4Kanban, lui, est un tableau solo et sobre qui reste dans votre dépôt et votre terminal.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Le choix", title: "Lequel utiliser ?" },
    oursHeading: "Choisissez AI4Kanban si",
    theirsHeading: "Choisissez Hermes Kanban si",
    ours: [
      "Vous voulez versionner et relire les tâches et les plans avec le code.",
      "Vous préférez un tableau portable, utilisable hors ligne et sans service à exploiter.",
      "Vous voulez choisir librement entre Claude Code, Codex, Cursor, Hermes ou un autre environnement.",
      "Vous êtes seul ou en petite équipe et privilégiez une couche de planification ciblée.",
    ],
    theirs: [
      "Hermes est déjà votre runtime principal, avec profils, passerelle et pilotage par chat en place.",
      "Vous avez besoin d'une file durable partagée entre plusieurs agents nommés et des humains.",
      "Vous avez besoin de reprendre automatiquement le travail interrompu.",
      "Vous voulez que le répartiteur découpe les tâches et les confie à des agents spécialistes.",
      "Vous exploitez de nombreux agents sur plusieurs tableaux et canaux de communication.",
    ],
    verdict:
      "Choisissez AI4Kanban pour une **couche de planification intégrée au dépôt et indépendante du runtime d'agents**. Choisissez Hermes Agent Kanban pour une **file partagée durable avec répartition, reprise et coordination multi-agents intégrées**. La vraie question n'est pas le nombre de fonctions, mais l'endroit auquel la planification doit appartenir : le projet ou le runtime.",
    note: "Les deux peuvent aussi se compléter : affinez et validez le travail dans AI4Kanban avec git, puis confiez l'exécution partagée approuvée à la file durable d'Hermes.",
  },
};

export default fr;
