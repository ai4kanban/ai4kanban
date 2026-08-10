// Français — the download page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const fr: DownloadCopy = {
  meta: {
    title: "Télécharger AI4Kanban — le tableau en application de bureau",
    description:
      "Obtenez le tableau AI4Kanban en application pour macOS, Windows et Linux. Rien à installer au préalable : ni Node, ni npx, ni terminal.",
    socialTitle: "Télécharger AI4Kanban",
    social:
      "Le tableau en application pour macOS, Windows et Linux. Rien à installer au préalable.",
  },

  hero: {
    title: "Ouvrez le tableau comme une application.",
    lead: "Le même tableau, dans une fenêtre. Rien à installer au préalable : ni Node, ni npx, ni terminal à laisser ouvert. Au premier lancement, il demande quel dossier de projet ouvrir, puis s'en souvient.",
    cta: "Télécharger pour votre système",
    note: "Lancer un agent demande toujours votre agent de code sur la machine : Claude Code ou Codex. L'application lit votre propre environnement shell au démarrage, donc un agent installé normalement est bien trouvé.",
  },

  builds: {
    title: "Quelle version prendre",
    lead: "Une publication, trois systèmes. macOS est celui que nous testons à chaque version ; Windows et Linux sont compilés et publiés sans test tant que personne ne nous signale le contraire.",
    columns: { system: "Système", file: "Fichier", signed: "Signé", tested: "Testé" },
    yes: "Oui",
    no: "Non",
    systems: ["macOS (Apple Silicon, Intel)", "Windows", "Linux"],
  },

  unsigned: {
    title: "Ouvrir les versions non signées",
    lead: "La version Mac est signée : un double-clic suffit. Windows et Linux sortent non signés cette fois-ci, et chacun avertit au premier lancement. Une seule étape pour passer :",
    windows: {
      title: "Windows",
      body: "SmartScreen affiche *Windows a protégé votre ordinateur*. Cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**.",
    },
    linux: {
      title: "Linux",
      body: "Rendez le fichier exécutable, puis lancez-le : `chmod +x AI4Kanban-*.AppImage`, puis `./AI4Kanban-*.AppImage`.",
    },
  },

  using: {
    title: "Une fois ouverte",
    items: [
      {
        title: "Un projet à la fois",
        body: "Au premier lancement, elle demande quel dossier ouvrir, puis s'en souvient. Le chemin dans l'en-tête en ouvre un autre, et un dossier sans tableau convient aussi : elle propose d'en créer un sur place.",
      },
      {
        title: "La mise à jour reste votre choix",
        body: "L'application ne se met jamais à jour toute seule. Quand une version plus récente sort, elle le signale avec un lien vers cette page. Fermer la fenêtre arrête le tableau et tout ce qui tourne sous lui.",
      },
    ],
  },

  deprecated: {
    title: "L'ancienne méthode : le lancer soi-même",
    body: "`npx ai4kanban-ui` sert toujours le tableau dans un navigateur, mais cette voie est dépréciée. Elle continue de fonctionner et le paquet est gelé plutôt que retiré, donc une installation existante démarre encore, mais plus aucune version n'y arrivera. Les pages, elles, ne disparaissent pas : l'application, ce sont ces mêmes pages dans une fenêtre, et atteindre le tableau depuis un autre appareil demande toujours un serveur. Ce qui est déprécié, c'est de vous demander d'en lancer un et d'ouvrir un navigateur.",
  },
};

export default fr;
