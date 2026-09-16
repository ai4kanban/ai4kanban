// Español — the contact page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { ContactCopy } from "./types";

const es: ContactCopy = {
  meta: {
    title: "Contacto de AI4Kanban: soporte y agentes a medida",
    description:
      "Obtén ayuda con AI4Kanban o encarga flujos de agentes adaptados a tu forma de trabajar. Un formulario, respuesta por correo.",
    socialTitle: "Contacta con AI4Kanban",
  },
  eyebrow: "CONTACTO",
  title: "Habla con nosotros",
  lead: "Obtén ayuda con AI4Kanban o encarga agentes adaptados a tu flujo de trabajo.",
  reason: "¿Qué necesitas?",
  support: {
    name: "Soporte",
    body: "Errores, instalación o dudas. Incluye tu versión y los registros.",
  },
  customize: {
    name: "Agentes a medida",
    body: "Flujos de agentes adaptados a tu forma de trabajar.",
    price: "$15",
    per: " / agente",
    note: "Un flujo de 5 agentes cuesta $75. Presupuesto y pago por correo.",
  },
  email: "Correo electrónico",
  message: "Mensaje",
  workflow: "Describe tu flujo de trabajo",
  workflowHint: "Los pasos, las herramientas que intervienen y qué debe hacer cada agente.",
  submit: "Enviar mensaje",
  submitting: "Enviando…",
  privacy: "Privacidad",
  errors: {
    emailRequired: "Indica tu correo electrónico. Te responderemos ahí.",
    emailInvalid: "Esa dirección de correo no parece válida.",
    emailTooLong: "Usa una dirección de 200 caracteres como máximo.",
    messageRequired: "Escribe un mensaje.",
    messageTooLong: "El mensaje no puede superar los 5000 caracteres.",
    workflowRequired: "Describe el flujo de trabajo que quieres.",
    workflowTooLong: "La descripción no puede superar los 5000 caracteres.",
  },
  limited: {
    title: "Demasiados mensajes desde aquí",
    body: "Lo que escribiste se conserva. Inténtalo más tarde o escribe a {support}.",
  },
  unknown: {
    title: "No pudimos confirmar el envío",
    body: "Lo que escribiste se conserva. Envíalo de nuevo; no llegará dos veces.",
  },
  failed: {
    title: "El mensaje no se envió",
    body: "Lo que escribiste se conserva. Inténtalo de nuevo o escribe a {support}.",
  },
  sent: {
    title: "Mensaje recibido",
    body: "Te responderemos a {email}.",
    another: "Enviar otro mensaje",
  },
  training: {
    title: "Formación",
    body: "Acompañamiento individual sobre tu propio proyecto.",
    cta: "Ver formación",
  },
};

export default es;
