// Français — the contact page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { ContactCopy } from "./types";

const fr: ContactCopy = {
  meta: {
    title: "Contacter AI4Kanban — support et agents sur mesure",
    description:
      "Obtenez de l’aide sur AI4Kanban, ou faites concevoir des workflows d’agents adaptés à votre façon de travailler. Un seul formulaire, réponse par e-mail.",
    socialTitle: "Contacter AI4Kanban",
  },
  eyebrow: "CONTACT",
  title: "Parlons-en",
  lead: "Obtenez de l’aide sur AI4Kanban, ou faites concevoir des agents autour de votre workflow.",
  reason: "De quoi avez-vous besoin ?",
  support: {
    name: "Support",
    body: "Bugs, installation ou questions. Joignez votre version et vos journaux.",
  },
  customize: {
    name: "Agents sur mesure",
    body: "Des workflows d’agents adaptés à votre façon de travailler.",
    price: "$15",
    per: " / agent",
    note: "Un workflow de 5 agents revient à $75. Devis et paiement par e-mail.",
  },
  email: "E-mail",
  message: "Message",
  workflow: "Décrivez votre workflow",
  workflowHint: "Les étapes, les outils utilisés et le rôle de chaque agent.",
  submit: "Envoyer le message",
  submitting: "Envoi…",
  privacy: "Confidentialité",
  errors: {
    emailRequired: "Indiquez votre adresse e-mail. Notre réponse y sera envoyée.",
    emailInvalid: "Cette adresse e-mail ne semble pas valide.",
    emailTooLong: "Utilisez une adresse de 200 caractères au plus.",
    messageRequired: "Rédigez un message.",
    messageTooLong: "Le message ne doit pas dépasser 5 000 caractères.",
    workflowRequired: "Décrivez le workflow souhaité.",
    workflowTooLong: "La description ne doit pas dépasser 5 000 caractères.",
  },
  limited: {
    title: "Trop de messages envoyés d’ici",
    body: "Votre texte est conservé. Réessayez plus tard, ou écrivez à {support}.",
  },
  unknown: {
    title: "Impossible de confirmer l’envoi",
    body: "Votre texte est conservé. Renvoyez-le : il n’arrivera pas en double.",
  },
  failed: {
    title: "Votre message n’a pas été envoyé",
    body: "Votre texte est conservé. Réessayez, ou écrivez à {support}.",
  },
  sent: {
    title: "Message reçu",
    body: "Nous vous répondrons à {email}.",
    another: "Envoyer un autre message",
  },
  training: {
    title: "Formation",
    body: "Un accompagnement individuel sur votre propre projet.",
    cta: "Voir la formation",
  },
};

export default fr;
