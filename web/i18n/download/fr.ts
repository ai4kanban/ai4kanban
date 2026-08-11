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
    title: "Télécharger AI4Kanban",
    lead: "Le tableau en application pour macOS, Windows et Linux. Rien à installer au préalable : ni Node, ni npx, ni terminal.",
    cta: "Télécharger pour {system}",
    ctaAny: "Télécharger",
    note: "Lancer un agent demande toujours Claude Code ou Codex sur la machine.",
  },

  builds: {
    title: "Tous les téléchargements",
    note: "Rien n'est signé pour l'instant et seul macOS est testé à chaque version : chaque système avertit au premier lancement.",
  },

  firstOpen: {
    title: "Au premier lancement",
    mac: {
      title: "macOS",
      steps: [
        "Ouvrez le `.dmg` et faites glisser **AI4Kanban** dans Applications.",
        "Double-cliquez dessus. macOS indique qu'il ne peut pas vérifier l'app : cliquez sur **Terminé**. Elle ne s'ouvre pas encore, c'est normal.",
        "Dans **Réglages Système → Confidentialité et sécurité**, descendez jusqu'à **Sécurité** et cliquez sur **Ouvrir quand même**.",
        "Déverrouillez, puis cliquez encore une fois sur **Ouvrir quand même**. Tous les lancements suivants s'ouvrent directement.",
      ],
    },
    windows: {
      title: "Windows",
      body: "Dans SmartScreen : **Informations complémentaires**, puis **Exécuter quand même**.",
    },
    linux: {
      title: "Linux",
      body: "`chmod +x AI4Kanban-*.AppImage`, puis lancez-le.",
    },
  },
};

export default fr;
