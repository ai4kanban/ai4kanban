// Français — the landing page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const fr: HomeCopy = {
  meta: {
    title: "Voyez le brouillon avant que les agents se mettent au travail | AI4Kanban",
    description:
      "AI4Kanban prépare les brouillons clés des tâches de votre tableau. Vous vérifiez l'essentiel, les agents s'occupent des détails, et vous faites avancer davantage de travail par vous-même.",
    socialTitle: "Voyez le brouillon. Laissez les agents faire le reste.",
    social: "Un tableau kanban pour agents IA qui vous montre d'abord les brouillons clés, puis laisse les agents terminer le reste.",
    schema:
      "AI4Kanban est un tableau kanban open source et local d'abord pour agents IA. Il prépare les brouillons clés de chaque tâche — une maquette d'interface, un brouillon de textes, un storyboard, des illustrations — pour que vous fixiez d'abord le cap ; des agents spécialisés terminent ensuite le reste dans le périmètre convenu. Il couvre le développement produit et la création de contenu, et se connecte à 8 outils comme Claude Code et Codex, qui tournent sur votre machine avec vos propres abonnements.",
  },

  hero: {
    title: "Voyez le brouillon. Laissez les agents faire le reste.",
    lead: "AI4Kanban prépare les brouillons clés des tâches de votre tableau. Vous vérifiez l'essentiel, les agents s'occupent des détails, et une seule personne fait avancer davantage de travail.",
    ctaDownload: "Télécharger",
    ctaGithub: "Voir sur GitHub ↗",
    image:
      "Enregistrement du tableau de démonstration d'AI4Kanban : planifier les tâches, relire les brouillons d'une carte, puis confier le travail aux agents.",
  },

  drafts: {
    title: "Relisez les brouillons clés. Prenez la bonne direction.",
    lead: "La mise en page d'une page, le propos d'un article, la façon dont une vidéo raconte son histoire : les agents transforment les parties qui comptent pour vous en brouillons sur la carte de la tâche. Quand vous le voyez, vous savez si c'est ce que vous voulez. Modifiez-le sur place et fixez la direction avant que le reste du travail ne commence.",
    kinds: [
      { label: "Maquette d'interface", body: "Voyez la mise en page et les interactions avant le développement." },
      { label: "Brouillon de textes", body: "Validez le message et la formulation avant que la page ne prenne forme." },
      { label: "Storyboard", body: "Voyez l'image et la voix off de chaque plan avant de produire la vidéo." },
      { label: "Illustrations", body: "Voyez ce que montre chaque illustration avant qu'elle soit finalisée." },
    ],
    closing:
      "Inutile de tout préciser. Une fois les brouillons clés validés, les agents terminent le reste dans le périmètre convenu.",
  },

  agents: {
    title: "Vos retours se retrouvent dans la tâche suivante.",
    body: [
      "Un agent de design prépare les maquettes, un agent de rédaction peaufine les textes, un agent de script planifie le contenu. AI4Kanban comprend 5 workflows et plus de 10 agents spécialisés qui se répartissent le travail par tâche et retiennent les préférences et décisions que vous avez clarifiées.",
      "Par exemple, si vous demandez « des titres plus directs », l'agent de rédaction applique ce retour aux brouillons suivants. La tâche suivante part de ce qui est déjà convenu : vous n'avez jamais à tout réexpliquer.",
    ],
    pro: "Les vidéos produit, présentations, carrousels et articles de blog nécessitent Pro.",
    image: "Vous donnez une consigne une fois ; l'agent la retient et chaque brouillon suivant la respecte.",
  },

  followUps: {
    title: "Laissez les agents repérer ce qui vous a échappé.",
    body: [
      "Quand les tâches s'accumulent, repérer chaque oubli ne devrait pas reposer sur vous seul. Des agents en arrière-plan vérifient régulièrement l'avancement, et un agent QA teste les changements récents comme le ferait un utilisateur.",
      "Un état d'erreur oublié ou un test manquant peut devenir une suggestion de suivi sur votre tableau. Vous l'acceptez, la modifiez ou la refusez, et les agents poursuivent.",
    ],
    image: "L'agent QA repère un oubli et vous remet un suivi à accepter ou à ignorer.",
  },

  parallel: {
    title: "Plusieurs chantiers à la fois. Les décisions clés restent les vôtres.",
    body: [
      "Une évolution produit, un article de lancement, une vidéo de présentation : inutile d'en finir un pour commencer le suivant. Les tâches indépendantes partent aux agents en parallèle ; vous relisez les brouillons clés sur les cartes, tranchez, et gardez votre attention pour ce qui mérite d'être fait ensuite.",
      "AI4Kanban s'occupe du découpage des tâches, des priorités, du suivi et des notifications : vous n'avez pas à coordonner le travail entre plusieurs conversations.",
    ],
    shots: {
      board: { label: "Board", alt: "Le tableau AI4Kanban : vue Board" },
      card: { label: "Card", alt: "Le tableau AI4Kanban : les détails et exigences d'une carte" },
      frontAria: "Vue {view} (actuelle)",
      flipAria: "Passer à la vue {view}",
    },
  },

  tools: {
    title: "Gardez les outils d'IA que vous utilisez déjà.",
    body: "Connectez Claude Code, Codex et d'autres ; ils tournent sur votre machine avec vos propres abonnements. 8 outils sont pris en charge, chaque agent peut choisir son outil et son modèle, et AI4Kanban ne facture aucun frais de tokens supplémentaire.",
  },

  start: {
    title: "Notez une idée. Voyez d'abord le brouillon.",
    lead: "Ouvrez un projet et écrivez ce que vous voulez faire. Partez du premier brouillon clé, fixez la direction, et confiez le reste aux agents.",
    cta: "Télécharger",
    firstOpen:
      "Les versions ne sont pas signées, donc macOS bloque la première ouverture : glissez l'app depuis le `.dmg`, puis choisissez de continuer dans l'avertissement. La page de téléchargement détaille les étapes pour macOS, Windows et Linux.",
    command: "Vous préférez la ligne de commande ? Lancez `npx ai4kanban@latest install` dans votre projet.",
  },
};

export default fr;
