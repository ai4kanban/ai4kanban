// Français — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const fr: VsHermesCopy = {
  meta: {
    title: "AI4Kanban vs. Hermes Agent Kanban : relisez les parties clés avant que les agents construisent",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description: "Vous utilisez déjà Claude Code ou Codex et voulez voir l’UI, le prompt ou les textes avant que les agents les construisent ? AI4Kanban vous convient. Vous utilisez déjà Hermes Agent et voulez gérer vos tâches depuis Telegram ou Slack ? Hermes Kanban vous convient. Voyez où chacun est le plus fort, ligne par ligne.",
    social: "Hermes Kanban met vos agents Hermes au travail et vous laisse les piloter depuis vos applications de chat. AI4Kanban met Claude Code ou Codex au travail et vous montre d’abord les brouillons des parties clés. Lequel correspond à votre façon de travailler ?",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Workflows spécialisés intégrés et approbation des brouillons : votre jugement intervient avant la construction, et vous corrigez moins après.",
    sharedLabel: "Les deux proposent",
    setup: {
      heading: "Des agents et workflows spécialisés, prêts à l’emploi",
      ours: "Les agents et workflows intégrés couvrent le développement logiciel, les blogs, les carrousels pour réseaux sociaux, les présentations et les vidéos produit. Vous pouvez aussi créer les vôtres.",
      theirs: "Les workers sont des profils Hermes que vous configurez avec un modèle et des skills. Aucun workflow spécialisé intégré pour le design d’UI, la rédaction ou la production de contenu.",
      art: {
        ours: [
          "Design UI",
          "Prompts",
          "Rédaction",
        ],
        theirs: {
          title: "Profil de worker",
          fields: [
            "Nom",
            "Modèle",
            "Skills",
          ],
          slot: "À configurer vous-même",
        },
      },
      shared: [
        {
          title: "Découpage des tâches et dépendances",
          body: [
            "AI4Kanban découpe le travail en cartes et sous-tâches, et les dépendances fixent l’ordre d’exécution.",
            "Hermes Kanban découpe une tâche d’une ligne en tâches enfants et lance chacune dès que ses tâches parentes sont terminées.",
          ],
        },
        {
          title: "Exécutions parallèles dans des git worktrees",
          body: [
            "AI4Kanban exécute côte à côte les cartes indépendantes, chacune dans son propre git worktree.",
            "Hermes Kanban exécute les tâches en parallèle, avec un git worktree par tâche.",
          ],
        },
      ],
    },
    drafts: {
      heading: "Relire les brouillons clés avant l’implémentation",
      ours: "Choisissez l’UI, les prompts, les textes ou les autres parties clés à relire. Les agents préparent des brouillons à prévisualiser et modifier, puis s’appuient sur ce que vous approuvez.",
      theirs: "Les tâches partent d’une spécification texte. Sa documentation ne décrit ni prévisualisation ni approbation des brouillons clés avant l’exécution.",
      art: {
        ours: [
          "Brouillon clé",
          "Approuver la direction",
          "Exécuter la tâche",
        ],
        theirs: {
          title: "Spécification de la tâche",
          fields: [
            "Objectif",
            "Approche",
            "Critères d’acceptation",
          ],
          slot: "Texte seulement",
        },
      },
      shared: [
        {
          title: "Une spécification écrite",
          body: [
            "Les cartes AI4Kanban contiennent le périmètre et les étapes de construction.",
            "Hermes Kanban peut réécrire une tâche en objectif, approche et critères d’acceptation.",
          ],
        },
        {
          title: "Retours sur la tâche",
          body: [
            "AI4Kanban reçoit vos modifications dans le chat de la carte et met le plan à jour.",
            "Hermes Kanban transmet vos notes au worker dans les commentaires de la tâche.",
          ],
        },
      ],
    },
    questions: {
      heading: "Fixez d’abord les exigences, puis cessez de surveiller",
      verdict: "Surveiller moins ne veut pas dire moins de qualité : brouillons, questions et synthèses des points clés gardent le résultat sur la bonne voie.",
      ours: "Il ne démarre pas à l’aveugle. Il pose d’abord les questions qui comptent et fixe ce que la livraison doit respecter, puis il construit. Vous approuvez les points clés et laissez les détails aux agents : inutile de surveiller chaque exécution, et vous livrez plus de travail dans la journée.",
      theirs: "Planification légère, exécution rapide : le travail démarre dès qu’il est découpé, le niveau d’exigence s’ajuste en cours de route et les corrections se font dans le worktree. C’est une façon de travailler valable, mais elle suppose que vous suiviez l’exécution, ce qui limite la quantité de travail livrée dans la journée.",
      art: {
        ours: [
          "Clarifier",
          "Approuver les points clés",
          "Exécuter",
        ],
        theirs: {
          title: "Tâche en cours",
          fields: [
            "Démarrer",
            "Ajuster l’exigence",
            "Corriger dans le worktree",
          ],
          slot: "Suivi pendant l’exécution",
        },
      },
      shared: [
        {
          title: "Des agents qui apprennent en travaillant",
          body: [
            "Les agents spécialisés d’AI4Kanban notent les brouillons que vous renvoyez ou rejetez, et les cartes terminées sont relues pour en extraire décisions et préférences.",
            "Chaque profil Hermes conserve des notes de mémoire et écrit ses propres skills à partir de ce qu’il apprend, y compris vos corrections.",
          ],
        },
        {
          title: "Historique de la tâche",
          body: [
            "AI4Kanban conserve sur la carte les plans, les conversations et les journaux d’exécution.",
            "Hermes Kanban conserve sur la tâche un fil de commentaires et l’historique des exécutions.",
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
    lead: "Un {check} indique le côté le plus fort sur chaque ligne.",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      startingPoint: {
        dimension: "Agents et workflows intégrés",
        kanban: "Agents et workflows spécialisés intégrés pour le développement et le contenu. Créez les vôtres. Les workflows de contenu nécessitent Pro.",
        hermes: "Des profils Hermes généralistes que vous configurez. Aucun workflow spécialisé intégré pour le design d’UI, la rédaction ou la production de contenu.",
      },
      planning: {
        dimension: "Avant le début du travail",
        kanban: "La planification règle ce qu’elle peut et vous pose les questions encore ouvertes. Rien n’est construit avant que vous le lanciez.",
        hermes: "Un modèle découpe la tâche en graphe de tâches sans vous consulter ; les tâches enfants démarrent seules, sauf si vous désactivez cette option.",
      },
      drafts: {
        dimension: "Relecture des brouillons clés avant l’exécution",
        kanban: "Brouillons image, schéma, HTML/TSX, diff et storyboard. Le contenu approuvé rejoint les exigences d’exécution.",
        hermes: "Une spécification texte avec objectif, approche et critères d’acceptation. Sa documentation ne prévoit aucun aperçu de brouillon avant l’exécution.",
      },
      questions: {
        dimension: "Questions qui vous sont posées",
        kanban: "Posées pendant la planification ou en cours de construction, chacune avec des options et une réponse recommandée ; seul le travail qui en dépend attend, et il reprend dès que vous répondez.",
        hermes: "Un worker met toute la tâche en pause avec une raison écrite ; vous commentez, la débloquez, et le worker repart du début.",
      },
      memory: {
        dimension: "Ce que retiennent les agents",
        kanban: "Chaque agent spécialisé note les brouillons que vous renvoyez ou rejetez ; les cartes terminées sont relues pour en extraire décisions et préférences.",
        hermes: "Chaque profil conserve des notes de mémoire et écrit ses propres skills à partir de ce qu’il apprend, y compris vos corrections.",
      },
      followUps: {
        dimension: "Travail après la livraison",
        kanban: "Les agents relisent ce qui a été livré et suggèrent du travail de suivi, raisons à l’appui ; un agent QA teste chaque jour les changements récents. Les suggestions attendent votre décision dans une file de tri.",
        hermes: "Les workers créent des tâches enfants pour découper le travail en cours. Le suivi après livraison est une nouvelle tâche que vous créez.",
      },
      landing: {
        dimension: "Fusion du travail parallèle",
        kanban: "Chaque construction terminée est rebasée et fusionnée à tour de rôle ; un agent résout les conflits.",
        hermes: "Les worktrees sont conservés après la tâche. La fusion n’est pas documentée ; les conflits passent dans une tâche de réconciliation distincte.",
      },
      recurring: {
        dimension: "Travail récurrent",
        kanban: "Des agents planifiés s’exécutent au rythme que vous fixez.",
        hermes: "Démarrages planifiés ponctuels. Le travail récurrent demande votre propre tâche cron.",
      },
      harness: {
        dimension: "Exécution avec Claude Code ou Codex",
        kanban: "Claude Code, Codex, Cursor, OpenCode et d’autres agents de code exécutent directement le travail, avec vos propres abonnements ; choisissez-en un par agent.",
        hermes: "Les workers sont des agents Hermes ; une skill fournie permet à l’un d’eux d’appeler Claude Code ou Codex depuis le terminal.",
      },
      interface: {
        dimension: "Tableau et interface",
        kanban: "Une application de bureau pour les cartes, les brouillons, les conversations et l’état des exécutions.",
        hermes: "Une CLI, un tableau de bord web et un plugin pour l’application de bureau.",
      },
      review: {
        dimension: "Vérification du travail",
        kanban: "Claude Code ou Codex exécutent les tests et vérifient les exigences pendant la construction ; AI4Kanban n’ajoute pas de seconde relecture, pour éviter de trop tester.",
        hermes: "Un profil relecteur vérifie chaque critère d’acceptation et exécute les tests, en renvoyant le travail jusqu’à ce qu’il passe.",
      },
      chat: {
        dimension: "Pilotage depuis les applications de chat",
        kanban: "Les notifications, Slack et Lark nécessitent Cloud, en aperçu sur invitation.",
        hermes: "Gérez le tableau avec /kanban depuis Telegram, Discord, Slack, WhatsApp, Signal et d’autres, avec des notifications de tâches.",
      },
      recovery: {
        dimension: "Reprise après un échec d’exécution",
        kanban: "Les erreurs du fournisseur sont relancées automatiquement. Une exécution arrêtée attend que vous la repreniez.",
        hermes: "Les battements de cœur récupèrent les tâches bloquées, et une tâche qui échoue sans cesse est mise en attente.",
      },
      api: {
        dimension: "API et extensions",
        kanban: "Une CLI qu’appellent les agents de code. Pas d’API publique.",
        hermes: "Une API REST et WebSocket, ainsi que des hooks de plugins pour les événements de tâches.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Recommandation",
      title: "Lequel choisir ?",
    },
    oursHeading: "Choisissez AI4Kanban si vous",
    theirsHeading: "Choisissez Hermes Kanban si vous",
    ours: [
      "Voulez des agents et workflows spécialisés intégrés, ou créer les vôtres.",
      "Voulez approuver les brouillons clés d’UI, de prompts ou de textes avant l’exécution complète.",
      "Voulez que les agents suggèrent du travail de suivi après chaque livraison.",
    ],
    theirs: [
      "Utilisez déjà Hermes Agent et voulez le tableau à l’intérieur.",
      "Voulez gérer vos tâches depuis Telegram, Slack, Discord ou d’autres applications de chat.",
      "Voulez une reprise automatique des tâches bloquées et une API sur laquelle construire.",
    ],
    verdict: "Choisissez AI4Kanban pour **les workflows spécialisés, l’approbation des brouillons avant la construction et les suggestions de travail de suivi** ; choisissez Hermes Kanban pour **le pilotage depuis les applications de chat, la reprise automatique et une API**.",
    note: "Comparaison établie d’après la documentation de Hermes Agent v0.21.6, vérifiée en octobre 2026.",
  },
};

export default fr;
