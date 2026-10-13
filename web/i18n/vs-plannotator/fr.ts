import type { VsPlannotatorCopy } from "./types";

const fr: VsPlannotatorCopy = {
  meta: {
    title: "AI4Kanban vs. Plannotator : relire les brouillons, lancer les tâches",
    socialTitle: "AI4Kanban vs. Plannotator",
    description:
      "Envie de relire les brouillons clés et de lancer des tâches en parallèle ? Comparez les agents spécialisés et le tableau de tâches d’AI4Kanban avec la relecture de plans, de documents et de code de Plannotator.",
    social:
      "Plannotator apporte la relecture de plans, de documents et de code dans vos sessions d’agent. AI4Kanban réunit sur un tableau de tâches les brouillons clés, la livraison en parallèle, la mémoire et les suivis.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs. Plannotator",
    lead: "Plannotator vous permet d’annoter les plans, les documents et le code de votre agent de code. AI4Kanban organise les tâches sur un tableau : des agents spécialisés intégrés préparent les brouillons clés pour que vous les approuviez, puis exécutent les tâches en parallèle, en arrière-plan.",
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
    title: "AI4Kanban : relire les brouillons clés, faire avancer plusieurs tâches",
    lead: "AI4Kanban organise le travail des agents de code sur un tableau de tâches, avec des spécialistes intégrés en design UI, rédaction et veille concurrentielle. Vous participez à la planification et approuvez les brouillons clés, puis les agents exécutent en arrière-plan. Les tâches sans dépendances peuvent avancer en même temps.",
    drafts: {
      title: "Relire ce que vous voudriez changer",
      body: "Vous craignez que l’IA prenne des libertés avec un écran, un prompt ou un texte ? Ce qui demande votre décision passe d’abord par un brouillon ; les agents construisent à partir du brouillon approuvé. En plus des plans et du HTML, prévisualisez des images, des schémas et des storyboards. Les agents règlent directement le reste des détails.",
      art: ["Brouillon", "Approuver", "Exécution"],
    },
    parallel: {
      title: "Faire avancer plusieurs tâches ensemble",
      body: "Le tableau réunit les tâches, leurs dépendances et leur avancement. Une fois les besoins fixés, les tâches indépendantes s’exécutent en parallèle. Consultez les journaux et les diffs de code depuis chaque carte, sans surveiller chaque session pendant l’exécution.",
      art: ["Connexion", "Tarifs", "Correctif API"],
    },
    memory: {
      title: "Moins d’explications la prochaine fois",
      body: "Chaque agent dispose d’une mémoire pensée pour son travail, qui apprend vos préférences et vos décisions. Les agents peuvent partager cette mémoire. Une fois un travail principal terminé, ils proposent des suivis pour combler les manques et repérer les oublis.",
      art: { agents: ["Design UI", "Rédaction"], shared: "Partagée · contexte du projet" },
    },
    custom: "Vous pouvez aussi créer vos propres agents et workflows.",
    tipLabel: "Astuce",
    tip: "Le workflow de développement logiciel est gratuit. Les workflows de blog, de carrousel pour réseaux sociaux, de présentation et de vidéo produit nécessitent Pro.",
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
      body: "Vous voulez faire avancer plusieurs tâches : approuver les brouillons clés d’UI et de textes, laisser les agents exécuter, et reporter vos préférences et décisions sur les tâches suivantes.",
    },
  },
  start: {
    title: "Prêt à coordonner plusieurs tâches ?",
    body: "Téléchargez AI4Kanban. Planifiez avec précision, livrez rapidement.",
    cta: "Télécharger AI4Kanban",
  },
};

export default fr;
