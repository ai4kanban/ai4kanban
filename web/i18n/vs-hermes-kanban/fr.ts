// Français — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const fr: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — un tableau en fichiers léger face à un runtime durable",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "Comment le tableau en fichiers d'ai4kanban se compare à Hermes Agent Kanban, de Nous Research : deux tableaux kanban pour agents qui se recouvrent beaucoup, d'un côté des fichiers bruts et diffables qui tournent sur n'importe quel agent (Hermes compris), de l'autre une file SQLite durable et partagée dans laquelle de nombreux agents nommés viennent prendre des tâches.",
    social:
      "Deux tableaux kanban pour agents qui se recouvrent beaucoup. ai4kanban est un tableau léger en fichiers qui tourne sur n'importe quel agent (Hermes compris) ; Hermes livre le même tableau avec une file durable partagée par de nombreux agents nommés.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Deux tableaux kanban tournés vers les agents, avec beaucoup de recouvrement. La différence tient à l'endroit où le tableau se situe dans la pile : ai4kanban est une *couche tableau* légère sur laquelle vous faites tourner n'importe quel agent ; Hermes Agent Kanban fond ce tableau dans son propre runtime.",
    ours: {
      name: "AI4Kanban",
      body: "Un tableau en Markdown brut dans votre dépôt. Le runtime, l'exécution et même la maintenance se posent par-dessus : changez d'agent, gardez le tableau.",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "Le tableau, le répartiteur et les agents nommés forment un seul runtime : durable et tout compris, mais le tableau ne se détache pas d'Hermes.",
    },
    oursDiagramAlt:
      "Le kanban est un tableau Markdown tout en bas ; le runtime de l'agent, l'exécution et la maintenance forment une couche interchangeable empilée par-dessus.",
    theirsDiagramAlt:
      "Un runtime Hermes intégré, avec le tableau SQLite, le répartiteur et les agents nommés fondus à l'intérieur.",
    taskLayer: "couche tâches · exécution + maintenance",
    boardLayer: "kanban · fichiers Markdown (git)",
    runtimeLabel: "Runtime Hermes",
  },
  summary: {
    heading: {
      eyebrow: "En bref",
      title: "Alors pourquoi ne pas simplement utiliser Hermes Kanban ?",
    },
    lead: "Bonne question, les deux se recouvrent pas mal. Ce sont deux tableaux kanban depuis lesquels un agent planifie et travaille ; voyez donc ai4kanban comme **une alternative légère à Hermes Kanban** : la même idée de tableau, sans le runtime embarqué. La différence est dessous.",
    oursHeading: "AI4Kanban — un tableau fait de fichiers",
    theirsHeading: "Hermes Kanban — un tableau à l'intérieur d'un runtime",
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
    whenLabel: "Quand prendre ai4kanban",
    when: "Prenez ai4kanban quand vous voulez le tableau **versionné avec votre code**, quand vous comptez rester dans un environnement que vous faites déjà tourner, ou quand vous ne voulez pas exploiter un runtime juste pour avoir un tableau de tâches. Prenez Hermes Kanban quand **vous travaillez déjà à fond avec Hermes** : son tableau se branche directement sur le répartiteur, les profils nommés et le pilotage par chat que vous avez montés. Au fond, les deux sont des files durables ; celle d'ai4kanban, ce sont des fichiers dans git, celle d'Hermes, des lignes dans SQLite.",
  },
  harness: {
    heading: {
      eyebrow: "Environnements compatibles",
      title: "Quels agents peuvent faire tourner le tableau ?",
    },
    lead: "La différence la plus nette de toutes. Le tableau d'ai4kanban, ce sont des fichiers bruts : **n'importe quel agent capable de lire un dépôt peut le faire tourner**, Hermes compris. Le tableau d'Hermes Kanban se trouve derrière les outils `kanban_*` du runtime, donc seul Hermes le peut.",
    oursSub: "n'importe quel agent qui lit des fichiers",
    theirsSub: "Hermes uniquement",
    supported: "compatible",
    notSupported: "non compatible",
    note: "…et la ligne d'ai4kanban continue encore : Windsurf, OpenCode, Gemini CLI, tout ce qui lit des fichiers. Hermes Kanban ne laisse aucune porte d'entrée aux autres agents.",
  },
  comparison: {
    heading: { eyebrow: "Face à face", title: "AI4Kanban vs. Hermes Kanban" },
    lead: "Un {check}, c'est une victoire nette ; un **tiret**, c'est un compromis. ai4kanban l'emporte sur la simplicité et la portabilité, Hermes sur la file partagée durable et l'échelle ; le reste est à égalité.",
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
        kanban: "Un tableau solo ; grep devient pénible à mesure qu'il grossit.",
        hermes:
          "Monte à de nombreux agents répartis sur de nombreux tableaux : multi-locataire, pilotable depuis Discord / Slack / e-mail / SMS.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Mémoire vs. audit",
      title: "Ce dont chaque tableau se souvient",
    },
    lead: "La différence essentielle : la mémoire d'ai4kanban est une **entrée pour la planification**, elle existe pour que la proposition suivante soit plus fine. Le journal d'Hermes est une **sortie de l'exécution**, il existe pour qu'on puisse rejouer le passé.",
    ours: {
      heading: "AI4Kanban",
      verdict: "Retient les conclusions, oublie le reste.",
      body: "Quatre petits fichiers, **élagués volontairement** : `archive.md` (ce qui a été livré), `rejected.md` (ce qu'on a écarté, et pourquoi), `redesign.md` (les erreurs de conception à ne pas refaire), `memory.md` (ce que les passages précédents ont appris). L'agent les lit tous avant de proposer ou d'écrire une carte ; l'historique complet, c'est l'affaire de git.",
      q: "Pourquoi l'idée X n'est-elle pas sur le tableau ?",
      a: "Une ligne dans `rejected.md` : l'idée, et pourquoi elle a été écartée. Les idées mortes restent mortes.",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "Retient chaque événement, ne résume rien.",
      body: "Chaque changement d'état atterrit dans un **journal en ajout seul** ; chaque tentative garde son code de sortie et toute la sortie du processus. C'est fait pour l'audit et la reprise après plantage, pas pour orienter l'idée suivante.",
      q: "Qu'est-il arrivé à la tâche 42 cette nuit ?",
      a: "`claimed → crashed → reclaimed → completed`, avec les journaux de chaque tentative à lire.",
    },
    note: "Une mémoire sélectionnée rend l'agent plus fin la fois d'après ; un journal d'audit rend le passé reconstituable. Ni l'un ni l'autre ne remplace l'autre.",
  },
  autonomy: {
    heading: {
      eyebrow: "Niveau d'autonomie",
      title: "Quelle autonomie donner à l'agent ?",
    },
    lead: "Hermes Kanban promet **« lâchez une phrase et partez »**, l'autonomie totale. ai4kanban est **assisté par l'agent**, et il démarre plus tôt que le mode plan : vous enregistrez une idée à moitié formée sur le tableau, `refine` la transforme en exigences concrètes, et vous validez avant qu'une ligne de code soit écrite.",
    stops: {
      traditional: {
        level: "Aucune autonomie",
        term: "Mené par l'humain",
        heading: "Kanban classique",
        detail:
          "Vous pensez chaque tâche et vous la découpez ; Trello ou Jira ne fait que l'enregistrer.",
      },
      kanban: {
        level: "Semi-autonomie",
        term: "Assisté par l'agent",
        heading: "AI4Kanban",
        detail:
          "Chaque `refine` creuse les pièces manquantes et complète les exigences. Vous relisez avant que quoi que ce soit soit construit.",
      },
      hermes: {
        level: "Autonomie totale",
        term: "On lâche et on oublie",
        heading: "Hermes Kanban",
        detail:
          "Une ligne en entrée, un arbre de tâches en sortie : découpé et traité sans surveillance jusqu'au bout. Le `/goal` de Claude Code fait le même pari.",
      },
    },
    scaleLeft: "Vous planifiez tout",
    scaleMiddle: "L'agent planifie, vous validez",
    scaleRight: "L'agent planifie tout",
    worstCaseLabel: "Le pire des cas, par niveau",
    worstCaseTheirs:
      "**On lâche et on oublie :** un petit malentendu du départ devient tout un arbre de tâches erronées, construites, tokens dépensés.",
    worstCaseOurs:
      "**Assisté par l'agent :** une carte Markdown erronée, repérée quand vous la relisez, avant que quoi que ce soit soit construit.",
    note: "Un refine complète les étapes qui manquent, sort les idées de côté dans leurs propres cartes, coche les points déjà faits, et vous laisse les arbitrages de goût sous forme de questions. Quand il n'en reste plus, la carte bascule en **ready** : vous la lisez, puis vous la construisez.",
  },
  gui: {
    heading: { eyebrow: "Les interfaces", title: "L'interface du tableau kanban" },
    lead: "Les deux livrent un tableau web, mais ils ne jouent pas le même rôle. Celui d'ai4kanban est une **surface de commande pour votre agent** : les actions d'une carte déclenchent des exécutions. Celui d'Hermes est une **fenêtre en direct sur le répartiteur** : il montre ce que la flotte fait en ce moment.",
    ours: {
      heading: "AI4Kanban — tableau local",
      body: "Un tableau web local posé sur les fichiers Markdown. Les actions d'une carte (*implémenter, relire, archiver*) confient le travail à un agent, et vous voyez son journal défiler avec des questions au passage.",
      alt: "Le tableau web local d'ai4kanban : un tableau clair avec les colonnes Blockers, UI, Skill, Docs et Distribution et un bouton pour créer une tâche.",
    },
    theirs: {
      heading: "Hermes Kanban — vue en direct du répartiteur",
      body: "Un tableau en direct qui suit le journal d'événements : glisser-déposer entre colonnes, un tiroir latéral avec l'historique des exécutions et des badges de statut de sortie, et le même tableau pilotable depuis Discord, Slack ou SMS.",
      alt: "Le tableau de bord Kanban d'Hermes Agent : un tableau sombre avec les colonnes Triage, Todo, Scheduled et Ready et une barre d'orchestration.",
    },
  },
  wins: {
    heading: { eyebrow: "Compromis", title: "Où chacun l'emporte" },
    lead: "Aucun n'est meilleur dans l'absolu. ai4kanban optimise pour un tableau léger, fait de fichiers, sans infrastructure propre ; Hermes Kanban optimise pour une file de travail durable et partagée que de nombreux agents attaquent sans surveillance. Les fonctions de l'environnement (exécutions parallèles, orchestration, interface) existent des deux côtés, donc elles ne sont pas listées ici.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "Aucune infrastructure propre",
        body: "Pas de base de données, pas de passerelle, pas de démon. À part l'agent que vous faites déjà tourner, le tableau n'est qu'un ensemble de fichiers Markdown : rien de plus à installer ni à maintenir en vie, et ça marche dans un avion.",
      },
      diffable: {
        title: "Des fichiers versionnables, qui se relisent en diff",
        body: "Le tableau vit dans le dépôt et voyage avec lui, sous le contrôle de version que vous utilisez. Chaque changement de tâche ou de plan se relit dans un diff : pas de SQLite en dehors de votre projet, pas de journal d'événements à interroger, aucun enfermement dans une pile d'agents.",
      },
      selfPruning: {
        title: "Une mémoire qui s'élague seule",
        body: "Elle consigne pourquoi une idée a été écartée et ce qui a été livré, pour que l'agent propose vers l'avant au lieu de ressortir du travail mort. Elle ne garde que ce qui oriente la tâche suivante, pas un journal d'audit complet.",
      },
      onePrompt: {
        title: "S'installe en un prompt",
        body: "Un fichier de skill et un petit script : aucun profil à configurer, aucun répartiteur à régler. Elle rejoint n'importe quel agent qui lit des fichiers là où il est déjà, Hermes compris.",
      },
    },
    theirs: {
      manyAgents: {
        title: "Un tableau, de nombreux agents nommés",
        body: "Un unique tableau durable sur lequel plusieurs agents nommés, et des humains, prennent des tâches et se passent le travail. Le répartiteur surveille les tâches prêtes et lance pour chacune l'agent assigné. Le tableau d'ai4kanban, lui, est mené par le seul environnement dans lequel vous êtes.",
      },
      selfHealing: {
        title: "Une file de tâches qui se répare seule",
        body: "La file suit chaque tâche à travers les plantages : TTL de prise, battements de cœur, reprise des prises expirées, nouvelles tentatives et coupe-circuits. Un processus peut mourir en cours et le tableau reprend la tâche et la réessaie. Les fichiers d'ai4kanban sont durables aussi, mais une exécution morte attend simplement le prochain créneau planifié.",
      },
      autoDecompose: {
        title: "Découpe les tâches automatiquement",
        body: "Vous lâchez une tâche brute et le découpeur LLM du répartiteur la déploie en un graphe de sous-tâches, chacune confiée à un agent spécialiste, sans découpage manuel. ai4kanban, lui, découpe une carte en points à cocher et en graphe de tâches entretenu à la main.",
      },
      fleetReach: {
        title: "Portée et échelle de flotte",
        body: "Conçu pour de nombreux agents répartis sur de nombreux tableaux, multi-locataire, pilotable depuis Discord, Telegram, Slack, e-mail et SMS. ai4kanban, lui, est un tableau solo et sobre qui reste dans votre dépôt et votre terminal.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Le choix", title: "Lequel utiliser ?" },
    oursHeading: "Prenez ai4kanban quand",
    theirsHeading: "Prenez Hermes Kanban quand",
    ours: [
      "Vous voulez un tableau en fichiers : chaque changement de tâche ou de plan se relit dans un diff.",
      "Vous ne voulez aucune infrastructure propre : des fichiers bruts, hors ligne, transportables, sans enfermement.",
      "Vous le voulez indépendant de l'agent : Claude Code, Cursor, et même Hermes.",
      "Vous êtes seul et préférez un tableau sobre à un moteur tout compris.",
    ],
    theirs: [
      "Vous travaillez déjà à fond avec Hermes : profils, passerelle et pilotage par chat sont en place.",
      "Vous voulez un unique tableau durable partagé par de nombreux agents nommés, et par des humains.",
      "Vous voulez une file qui récupère seule les tâches en cours après un plantage.",
      "Vous voulez que le répartiteur découpe les tâches tout seul et les confie à des spécialistes.",
      "Vous faites tourner des charges de flotte sur de nombreux tableaux et plateformes de chat.",
    ],
    verdict:
      "Ils se recouvrent bien plus que les noms ne le laissent croire : ce sont deux tableaux kanban pour agents. La ligne de partage, c'est ce qui est embarqué. ai4kanban est un **tableau en fichiers qui laisse l'automatisation à votre environnement** ; Hermes Agent Kanban, c'est ce même tableau **enveloppé dans une file de travail durable et partagée**. Si vous voulez un tableau que de nombreux agents partagent et qui survit aux plantages, prenez Hermes. Si vous voulez un tableau sobre dans votre dépôt que vous n'étendez qu'au besoin, prenez ai4kanban.",
    note: "Ils peuvent même cohabiter : ai4kanban comme l'endroit léger où vous planifiez et élaguez dans git, Hermes comme la file durable qui exécute le travail lourd et partagé une fois que vous avez décidé ce que c'est.",
  },
};

export default fr;
