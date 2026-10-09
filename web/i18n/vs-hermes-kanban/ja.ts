// 日本語 — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const ja: VsHermesCopy = {
  meta: {
    title: "AI4Kanban vs. Hermes Agent Kanban：エージェントが作る前に重要な部分を確認",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description: "Claude CodeやCodexをすでに使っていて、エージェントが作る前にUI、プロンプト、コピーを確認したいならAI4Kanban。Hermes Agentをすでに使っていて、TelegramやSlackからタスクを管理したいならHermes Kanban。どちらが何に強いかを項目ごとに比べます。",
    social: "Hermes KanbanはHermesのエージェントを働かせ、チャットアプリから指示できます。AI4KanbanはClaude CodeやCodexを働かせ、重要な部分のドラフトを先に見せます。あなたの働き方に合うのはどちらでしょうか？",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "組み込みの専門ワークフローとドラフト承認で、あなたの判断を実装の前に反映。後から直す手間が減ります。",
    sharedLabel: "どちらにもある機能",
    setup: {
      heading: "専門エージェントとワークフローをすぐに使える",
      ours: "組み込みのエージェントとワークフローが、ソフトウェア開発、ブログ、SNSカルーセル、スライド、製品動画をカバーします。独自に作成することもできます。",
      theirs: "ワーカーは、モデルとスキルを設定したHermesのプロファイルです。UIデザイン、コピーライティング、コンテンツ制作の専門ワークフローは組み込まれていません。",
      art: {
        ours: [
          "UIデザイン",
          "プロンプト",
          "コピー",
        ],
        theirs: {
          title: "ワーカーのプロファイル",
          fields: [
            "名前",
            "モデル",
            "スキル",
          ],
          slot: "自分で設定",
        },
      },
      shared: [
        {
          title: "タスク分解と依存関係",
          body: [
            "AI4Kanbanは仕事をカードとサブタスクに分け、依存関係で実行順を決めます。",
            "Hermes Kanbanは1行のタスクを子タスクに分け、親タスクが終わった子タスクから実行します。",
          ],
        },
        {
          title: "git worktreeでの並行実行",
          body: [
            "AI4Kanbanは独立したカードを、それぞれ専用のgit worktreeで同時に実行します。",
            "Hermes Kanbanはタスクごとにgit worktreeを用意し、並行して実行します。",
          ],
        },
      ],
    },
    drafts: {
      heading: "重要なドラフトを実装前に確認",
      ours: "UI、プロンプト、コピーなど、確認したい重要な部分を選べます。エージェントがプレビュー・編集できるドラフトを用意し、承認した内容をもとに実行します。",
      theirs: "タスクはテキストの仕様から始まります。実行前に重要なドラフトをプレビューして承認する仕組みは、ドキュメントに記載されていません。",
      art: {
        ours: [
          "重要なドラフト",
          "方向を承認",
          "タスク実行",
        ],
        theirs: {
          title: "タスクの仕様",
          fields: [
            "目標",
            "進め方",
            "受け入れ基準",
          ],
          slot: "テキストのみ",
        },
      },
      shared: [
        {
          title: "文章による仕様",
          body: [
            "AI4Kanbanのカードには、範囲と構築の手順が書かれます。",
            "Hermes Kanbanはタスクを目標、進め方、受け入れ基準に書き直せます。",
          ],
        },
        {
          title: "タスクへのフィードバック",
          body: [
            "AI4Kanbanはカードのチャットで修正を受け取り、計画を更新します。",
            "Hermes Kanbanはタスクのコメントで、あなたのメモをワーカーに伝えます。",
          ],
        },
      ],
    },
    questions: {
      heading: "先に要件を固めて、あとは任せる",
      verdict: "見守る時間が減っても品質は下がりません。ドラフト、質問、要点のまとめが、結果をぶれさせません。",
      ours: "いきなり作り始めることはありません。まず大事な質問をして、納品が満たすべき条件を固めてから作ります。あなたは要点を承認し、細部はエージェントに任せるので、毎回の実行を見守る必要がなく、1日に納品できる仕事が増えます。",
      theirs: "計画は軽く、実行は速く。分解が終わるとすぐに作業が始まり、基準は途中で調整し、修正はworktreeで行います。これも有効な進め方ですが、実行中にあなたが確認し続ける必要があり、1日に納品できる仕事の量が限られます。",
      art: {
        ours: [
          "確認",
          "要点を承認",
          "実行",
        ],
        theirs: {
          title: "実行中のタスク",
          fields: [
            "開始",
            "基準を調整",
            "worktreeで修正",
          ],
          slot: "実行中も確認が必要",
        },
      },
      shared: [
        {
          title: "働きながら学ぶエージェント",
          body: [
            "AI4Kanbanの専門エージェントは、差し戻しや却下したドラフトを記録します。完了したカードは振り返られ、決定や好みが抽出されます。",
            "Hermesの各プロファイルはメモリのメモを残し、学んだこと（あなたの修正を含む）から独自のスキルを書きます。",
          ],
        },
        {
          title: "タスクの履歴",
          body: [
            "AI4Kanbanはカードに計画、会話、実行記録を残します。",
            "Hermes Kanbanはタスクにコメントのスレッドと実行履歴を残します。",
          ],
        },
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "主な違い",
      title: "項目ごとの比較",
    },
    lead: "{check} は各項目で優れている側を示します。",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      startingPoint: {
        dimension: "組み込みのエージェントとワークフロー",
        kanban: "開発やコンテンツ向けの専門エージェントとワークフローを内蔵。独自に作成することもできます。コンテンツのワークフローはProが必要です。",
        hermes: "汎用のHermesプロファイルを自分で設定します。UIデザイン、コピーライティング、コンテンツ制作の専門ワークフローは組み込まれていません。",
      },
      planning: {
        dimension: "作業を始める前",
        kanban: "計画の段階で決められることは決め、未確定の点はあなたに質問します。あなたが開始するまで構築は始まりません。",
        hermes: "モデルがあなたに質問せずにタスクをタスクグラフに分解します。オフにしない限り、子タスクは自動で始まります。",
      },
      drafts: {
        dimension: "実行前の重要なドラフト確認",
        kanban: "画像、図、HTML/TSX、diff、ストーリーボードのドラフトに対応。承認した内容が実行の要件になります。",
        hermes: "目標、進め方、受け入れ基準を書いたテキストの仕様。実行前のドラフトプレビューはドキュメントに記載されていません。",
      },
      questions: {
        dimension: "あなたへの質問",
        kanban: "計画中にも構築中にも質問し、それぞれに選択肢と推奨の回答が付きます。待つのは依存する作業だけで、回答すればすぐに再開します。",
        hermes: "ワーカーが理由を書いてタスク全体を一時停止します。あなたがコメントしてブロックを解除すると、ワーカーが最初からやり直します。",
      },
      memory: {
        dimension: "エージェントが覚えること",
        kanban: "各専門エージェントが、差し戻しや却下したドラフトを記録します。完了したカードは振り返られ、決定や好みが抽出されます。",
        hermes: "各プロファイルはメモリのメモを残し、学んだこと（あなたの修正を含む）から独自のスキルを書きます。",
      },
      followUps: {
        dimension: "納品後の仕事",
        kanban: "エージェントが納品した内容を振り返り、理由を添えて次の仕事を提案します。QAエージェントが最近の変更を毎日テストします。提案は仕分け待ちの列に入り、あなたが判断します。",
        hermes: "ワーカーは進行中の仕事を分けるために子タスクを作ります。納品後のフォローアップは、あなたが新しく作るタスクです。",
      },
      landing: {
        dimension: "並行作業のマージ",
        kanban: "完了したビルドを順番にリベースしてマージします。コンフリクトはエージェントが解決します。",
        hermes: "タスク後もworktreeは残ります。マージの方法はドキュメントになく、コンフリクトは別の調整タスクで扱います。",
      },
      recurring: {
        dimension: "定期的な仕事",
        kanban: "スケジュール設定したエージェントが、あなたの決めた間隔で実行されます。",
        hermes: "1回限りの予約実行に対応。定期的な仕事には自分でcronを設定する必要があります。",
      },
      harness: {
        dimension: "Claude CodeやCodexでの実行",
        kanban: "Claude Code、Codex、Cursor、OpenCodeなどのコーディングエージェントが、あなた自身のサブスクリプションで直接実行します。エージェントごとに選べます。",
        hermes: "ワーカーはHermesのエージェントです。付属のスキルを使うと、ターミナルからClaude CodeやCodexを呼び出せます。",
      },
      interface: {
        dimension: "ボードと操作画面",
        kanban: "カード、ドラフト、会話、実行状況をまとめて見られるデスクトップアプリ。",
        hermes: "CLI、Webダッシュボード、デスクトップアプリ用プラグイン。",
      },
      review: {
        dimension: "成果の確認",
        kanban: "Claude CodeやCodexが構築しながらテストを実行し、要件を確認します。過剰なテストを避けるため、AI4Kanbanは2回目のレビューを追加しません。",
        hermes: "レビュー担当のプロファイルが受け入れ基準を1つずつ確認してテストを実行し、合格するまで差し戻します。",
      },
      chat: {
        dimension: "チャットアプリからの操作",
        kanban: "通知、Slack、LarkにはCloudが必要で、現在は招待制のプレビューです。",
        hermes: "Telegram、Discord、Slack、WhatsApp、Signalなどから/kanbanでボードを管理でき、タスクの通知も受け取れます。",
      },
      recovery: {
        dimension: "失敗した実行からの復旧",
        kanban: "プロバイダーのエラーは自動で再試行します。停止した実行は、あなたが再開するまで待ちます。",
        hermes: "ハートビートで止まったタスクを回収し、失敗を繰り返すタスクは保留にします。",
      },
      api: {
        dimension: "APIと拡張",
        kanban: "コーディングエージェントが呼び出すCLI。公開APIはありません。",
        hermes: "RESTとWebSocketのAPIに加え、タスクイベント用のプラグインフック。",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "選び方",
      title: "どちらを選ぶべきか？",
    },
    oursHeading: "AI4Kanbanが向く場合",
    theirsHeading: "Hermes Kanbanが向く場合",
    ours: [
      "組み込みの専門エージェントとワークフローを使いたい、または独自に作りたい。",
      "本格的に実行する前に、UI、プロンプト、コピーなどの重要なドラフトを承認したい。",
      "納品のたびに、エージェントから次の仕事を提案してほしい。",
    ],
    theirs: [
      "すでにHermes Agentを使っていて、その中でボードを使いたい。",
      "Telegram、Slack、Discordなどのチャットアプリからタスクを管理したい。",
      "止まったタスクの自動復旧と、開発に使えるAPIがほしい。",
    ],
    verdict: "**専門ワークフロー、構築前のドラフト承認、次の仕事の提案**ならAI4Kanban。**チャットアプリからの操作、自動復旧、API**ならHermes Kanban。",
    note: "Hermes Agent v0.21.6のドキュメントをもとに比較（2026年10月時点）。",
  },
};

export default ja;
