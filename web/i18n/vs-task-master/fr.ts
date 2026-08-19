// Français — the Task Master comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const fr: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Task Master — écrire la spec, ou se la faire demander",
    socialTitle: "AI4Kanban vs. Task Master",
    description:
      "Comparez AI4Kanban et Task Master (Taskmaster). Task Master découpe le PRD que vous avez déjà écrit en un backlog ordonné. AI4Kanban part d’une idée floue et questionne jusqu’à ce que la carte soit réalisable.",
    social:
      "Task Master a besoin d’un PRD pour commencer. AI4Kanban part d’une seule phrase et vous demande le reste. Voyez quel point de départ correspond à votre façon de travailler.",
  },
  hero: {
    badge: "Comparaison",
    title: "AI4Kanban vs.\nTask Master",
    lead: "Les deux donnent à l’agent de code une liste de tâches plutôt qu’une fenêtre de chat. Task Master prend le document d’exigences que vous avez écrit et le découpe en un backlog ordonné. AI4Kanban commence une étape plus tôt : vous donnez une phrase approximative, et il questionne jusqu’à ce qu’il y ait quelque chose qui mérite d’être construit.",
    ours: {
      name: "AI4Kanban",
      body: "Un tableau Markdown dans votre dépôt. L’agent propose le travail, demande ce qu’il ne peut pas trancher et archive ce qui est livré.",
    },
    theirs: {
      name: "Task Master",
      body: "Un moteur de tâches pour tout éditeur avec IA. Analyse un PRD, l’étend en sous-tâches et vide le backlog.",
    },
    oursDiagramAlt:
      "Une phrase approximative entre dans AI4Kanban, qui renvoie les questions auxquelles il ne peut pas répondre seul et rend une carte terminée.",
    theirsDiagramAlt:
      "Un document d’exigences terminé entre dans Task Master et revient découpé en tâches numérotées, dans l’ordre des dépendances.",
    oursDiagramTop: "en entrée : une phrase floue",
    oursDiagramBottom: "il questionne, puis écrit la carte",
    theirsDiagramTop: "en entrée : le document que vous avez écrit",
    theirsDiagramBottom: "des tâches numérotées, dans l’ordre des dépendances",
  },
  summary: {
    heading: {
      eyebrow: "En bref",
      title: "La différence, c’est ce que vous devez apporter.",
    },
    lead: "Task Master — écrit `Taskmaster` dans sa propre documentation — est le gestionnaire de tâches le plus connu pour les agents de code, et il fait bien son travail. Il lit un document d’exigences, le découpe en tâches avec leurs dépendances, note la complexité de chacune, étend les plus lourdes en sous-tâches et vous rend la prochaine tâche que rien ne bloque. Si vous écrivez déjà des spécifications, c’est presque tout ce qu’il vous faut.",
    panel:
      "AI4Kanban part du principe que la spec n’existe pas encore. Vous donnez une phrase. Il lit le code et la mémoire du projet, tranche ce qu’il peut trancher seul, ne vous demande que ce qui reste vraiment ouvert, et recommence jusqu’à ce que la carte soit assez concrète pour être construite. **Les questions sont le produit.** Le tableau est l’endroit où les réponses restent.",
    note: "Vérifié le 10 août 2026 : la dernière version de Task Master est la 0.43.1 (31 mars 2026) et le dernier commit sur `main` date du 23 avril 2026, tandis que la même équipe développe Hamster, un espace de planification hébergé. Le paquet est toujours installé environ 78 000 fois par mois : c’est un outil très utilisé dont le dépôt est calme, pas un projet abandonné.",
  },
  start: {
    heading: {
      eyebrow: "Jour un",
      title: "Ce qu’il faut apporter avant que l’un ou l’autre serve à quelque chose",
    },
    lead: "Même objectif : une tâche qu’un agent de code peut terminer sans deviner. Les deux outils demandent des choses différentes au départ, et c’est presque toute la comparaison.",
    ours: {
      label: "AI4Kanban",
      title: "Une phrase suffit",
      steps: [
        "Dites l’idée en gros. Pas de format, pas de document, pas de modèle.",
        "L’agent lit le code et les décisions passées du projet, tranche ce qu’il peut, et ne vous pose que les questions encore ouvertes.",
        "Il écrit la carte, la place dans le tableau selon sa valeur et ses dépendances, et garde vos réponses pour la fois suivante.",
      ],
    },
    theirs: {
      label: "Task Master",
      title: "D’abord un document écrit",
      steps: [
        "Écrivez le document d’exigences. Leur guide suggère de le rédiger avec un modèle de chat, puis de l’enregistrer sous `.taskmaster/docs/prd.txt`.",
        "`parse-prd` le découpe en tâches avec dépendances, `expand` les casse en sous-tâches et `analyze-complexity` note celles qu’il faut découper davantage.",
        "`next` vous rend la tâche la plus prioritaire que rien ne bloque.",
      ],
    },
    note: "Aucun des deux chemins n’est difficile. Mais quand le document est flou, Task Master découpe un document flou : vous pouvez toujours lancer `update-task` avec plus de contexte, et le modèle de recherche peut aller se documenter, mais rien dans la boucle ne vous demande ce que vous vouliez dire.",
  },
  comparison: {
    heading: { eyebrow: "Face à face", title: "AI4Kanban vs. Task Master" },
    lead: "Un {check} marque l’option la plus nette pour ce besoin ; un **tiret** signifie que cela dépend de votre façon de travailler. Task Master est plus fort sur **la couverture, l’exécution par lots et la recherche en direct**. AI4Kanban est plus fort pour **passer d’une idée floue à une vraie spec, et garder ce qui a été décidé**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Task Master",
    rows: {
      startingPoint: {
        dimension: "D’où vient une tâche",
        kanban:
          "Une phrase approximative de votre part, ou une proposition que l’agent fait seul après avoir lu le code et le tableau.",
        taskMaster:
          "Un document d’exigences que vous écrivez d’abord, puis analysé en tâches. Vous pouvez aussi ajouter une tâche à la fois depuis une consigne.",
      },
      vagueRequest: {
        dimension: "Quand la demande est floue",
        kanban:
          "Une boucle d’affinage répond à ce que la mémoire et le code permettent, vous demande le reste, et ne déclare pas la carte prête tant qu’une question est ouverte.",
        taskMaster:
          "Les tâches sortent aussi précises que le document est entré. Vous pouvez mettre à jour une tâche, l’étendre, ou envoyer le modèle de recherche se renseigner.",
      },
      board: {
        dimension: "Ce qu’est le tableau sur le disque",
        kanban:
          "Un fichier Markdown par carte sous `docs/kanban/`, plus des fichiers de mémoire en texte brut. Un diff se lit comme une phrase.",
        taskMaster:
          "Un seul `.taskmaster/tasks/tasks.json` contenant toutes les tâches et sous-tâches ; `generate` peut aussi écrire un fichier texte par tâche.",
      },
      setup: {
        dimension: "Ce qu’il faut mettre en place",
        kanban:
          "Une consigne. Pas de serveur MCP, pas de clés d’API, pas de modèles à configurer : c’est le modèle de votre agent de code qui réfléchit.",
        taskMaster:
          "Un serveur MCP ou la CLI, plus les modèles principal, de recherche et de secours. Les fournisseurs Claude Code et Codex ne demandent pas de clé supplémentaire ; la plupart des autres si.",
      },
      execution: {
        dimension: "Faire tourner le travail",
        kanban:
          "Votre agent implémente la carte et l’archive. Pas d’exécuteur par lots, pas de flux de tests imposé.",
        taskMaster:
          "`loop` enchaîne des sessions neuves de Claude Code, avec des préréglages pour les tests, le lint et la duplication ; `autopilot` mène un cycle TDD rouge-vert-commit sur sa propre branche.",
      },
      memory: {
        dimension: "Ce qui se transmet",
        kanban:
          "Une mémoire par module : décisions, idées rejetées, corrections de conception et travail livré, relus avant la proposition suivante — un non reste donc un non.",
        taskMaster:
          "Des notes horodatées ajoutées aux sous-tâches, des fichiers de recherche enregistrés, et des étiquettes qui séparent plusieurs listes de tâches.",
      },
      reach: {
        dimension: "Où ça tourne",
        kanban:
          "Claude Code, Codex, Cursor, OpenCode et DeepSeek Harness aujourd’hui. Le tableau n’est que des fichiers : un autre harnais n’a pas besoin d’un nouveau format, seulement d’un branchement.",
        taskMaster:
          "Cursor, Windsurf, VS Code, Claude Code, Codex, Kiro, Amazon Q et d’autres, via MCP ou la CLI, avec plus de quinze fournisseurs de modèles.",
      },
      teams: {
        dimension: "À plusieurs",
        kanban:
          "La collaboration, c’est git : brancher, relire le plan dans une pull request, fusionner. Rien ne se synchronise en temps réel.",
        taskMaster:
          "Le tableau open source est local lui aussi, mais la même équipe vend Hamster, un espace hébergé avec briefs partagés et synchronisation, à partir de 40 dollars par créateur et par mois.",
      },
      license: {
        dimension: "Licence",
        kanban:
          "Apache-2.0. Utilisez-le, forkez-le, vendez ce que vous construisez avec : aucune condition supplémentaire.",
        taskMaster:
          "MIT avec la Commons Clause : gratuit pour un usage personnel, commercial et académique, mais vous ne pouvez ni vendre Task Master lui-même ni le proposer comme service hébergé.",
      },
    },
  },
  boardShape: {
    heading: {
      eyebrow: "Sur le disque",
      title: "Un fichier JSON, ou un fichier par carte",
    },
    lead: "Les deux tableaux vivent dans votre dépôt et sont donc versionnés avec le code. Ce qui change, c’est ce qu’un diff montre à un humain.",
    oursLabel: "AI4Kanban",
    theirsLabel: "Task Master",
    oursCaption:
      "Une carte, un fichier Markdown. Une pull request montre le plan qui change, en mots que vous pouvez lire et contester.",
    theirsCaption:
      "Un fichier contient tout le backlog. Le diff montre du JSON : exact, et pas écrit pour être lu.",
    note: "Task Master a ajouté un verrou de fichier entre processus en 0.42.0 pour que deux écritures simultanées ne perdent pas de données. Des fichiers séparés ne partagent pas cette contention : deux exécutions ne se heurtent que si elles modifient la même carte.",
  },
  wins: {
    heading: { eyebrow: "Compromis", title: "Là où chacun gagne" },
    lead: "Task Master va plus loin, tourne plus longtemps sans vous et sait aller se documenter. AI4Kanban est plus étroit volontairement : il gagne sa place sur la partie du travail qui précède l’existence même d’une tâche.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Task Master",
    ours: {
      asksFirst: {
        title: "Il demande avant de construire",
        body: "L’agent transforme une phrase floue en questions, répond à ce que le code et les décisions passées permettent, et ne vous laisse que ce que personne d’autre ne peut trancher.",
      },
      diffablePlan: {
        title: "Le plan est un texte lisible",
        body: "Chaque carte est un fichier Markdown. Vous relisez un plan comme vous relisez du code : dans un diff, en mots, avant que quoi que ce soit ne soit écrit.",
      },
      moduleMemory: {
        title: "Il se souvient de vos refus",
        body: "Décisions, idées rejetées et corrections de conception sont gardées par module et relues avant la proposition suivante : le tableau cesse donc de suggérer deux fois la même chose.",
      },
      nothingToWire: {
        title: "Rien à monter",
        body: "Pas de serveur MCP, pas de clés d’API, pas de rôles de modèles à configurer, pas de schémas d’outils dans chaque conversation. Une consigne l’installe dans un dépôt.",
      },
    },
    theirs: {
      everywhere: {
        title: "Il tourne presque partout",
        body: "Cursor, Windsurf, VS Code, Claude Code, Codex, Kiro et d’autres, via MCP ou une CLI, avec plus de quinze fournisseurs de modèles, locaux compris.",
      },
      research: {
        title: "La recherche est intégrée",
        body: "Un rôle de recherche dédié peut apporter des informations à jour pendant l’écriture ou l’extension des tâches, et enregistre ce qu’il a trouvé à côté d’elles.",
      },
      batchRuns: {
        title: "Il peut travailler pendant votre sommeil",
        body: "`loop` ouvre une session neuve par tâche, avec des préréglages pour les tests, le lint, la duplication et les odeurs de code ; `autopilot` mène un cycle TDD strict sur sa propre branche.",
      },
      proven: {
        title: "C’est celui que tout le monde connaît",
        body: "Environ 28 000 étoiles GitHub et près de 78 000 installations npm par mois, avec une documentation, un Discord et des années de méthodes partagées à copier.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La décision", title: "Lequel correspond à votre façon de travailler ?" },
    oursHeading: "Choisissez AI4Kanban quand",
    theirsHeading: "Choisissez Task Master quand",
    ours: [
      "Vos idées commencent par une phrase, et c’est l’écriture de la spec qui vous bloque.",
      "Vous voulez relire le plan et ses raisons dans un diff, à côté du code.",
      "Vous voulez que le tableau retienne les décisions et les refus et cesse de reposer les mêmes questions.",
      "Vous préférez ne pas faire tourner un serveur MCP de plus, garder plus de clés d’API ni configurer des modèles.",
    ],
    theirs: [
      "Vous écrivez déjà des documents d’exigences et voulez qu’ils soient bien découpés et ordonnés.",
      "Vous travaillez dans Cursor, Windsurf, VS Code ou Kiro et voulez le tableau dans l’éditeur.",
      "Vous voulez des exécutions autonomes par lots ou un flux strict de tests d’abord, sans rien monter.",
      "Vous voulez de la recherche en direct dans la planification, ou un fournisseur de modèles que nous ne couvrons pas.",
    ],
    verdict:
      "Task Master commence là où votre spec s’arrête. AI4Kanban commence avant : tout son travail est le trajet entre une idée floue et une tâche qui mérite d’être confiée à un agent. Si vous écrivez de bons documents, Task Master abattra plus de travail aujourd’hui. Si ces documents sont justement ce qui ne s’écrit jamais, c’est ce trou-là qu’il faut combler d’abord.",
    note: "Les deux ne s’excluent pas : un PRD écrit à partir d’une carte AI4Kanban affinée s’analyse très bien. Mais un seul tableau doit détenir l’état des tâches, sinon vous en maintiendrez deux.",
  },
};

export default fr;
