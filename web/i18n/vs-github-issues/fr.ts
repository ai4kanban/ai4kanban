// Français — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const fr: VsGithubCopy = {
  meta: {
    title: "AI4Kanban vs. GitHub Issues — À chaque type de travail son outil",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "Comparaison pratique entre le tableau à base de fichiers d’AI4Kanban et GitHub Issues : Markdown local ou API distante, consommation de tokens, facilité d’utilisation par les agents, collaboration en équipe et situations dans lesquelles chaque outil est le plus adapté.",
    social:
      "AI4Kanban n’a pas vocation à remplacer GitHub Issues : les deux outils répondent à des goulots d’étranglement différents. Un comparatif pratique sur la vitesse, les tokens, les agents et les équipes.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban n’a pas vocation à remplacer GitHub Issues. Les deux outils répondent à des goulots d’étranglement différents. GitHub Issues est un référentiel partagé et durable qui facilite la collaboration publique ; AI4Kanban est un espace de travail privé et local qu’un agent peut manipuler directement. Le bon choix dépend de ce qui ralentit réellement votre travail.",
    ours: {
      name: "AI4Kanban",
      body: "Du Markdown brut stocké dans votre dépôt, sous la forme d’un tableau local que les agents peuvent consulter et mettre à jour rapidement.",
    },
    theirs: {
      name: "GitHub Issues",
      body: "Une base de données hébergée et accessible par API, conçue comme référentiel partagé pour une équipe ou une communauté.",
    },
  },
  summary: {
    heading: {
      eyebrow: "En bref",
      title: "Pourquoi ne pas simplement utiliser GitHub Issues ?",
    },
    lead: "C’est tout à fait possible. Presque tout ce que permet AI4Kanban peut également être réalisé avec GitHub Issues et la CLI `gh` ou un serveur MCP GitHub. La différence essentielle tient au coût opérationnel.",
    panel:
      "Pour un agent, accomplir la même tâche avec GitHub Issues implique généralement **davantage de données**, **plus d’appels d’outils**, **une consommation de tokens supérieure** et **une latence réseau supplémentaire**. Il faut parfois aussi **des instructions plus explicites** pour que l’agent utilise un outil distant. AI4Kanban n’offre pas la même étendue de fonctions collaboratives et d’intégrations que GitHub ; il privilégie en contrepartie un accès local direct et rapide. Pour un développeur indépendant qui travaille principalement avec un agent, cette rapidité peut être la ressource la plus précieuse.",
  },
  comparison: {
    heading: {
      eyebrow: "Comparaison directe",
      title: "AI4Kanban vs. GitHub Issues",
    },
    lead: "Le tableau ci-dessous compare les deux outils selon quatorze critères. Un {check} signale un avantage net ; un **tiret** signale un compromis qui dépend de ce dont vous avez besoin. AI4Kanban se distingue par sa **rapidité et son accès local**, tandis que GitHub Issues est mieux adapté au **passage à l’échelle et à la collaboration entre plusieurs personnes**.",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "Stockage",
        kanban:
          "Fichiers Markdown bruts dans votre dépôt, versionnés avec Git.",
        issues:
          "Données hébergées par GitHub et accessibles via ses interfaces et son API.",
      },
      offline: {
        dimension: "Accès hors ligne",
        kanban:
          "Entièrement disponible, puisque le tableau est stocké sur le disque.",
        issues:
          "Les données des tickets nécessitent une connexion réseau et une authentification.",
      },
      agentReads: {
        dimension: "Mode d’accès pour un agent",
        kanban:
          "Accès direct avec des outils de système de fichiers tels que Read, Grep et Glob.",
        issues: "Accès via la CLI `gh` ou des appels MCP distants.",
      },
      tokenCost: {
        dimension: "Consommation de tokens par requête",
        kanban:
          "Généralement faible, car `grep` peut ne renvoyer que le contenu correspondant.",
        issues:
          "Généralement plus élevée, car l’agent doit traiter les définitions d’outils et les réponses JSON.",
      },
      latency: {
        dimension: "Latence",
        kanban: "L’accès au disque local est pratiquement immédiat.",
        issues: "Chaque requête doit attendre une réponse réseau.",
      },
      setup: {
        dimension: "Mise en place",
        kanban:
          "Installation à l’aide d’un prompt ; le cœur se compose d’un fichier de skill et d’un petit script.",
        issues:
          "Nécessite un compte GitHub, une authentification et la configuration de la CLI ou de MCP.",
      },
      lockIn: {
        dimension: "Dépendance à une plateforme",
        kanban:
          "Aucune dépendance à une plateforme hébergée ; le tableau est en texte brut et suit le dépôt.",
        issues:
          "Les données restent dans GitHub tant qu’elles ne sont pas exportées ou migrées.",
      },
      metadata: {
        dimension: "Métadonnées",
        kanban:
          "Délibérément limitées à l’essentiel, comme la priorité et l’effort.",
        issues:
          "Champs complets pour les étiquettes, les jalons, les responsables et les projets.",
      },
      concurrency: {
        dimension: "Utilisation simultanée",
        kanban:
          "Aucun contrôle de concurrence ; deux personnes peuvent créer le même numéro de tâche, par exemple #1894.",
        issues:
          "Les identifiants attribués par le serveur permettent une utilisation simultanée sûre.",
      },
      history: {
        dimension: "Historique des décisions",
        kanban:
          "Conserve les décisions qui influencent le travail à venir, par exemple les raisons du rejet d’une idée et ce qui a déjà été livré.",
        issues:
          "Conserve l’historique complet des commentaires, des modifications et de l’activité.",
      },
      closing: {
        dimension: "Clôture du travail",
        kanban:
          "Une carte est archivée lorsque tous ses éléments sont terminés.",
        issues:
          "Les tickets peuvent être fermés automatiquement à partir de pull requests associées et de workflows.",
      },
      search: {
        dimension: "Recherche à grande échelle",
        kanban:
          "`grep` est rapide sur un petit tableau, mais devient moins pratique à mesure que celui-ci grandit.",
        issues:
          "La recherche plein texte indexée et les filtres enregistrés sont conçus pour de plus grands volumes de données.",
      },
      contributors: {
        dimension: "Contributeurs externes",
        kanban:
          "Il est possible de contribuer en modifiant le Markdown, mais il n’existe pas d’interface légère pour créer une tâche.",
        issues:
          "Dans les dépôts publics, les contributeurs peuvent ouvrir des tickets, commenter et réagir sans soumettre de code.",
      },
      transparency: {
        dimension: "Transparence",
        kanban:
          "Chaque carte reste visible dans le dépôt ; seule la mémoire centrale est réduite aux informations essentielles.",
        issues:
          "Les tickets se partagent facilement et conviennent au fonctionnement public habituel des communautés open source.",
      },
    },
  },
  wins: {
    heading: { eyebrow: "Compromis", title: "Les points forts de chaque outil" },
    lead: "Aucun des deux n’est supérieur dans tous les cas. AI4Kanban est optimisé pour permettre à un développeur et à un agent de faire avancer le travail rapidement. GitHub Issues est conçu pour maintenir la synchronisation entre de nombreuses personnes et de nombreux systèmes.",
    oursHeading: "AI4Kanban",
    theirsHeading: "GitHub Issues",
    ours: {
      tokenLight: {
        title: "Accès local efficace",
        body: "Aucun appel MCP et aucune dépendance au réseau. L’agent recherche dans du Markdown local au lieu de parcourir une API distante, ce qui réduit la consommation de tokens et la latence, tout en évitant les interruptions liées à l’authentification pendant une tâche.",
      },
      agentsUseIt: {
        title: "Adapté au mode de travail des agents",
        body: "Les agents ont tendance à utiliser les outils du système de fichiers avant de consulter un gestionnaire de tickets distant. Un tableau Markdown est déjà présent dans l’environnement qu’ils connaissent : il demande moins d’instructions et réduit le risque que l’agent interprète mal l’état d’une tâche.",
      },
      offline: {
        title: "Portable et disponible hors ligne",
        body: "Le tableau est un ensemble de fichiers bruts dans Git. Il reste utilisable sans connexion ou lorsque GitHub est indisponible. Il ne dépend ni d’un SaaS ni d’une plateforme particulière : lorsque vous clonez le dépôt, vous récupérez aussi l’intégralité du tableau.",
      },
      memory: {
        title: "Une mémoire tournée vers la prochaine décision",
        body: "AI4Kanban conserve les informations qui doivent guider la suite : pourquoi une idée a été écartée, ce qui a été livré et ce qui sépare encore l’état actuel de l’objectif. L’agent peut ainsi formuler des propositions utiles pour avancer, sans répéter du travail déjà terminé ou abandonné.",
      },
    },
    theirs: {
      teams: {
        title: "Conçu pour la coordination d’équipe",
        body: "Les identifiants attribués par le serveur, les mises à jour simultanées sûres et l’attribution de responsables rendent GitHub Issues adapté aux flux de travail à plusieurs. AI4Kanban ne possède pas de base de données de coordination : deux personnes peuvent créer séparément la tâche #1894 et provoquer un conflit.",
      },
      transparency: {
        title: "Accessible à une communauté plus large",
        body: "Les tickets peuvent être publics et partagés par URL ; les contributeurs externes peuvent également signaler un problème, commenter et réagir. GitHub Issues est préférable lorsque la participation ouverte compte davantage que la rapidité locale.",
      },
      fullContext: {
        title: "Historique complet de l’activité",
        body: "AI4Kanban compresse volontairement les anciennes informations et réduit une carte archivée à un résumé d’une ligne. GitHub Issues conserve les commentaires, les modifications et les références croisées dans l’historique du ticket.",
      },
      integration: {
        title: "Intégrations éprouvées",
        body: "GitHub Issues s’intègre aux règles de fermeture par pull request, aux liens vers les commits, aux projets, aux étiquettes, aux jalons, à la recherche indexée et à un vaste écosystème d’outils tiers.",
      },
    },
  },
  ergonomics: {
    heading: {
      eyebrow: "La différence essentielle",
      title: "Pourquoi les agents travaillent bien avec des fichiers",
    },
    lead: "La différence pratique apparaît lorsqu’un agent exécute réellement la tâche. Demandez-lui de **« trouver mes tâches ouvertes de priorité élevée »** : les deux approches suivent alors des chemins très différents.",
    issues: {
      title: "vous › agent + GitHub MCP",
      chip: "plusieurs appels",
      lines: [
        "trouve mes tickets ouverts de priorité élevée",
        "list_issues(state:open, labels:high)",
        "4,2 Ko de JSON — 18 tickets avec tous leurs champs",
        "paginer, filtrer, résumer…",
        "renouveler l’authentification · traiter les limites d’utilisation · réessayer",
      ],
      footer:
        "plusieurs appels d’outils · des kilo-octets de JSON · un accès réseau à chaque fois",
    },
    kanban: {
      title: "vous › agent + AI4Kanban",
      chip: "un seul appel",
      lines: [
        "trouve mes tâches ouvertes de priorité élevée",
        'grep -rl "Priority: high" docs/kanban/todo',
        "trois chemins de fichiers",
        "terminé — un seul appel, sans réseau",
      ],
      footer: "un appel d’outil · quelques chemins · tout en local",
    },
    note: "Ces opérations supplémentaires s’accumulent. Demander quelle tâche traiter ensuite, archiver une tâche ou examiner le tableau exige une nouvelle interaction distante lorsque la source est GitHub Issues. Quand les deux options sont disponibles, les modèles ont aussi tendance à privilégier les outils familiers et faciles d’accès du système de fichiers, sauf si on leur demande explicitement d’utiliser le gestionnaire distant.",
  },
  decision: {
    heading: { eyebrow: "Comment choisir", title: "Quel outil utiliser ?" },
    oursHeading: "Utilisez AI4Kanban si",
    theirsHeading: "Utilisez GitHub Issues si",
    ours: [
      "Vous travaillez seul ou avec une ou deux personnes de confiance.",
      "Vous pilotez principalement le travail à l’aide d’un agent dans le terminal.",
      "Vous privilégiez l’avancement et une mémoire concise des décisions plutôt qu’un historique complet de l’activité.",
      "Vous souhaitez conserver le tableau dans Git, disponible hors ligne et facile à déplacer.",
    ],
    theirs: [
      "Vous développez publiquement et la transparence du processus est importante.",
      "Plusieurs personnes doivent mettre à jour le backlog en même temps.",
      "Votre flux de travail dépend des intégrations avec les pull requests et la CI, des projets ou des jalons.",
      "Vous souhaitez que des contributeurs externes puissent ouvrir des tickets et participer aux discussions.",
    ],
    verdict:
      "AI4Kanban et GitHub Issues ne sont pas des substituts directs. GitHub Issues fournit un **référentiel partagé** ; AI4Kanban offre un **tableau local rapide qu’un agent peut manipuler directement**. Si la coordination entre les personnes constitue le principal frein, utilisez GitHub Issues. Si le problème tient à l’efficacité avec laquelle vous et un agent pouvez faire avancer le travail, utilisez AI4Kanban.",
    note: "De nombreux développeurs indépendants utilisent les deux : GitHub Issues comme gestionnaire public de tickets, et AI4Kanban comme espace de travail privé utilisé au quotidien par leur agent.",
  },
};

export default fr;
