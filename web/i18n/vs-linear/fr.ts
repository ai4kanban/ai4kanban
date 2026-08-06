// Français — the Linear comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsLinearCopy } from "./types";

const fr: VsLinearCopy = {
  meta: {
    title: "AI4Kanban vs. Linear — planifier dans le dépôt ou coordonner l’équipe",
    socialTitle: "AI4Kanban vs. Linear",
    description:
      "Comparez AI4Kanban et Linear : un système de planification intégré au dépôt pour les agents de code face à une plateforme collaborative de développement produit pour les équipes et les agents.",
    social:
      "Linear coordonne le travail à l’échelle de l’organisation. AI4Kanban transforme les demandes imprécises en plans prêts à exécuter dans le dépôt. Découvrez le modèle qui correspond à votre façon de travailler.",
  },
  hero: {
    badge: "Comparaison",
    title: "AI4Kanban vs.\nLinear",
    lead: "Linear offre aux équipes un espace commun pour planifier et livrer leurs produits. AI4Kanban installe le système de planification de l’agent de code dans le dépôt. Le premier coordonne une organisation ; le second transforme une demande incomplète en travail prêt à réaliser, sans séparer le plan du code.",
    ours: {
      name: "AI4Kanban",
      body: "Un tableau Markdown dans le dépôt, conçu pour l’affinage piloté par l’agent.",
    },
    theirs: {
      name: "Linear",
      body: "Un espace hébergé où personnes et agents coordonnent le développement produit.",
    },
  },
  summary: {
    heading: {
      eyebrow: "En bref",
      title: "Les deux gèrent des agents, mais pas au même niveau.",
    },
    lead: "Linear est une plateforme complète de développement produit. Ses agents exploitent le contexte de l’espace de travail, les tickets peuvent être délégués à des agents de code, et MCP permet de connecter des agents externes. Coding Sessions peut aussi exécuter Claude Code ou Codex et soumettre une pull request à la relecture.",
    panel:
      "AI4Kanban répond à un besoin plus ciblé : **planifier avec un agent de code dans le dépôt**. Une demande incomplète devient une série de questions, de décisions et de dépendances, puis une carte prête à réaliser. Le plan et son historique restent en Markdown, consultables et révisables à côté du code.",
  },
  comparison: {
    heading: { eyebrow: "Face à face", title: "AI4Kanban vs. Linear" },
    lead: "Un {check} indique l’option la plus adaptée à un besoin donné ; un **tiret** signifie que la réponse dépend de votre organisation. Linear est plus complet pour **la coordination d’équipe, la planification de portefeuille, les intégrations et l’exécution managée des agents**. AI4Kanban se distingue par **l’affinage dans le dépôt, la portabilité et l’historique de planification dans git**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Linear",
    rows: {
      bestFit: {
        dimension: "À qui il convient",
        kanban: "Développeurs indépendants et petites équipes qui planifient et livrent avec un agent de code.",
        linear: "Organisations produit et ingénierie qui coordonnent personnes, projets et agents.",
      },
      sourceOfTruth: {
        dimension: "Emplacement du plan",
        kanban: "Du Markdown dans le dépôt du projet, versionné avec le code.",
        linear: "Un espace Linear partagé, accessible par ses applications, son API et son MCP server.",
      },
      refinement: {
        dimension: "De l'idée brute à la tâche prête",
        kanban: "Un processus guidé étudie la demande, consigne les décisions et s’arrête lorsque la carte est assez précise pour être réalisée.",
        linear: "Linear Agent peut rédiger, résumer, mettre à jour et cadrer les tickets ; la qualité du résultat dépend toujours de celle du ticket.",
      },
      agentModel: {
        dimension: "Modèle d'agents",
        kanban: "L’environnement de code de votre choix lit et écrit le tableau ; Claude Code et Codex sont actuellement pris en charge.",
        linear: "Linear Agent, des app users installables, des tickets délégués, des consignes pour agents et un MCP server hébergé.",
      },
      execution: {
        dimension: "Code et relecture",
        kanban: "L’environnement choisi réalise la carte finalisée ; la relecture reste dans votre workflow git habituel.",
        linear: "Coding Sessions exécute Claude Code ou Codex dans le cloud, ouvre une pull request et intègre les diffs et la relecture à Linear.",
      },
      collaboration: {
        dimension: "Collaboration humaine",
        kanban: "Bien adapté à la collaboration par git en petite équipe, mais pas à l’édition simultanée du tableau par de nombreuses personnes.",
        linear: "Un espace en temps réel avec responsables, commentaires, équipes privées, invités, notifications et permissions.",
      },
      portfolio: {
        dimension: "Étendue de la planification",
        kanban: "Cartes, dépendances, priorités, ROI, releases et historique de planification par module.",
        linear: "Tickets, projets, cycles, initiatives, jalons, chronologies, triage, analyses et demandes clients.",
      },
      setup: {
        dimension: "Prise en main",
        kanban: "S’installe dans un dépôt avec un prompt ; le tableau ne demande ni compte, ni base de données, ni service hébergé.",
        linear: "Créez un espace, invitez l’équipe, puis configurez les intégrations et les accès des agents selon vos besoins.",
      },
      portability: {
        dimension: "Portabilité",
        kanban: "Clonez le dépôt : le tableau, les décisions et l’historique suivent. La planification reste également disponible hors ligne.",
        linear: "Les données résident dans Linear ; les administrateurs peuvent exporter les tickets en CSV ou les récupérer par l’API.",
      },
      pricing: {
        dimension: "Prix",
        kanban: "Open source sous licence Apache-2.0 ; vous ne payez que les outils d’agent de code que vous choisissez.",
        linear: "Free comprend 250 tickets et 2 équipes. Facturé à l’année, Basic coûte 10 $ par utilisateur et par mois, Business 16 $. Coding Sessions consomme également des AI credits.",
      },
    },
  },
  model: {
    heading: {
      eyebrow: "La différence essentielle",
      title: "Contexte du dépôt ou contexte de l’organisation",
    },
    lead: "La question n’est pas de savoir si le produit gère des agents, mais **où doit résider le contexte de planification** : avec le code dans le dépôt, ou dans un espace commun à toute l’organisation.",
    ours: {
      name: "AI4Kanban — le plan reste près du code",
      is: "Avant de modifier le plan, l’agent consulte le code, les décisions antérieures, les approches écartées et le travail terminé. Il précise la demande jusqu’à ce que chaque question soit résolue ou vous soit clairement attribuée.",
      isnt: "Ce n’est pas une suite collaborative à l’échelle de l’organisation. Sa valeur tient à un contexte de planification durable, versionné avec le code et disponible dans chaque clone.",
    },
    theirs: {
      name: "Linear — un espace commun à toute l’organisation",
      is: "Les tickets appartiennent à des équipes et les projets peuvent en réunir plusieurs. Cycles, initiatives, chronologies, documents, commentaires et demandes clients forment un contexte partagé, dans lequel les agents travaillent avec les mêmes règles d’accès.",
      isnt: "Cette richesse peut être superflue pour un développeur indépendant dont la principale difficulté consiste à transformer une demande imprécise en plan de réalisation fiable.",
    },
    note: "Les deux peuvent cohabiter, mais un seul doit faire autorité sur l’état des tâches. Pour un développeur indépendant, maintenir le même travail à deux endroits ajoute généralement plus de processus que de valeur.",
  },
  wins: {
    heading: { eyebrow: "Compromis", title: "Où chacun l'emporte" },
    lead: "Linear offre une couverture fonctionnelle étendue, une coordination d’équipe solide et une exécution managée. AI4Kanban garde la planification pilotée par l’agent près du code, facile à examiner et disponible d’une session à l’autre.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Linear",
    ours: {
      roughToReady: {
        title: "Affine les demandes avant leur réalisation",
        body: "L’agent étudie la demande, pose des questions, consigne les décisions et découpe le travail avant de considérer la carte comme un plan de réalisation.",
      },
      repoMemory: {
        title: "Conserve l’historique du plan près du code",
        body: "Décisions, approches écartées, dépendances et cartes sont de simples fichiers diffables que la prochaine session de l’agent peut consulter.",
      },
      anyHarness: {
        title: "Fonctionne avec votre environnement de code",
        body: "Le tableau n’est pas lié à un runtime d’agent propriétaire. Claude Code et Codex sont déjà pris en charge, et le format de fichier ouvert permet d’utiliser d’autres environnements.",
      },
      noSaas: {
        title: "Ne nécessite aucun service de gestion de projet",
        body: "Le tableau lui-même ne demande ni espace, ni licences, ni authentification, ni base de données, ni couche de synchronisation à administrer. Il fait simplement partie du dépôt.",
      },
    },
    theirs: {
      teamSystem: {
        title: "Conçu pour la collaboration en équipe",
        body: "Édition simultanée, responsabilités claires, permissions, commentaires, équipes privées, invités, notifications et interface aboutie sont intégrés.",
      },
      agentPlatform: {
        title: "Fournit agents et exécution managés",
        body: "Linear Agent, app users, MCP, tickets délégués, Coding Sessions, diffs et relecture des pull requests partagent le même contexte d’espace de travail.",
      },
      planningDepth: {
        title: "Planifie les produits à grande échelle",
        body: "Projets, cycles, initiatives, jalons, chronologies, triage, analyses et demandes clients prennent en charge une planification qui dépasse largement un seul dépôt.",
      },
      integrations: {
        title: "Relie le travail dans toute l’organisation",
        body: "GitHub, GitLab, Slack, Teams, outils de support, API, webhooks et recherche relient la planification au reste du travail de l’organisation.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "La décision", title: "Lequel correspond à votre workflow ?" },
    oursHeading: "Choisissez AI4Kanban si",
    theirsHeading: "Choisissez Linear si",
    ours: [
      "Un développeur indépendant ou une petite équipe planifie et réalise le travail avec un agent de code.",
      "Les demandes sont souvent incomplètes, et leur transformation en plans fiables constitue le goulot d’étranglement.",
      "Vous voulez versionner les tâches, les décisions et l’historique de planification avec le code.",
      "Vous préférez choisir votre environnement de code plutôt que d’adopter le runtime d’un outil de projet.",
    ],
    theirs: [
      "De nombreuses personnes doivent créer, attribuer, discuter et mettre à jour le travail en parallèle.",
      "Votre planification dépend des cycles, initiatives, chronologies, du triage, des demandes clients ou des rapports.",
      "Vous voulez des sessions de code managées dans le cloud et une relecture des diffs dans l’espace projet.",
      "Vous avez besoin d’intégrations, de permissions, de contrôles de sécurité et d’un support à l’échelle de l’organisation.",
    ],
    verdict:
      "Choisissez Linear si la difficulté consiste à coordonner personnes, projets et agents dans toute l’organisation. Choisissez AI4Kanban s’il faut surtout donner à l’agent de code un contexte durable et suffisant pour transformer une demande incomplète en travail fiable. Le critère décisif n’est pas la longueur de la liste de fonctionnalités, mais l’endroit où votre processus de planification doit vivre.",
    note: "AI4Kanban propose un autre modèle de planification ; il ne remplace pas Linear fonctionnalité par fonctionnalité.",
  },
};

export default fr;
