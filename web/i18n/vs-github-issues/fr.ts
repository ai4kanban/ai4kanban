// Français — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const fr: VsGithubCopy = {
  meta: {
    title:
      "AI4Kanban face à GitHub Issues : tableau local pour agents ou suivi collaboratif",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "Comparez AI4Kanban et GitHub Issues sur le stockage, le coût pour l’agent, la coordination d’équipe, l’historique et la participation externe.",
    social:
      "AI4Kanban facilite le travail local entre un développeur et un agent. GitHub Issues facilite la coordination d’une équipe ou d’une communauté.",
  },
  hero: {
    badge: "Comparatif",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban et GitHub Issues répondent à des besoins de coordination différents. AI4Kanban place le tableau dans le dépôt pour que le développeur et l’agent puissent le manipuler directement. GitHub Issues offre à une équipe ou une communauté un service partagé pour suivre le travail et en discuter. Le choix dépend surtout de votre priorité : travailler efficacement en local avec un agent, ou coordonner plusieurs personnes.",
    ours: {
      name: "AI4Kanban",
      body: "Un tableau Markdown conservé avec le code, que l’agent peut consulter et mettre à jour directement.",
    },
    theirs: {
      name: "GitHub Issues",
      body: "Un service hébergé pour partager les tâches, les échanges et leur état avec une équipe ou une communauté.",
    },
  },
  comparison: {
    heading: {
      eyebrow: "Comparaison essentielle",
      title: "Espace local ou service partagé ?",
    },
    lead: "La différence fondamentale tient à l’emplacement du tableau. Ce choix détermine le coût d’accès pour l’agent, la coordination du travail simultané, l’historique conservé et la manière dont des personnes externes peuvent participer.",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "Emplacement du travail",
        kanban:
          "Le tableau est stocké en Markdown dans le dépôt. L’agent peut le consulter et le modifier directement, même hors ligne.",
        issues:
          "Les tâches sont hébergées par GitHub. L’agent doit être connecté et passer par la CLI `gh` ou MCP.",
      },
      tokenCost: {
        dimension: "Coût pour l’agent",
        kanban:
          "La recherche locale peut ne renvoyer que le texte pertinent, ce qui réduit le contexte utilisé et le temps de réponse.",
        issues:
          "Une opération distante oblige aussi l’agent à traiter les définitions d’outils et les réponses JSON, tout en dépendant du réseau. Elle consomme donc généralement plus de tokens.",
      },
      concurrency: {
        dimension: "Collaboration simultanée",
        kanban:
          "Aucun serveur ne coordonne les modifications : deux personnes peuvent créer le même numéro de tâche et provoquer un conflit.",
        issues:
          "Le serveur attribue les identifiants et synchronise les mises à jour, ce qui sécurise le travail simultané en équipe.",
      },
      history: {
        dimension: "Historique conservé",
        kanban:
          "Il conserve les décisions et les résultats utiles au travail futur, tout en résumant les détails plus anciens.",
        issues:
          "Il garde la trace complète des commentaires, modifications, références croisées et activités.",
      },
      contributors: {
        dimension: "Participation externe",
        kanban:
          "Les contributeurs doivent avoir accès au dépôt et participer en modifiant les fichiers Markdown.",
        issues:
          "Dans un dépôt public, chacun peut ouvrir un ticket, commenter ou réagir sans soumettre de code.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "Comment choisir",
      title: "Quel outil correspond à votre façon de travailler ?",
    },
    oursHeading: "AI4Kanban convient mieux si",
    theirsHeading: "GitHub Issues convient mieux si",
    ours: [
      "Vous travaillez seul ou avec une ou deux personnes avec qui vous collaborez régulièrement.",
      "Vous vous appuyez principalement sur un agent dans le terminal pour faire avancer les tâches.",
      "Vous privilégiez une exécution rapide et un contexte de décision concis plutôt qu’un journal d’activité exhaustif.",
      "Vous voulez conserver le tableau dans Git, l’utiliser hors ligne et le déplacer avec le dépôt.",
    ],
    theirs: [
      "Plusieurs personnes doivent attribuer et mettre à jour des tâches en même temps.",
      "Le projet est développé publiquement et la transparence du processus est importante.",
      "Votre flux de travail dépend des pull requests, de la CI, des projets, des jalons ou de l’automatisation.",
      "Vous souhaitez que des contributeurs externes puissent ouvrir des tickets et participer aux échanges.",
    ],
    verdict:
      "Ces outils ne sont pas directement interchangeables. GitHub Issues est un **outil partagé de suivi des tâches** ; AI4Kanban est un **tableau local qu’un agent peut manipuler directement**. Choisissez GitHub Issues si la coordination de l’équipe constitue le principal frein. Choisissez AI4Kanban si vous devez avancer plus efficacement avec un agent.",
    note: "Ils peuvent aussi être complémentaires : utilisez GitHub Issues pour le travail d’équipe ou public, et AI4Kanban comme espace de travail local de l’agent.",
  },
};

export default fr;
