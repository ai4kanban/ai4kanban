// Français — mirrors `en.ts` key for key. See that file for the inline markup
// rules (`code`, **bold**, *italic*, \n).
//
// Product names (AI4Kanban, Claude Code, GitHub Issues, Hermes Agent Kanban,
// Vibe Kanban), file names, track names and shell commands stay as they are.
//
// French typography: a narrow no-break space (U+202F) sits before ; ! ? and a
// no-break space (U+00A0) before : and inside « ». They are invisible in this
// file but they are what keeps the punctuation from wrapping to the next line.
import type { SiteCopy } from "./types";

const fr: SiteCopy = {
  shared: {
    nav: {
      install: "Installation",
      usage: "L'utiliser",
      boardUi: "Tableau web",
      features: "Fonctions",
      recipes: "Recettes",
      compare: "Comparatifs",
      compareMore: "D'autres comparatifs bientôt…",
      github: "GitHub ↗",
    },
    footer: {
      license: "Licence Apache 2.0",
      origin: "Généralisé à partir d'une skill conçue pour",
    },
    code: {
      copy: "Copier",
      copied: "Copié",
      copyAria: "Copier dans le presse-papiers",
      copiedAria: "Copié",
    },
    language: { label: "Langue" },
    vs: "vs",
    bottomLine: "En résumé",
    cta: { install: "Installer ai4kanban", github: "Voir sur GitHub ↗" },
  },

  home: {
    meta: {
      title: "AI4Kanban — la gestion de projet par IA qui grandit avec vous",
      description:
        "La gestion de projet par IA pour Claude Code : une skill et un tableau local. Donnez-lui une idée floue et l'agent la découpe, tranche seul ce qu'il peut et clarifie le reste avec vous jusqu'à ce qu'elle soit prête à construire. Du Markdown brut, dans git.",
      social:
        "Donnez-lui une idée floue. L'agent la découpe, tranche seul ce qu'il peut, vous soumet le reste et poursuit en arrière-plan jusqu'à ce que chaque détail soit assez précis pour être construit.",
    },
    hero: {
      badge: "Une skill Claude Code + un tableau local",
      title: "La gestion de projet par IA\nqui grandit avec vous.",
      lead: "Donnez-lui une idée floue. L'agent la découpe, tranche seul ce qu'il peut, vous soumet le reste et poursuit en arrière-plan jusqu'à ce que chaque détail soit assez précis pour être construit. Le tableau est du Markdown brut dans `docs/kanban/` : versionné dans git, sans base de données ni MCP.",
      ctaInstall: "Installez-le en un seul prompt",
      ctaGithub: "Voir sur GitHub",
    },
    quickview: {
      caption:
        "Le tableau, rendu dans votre terminal : exactement les fichiers qui vivent dans git.",
      taskView: "Noms de tâche",
      fileView: "Chemins de fichier",
      frontAria: "Vue {view} (au premier plan)",
      flipAria: "Passer à la vue {view}",
    },
    features: {
      breakDown: {
        title: "Découpage autonome",
        body: "L'agent lit une idée et la découpe en sous-tâches. Une demande sans rapport qui s'y était glissée en ressort comme une tâche à part.",
      },
      clarify: {
        title: "Clarification en boucle",
        body: "L'agent commence par questionner l'idée. Ce que la mémoire et le bon sens suffisent à trancher, il le tranche seul ; le reste vous revient. Et il recommence jusqu'à n'avoir plus de questions.",
      },
      alwaysOn: {
        title: "Fonctionnement 24h/24",
        body: "Le découpage et les clarifications continuent en arrière-plan jusqu'à ce que l'idée devienne une spécification claire.",
      },
      traceable: {
        title: "Décisions traçables",
        body: "Vous pouvez toujours revoir comment une spécification a pris forme, étape par étape.",
      },
      proposes: {
        title: "Propositions autonomes",
        body: "L'agent avance des fonctionnalités tirées de la mémoire de chaque module. Vous en refusez une, c'est noté : il ne reproposera plus rien de ce genre.",
      },
      selfEvolving: {
        title: "Auto-évolution",
        body: "Chaque fois que vous intervenez, votre arbitrage est enregistré et oriente les décisions suivantes de l'agent. La mémoire est rangée par module du projet.",
      },
      orders: {
        title: "Dépendances et priorités",
        body: "Il ne se contente pas de découper : il repère les dépendances et met le gain en balance avec l'effort, pour que le travail avance dans le bon ordre.",
      },
      lifecycle: {
        title: "Cycle complet jusqu'à la livraison",
        body: "Son travail ne s'arrête pas quand la spécification est claire. Il mène toute la vie d'une tâche, de la proposition à la clarification, à la construction, à l'archivage, de sorte que le tableau montre toujours où en est vraiment le projet.",
      },
    },
    featuresNote:
      "AI4Kanban est fait pour les petites équipes. Les agents de code d'aujourd'hui transforment déjà une spécification claire en code qui marche, mais donnez-leur une idée floue et ils construiront la mauvaise chose sur de mauvaises hypothèses. AI4Kanban se souvient de vos décisions passées et s'en sert pour transformer cette même idée floue en une spécification assez concrète pour être construite.",
    install: {
      heading: { eyebrow: "Mise en place", title: "Installez-le en un seul prompt" },
      lead: "Depuis la racine de votre projet, dites à Claude Code (ou à n'importe quel agent capable de lancer des commandes shell) :",
      note: "L'agent lit votre code, puis lance une seule commande — `npx ai4kanban install` — qui installe la skill et met le tableau en place. Il remplit ensuite la configuration, vous demande l'objectif du projet — la seule question de l'installation —, en tire les premières décisions et crée vos dix premières tâches. Pour mettre à jour plus tard, une commande suffit aussi : `npx ai4kanban update`.",
    },
    board: {
      heading: { eyebrow: "Usage", title: "Utiliser AI4Kanban dans Claude Code" },
      lead: "Une fois installé, vous le pilotez en langage courant :",
      terminal: "you › claude",
      rows: {
        whatsNext: {
          say: '"/kanban on fait quoi ensuite ?"',
          does: "lit le tableau et vos sources, puis propose 3 nouvelles tâches",
        },
        addTask: {
          say: '"/kanban ajoute une tâche : …"',
          does: "examine l'idée, écrit une carte et l'ajoute à l'index",
        },
        refine: {
          say: '"/kanban refine #4"',
          does: "relit la carte #4, puis la pousse d'un cran vers le concret",
        },
        review: {
          say: '"/kanban passe le tableau en revue"',
          does: "vérifie la clarté, les doublons et ce qui est déjà fait",
        },
        done: {
          say: '"/kanban #4 est terminée"',
          does: "la comprime dans l'archive et supprime la carte",
        },
        badIdea: {
          say: '"/kanban #4 était une mauvaise idée"',
          does: "note pourquoi dans rejected.md pour ne jamais la reproposer",
        },
      },
    },
    ui: {
      heading: {
        eyebrow: "Tableau web",
        title: "Un tableau local que vous ouvrez dans le navigateur",
      },
      lead: "Vous préférez regarder plutôt que demander ? Une commande ouvre un tableau posé sur ces mêmes fichiers Markdown : vous lisez une tâche en entier sans chercher son fichier dans l'arborescence de l'IDE, et vous agissez d'un clic au lieu de retaper le même prompt dans le chat.",
      optional:
        "C'est facultatif : l'installation n'embarque rien de plus. Quand vous en voulez, demandez-le simplement à Claude :",
      started:
        "Claude démarre pour vous le serveur déjà compilé : en localhost uniquement, rien à compiler.",
      actionsLead:
        "Les boutons de chaque carte confient une action à l'agent, sans passer par le chat :",
      actions: {
        implement: {
          label: "Implémenter",
          body: "confier la carte à Claude pour qu'il la construise",
        },
        edit: { label: "Modifier", body: "retoucher la carte, sans la lancer" },
        refine: { label: "Affiner", body: "pousser d'un cran une carte bloquée" },
        resolve: {
          label: "Répondre",
          body: "répondre aux questions ouvertes de la carte",
        },
        archive: { label: "Archiver", body: "ranger une carte terminée" },
        reject: { label: "Rejeter", body: "abandonner une carte et noter pourquoi" },
      },
      shots: {
        board: {
          label: "Vue tableau",
          alt: "Le tableau web local d'ai4kanban, avec les colonnes Blockers, UI, Skill, Docs et Distribution remplies de cartes Markdown portant leurs #id, des badges de priorité et de ROI, et des barres de progression de sous-tâches.",
        },
        detail: {
          label: "Détail d'une carte",
          alt: "La page de détail d'une tâche dans le tableau local : titre, actions Implémenter / Relire / Modifier / Rejeter, une ligne de métadonnées avec la voie, la priorité, le ROI, les points à cocher et les blocages, et le corps complet de la carte.",
        },
      },
      frontAria: "{view} (au premier plan)",
      flipAria: "Passer à {view}",
    },
    presets: {
      heading: { eyebrow: "Préréglages", title: "Le préréglage indie-hacker" },
      lead: "Construire toute la journée pendant que personne ne regarde, c'est le piège classique du fondateur solo. Ce préréglage partage votre temps en trois : trouver des utilisateurs, vérifier la demande, construire. Et Claude maintient le nouveau travail réparti sur les trois au lieu de tout empiler sur un seul.",
      tracks: {
        growth: {
          body: "Passez devant les utilisateurs : publications, prise de contact, lancements. Claude suggère des méthodes à tenter et les rédige pour vous.",
        },
        validation: {
          body: "Vérifiez que le marché en veut avant de construire en profondeur. Posez une question honnête, partagez un essai, gardez le verdict.",
        },
        building: {
          body: "Restez au MVP. Construisez quand ça démultiplie votre travail, renforce le produit, ou quand les utilisateurs le demandent clairement.",
        },
      },
      note: "Le préréglage `indie-hacker` ajoute aussi deux garde-fous de relecture, un test de douve et un test de confiance, plus une méthode de validation marché pour publier sur Reddit ou X avant de construire. À l'installation, vous pouvez mettre vos propres voies et vos propres pondérations.",
    },
    advanced: {
      heading: {
        eyebrow: "Fonctions",
        title: "De la gestion de projet en Markdown, pas une liste à plat",
      },
      lead: "Une liste de tâches à plat n'est qu'une liste. Celle-ci fait quatre choses qu'une liste ne peut pas faire : le travail récurrent, des sous-tâches pour les gros chantiers, une mémoire de ce qui est fait, et un décompte du débit.",
      recurring: {
        title: "Tâches récurrentes",
        body: "Certains travaux ne se font jamais une fois pour toutes. Gardez chacun comme une carte dans `docs/kanban/todo/recurring/` (un travail qui n'est jamais archivé) et laissez le `/loop` de Claude Code l'exécuter à la cadence que vous choisissez, chaque matin par exemple.",
        examples: {
          competitors: {
            label: "Veille concurrentielle",
            body: "Voir ce que les concurrents ont sorti ou changé, et signaler ce qui mérite une réponse.",
          },
          listening: {
            label: "Écoute sociale",
            body: "Récupérer les publications fraîches de Reddit ou Slack et faire remonter celles qui comptent.",
          },
          boardReview: {
            label: "Revue du tableau",
            body: "Balayer le backlog à la recherche de cartes périmées, en double ou déjà faites.",
          },
        },
        ladderLead:
          "Tous les travaux n'ont pas besoin du même niveau d'automatisation. Une carte peut rester à n'importe quel barreau : de celui que vous menez à la main, à celui que Claude prend en charge, jusqu'au script qui tourne tout seul :",
        ladder: {
          ask: { label: "vous le faites à la main" },
          agent: { label: "Claude le fait pour vous" },
          script: { label: "une commande l'exécute, sans humain" },
        },
        ladderNote:
          "Montez chaque travail aussi haut qu'il le mérite : certains restent manuels, d'autres finissent par tourner seuls.",
      },
      group: {
        title: "Tâches groupées",
        body: "Une tâche trop grosse pour être commencée a tendance à rester là. Quand une seule carte ne suffit plus, elle devient une **tâche groupée** : son propre dossier, avec un `root.md` de suivi et une carte par morceau. Chaque morceau a son id et est relié par des liens *Blocked by* et *Related*, si bien que vous savez toujours quoi attraper ensuite.",
      },
      memory: {
        title: "La mémoire du projet",
        body: "Faire tourner le tableau, c'est une boucle. À chaque tour, Claude propose du travail neuf en puisant dans trois sources, vous tranchez, et il replie le résultat dans un hub de mémoire, pour que le tour suivant parte du précédent au lieu de le refaire.",
        hubLabel: "docs/kanban/ : le hub qui garde vos arbitrages",
        files: {
          memory: {
            body: "Les notes de chaque passage sont reprises au suivant, avec un repère par source, si bien qu'il ne relit que ce qui a changé.",
          },
          archive: {
            body: "Le travail livré se réduit à une ligne. Il lit ceci avant de proposer, donc il ne resuggère pas ce qui est fait.",
          },
          rejected: {
            body: "Les idées que vous avez écartées sont gardées avec leur motif, pour qu'il ne vous les ressorte jamais.",
          },
          redesign: {
            body: "Une erreur de conception que vous avez corrigée devient une note, pour que la carte suivante ne refasse pas le mauvais plan.",
          },
        },
        loop: {
          aria: "La boucle : il propose, vous tranchez, il apprend, puis ça recommence.",
          centerCaption: "lit et écrit",
          stepLabel: "étape",
          stages: {
            propose: {
              label: "Proposer",
              body: "Puise dans trois sources du travail qui n'est ni déjà livré ni mis de côté :",
            },
            decide: {
              label: "Vous tranchez",
              body: "On y va, on passe, ou on corrige le plan. Quelques mots à Claude suffisent.",
            },
            learn: {
              label: "Apprendre",
              body: "Replie le résultat et votre retour dans le hub, pour que le tour suivant démarre plus affûté.",
            },
          },
          sources: {
            project: {
              label: "Votre projet",
              body: "Code, tableau, docs, discussions d'équipe : il relie ce qui est déjà là en travail qui vaut la peine.",
            },
            outside: {
              label: "L'extérieur",
              body: "Reddit, Slack, votre CRM. Les travaux récurrents ramènent du signal frais et déposent leurs trouvailles sur le tableau.",
            },
            you: {
              label: "Vous",
              body: "Votre propre cap et vos retours, gardés dans le tableau pour qu'un bon arbitrage ne se perde pas et ne soit pas redemandé.",
            },
          },
        },
      },
      metrics: {
        title: "Métriques des tâches",
        body: "Chaque carte archivée est une unité livrée : votre vitesse n'est donc qu'un nombre dans git, juste à côté du travail. Aucun outil externe à tenir synchronisé.",
        chart: {
          aria: "Débit quotidien sur douze jours : tâches totales, terminées, créées et rejetées.",
          series: {
            total: "Total",
            completed: "Terminées",
            created: "Créées",
            rejected: "Rejetées",
          },
          caption:
            "Une ligne par jour dans `metrics.csv` : terminées, créées, rejetées et leur total. Le script le tient à jour ; vous n'y touchez jamais.",
        },
      },
    },
  },

  vsGithub: {
    meta: {
      title:
        "AI4Kanban vs. GitHub Issues — un autre outil pour un autre travail",
      socialTitle: "AI4Kanban vs. GitHub Issues",
      description:
        "Comment le tableau en fichiers d'ai4kanban se compare à GitHub Issues : Markdown local contre API distante, coût en tokens, ergonomie côté agent, équipes, et quand utiliser lequel.",
      social:
        "Pas un remplaçant, mais un autre outil pour un autre goulot d'étranglement. Un face-à-face sur la vitesse, les tokens, les agents et les équipes.",
    },
    hero: {
      badge: "Comparatif",
      title: "AI4Kanban vs.\nGitHub Issues",
      lead: "Pas un remplaçant, mais un autre outil pour un autre goulot d'étranglement. GitHub Issues est un registre partagé, durable et public. ai4kanban est une surface de travail privée, locale et pensée pour l'agent. Choisissez selon ce qui vous ralentit vraiment.",
      ours: {
        name: "AI4Kanban",
        body: "Du Markdown brut dans votre dépôt. Le brouillon local et rapide de l'agent.",
      },
      theirs: {
        name: "GitHub Issues",
        body: "Une base de données derrière une API. Le registre partagé et public.",
      },
    },
    summary: {
      heading: {
        eyebrow: "En bref",
        title: "Alors pourquoi ne pas simplement utiliser GitHub Issues ?",
      },
      lead: "Vous pouvez. Presque tout ce que fait ai4kanban, vous pourriez le faire avec GitHub Issues plus la CLI `gh` ou un serveur MCP GitHub. La différence, c'est ce que ça coûte d'y arriver.",
      panel:
        "La même tâche sur GitHub Issues, c'est **plus de bruit**, **plus d'allers-retours**, **plus de tokens**, **plus de latence**, et **des prompts plus insistants** rien que pour que l'agent daigne s'en servir. ai4kanban échange la portée de GitHub contre la vitesse locale, et pour quelqu'un qui construit seul avec un agent, c'est justement la vitesse qui manque.",
    },
    comparison: {
      heading: { eyebrow: "Face à face", title: "AI4Kanban vs. GitHub Issues" },
      lead: "Quatorze critères. Un {check}, c'est une victoire nette ; un **tiret**, c'est un compromis assumé qui dépend de ce dont vous avez besoin. ai4kanban emporte les lignes **vitesse et proximité** ; GitHub Issues emporte celles de **l'échelle et de la collaboration**.",
      ourLabel: "AI4Kanban",
      theirLabel: "GitHub Issues",
      rows: {
        storage: {
          dimension: "Stockage",
          kanban: "Du Markdown brut dans votre dépôt, dans git.",
          issues: "La base de données de GitHub, derrière une API.",
        },
        offline: {
          dimension: "Fonctionne hors ligne",
          kanban: "Oui : ce ne sont que des fichiers sur disque.",
          issues: "Non : il faut le réseau et l'authentification.",
        },
        agentReads: {
          dimension: "Comment un agent le lit",
          kanban: "Outils de fichiers natifs : Read, Grep, Glob.",
          issues: "Allers-retours via la CLI gh ou via MCP.",
        },
        tokenCost: {
          dimension: "Coût en tokens par consultation",
          kanban: "Faible : grep ne renvoie que les lignes qui correspondent.",
          issues: "Élevé : charges JSON et schémas d'outils.",
        },
        latency: {
          dimension: "Latence",
          kanban: "Disque local, quasi instantané.",
          issues: "Un aller-retour réseau par appel.",
        },
        setup: {
          dimension: "Mise en place",
          kanban: "Un prompt : un fichier de skill et un petit script.",
          issues: "Un compte, un jeton d'authentification, une config MCP.",
        },
        lockIn: {
          dimension: "Dépendance au fournisseur",
          kanban: "Aucune : le tableau voyage avec le dépôt.",
          issues: "Vit sur GitHub.",
        },
        metadata: {
          dimension: "Métadonnées",
          kanban:
            "Minimales par choix : priorité et effort, tout ce dont a besoin quelqu'un qui construit seul.",
          issues:
            "Étiquettes, jalons, assignations, projets, de quoi coordonner une équipe.",
        },
        concurrency: {
          dimension: "Accès concurrent",
          kanban: "Aucun : les id se télescopent si deux personnes ajoutent #1894.",
          issues: "Des id attribués par le serveur, sûrs en équipe.",
        },
        history: {
          dimension: "Historique des décisions",
          kanban:
            "Élagué aux décisions qui orientent la tâche suivante : pourquoi une idée a été écartée, ce qui a été livré. L'agent propose donc vers l'avant, sans jamais refaire du travail fait ou mort.",
          issues:
            "Tout l'historique des commentaires et des modifications est conservé, rien n'est perdu.",
        },
        closing: {
          dimension: "Clore le travail",
          kanban: "On archive la tâche une fois ses points cochés.",
          issues: "Ferme automatiquement les issues depuis les PR liées et la CI.",
        },
        search: {
          dimension: "Recherche à grande échelle",
          kanban: "grep : rapide sur un petit tableau, pénible à mesure qu'il grossit.",
          issues: "Recherche plein texte indexée et filtres enregistrés.",
        },
        contributors: {
          dimension: "Contributeurs externes",
          kanban:
            "Possible, mais seulement en committant le Markdown : pas de dépôt de ticket léger.",
          issues:
            "N'importe qui peut ouvrir un ticket, commenter et réagir sans commit.",
        },
        transparency: {
          dimension: "Transparence",
          kanban:
            "Chaque carte reste visible dans le dépôt ; seul le hub de mémoire est élagué à l'essentiel.",
          issues: "Public et partageable par lien, la norme de l'open source.",
        },
      },
    },
    wins: {
      heading: { eyebrow: "Compromis", title: "Où chacun l'emporte" },
      lead: "Aucun n'est meilleur dans l'absolu. ai4kanban optimise pour un agent qui va vite ; GitHub Issues optimise pour beaucoup de gens qui restent synchronisés.",
      oursHeading: "AI4Kanban",
      theirsHeading: "GitHub Issues",
      ours: {
        tokenLight: {
          title: "Léger en tokens et instantané",
          body: "Pas de MCP, pas de réseau. L'agent fait un grep sur du Markdown local au lieu de paginer une API distante : moins de tokens, moins de latence, aucune authentification à rafraîchir en pleine tâche.",
        },
        agentsUseIt: {
          title: "Les agents s'en servent vraiment",
          body: "Les agents rechignent à fouiller GitHub Issues ; par défaut ils attrapent les outils du système de fichiers. Un tableau en Markdown les rejoint là où ils sont déjà : moins d'insistance, moins d'états de tâche inventés.",
        },
        offline: {
          title: "Hors ligne, et à vous",
          body: "Des fichiers bruts dans git. Ça marche dans un avion, ça marche quand GitHub est en panne. Aucune dépendance SaaS, aucun enfermement : vous clonez le dépôt et tout le tableau vous suit.",
        },
        memory: {
          title: "Une mémoire réglée pour proposer",
          body: "Elle consigne les décisions qui orientent la tâche suivante : pourquoi une idée a été écartée, ce qui a été livré, ce qui manque encore pour atteindre l'objectif. L'agent propose donc vers l'avant, sans refaire ce qui est fait ni ressortir ce que vous aviez tué.",
        },
      },
      theirs: {
        teams: {
          title: "Conçu pour les équipes",
          body: "Des id attribués par le serveur, des modifications concurrentes sûres, des assignations. ai4kanban n'a pas de base de données : deux personnes peuvent créer #1894 en même temps et entrer en conflit.",
        },
        transparency: {
          title: "Transparence et portée",
          body: "Public et partageable par lien, avec des contributeurs externes qui ouvrent des tickets, commentent et réagissent. Le bon foyer quand l'ouverture compte plus que la vitesse brute.",
        },
        fullContext: {
          title: "Tout le contexte, pour toujours",
          body: "ai4kanban compresse volontairement : une carte archivée se réduit à une ligne. Sur GitHub, chaque commentaire, chaque modification et chaque lien croisé reste intact.",
        },
        integration: {
          title: "Intégration profonde",
          body: "Fermeture automatique depuis les PR, liens vers les commits, tableaux de projet, étiquettes, jalons, et tout un écosystème d'outils tiers avec une recherche indexée qui tient l'échelle.",
        },
      },
    },
    ergonomics: {
      heading: { eyebrow: "Le nœud", title: "Pourquoi les agents préfèrent les fichiers" },
      lead: "La vraie différence apparaît quand c'est l'agent qui travaille. Demandez la même chose, **« trouve mes tâches ouvertes en priorité haute »**, et les deux chemins ne se ressemblent presque pas.",
      issues: {
        title: "you › agent + GitHub MCP",
        chip: "beaucoup de tours",
        lines: [
          "trouve mes issues ouvertes en priorité haute",
          "list_issues(state:open, labels:high)",
          "4,2 Ko de JSON — 18 issues, tous les champs",
          "paginer, filtrer, résumer…",
          "renouvellement d'auth · en-têtes de quota · nouvelles tentatives",
        ],
        footer: "plusieurs appels d'outils · des Ko de JSON · du réseau à chaque fois",
      },
      kanban: {
        title: "you › agent + ai4kanban",
        chip: "un seul tour",
        lines: [
          "trouve mes tâches ouvertes en priorité haute",
          'grep -rl "Priority: high" docs/kanban/todo',
          "trois chemins de fichier",
          "terminé : un appel, pas de réseau",
        ],
        footer: "un appel d'outil · quelques chemins · tout en local",
      },
      note: "Et ça s'accumule. Chaque « on fait quoi ensuite ? », chaque archivage, chaque revue du tableau paie le péage de l'aller-retour sur GitHub Issues. Et les modèles, quand ils ont le choix, évitent discrètement l'outil distant pour aller vers les fichiers.",
    },
    decision: {
      heading: { eyebrow: "Le choix", title: "Lequel utiliser ?" },
      oursHeading: "Prenez ai4kanban quand",
      theirsHeading: "Prenez GitHub Issues quand",
      ours: [
        "Vous travaillez seul, ou en binôme restreint et de confiance.",
        "Vous menez le travail via un agent dans le terminal.",
        "Avancer vous importe plus que laisser une trace écrite.",
        "Vous voulez le tableau dans git : hors ligne et transportable.",
      ],
      theirs: [
        "Vous construisez au grand jour et la transparence compte.",
        "Plusieurs personnes manipulent le backlog en même temps.",
        "Vous vous appuyez sur les liens PR/CI, les tableaux de projet et les jalons.",
        "Vous avez besoin que des contributeurs externes ouvrent des tickets et en discutent.",
      ],
      verdict:
        "Ce ne sont pas vraiment des concurrents. GitHub Issues est le **registre partagé** ; ai4kanban est le **brouillon local et rapide de l'agent**. Si votre goulot d'étranglement, c'est la coordination entre personnes, prenez GitHub Issues. Si c'est le débit avec un agent, prenez ai4kanban.",
      note: "Beaucoup de gens qui construisent seuls utilisent les deux : GitHub Issues comme suivi public, ai4kanban comme la surface privée que leur agent pilote tous les jours.",
    },
  },

  vsHermes: {
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
  },

  vsVibe: {
    meta: {
      title:
        "AI4Kanban vs. Vibe Kanban — un tableau de planification face à un cockpit d'agents",
      socialTitle: "AI4Kanban vs. Vibe Kanban",
      description:
        "Vibe Kanban s'est arrêté quand Bloop a fermé en avril 2026. Comment le tableau en fichiers d'ai4kanban se compare : un tableau de planification léger dans votre dépôt face à un cockpit qui fait tourner de nombreux agents de code en parallèle, et ce qui se transpose.",
      social:
        "L'entreprise derrière Vibe Kanban a fermé. Un tableau de planification dans votre dépôt face à un cockpit d'orchestration d'agents : la différence honnête, et ce qui se transpose.",
    },
    hero: {
      badge: "Comparatif",
      title: "AI4Kanban vs.\nVibe Kanban",
      lead: "Vibe Kanban est un cockpit pour faire tourner de nombreux agents de code en parallèle, et l'entreprise derrière, Bloop, a fermé en avril 2026. ai4kanban est un tableau de planification que votre agent édite comme des fichiers bruts dans votre dépôt. Ils règlent des goulots d'étranglement différents. Voici la différence honnête, et ce qui se transpose vraiment.",
      ours: {
        name: "AI4Kanban",
        body: "Du Markdown brut dans votre dépôt. Un tableau de planification que votre agent édite.",
      },
      theirs: {
        name: "Vibe Kanban",
        body: "Une appli web locale. Un cockpit qui fait tourner de nombreux agents en parallèle.",
      },
    },
    summary: {
      heading: {
        eyebrow: "En bref",
        title: "Vibe Kanban s'est arrêté : et maintenant ?",
      },
      lead: "Bloop, l'entreprise derrière Vibe Kanban, a fermé en avril 2026. Les offres payantes ont été annulées et remboursées, les fonctions cloud retirées, et le projet est devenu entièrement local. Il est resté open source sous Apache-2.0, mais le dépôt d'origine n'a plus reçu de commit depuis fin avril 2026, si bien que son avenir repose désormais sur les forks de la communauté plutôt que sur l'équipe qui l'a construit.",
      panel:
        "Si ce que vous appréciiez dans Vibe Kanban, c'était le **tableau**, un endroit calme pour aligner et affûter le travail destiné à votre agent de code, ai4kanban vous le donne sous forme de fichiers bruts dans git, sans entreprise qui puisse fermer et sans serveur à maintenir en vie. Si ce que vous appréciiez, c'était le **moteur qui fait tourner de nombreux agents en parallèle**, on préfère prévenir : ai4kanban n'est pas ça, et autant vous le dire maintenant plutôt que vous perdre trois sections plus loin.",
    },
    comparison: {
      heading: { eyebrow: "Face à face", title: "AI4Kanban vs. Vibe Kanban" },
      lead: "Dix critères. Un {check}, c'est une victoire nette ; un **tiret**, c'est un compromis assumé qui dépend de ce dont vous avez besoin. ai4kanban emporte les lignes **légèreté et planification** ; Vibe Kanban emporte celles des **agents en parallèle et de la relecture**, ses vraies forces, dites sans détour.",
      ourLabel: "AI4Kanban",
      theirLabel: "Vibe Kanban",
      rows: {
        whatFor: {
          dimension: "À quoi ça sert",
          kanban:
            "Un tableau de planification que votre agent édite dans le dépôt : aligner et affûter le travail.",
          vibe: "Un cockpit pour faire tourner de nombreux agents de code en parallèle et relire ce qu'ils produisent.",
        },
        orchestration: {
          dimension: "Orchestration d'agents en parallèle",
          kanban: "Aucune : vous menez un agent, le tableau ne fait pas tourner d'agents.",
          vibe: "Son point fort : de nombreux agents à la fois, chacun dans un worktree git isolé.",
        },
        review: {
          dimension: "Relecture de la sortie de l'agent",
          kanban: "Ce n'est pas son travail : les diffs, c'est votre environnement qui les montre.",
          vibe: "Intégrée : relecture de diff en ligne, aperçu en direct et gestion des pull requests.",
        },
        planning: {
          dimension: "Planification et affinage",
          kanban:
            "Une boucle de refine transforme une idée brute en une tâche concrète et prête.",
          vibe: "Minimal : le tableau met surtout en file et suit les exécutions d'agents.",
        },
        onDisk: {
          dimension: "Ce que c'est sur le disque",
          kanban: "Du Markdown brut dans votre dépôt, dans git.",
          vibe: "Une base SQLite locale dans un répertoire de configuration.",
        },
        runsAs: {
          dimension: "Comment ça tourne",
          kanban: "Juste des fichiers : pas de serveur, rien à maintenir en vie.",
          vibe: "Une appli web locale (backend Rust + interface web) que vous démarrez et laissez tourner.",
        },
        setup: {
          dimension: "Mise en place",
          kanban: "Un prompt : un fichier de skill et un petit script.",
          vibe: "npx vibe-kanban, plus chaque CLI d'agent installée et connectée.",
        },
        whichAgents: {
          dimension: "Quels agents le font tourner",
          kanban:
            "N'importe quel agent capable de lire des fichiers : Claude Code, Codex, Cursor, et d'autres.",
          vibe: "Les CLI d'agents qu'il câble : Claude Code, Codex, Gemini, et d'autres.",
        },
        lockIn: {
          dimension: "Dépendance au fournisseur",
          kanban: "Aucune : le tableau, ce sont des fichiers qui voyagent avec le dépôt.",
          vibe: "Apache-2.0 et auto-hébergeable, avec un export de données livré avant la fermeture.",
        },
        maintenance: {
          dimension: "Qui l'entretient",
          kanban: "Activement entretenu.",
          vibe: "Bloop a fermé en avril 2026 ; le dépôt d'origine est à l'arrêt depuis.",
        },
      },
    },
    purpose: {
      heading: {
        eyebrow: "La vraie différence",
        title: "Tableau de planification vs. cockpit d'orchestration",
      },
      lead: "Les deux outils se placent à des points différents de la boucle. L'un est là où vous décidez **quoi construire** ; l'autre est là où vous **faites tourner les agents qui le construisent**. Prendre l'un pour l'autre, c'est le chemin le plus court vers la déception, alors disons-le franchement.",
      ours: {
        name: "AI4Kanban — le plan",
        is: "Un tableau que votre agent lit et édite comme du Markdown brut dans votre dépôt. Vous enregistrez une idée brute, une boucle de refine l'affûte en une tâche prête, et vous validez avant qu'on écrive du code. Le travail vit dans git, juste à côté du code qu'il va changer.",
        isnt: "Il ne fait pas tourner d'agents, ne monte pas de worktrees et ne relit pas leurs diffs : c'est votre environnement qui s'en charge. C'est la carte, pas le moteur.",
      },
      theirs: {
        name: "Vibe Kanban — le moteur",
        is: "Une appli web locale qui fait tourner de nombreux agents de code à la fois, chacun isolé dans son propre worktree git, puis vous laisse relire leurs diffs et prévisualiser l'appli au même endroit. Sa valeur, c'est le débit sur des exécutions parallèles.",
        isnt: "Elle n'est pas faite pour affûter une idée à moitié formée jusqu'au plan : le tableau met surtout en file et suit les exécutions. L'affinage y est minimal.",
      },
      note: "Beaucoup de gens faisaient tourner Vibe Kanban rien que pour son tableau. Si c'était votre cas, ai4kanban lui offre un toit plus léger : des fichiers dans git, rien à maintenir allumé. Si vous l'utilisiez pour piloter des agents en parallèle, gardez un œil sur les forks de la communauté ; ai4kanban ne remplacera pas ce moteur.",
    },
    wins: {
      heading: { eyebrow: "Compromis", title: "Où chacun l'emporte" },
      lead: "Aucun n'est meilleur dans l'absolu. ai4kanban optimise pour un tableau léger, fait de fichiers, qui survit à n'importe quel outil ; Vibe Kanban optimise pour faire tourner et relire de nombreux agents à la fois.",
      oursHeading: "AI4Kanban",
      theirsHeading: "Vibe Kanban",
      ours: {
        nothingRunning: {
          title: "Rien à maintenir allumé",
          body: "Le tableau, c'est du Markdown brut dans votre dépôt : pas d'appli web, pas de base de données, pas de serveur. Rien à installer au-delà de l'agent que vous faites déjà tourner, et rien qui puisse tomber.",
        },
        planning: {
          title: "Planifier, pas seulement mettre en file",
          body: "Une boucle de refine creuse les pièces manquantes et transforme une idée brute en une carte concrète que vous validez avant qu'on écrive du code. Le tableau de Vibe Kanban, lui, met surtout des exécutions d'agents en file.",
        },
        outlives: {
          title: "Survit à n'importe quelle entreprise",
          body: "Pas de SaaS, pas de runtime embarqué, pas de dépôt qui puisse s'arrêter. Le tableau, ce sont des fichiers dans git : vous clonez le dépôt et il vous suit. La fermeture de Bloop, c'est exactement le risque que ça évite.",
        },
        anyAgent: {
          title: "N'importe quel agent, à tout moment",
          body: "Ce ne sont que des fichiers : n'importe quel agent capable de lire des fichiers peut le piloter, Claude Code, Codex, Cursor, ou ce vers quoi vous basculerez ensuite. Vous n'êtes pas lié à la liste de CLI qu'un outil veut bien gérer.",
        },
      },
      theirs: {
        parallel: {
          title: "Fait tourner de nombreux agents à la fois",
          body: "Toute sa raison d'être : éclater le travail sur plusieurs agents de code en parallèle, chacun isolé dans sa branche et son worktree git pour qu'ils ne se marchent jamais dessus. ai4kanban ne fait pas tourner d'agents du tout.",
        },
        reviewInPlace: {
          title: "Exécuter et relire au même endroit",
          body: "Relecture de diff en ligne, un navigateur intégré pour prévisualiser l'appli, et la gestion des pull requests, le tout dans le cockpit. Vous suivez et orientez la sortie de l'agent sans quitter le tableau.",
        },
        boardUi: {
          title: "Une vraie interface de tableau",
          body: "Un tableau web bâti pour piloter des exécutions d'agents : vous lancez une tâche, vous la regardez travailler, vous changez d'espace de travail. Conçu pour l'orchestration, pas un simple fichier qu'on grep.",
        },
        support: {
          title: "Large support d'agents",
          body: "Premier arrivé sur l'orchestration multi-agents, avec de nombreuses CLI d'agents câblées d'origine : Claude Code, Codex, Gemini, et d'autres.",
        },
      },
    },
    decision: {
      heading: { eyebrow: "Le choix", title: "Lequel utiliser ?" },
      oursHeading: "Prenez ai4kanban quand",
      theirsHeading: "Prenez Vibe Kanban quand",
      ours: [
        "Vous voulez un tableau de planification que votre agent édite directement dans le dépôt.",
        "Vous voulez zéro infrastructure : des fichiers dans git, rien à lancer ni à maintenir en vie.",
        "Vous préférez ne pas lier votre tableau à un produit qui peut fermer.",
        "Vous menez un agent à la fois et préférez un plan clair au parallélisme.",
      ],
      theirs: [
        "Vous voulez faire tourner de nombreux agents de code en parallèle, chacun isolé.",
        "Vous voulez la relecture de diff en ligne et l'aperçu en direct dans un seul cockpit.",
        "Orchestrer et relire les exécutions d'agents est votre vrai goulot d'étranglement.",
        "Dépendre d'un fork communautaire maintenant que Bloop a fermé ne vous gêne pas.",
      ],
      verdict:
        "Ils règlent des goulots d'étranglement différents. Vibe Kanban est un **cockpit d'orchestration** pour faire tourner de nombreux agents ; ai4kanban est un **tableau de planification** qu'un agent édite dans votre dépôt. Si vous aimiez le tableau de Vibe Kanban pour aligner le travail, ai4kanban vous le rend sous forme de fichiers bruts qui survivent à n'importe quelle entreprise. Si vous aimiez son moteur d'agents en parallèle, ai4kanban n'est pas ça, et on préfère le dire.",
      note: "Depuis la fermeture de Bloop, c'est le tableau qui mérite d'être emporté plus loin, sans aucune entreprise attachée, et c'est exactement ce qu'est ai4kanban.",
    },
  },

  vsLinear: {
    meta: {
      title: "AI4Kanban vs. Linear — la gestion de projet par IA dans le dépôt",
      socialTitle: "AI4Kanban vs. Linear",
      description:
        "Comparez ai4kanban à l'app Linear : une boucle de planification dans le dépôt pour agents de code face à l'espace d'équipe, la plateforme d'agents, les projets et le suivi des tickets de Linear.",
      social:
        "Linear est le système d'équipe le plus solide. ai4kanban est la boucle de planification la plus ciblée dans le dépôt. Voici où chacun excelle, agents, prix et flux compris.",
    },
    hero: {
      badge: "Comparaison",
      title: "AI4Kanban vs.\nLinear",
      lead: "Linear est un espace de gestion de projet abouti où personnes et agents se coordonnent. ai4kanban est un tableau de planification dans le dépôt qu'un agent affine, de l'idée brute à la tâche prête à construire. Ce n'est pas un Linear moins cher, mais un autre modèle de planification.",
      ours: {
        name: "AI4Kanban",
        body: "Du Markdown brut dans votre dépôt. L'agent mène la boucle de planification.",
      },
      theirs: {
        name: "Linear",
        body: "Un espace d'équipe hébergé. Personnes et agents planifient, construisent et relisent ensemble.",
      },
    },
    summary: {
      heading: {
        eyebrow: "En bref",
        title: "Linear a des agents. La différence, c'est où vit le plan.",
      },
      lead: "Linear n'est pas un simple gestionnaire de tickets agrémenté d'IA. Linear Agent travaille avec le contexte de l'espace, sa plateforme délègue des tickets aux agents de code, son MCP server connecte des agents externes, et Coding Sessions peut lancer Claude Code ou Codex puis rendre une pull request à relire.",
      panel:
        "Choisissez ai4kanban pour une raison plus précise : vous voulez que **l'agent mène la boucle de planification dans le dépôt**. Une demande brute devient des questions, des décisions, des dépendances et une carte prête à construire. Le tableau et sa mémoire restent en Markdown, relisibles à côté du code.",
    },
    comparison: {
      heading: { eyebrow: "Face à face", title: "AI4Kanban vs. Linear" },
      lead: "Un {check} marque le choix le plus net sur chaque ligne ; un **tiret** signifie que tout dépend de votre façon de travailler. Linear l'emporte sur **la coordination d'équipe, la planification de portefeuille, les intégrations et l'exécution intégrée des agents**. ai4kanban l'emporte sur **l'affinage dans le dépôt, la portabilité et la mémoire du plan dans git**.",
      ourLabel: "AI4Kanban",
      theirLabel: "Linear",
      rows: {
        bestFit: {
          dimension: "À qui il convient",
          kanban: "Développeurs seuls et petites équipes dont l'agent de code conduit le travail.",
          linear: "Équipes produit et ingénierie qui coordonnent personnes, projets et agents.",
        },
        sourceOfTruth: {
          dimension: "Source de vérité",
          kanban: "Du Markdown dans le dépôt du projet, versionné avec le code.",
          linear: "Un espace Linear partagé, accessible par ses apps, son API ou MCP.",
        },
        refinement: {
          dimension: "De l'idée brute à la tâche prête",
          kanban: "Une boucle de refine et resolve répond à ce qu'elle peut, consigne le reste et s'arrête quand la carte est concrète.",
          linear: "Linear Agent rédige, résume, met à jour et aide à cadrer ; la qualité du ticket guide toujours le résultat de Coding Sessions.",
        },
        agentModel: {
          dimension: "Modèle d'agents",
          kanban: "Votre environnement actuel lit et écrit le tableau ; Claude Code et Codex sont déjà câblés.",
          linear: "Linear Agent, plus des app users installables, des tickets délégués, des consignes pour agents et un MCP server hébergé.",
        },
        execution: {
          dimension: "Code et relecture",
          kanban: "L'environnement choisi implémente la carte prête ; la relecture reste dans cet environnement et le flux git.",
          linear: "Coding Sessions lance Claude Code ou Codex dans le cloud, ouvre une PR et place les diffs et la relecture dans Linear.",
        },
        collaboration: {
          dimension: "Collaboration humaine",
          kanban: "Collaboration par git pour petites équipes ; l'édition simultanée du tableau n'est pas son point fort.",
          linear: "Un espace en temps réel avec membres, responsables, commentaires, équipes privées, invités et permissions.",
        },
        portfolio: {
          dimension: "Étendue de la planification",
          kanban: "Cartes, dépendances, priorité, ROI, releases et mémoire par module.",
          linear: "Tickets, projets, cycles, initiatives, jalons, chronologies, triage, analyses et demandes clients.",
        },
        setup: {
          dimension: "Mise en place",
          kanban: "S'installe dans un dépôt avec un prompt ; le tableau ne demande ni compte, ni base de données, ni service distant.",
          linear: "Créez un espace, puis branchez les intégrations et les accès d'agents dont l'équipe a besoin.",
        },
        portability: {
          dimension: "Portabilité",
          kanban: "Clonez le dépôt : le tableau, les décisions et l'historique suivent, même hors ligne.",
          linear: "Les données vivent dans Linear ; les administrateurs peuvent exporter les tickets en CSV et utiliser l'API.",
        },
        pricing: {
          dimension: "Prix",
          kanban: "Sous Apache-2.0 et gratuit ; vous ne payez que les outils d'agent de code choisis.",
          linear: "Free : 250 tickets et 2 équipes. Basic : 10 $ par personne et par mois, facturé à l'année. Business : 16 $. Coding Sessions consomme des AI credits.",
        },
      },
    },
    model: {
      heading: {
        eyebrow: "La vraie différence",
        title: "Mémoire du dépôt ou espace d'équipe",
      },
      lead: "Les deux produits gèrent désormais des agents. La vraie question est : **quel contexte possède le plan** ? Le dépôt du projet ou un espace partagé par l'entreprise ?",
      ours: {
        name: "AI4Kanban — le dépôt planifie avec vous",
        is: "Avant de changer le plan, l'agent lit le code, les décisions passées, les idées rejetées et le travail déjà livré. Il continue d'affiner jusqu'à ce que les questions ouvertes aient une réponse ou vous soient clairement remises.",
        isnt: "Ce n'est pas une grande suite collaborative. La mémoire utile du plan est commitée avec le code et suit chaque clone.",
      },
      theirs: {
        name: "Linear — l'espace coordonne tout le monde",
        is: "Les tickets appartiennent à des équipes, les projets peuvent les traverser ; cycles, initiatives, chronologies, documents, commentaires et demandes clients créent un contexte commun. Les agents travaillent dans ce même espace régi par des permissions.",
        isnt: "C'est bien plus de système qu'il n'en faut à un développeur seul si le vrai problème est de transformer une demande floue en spécification fiable.",
      },
      note: "Ils peuvent cohabiter, mais il faut alors décider lequel possède l'état des tâches. Pour un développeur seul, deux sources de vérité ajoutent souvent plus de processus que de valeur.",
    },
    wins: {
      heading: { eyebrow: "Compromis", title: "Où chacun l'emporte" },
      lead: "Linear l'emporte par son étendue, sa coordination et son exécution intégrée. ai4kanban garde la planification menée par l'agent locale, inspectable et difficile à perdre entre deux exécutions.",
      oursHeading: "AI4Kanban",
      theirsHeading: "Linear",
      ours: {
        roughToReady: {
          title: "Transforme les demandes floues en travail prêt",
          body: "L'agent questionne, cherche, découpe et résout une carte en boucle, au lieu de prendre la première description pour une spécification.",
        },
        repoMemory: {
          title: "La mémoire du plan à côté du code",
          body: "Décisions, idées rejetées, dépendances et cartes sont des fichiers bruts, diffables, que l'exécution suivante lit par défaut.",
        },
        anyHarness: {
          title: "Apportez votre propre environnement",
          body: "Le tableau n'est lié ni à Linear Agent ni à une seule intégration. Claude Code et Codex fonctionnent déjà ; le format reste ouvert à tout environnement.",
        },
        noSaas: {
          title: "Aucun SaaS de tableau à administrer",
          body: "La surface de planification n'a ni espace, ni sièges, ni authentification, ni base de données, ni couche de synchronisation. Le tableau fait partie du dépôt.",
        },
      },
      theirs: {
        teamSystem: {
          title: "Un vrai système pour une équipe humaine",
          body: "Édition simultanée, responsabilité, permissions, commentaires, équipes privées, invités, notifications et interface aboutie.",
        },
        agentPlatform: {
          title: "Agents et exécution intégrés",
          body: "Linear Agent, app users, MCP, tickets délégués, Coding Sessions, diffs et relecture des pull requests partagent le même contexte.",
        },
        planningDepth: {
          title: "Une planification produit profonde",
          body: "Projets, cycles, initiatives, jalons, chronologies, triage, analyses et demandes clients dépassent largement un petit tableau dans le dépôt.",
        },
        integrations: {
          title: "Des intégrations et un contexte recherchable",
          body: "GitHub, GitLab, Slack, Teams, outils de support, API, webhooks et recherche relient le reste du travail de l'entreprise.",
        },
      },
    },
    decision: {
      heading: { eyebrow: "Le choix", title: "Lequel utiliser ?" },
      oursHeading: "Prenez ai4kanban quand",
      theirsHeading: "Restez sur Linear quand",
      ours: [
        "Un développeur seul ou une petite équipe conduit le travail avec un agent de code.",
        "Vos demandes commencent floues et la boucle de planification est le goulot d'étranglement.",
        "Vous voulez les tâches et les décisions durables dans git, à côté du code.",
        "Vous voulez choisir l'environnement plutôt qu'adopter le runtime d'agents du tableau.",
      ],
      theirs: [
        "Plusieurs personnes créent, assignent, discutent et mettent à jour le travail en même temps.",
        "Vous dépendez des cycles, initiatives, chronologies, du triage, des demandes clients ou des rapports.",
        "Vous voulez déléguer des sessions de code dans le cloud et relire les diffs dans l'outil de projet.",
        "Vous avez besoin d'intégrations à l'échelle de l'entreprise, de permissions, de contrôles de sécurité et de support.",
      ],
      verdict:
        "Linear est le meilleur **système d'équipe**. ai4kanban est la boucle de **planification dans le dépôt** la plus ciblée. Si la coordination entre personnes est le goulot, restez sur Linear. Si un agent de code reçoit sans cesse du travail flou et perd les décisions qui le sous-tendent, mettez le tableau dans le dépôt et laissez l'agent l'affiner là.",
      note: "C'est un changement de modèle de planification, pas un remplacement de Linear fonction par fonction.",
    },
  },
};

export default fr;
