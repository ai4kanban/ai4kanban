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
    title: "Télécharger AI4Kanban",
    lead: "Le tableau en application de bureau pour macOS, Windows et Linux.",
    cta: "Télécharger",
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
  command: {
    title: "La commande `akb`",
    body: "L'app embarque `akb` — la commande avec laquelle un agent de code pilote le tableau — et propose de la mettre dans votre PATH au premier lancement. macOS écrit un lien dans `/usr/local/bin/akb` et demande votre mot de passe administrateur ; Windows ajoute le dossier de l'app au PATH, ce qui ne vaut que pour les terminaux ouverts ensuite. Rien n'est copié hors de l'app : mettre l'app à jour met la commande à jour.",
    later: "Si vous refusez, le bouton reste dans **Configuration → General**. Linux n'y a pas droit : l'AppImage se décompresse ailleurs à chaque exécution, donc `npm install -g ai4kanban` reste la voie.",
  },
};

export default fr;
