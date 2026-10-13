import type { DraftFirstCopy } from "./types";

const fr: DraftFirstCopy = {
  meta: {
    title: "draft-first : relisez les brouillons de l’IA avant de construire",
    description:
      "Moins de reprises. Votre agent de code prépare d’abord des brouillons des écrans, des prompts et des textes, puis construit à partir de ceux que vous confirmez.",
  },
  schema:
    "draft-first est une skill pour Claude Code, Codex, Cursor, OpenCode et d’autres agents de code. Elle soumet à votre relecture des brouillons d’écrans, des prompts avec des exemples de sortie, des textes, des images, des choix de bibliothèques et des comparatifs concurrentiels. Une fois que vous les avez corrigés et confirmés, l’agent implémente les écrans, les textes et les options retenus, avec moins de suppositions pendant la construction.",
  hero: {
    title: ["Voyez le brouillon.", "Puis construisez."],
    lead: "Votre agent de code prépare des brouillons des écrans, des prompts et des textes. Vous les relisez et les corrigez ; il construit ensuite à partir de la version que vous confirmez.",
    update: "Relancez la commande pour mettre à jour.",
    worksWith: "Compatible avec",
    alt: "Une page de relecture draft-first : un brouillon est supprimé, un autre reçoit une note, puis la page est confirmée.",
  },
  drafts: {
    title: "Des brouillons pour l’essentiel",
    lead: "Votre IA se trompe toujours sur les détails ? Relisez les brouillons des parties clés, corrigez-les et confirmez-les, puis laissez-la construire à partir de ces brouillons.",
    kinds: [
      ["Écrans", "voyez à quoi ressemblera la page."],
      ["Prompts", "lisez le prompt et des exemples de sortie."],
      ["Textes", "lisez ce que votre IA a écrit."],
      ["Images", "voyez les images avant d’en choisir une."],
    ],
    more: "Elle prépare aussi des brouillons de choix de bibliothèques et de comparatifs concurrentiels.",
    closing: "Le reste, confiez-le à votre agent.",
  },
  review: {
    title: "Ajustez le brouillon. Puis construisez à partir de lui.",
    actions: [
      ["Supprimer", "Retirez une option dont vous ne voulez pas."],
      ["Note", "Laissez un commentaire sur un brouillon."],
      ["Confirmer", "Enregistrez la version à partir de laquelle votre agent construira."],
    ],
    export: "Exportez une image ou un unique fichier HTML à partager. Le fichier HTML s’ouvre dans un navigateur ; rien n’est envoyé en ligne.",
    workflow: ["Pour la méthode derrière ces brouillons, lisez ", "draft-first development", " (en anglais)."],
  },
  helpers: {
    title: "Vous choisissez ce qui passe par un brouillon",
    lead: "Six agents de brouillon sont inclus. Vous voulez un storyboard avant que votre IA ne réalise une vidéo ? Ajoutez .draft-first/helpers/storyboard.md avec des instructions pour décrire l’image et la narration de chaque scène.",
    example: "Exemple : un agent de storyboard vidéo",
    file: ".draft-first/helpers/storyboard.md",
    description: "Une vidéo créée ou modifiée.",
    body: "Listez les scènes dans l’ordre, avec une ligne pour ce que voit le spectateur et une ligne pour la narration.",
  },
  upgrade: {
    title: "Trop de tâches ? Confiez-les à AI4Kanban.",
    lead: "Placez vos brouillons sur un tableau AI4Kanban pour planifier, relire et exécuter plusieurs tâches au même endroit.",
    cards: [
      ["Vos préférences retenues", "Les agents réutilisent vos préférences et vos décisions : vous avez moins à expliquer la fois suivante."],
      ["Des tâches en parallèle", "Les tâches indépendantes s’exécutent en même temps ; celles qui dépendent d’autres attendent leurs résultats."],
      ["Aucun suivi oublié", "Une fois une tâche terminée, les agents proposent le travail restant sous forme de tâches de suivi."],
    ],
    explore: "Découvrir AI4Kanban",
    download: "Télécharger AI4Kanban",
  },
  faq: {
    title: "Questions fréquentes",
    items: [
      ["Où sont stockés mes brouillons ?", "Dans .draft-first/, à la racine du projet. Ce dossier contient les brouillons, les notes et les fichiers confirmés que votre agent utilise pour construire."],
      ["Quels agents sont pris en charge ?", "Tout agent de code qui lit les skills depuis .claude/skills/ ou .agents/skills/."],
      [
        "Comment le désinstaller ?",
        "Supprimez les dossiers draft-first de .claude/skills/ et .agents/skills/. Pour supprimer aussi les brouillons du projet, sauvegardez ce que vous souhaitez garder, puis supprimez .draft-first/ de ce projet.",
      ],
    ],
  },
};

export default fr;
