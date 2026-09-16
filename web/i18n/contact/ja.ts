// 日本語 — the contact page, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { ContactCopy } from "./types";

const ja: ContactCopy = {
  meta: {
    title: "AI4Kanban へのお問い合わせ — サポートとエージェントのカスタマイズ",
    description:
      "AI4Kanban のサポート、またはお客様の業務に合わせたエージェントワークフローの構築を承ります。フォームひとつで、返信はメールでお届けします。",
    socialTitle: "AI4Kanban へのお問い合わせ",
  },
  eyebrow: "お問い合わせ",
  title: "お問い合わせ",
  lead: "AI4Kanban のサポート、またはワークフローに合わせたエージェントの構築を承ります。",
  reason: "ご用件をお選びください",
  support: {
    name: "サポート",
    body: "不具合、セットアップ、ご質問など。バージョンとログを添えてください。",
  },
  customize: {
    name: "エージェントのカスタマイズ",
    body: "お客様の業務に合わせたエージェントワークフローを構築します。",
    price: "$15",
    per: " / エージェント",
    note: "5 エージェントのワークフローで $75 です。見積もりとお支払いはメールで確定します。",
  },
  email: "メールアドレス",
  message: "お問い合わせ内容",
  workflow: "ワークフローの説明",
  workflowHint: "手順、使用するツール、各エージェントの役割をご記入ください。",
  submit: "送信する",
  submitting: "送信中…",
  privacy: "プライバシー",
  errors: {
    emailRequired: "メールアドレスを入力してください。返信はこちらに届きます。",
    emailInvalid: "メールアドレスの形式が正しくありません。",
    emailTooLong: "メールアドレスは 200 文字以内で入力してください。",
    messageRequired: "お問い合わせ内容を入力してください。",
    messageTooLong: "お問い合わせ内容は 5000 文字以内で入力してください。",
    workflowRequired: "ご希望のワークフローを入力してください。",
    workflowTooLong: "ワークフローの説明は 5000 文字以内で入力してください。",
  },
  limited: {
    title: "送信回数が上限に達しました",
    body: "入力内容は保持されています。しばらくしてから再度お試しいただくか、{support} へ直接メールしてください。",
  },
  unknown: {
    title: "送信を確認できませんでした",
    body: "入力内容は保持されています。もう一度送信しても、重複して届くことはありません。",
  },
  failed: {
    title: "送信できませんでした",
    body: "入力内容は保持されています。再度お試しいただくか、{support} へ直接メールしてください。",
  },
  sent: {
    title: "お問い合わせを受け付けました",
    body: "{email} 宛てにご返信します。",
    another: "別のお問い合わせを送る",
  },
  training: {
    title: "トレーニング",
    body: "ご自身のプロジェクトに沿ったマンツーマンの指導です。",
    cta: "トレーニングを見る",
  },
};

export default ja;
