// Français — the download page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { DownloadCopy } from "./types";

const fr: DownloadCopy = {
  meta: {
    title: "Télécharger AI4Kanban — le tableau en application de bureau",
    description:
      "Obtenez AI4Kanban en application de bureau pour macOS, Windows et Linux.",
    socialTitle: "Télécharger AI4Kanban",
    social: "Le tableau en application de bureau pour macOS, Windows et Linux.",
  },

  hero: {
    title: "L’app de bureau AI4Kanban",
    lead: "Pour macOS, Windows et Linux.",
    cta: "Télécharger",
    ctaFor: "Télécharger pour {system}",
  },

  builds: {
    title: "Tous les téléchargements",
  },

  firstOpen: {
    title: "Au premier lancement",
    platformLabel: "Choisissez votre plateforme",
    mac: {
      steps: [
        "Ouvrez le `.dmg` et faites glisser **AI4Kanban** dans Applications.",
        "Double-cliquez dessus. macOS indique qu'il ne peut pas vérifier l'app : cliquez sur **Terminé**. Elle ne s'ouvre pas encore, c'est normal.",
        "Dans **Réglages Système → Confidentialité et sécurité**, descendez jusqu'à **Sécurité** et cliquez sur **Ouvrir quand même**.",
        "Déverrouillez, puis cliquez encore une fois sur **Ouvrir quand même**. Tous les lancements suivants s'ouvrent directement.",
      ],
    },
    windows: {
      body: "Dans SmartScreen : **Informations complémentaires**, puis **Exécuter quand même**.",
    },
    linux: {
      body: "`chmod +x AI4Kanban-*.AppImage`, puis lancez-le.",
    },
  },
  command: {
    title: "Utiliser `akb` dans un terminal",
    mac: "Lancez l’app une fois et `akb` marche dans votre terminal.",
    windows: "Ouvrez un nouveau terminal et `akb` marche.",
    linux: "Seul Linux demande une étape : `npm install -g ai4kanban`.",
  },
};

export default fr;
