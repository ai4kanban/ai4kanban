// 日本語 — the Vibe Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsVibeCopy } from "./types";

const ja: VsVibeCopy = {
  meta: {
    title: "AI4Kanban vs. Vibe Kanban — 計画ワークフローとマルチエージェント環境の比較",
    socialTitle: "AI4Kanban vs. Vibe Kanban",
    description:
      "Bloop は 2026 年 4 月に事業を終了しましたが、Vibe Kanban はコミュニティ主導のオープンソースプロジェクトとして継続しています。マルチエージェント環境と、AI4Kanban のファイルベースの計画ワークフローを比較します。",
    social:
      "AI4Kanban と Vibe Kanban が解決する課題は異なります。リポジトリ内で作業を計画するか、複数のコーディングエージェントを実行・レビューするかの違いです。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nVibe Kanban",
    lead: "Vibe Kanban は複数のコーディングエージェントを並列で実行し、その成果をまとめてレビューするためのツールです。AI4Kanban は、1 つのエージェントとアイデアを具体的なタスクに整え、Markdown としてリポジトリに保存します。どちらにもボードはありますが、対象とする開発工程が異なります。",
    ours: {
      name: "AI4Kanban",
      body: "エージェントと作業を計画・具体化する、ファイルベースのワークフロー。",
    },
    theirs: {
      name: "Vibe Kanban",
      body: "複数のエージェントを実行し、成果をレビューするローカルアプリ。",
    },
    oursDiagramAlt:
      "一枚のカードが三つの列を進むごとに具体的になり、完了の条件が書かれた時点で、どのコーディングエージェントでも着手できます。",
    theirsDiagramAlt:
      "定義済みのタスクを複数のエージェントに同時に渡し、同じ作業の複数の版が戻ってきて見比べられます。",
    oursDiagramTop: "動かす前に、やることを具体化する",
    oursDiagramBottom: "あとはどのコーディングエージェントでも動かせる",
    theirsDiagramTop: "一つのタスクを複数のエージェントで同時に実行",
    theirsDiagramBottom: "結果を見比べて、いちばん良いものを残す",
  },
  summary: {
    heading: {
      eyebrow: "手短に言うと",
      title: "Bloop の終了後も、Vibe Kanban は継続",
    },
    lead: "Vibe Kanban の運営会社 Bloop は 2026 年 4 月に事業を終了しました。有料契約は終了し、リモートサービスも廃止され、製品は完全ローカルの構成へ移行しました。Vibe Kanban 自体は Apache-2.0 で公開され、現在はコミュニティによって保守されています。",
    panel:
      "**タスクを計画するボード**が必要で、データベースや常駐アプリを増やしたくないなら、AI4Kanban が適しています。**複数のエージェントを並列実行**し、1 つの画面で成果をレビューしたいなら、Vibe Kanban が適しています。AI4Kanban は Vibe Kanban のオーケストレーション機能を置き換えるものではありません。",
  },
  comparison: {
    heading: { eyebrow: "真っ向比較", title: "AI4Kanban vs. Vibe Kanban" },
    lead: "{check} は特定の要件で優位な選択肢を示します。**ダッシュ**は優劣ではなく、設計方針の違いです。AI4Kanban は**計画と可搬性**を、Vibe Kanban は**並列実行と統合レビュー**を重視しています。",
    ourLabel: "AI4Kanban",
    theirLabel: "Vibe Kanban",
    rows: {
      whatFor: {
        dimension: "主な用途",
        kanban:
          "エージェントとともに、リポジトリ内でタスクを定義・具体化・整理する。",
        vibe: "複数のコーディングエージェントを並列実行し、その成果をレビューする。",
      },
      orchestration: {
        dimension: "マルチエージェントの実行管理",
        kanban: "各デリバリーは専用のブランチと git worktree で進むため、複数を並行して動かしても作業中のコードに触れません。",
        vibe: "中核機能。各エージェントを独立した git worktree で実行します。",
      },
      review: {
        dimension: "エージェント出力のレビュー",
        kanban: "エージェント、開発環境、またはコードレビューツールで行います。",
        vibe: "インライン diff、ライブプレビュー、pull request ワークフローを内蔵しています。",
      },
      planning: {
        dimension: "計画と詳細化",
        kanban:
          "ガイド付きの詳細化プロセスで、初期アイデアを実行可能なタスクに整えます。",
        vibe: "要件の具体化よりも、実行のキューイングと進捗管理に重点を置いています。",
      },
      onDisk: {
        dimension: "データの保存先",
        kanban: "リポジトリ内の Markdown として、コードと一緒にバージョン管理します。",
        vibe: "設定ディレクトリに置かれたローカルの SQLite データベース。",
      },
      runsAs: {
        dimension: "動作形態",
        kanban: "ボードはファイルだけで構成され、サービスやアプリは不要です。",
        vibe: "Rust バックエンドと Web UI で構成されるローカルアプリです。",
      },
      setup: {
        dimension: "導入",
        kanban: "1 つのプロンプトでスキルファイルと小さな補助スクリプトを導入します。",
        vibe: "`npx vibe-kanban` を実行し、使用する各エージェント CLI を導入・認証します。",
      },
      whichAgents: {
        dimension: "エージェントの互換性",
        kanban:
          "リポジトリ内のファイルを読み書きできるエージェントなら利用できます。",
        vibe: "Claude Code、Codex、Gemini など、統合済みの CLI に対応しています。",
      },
      lockIn: {
        dimension: "可搬性",
        kanban: "Markdown のボードはリポジトリと一緒に移動し、エクスポートも不要です。",
        vibe: "Apache-2.0 でセルフホストでき、データエクスポートにも対応しています。",
      },
      maintenance: {
        dimension: "保守体制",
        kanban: "現役で保守されています。",
        vibe: "Bloop が 2026 年 4 月に事業を終了して以降、コミュニティが保守しています。",
      },
    },
  },
  purpose: {
    heading: {
      eyebrow: "本当の違い",
      title: "作業を計画するか、エージェントを実行するか",
    },
    lead: "2 つの製品は、ワークフローの異なる段階を支援します。AI4Kanban は**何を作るか**を決め、タスクを準備するためのものです。Vibe Kanban は**複数のエージェントで実行**し、成果をレビューするためのものです。",
    ours: {
      name: "AI4Kanban — 計画と具体化",
      is: "エージェントがリポジトリ内の Markdown ボードを直接更新します。詳細化プロセスによって初期アイデアを具体的でレビュー可能なタスクに整え、実装前に承認できます。",
      isnt: "diff の表示やプルリクエストの作成は行いません。これらはエージェントや開発環境の役割です。",
    },
    theirs: {
      name: "Vibe Kanban — 実行とレビュー",
      is: "複数のコーディングエージェントを別々の git worktree で同時に実行するローカルアプリです。タスク実行、diff レビュー、ライブプレビューを 1 つのワークスペースに集約します。",
      isnt: "不完全なアイデアを詳細な実装計画へ発展させることよりも、エージェント実行の管理に重点を置いています。",
    },
    note: "Vibe Kanban を主にタスク整理に使っていたなら、AI4Kanban はよりシンプルでリポジトリに馴染む選択肢です。並列実行と統合レビューを重視するなら、Vibe Kanban のほうが適しています。",
  },
  wins: {
    heading: { eyebrow: "トレードオフ", title: "それぞれが勝つところ" },
    lead: "どちらか一方が常に優れているわけではありません。AI4Kanban は軽量で可搬性の高い計画ワークフローを、Vibe Kanban は複数エージェントの協調実行とレビューを優先しています。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Vibe Kanban",
    ours: {
      nothingRunning: {
        title: "常駐サービスが不要",
        body: "ボードはリポジトリ内の Markdown です。Web アプリ、データベース、バックグラウンドサービスは必要ありません。",
      },
      planning: {
        title: "体系的なタスクの具体化",
        body: "詳細化プロセスが不足情報を洗い出し、粗いアイデアを具体的なタスクに整えて、実装前の確認を可能にします。",
      },
      outlives: {
        title: "可搬性を前提とした設計",
        body: "計画は対象コードと一緒に git へ保存されます。リポジトリを clone すればボードも移動し、移行やエクスポートは不要です。",
      },
      anyAgent: {
        title: "ファイルを扱えるエージェントに対応",
        body: "リポジトリのファイルを扱えるエージェントなら、Claude Code、Codex、Cursor、今後登場するツールでも利用できます。",
      },
    },
    theirs: {
      parallel: {
        title: "多数のエージェントを同時に回す",
        body: "複数のコーディングエージェントにタスクを振り分け、各実行を独立した git ブランチと worktree に隔離します。",
      },
      reviewInPlace: {
        title: "実行とレビューが同じ場所に",
        body: "インライン diff、アプリのライブプレビュー、pull request ワークフローにより、ワークスペースを離れずに成果を確認できます。",
      },
      boardUi: {
        title: "専用のビジュアルインターフェース",
        body: "タスクの開始、進捗の確認、実行中のワークスペース切り替えに特化した Web インターフェースです。",
      },
      support: {
        title: "幅広いエージェント連携",
        body: "Claude Code、Codex、Gemini など、複数のエージェント CLI を標準で利用できます。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "選び方", title: "どちらを使うべき？" },
    oursHeading: "AI4Kanban が適している場合",
    theirsHeading: "こんなときは Vibe Kanban",
    ours: [
      "エージェントとリポジトリ内でタスクを計画・具体化したい。",
      "独立したアプリやデータベースよりも、git 上の Markdown を使いたい。",
      "ファイルを扱える任意のコーディングエージェントでボードを使いたい。",
      "並列実行よりも、明確で十分に整理された要件を重視している。",
    ],
    theirs: [
      "複数のコーディングエージェントを隔離された worktree で並列実行したい。",
      "インライン diff とライブプレビューを 1 つの画面で使いたい。",
      "エージェント実行の調整とレビューが主なボトルネックになっている。",
      "コミュニティが保守するオープンソースプロジェクトを利用できる。",
    ],
    verdict:
      "独立した実行環境を必要としない**リポジトリネイティブな計画ワークフロー**なら AI4Kanban、**マルチエージェントの実行と統合レビュー**なら Vibe Kanban が適しています。選択を決めるのは、作業の計画と実行の調整のどちらが大きな制約になっているかです。",
    note: "Bloop の事業終了によって Vibe Kanban の保守体制は変わりましたが、2 つの製品の根本的な違いは変わりません。",
  },
};

export default ja;
