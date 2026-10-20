import type { VsPlannotatorCopy } from "./types";

const fr: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator : du brouillon à la livraison",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "Comparez AI4Kanban et Plannotator sur la validation des brouillons et du code, les workflows spécialisés, les tâches parallèles et la suite après approbation.",
    social:
      "Comparez AI4Kanban et Plannotator sur la validation des brouillons et du code, les workflows spécialisés, les tâches parallèles et la suite après approbation.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs. Plannotator",
    lead: "Comparez AI4Kanban et Plannotator sur la validation des brouillons et du code, les workflows spécialisés, les tâches parallèles et la suite après approbation.",
  },
  both: {
    title: "Ce que les deux proposent",
    items: [
      "Relire les plans avant l’exécution",
      "Renvoyer les annotations à l’agent",
      "Fonctionner avec plusieurs agents de code",
      "Afficher les diffs de code",
      "Gratuit et open source",
    ],
  },
  theirs: {
    title: "Plannotator : relire dans votre session d’agent",
    intro:
      "Plannotator se connecte à votre agent de code par des hooks et des commandes. Les hooks de plan compatibles ouvrent une relecture locale dans le navigateur. Approuvez le plan ou renvoyez-le avec des annotations, consultez le diff du plan, puis continuez dans la même session.",
    more: [
      {
        title: "Relire bien plus que des plans",
        body: "Annotez du Markdown, des dossiers, des URL, des brouillons HTML ou le dernier message de l’agent. Relisez les modifications de code locales, les PR GitHub et les MR GitLab. Posez des questions à l’IA pendant la relecture, ou lancez une relecture de code par l’IA qui ajoute ses remarques au diff.",
      },
      {
        title: "Partager une relecture",
        body: "Partagez un lien pour que d’autres annotent, puis importez leurs retours. Les petits contenus passent par des fragments d’URL ; les contenus plus lourds et le HTML utilisent des liens courts chiffrés. Le partage de liens de la version open source reste disponible, avec un support déprécié. La collaboration en équipe passe à Workspaces, toujours annoncé « bientôt disponible » sur le site.",
      },
    ],
    links: ["Découvrir Plannotator", "README de Plannotator"],
  },
  ours: {
    title: "AI4Kanban : des brouillons au travail terminé",
    lead: "Les spécialistes préparent les brouillons d’interface, de textes ou de script à valider. Une fois ces parties approuvées, le workflow mène la tâche à terme. Code, articles et vidéos sont intégrés ; les tâches indépendantes peuvent avancer en parallèle.",
    drafts: {
      title: "Relire ce que vous voudriez changer",
      body: "Les parties qui demandent votre jugement font d’abord l’objet d’un brouillon. Relisez-le et modifiez-le sur la carte ; les agents poursuivent à partir de la version validée et règlent les détails dans le périmètre convenu. Corriger les points clés à ce stade limite les reprises ultérieures.",
      art: ["Brouillon", "Approuver", "Exécution"],
    },
    parallel: {
      title: "Faire avancer plusieurs tâches ensemble",
      body: "Réunissez développement et marketing sur un même tableau, avec les brouillons, décisions et avancées sur chaque carte. Une fois les exigences définies, les tâches indépendantes avancent en parallèle ; celles qui ont des dépendances suivent leur ordre.",
      art: ["Connexion", "Tarifs", "Correctif API"],
    },
    memory: {
      title: "Moins d’explications la prochaine fois",
      body: "Chaque agent retient les préférences et décisions utiles à son travail et peut partager le contexte du projet avec les autres agents. Les tâches suivantes partent de ce qui a déjà été convenu. Après un travail principal, les agents proposent des suites que vous pouvez accepter, modifier ou refuser.",
      art: { agents: ["Design UI", "Rédaction"], shared: "Partagée · contexte du projet" },
    },
    custom: "Vous pouvez aussi créer vos propres agents et workflows.",
    tipLabel: "Astuce",
    tip: "Le workflow de développement logiciel est gratuit. Les workflows de blog, de publications pour les réseaux sociaux, de présentation, de vidéo produit et de clonage vidéo nécessitent Pro.",
  },
  compare: {
    title: "Ce qui est intégré",
    head: "Fonctionnalité",
    yes: "Inclus",
    no: "Non inclus",
    how: {
      label: "Façon de travailler",
      theirs: "Ouvrir une relecture dans votre session d’agent en cours",
      ours: "Lancer des agents depuis des cartes de tâche, en arrière-plan",
    },
    rows: {
      plans: { label: "Relire les plans et renvoyer des retours avant l’exécution" },
      html: { label: "Prévisualiser des brouillons HTML" },
      images: { label: "Relire des brouillons d’images et de storyboards" },
      planDiff: { label: "Afficher les différences entre versions du plan" },
      askAi: {
        label: "Interroger l’IA pendant la relecture",
        theirs: "Questions dans la vue de relecture",
        ours: "Conversation sur la carte",
      },
      codeDiff: { label: "Afficher les diffs de code", ours: "Onglet Diff de la livraison" },
      aiReview: { label: "Remarques de relecture IA sur les diffs de code" },
      prs: { label: "Relire les PR GitHub et les MR GitLab" },
      share: { label: "Partager des liens de relecture", theirs: "Support déprécié en version OSS" },
      board: { label: "Tableau de tâches avec dépendances et exécution en parallèle" },
      agents: { label: "Agents spécialisés et workflows intégrés" },
      memory: { label: "Mémoire des préférences et décisions, partagée entre agents" },
      followUps: { label: "Suivis proposés après une tâche principale" },
    },
    note: "Seules les fonctionnalités intégrées sont comparées. L’historique local de Plannotator et ses exports vers Obsidian ou Bear conservent des traces de relecture ; ils ne constituent pas la mémoire que les agents réutilisent dans les tâches suivantes.",
  },
  decision: {
    title: "Lequel correspond à votre travail ?",
    theirs: {
      name: "Choisir Plannotator",
      body: "Vous voulez relire plans, documents et code autour de l’agent que vous utilisez déjà, en vérifiant chaque version. Vous avez aussi besoin de relire des PR ou de partager des annotations.",
    },
    ours: {
      name: "Choisir AI4Kanban",
      body: "Validez les brouillons clés sur la carte, puis laissez les agents terminer. Les workflows intégrés couvrent développement et marketing, avec des tâches indépendantes en parallèle. Les agents réutilisent vos préférences pour limiter les corrections répétées.",
    },
  },
  start: {
    title: "Prêt à coordonner plusieurs tâches ?",
    body: "Téléchargez AI4Kanban. Planifiez avec précision, livrez rapidement.",
    cta: "Télécharger AI4Kanban",
  },
};

export default fr;
