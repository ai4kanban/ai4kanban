// 日本語 — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const ja: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — リポジトリ中心の計画か、統合型エージェントランタイムか",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "AI4Kanban のリポジトリ中心の Markdown ボードと、Nous Research の Hermes Agent Kanban を比較します。前者は計画の可搬性とレビュー性を保ち、後者は共有 SQLite キュー、ディスパッチャ、マルチエージェントランタイムを提供します。",
    social:
      "2 つのエージェント向けカンバン、2 つの設計思想。任意のコーディングエージェントで使える Markdown ボードか、Hermes ランタイムに統合された永続共有キューか。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "どちらもエージェントにカンバンを提供しますが、設計上の境界が異なります。AI4Kanban はボードをリポジトリ内の可搬な*プロジェクト層*として保ち、Hermes Agent Kanban は Hermes ランタイムの一部として扱います。",
    ours: {
      name: "AI4Kanban",
      body: "コードと一緒に置く Markdown ボード。作業を担うエージェントを替えても、ボードを移行する必要はありません。",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "ボード、ディスパッチャ、名前付きエージェントが、ひとつの永続的な Hermes システムとして動きます。",
    },
    oursDiagramAlt:
      "カンバンは一番下にある Markdown のボード。エージェントランタイム、実行、保守はその上に積まれた差し替え可能な層。",
    theirsDiagramAlt:
      "SQLite のボード、ディスパッチャ、名前付きエージェントが内側に溶け込んだ、ひとつの Hermes ランタイム。",
    taskLayer: "タスク層 · 実行 + 保守",
    boardLayer: "カンバン · Markdown ファイル（git）",
  },
  summary: {
    heading: {
      eyebrow: "手短に言うと",
      title: "実務上の違い",
    },
    lead: "解決する課題は似ていますが、担当する層が異なります。AI4Kanban は**今のエージェント環境で使える可搬な計画システム**。Hermes Kanban は **Hermes 内の運用キュー**で、複数ワーカーの協調と中断後の復旧に重点を置きます。",
    oursHeading: "AI4Kanban — 計画はプロジェクトに属する",
    theirsHeading: "Hermes Kanban — 実行はランタイムに属する",
    ours: [
      "リポジトリのなかのただの Markdown。タスクや計画の変更はすべてレビュー可能な diff。",
      "自前のインフラなし。入れるものも、動かし続けるものもありません。",
      "実行は、あなたがすでに使っている環境が担います。Claude Code、Codex、Cursor、そして Hermes でも。",
    ],
    theirs: [
      "~/.hermes/kanban.db にある堅牢な SQLite キュー。多数の名前付きエージェントと人が共有します。",
      "ディスパッチャが着手可能なタスクをエージェントに渡し、落ちた実行を復旧します。",
      "Hermes / Nous のスタックとその kanban_* ツールに紐づいています。",
    ],
    whenLabel: "選び方",
    when: "計画を**コードと一緒にバージョン管理したい**、現在のエージェント環境を使い続けたい、専用のオーケストレーションサービスまでは必要ない、という場合は AI4Kanban が適しています。**Hermes がすでに主要な実行環境**で、ディスパッチャ、名前付きプロファイル、チャット操作、復旧機能を活用したいなら Hermes Kanban が適しています。永続化の方法も異なり、AI4Kanban はファイルと git、Hermes は SQLite にキュー状態を保存します。",
  },
  harness: {
    heading: {
      eyebrow: "実行環境の対応",
      title: "どのエージェントがボードを動かせる？",
    },
    lead: "最も明確な違いです。AI4Kanban は通常のリポジトリファイルを使うため、Hermes を含め、**プロジェクトを読み書きできるエージェントならどれでも利用できます**。Hermes Kanban はランタイムの `kanban_*` ツール経由で提供されるため、Hermes 専用です。",
    oursSub: "ファイルを読めるエージェントなら何でも",
    theirsSub: "Hermes のみ",
    supported: "対応",
    notSupported: "非対応",
    note: "AI4Kanban は Windsurf、OpenCode、Gemini CLI など、プロジェクトファイルを読めるツールでも利用できます。Hermes Kanban は Hermes ランタイムからのみ利用できます。",
  },
  comparison: {
    heading: { eyebrow: "真っ向比較", title: "AI4Kanban vs. Hermes Kanban" },
    lead: "{check} は明確な優位性、**ダッシュ**はトレードオフを示します。AI4Kanban は可搬性と運用の簡潔さ、Hermes は複数エージェントによる協調実行と復旧性を重視しています。",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      whatItIs: {
        dimension: "何であるか",
        kanban:
          "ファイルベースのカンバン層。ボードはリポジトリのなかのただの Markdown。",
        hermes:
          "Hermes エージェントランタイムのカンバン機能。堅牢な SQLite のボード。",
      },
      infrastructure: {
        dimension: "インフラ",
        kanban:
          "自前のものはなし。ボードはリポジトリのなかの Markdown ファイルだけ。",
        hermes:
          "常駐するゲートウェイ、SQLite データベース、そしてディスパッチャのループ。",
      },
      whereBoardLives: {
        dimension: "ボードの置き場所",
        kanban:
          "あなたのリポジトリの中、バージョン管理下。タスクや計画の変更はすべてレビュー可能な diff。",
        hermes:
          "~/.hermes/kanban.db の SQLite DB の中。変更は diff ではなくイベントログへ。",
      },
      setup: {
        dimension: "導入",
        kanban: "プロンプト 1 つ：スキルファイル 1 枚と小さなスクリプト。",
        hermes:
          "Hermes ランタイムを入れ、プロファイルを設定し、ゲートウェイを起動する。",
      },
      parallelRuns: {
        dimension: "並列実行とスケジュール実行",
        kanban:
          "実行環境が回します。あなたが動かせば Claude Code が並列でサブエージェントを立ち上げます。定期的な仕事は recurring/ フォルダに置きます。",
        hermes:
          "ランタイムが回します。ディスパッチャが着手可能なタスクを自分で拾い、タスクごとにワーカープロセスを立ち上げます。",
      },
      crashRecovery: {
        dimension: "クラッシュからの復旧",
        kanban:
          "タスク単位のキューはありません。途中で落ちた実行は、次のスケジュールで走り直すだけです。",
        hermes:
          "堅牢なキューが進行中の作業を自動で拾い直します。取得 TTL、ハートビート、期限切れ取得の回収、リトライ。",
      },
      decomposition: {
        dimension: "タスクの分解",
        kanban:
          "カードは TODO とタスクグラフに分かれます。グループ、ブロック関係、関連。依存は書きながら整理されます。",
        hermes:
          "ディスパッチャが LLM の分解器を自動で走らせ、タスクを子タスクのグラフに展開して専門エージェントに割り振ります。",
      },
      reviewMemory: {
        dimension: "レビューと記憶",
        kanban:
          "記憶は「なぜ却下したか」と「何をリリースしたか」に刈り込まれ、エージェントが前へ提案できるようにします。完全なログではなく、選び抜かれたものです。",
        hermes:
          "追記専用の完全なイベントログと、試行ごとの実行履歴を監査用に保持します。",
      },
      dashboard: {
        dimension: "ダッシュボード GUI",
        kanban:
          "ローカルの Web ボード。カードの操作（実装、レビュー、アーカイブ）が作業をエージェントに引き渡します。",
        hermes:
          "ドラッグ&ドロップとサイドドロワーを備えたライブ Web ボード。加えてチャットアプリからの操作も。",
      },
      scale: {
        dimension: "規模と到達範囲",
        kanban: "ひとつのリポジトリで作業する個人や小規模チームに適しています。",
        hermes:
          "多数のボードにまたがる多数のエージェントまでスケール。マルチテナントで、Discord / Slack / メール / SMS から操作できます。",
      },
    },
  },
  memory: {
    heading: { eyebrow: "記憶 vs. 監査", title: "目的の異なる 2 種類の履歴" },
    lead: "AI4Kanban は過去の判断を次の提案に反映するための**計画コンテキスト**を残します。Hermes は実行内容を調査し再現するための**実行記録**を残します。どちらも有用ですが、目的は異なります。",
    ours: {
      heading: "AI4Kanban",
      verdict: "すべての出来事ではなく、判断を残す。",
      body: "小さなファイルが 4 つ、**意図的に刈り込まれています**。`archive.md`（何をリリースしたか）、`rejected.md`（何を、なぜ却下したか）、`redesign.md`（繰り返してはいけない設計ミス）、`memory.md`（過去のスキャンで分かったこと）。エージェントは提案やカード執筆の前にすべて読みます。完全な履歴は git の仕事です。",
      q: "案 X がボードに無いのはなぜ？",
      a: "`rejected.md` の 1 行。その案と、却下した理由です。死んだ案は死んだままです。",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "実行の全履歴を残す。",
      body: "状態遷移はすべて**追記専用のログ**に落ち、試行ごとに終了コードとワーカーの全出力が残ります。監査とクラッシュ復旧のために作られていて、次の案を導くためではありません。",
      q: "タスク 42 は昨夜どうなった？",
      a: "`claimed → crashed → reclaimed → completed`、試行ごとのログ付きで読めます。",
    },
    note: "整理された記憶は次の判断に役立ち、監査ログは前回の実行を説明します。両者は代替関係にありません。",
  },
  autonomy: {
    heading: {
      eyebrow: "自律のレベル",
      title: "エージェントにどこまで任せる？",
    },
    lead: "Hermes Kanban は**「一行だけ渡して、あとは任せる」**無人実行を前提とします。AI4Kanban は**レビューを組み込んだ自律性**を採用します。未完成のアイデアを記録し、`refine` で具体的な要件へ育て、実装前に人が承認します。",
    stops: {
      traditional: {
        level: "自律なし",
        term: "人が回す",
        heading: "従来のカンバン",
        detail:
          "タスクは全部あなたが思いつき、あなたが分解します。Trello や Jira はそれを記録するだけ。",
      },
      kanban: {
        level: "レビュー付き自律",
        term: "エージェントが提案し、人が承認",
        heading: "AI4Kanban",
        detail:
          "`refine` が不足を特定して要件を具体化し、実装前のレビューに提示します。",
      },
      hermes: {
        level: "完全自律",
        term: "無人実行",
        heading: "Hermes Kanban",
        detail:
          "短い依頼をタスクツリーに分解し、監督なしで実行します。Claude Code の `/goal` も近いモデルです。",
      },
    },
    scaleLeft: "計画は全部あなた",
    scaleMiddle: "エージェントが計画、あなたが承認",
    scaleRight: "計画は全部エージェント",
    worstCaseLabel: "自律レベルごとのリスク",
    worstCaseTheirs:
      "**無人実行：**初期の誤解が、人のレビュー前にタスクツリー全体へ広がる可能性があります。",
    worstCaseOurs:
      "**レビュー付き自律：**問題のある Markdown 計画はレビューに届きますが、実装はまだ始まっていません。",
    note: "1 回の refine で不足を補い、隣接するアイデアを別カードに分け、完了済みの作業を認識し、判断が必要な点を質問に変えます。すべて解決するとカードは **ready** になり、最終レビューと実装へ進みます。",
  },
  gui: {
    heading: { eyebrow: "2 つのダッシュボード", title: "2 つのボード、2 つの役割" },
    lead: "どちらも Web インターフェースを備えます。AI4Kanban は、カード操作からエージェント実行を始める**プロジェクト作業の操作面**。Hermes は、エージェント群の現在地を示す**ディスパッチャの運用ビュー**です。",
    ours: {
      heading: "AI4Kanban — ローカルボード",
      body: "Markdown ファイルの上に載るローカルの Web ボード。カードの操作（*実装、レビュー、アーカイブ*）が作業をエージェントに引き渡し、途中で人に確認しながら流れてくるログを眺められます。",
      alt: "AI4Kanban のローカル Web ボード。Blockers、UI、Skill、Docs、Distribution の各列と「Create task」ボタンのある明るい配色のボード。",
    },
    theirs: {
      heading: "Hermes Kanban — ディスパッチャのライブビュー",
      body: "イベントログを追いかけるライブなボード。列をまたぐドラッグ&ドロップ、実行履歴と終了ステータスのバッジが並ぶサイドドロワー、そして同じボードを Discord、Slack、SMS からも操作できます。",
      alt: "Hermes Agent のカンバンダッシュボード。Triage、Todo、Scheduled、Ready の各列とオーケストレーション用ツールバーのある暗い配色のボード。",
    },
  },
  wins: {
    heading: { eyebrow: "トレードオフ", title: "それぞれが勝つところ" },
    lead: "適した選択は運用モデルによって変わります。AI4Kanban はインフラを最小限にし、計画の可搬性を保ちます。Hermes Kanban は、協調的な無人実行のための永続共有キューを提供します。並列作業、オーケストレーション、ダッシュボードは両方にあるため、以下では本質的な差だけを取り上げます。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "ボード用サービスの運用が不要",
        body: "データベースもゲートウェイもデーモンもなし。すでに動かしているエージェントの他は、ボードはただの Markdown ファイルです。追加で入れるものも、生かし続けるものもなく、飛行機の中でも動きます。",
      },
      diffable: {
        title: "コードと一緒に移動する計画",
        body: "ボードはリポジトリに住み、リポジトリと一緒に移動します。使っているバージョン管理がそのまま効きます。タスクや計画の変更はすべてレビュー可能な diff。プロジェクトの外に SQLite はなく、問い合わせるイベントログもなく、特定のエージェントスタックに縛られることもありません。",
      },
      selfPruning: {
        title: "将来の判断に役立つ記憶",
        body: "なぜその案を却下したか、何をリリースしたかを記録するので、エージェントは死んだ作業を蒸し返さず前へ提案します。残すのは次のタスクを導くものだけで、完全な監査ログではありません。",
      },
      onePrompt: {
        title: "今のエージェント環境にそのまま導入",
        body: "スキルファイル 1 枚と小さなスクリプト。設定するプロファイルも、調整するディスパッチャもありません。ファイルを読めるエージェントがすでに立っている場所で出迎えます。Hermes も含めて。",
      },
    },
    theirs: {
      manyAgents: {
        title: "名前付きエージェントが共有するキュー",
        body: "複数の名前付きエージェント、そして人がタスクを取り、作業を引き継ぐ、ひとつの堅牢なボード。ディスパッチャが着手可能なタスクを監視し、それぞれに割り当てられたエージェントを立ち上げます。AI4Kanban のボードは、あなたがいまいる 1 つの実行環境が回します。",
      },
      selfHealing: {
        title: "進行中の作業を自動復旧",
        body: "キューはクラッシュをまたいで各タスクを追います。取得 TTL、ハートビート、期限切れ取得の回収、リトライ、サーキットブレーカー。ワーカーが途中で落ちてもボードが取り戻して再試行します。AI4Kanban のファイルも消えはしませんが、落ちた実行は次のスケジュールを待つだけです。",
      },
      autoDecompose: {
        title: "自動分解とルーティング",
        body: "粗いタスクを放り込めば、ディスパッチャの LLM 分解器が子タスクのグラフに展開し、それぞれを専門エージェントに割り振ります。手作業の分解は不要です。AI4Kanban のほうは、カードを TODO と手入れするタスクグラフに分けます。",
      },
      fleetReach: {
        title: "大規模なマルチエージェント運用",
        body: "多数のボードにまたがる多数のエージェントのために作られ、マルチテナントで、Discord、Telegram、Slack、メール、SMS から操作できます。AI4Kanban のほうは、あなたのリポジトリとターミナルに留まる簡素なひとり用ボードです。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "選び方", title: "どちらを使うべき？" },
    oursHeading: "AI4Kanban が適する場合",
    theirsHeading: "Hermes Kanban が適する場合",
    ours: [
      "タスクと計画をコードと一緒にバージョン管理し、レビューしたい。",
      "運用サービスが不要で、可搬かつオフラインでも使えるボードが欲しい。",
      "Claude Code、Codex、Cursor、Hermes など、エージェント環境を自由に選びたい。",
      "個人または小規模チームで、計画に特化した層を重視している。",
    ],
    theirs: [
      "Hermes が主要なエージェントランタイムで、プロファイル、ゲートウェイ、チャット操作が整っている。",
      "複数の名前付きエージェントと人が共有する永続キューが必要。",
      "中断した作業を自動復旧したい。",
      "ディスパッチャにタスクの分解と専門エージェントへの割り当てを任せたい。",
      "複数のボードと通信チャネルにまたがって多数のエージェントを運用している。",
    ],
    verdict:
      "**リポジトリに置かれ、エージェントランタイムから独立した計画層**が必要なら AI4Kanban を選びます。**ディスパッチ、復旧、マルチエージェント連携を統合した永続共有キュー**が必要なら Hermes Agent Kanban を選びます。機能の多寡ではなく、計画をプロジェクトとランタイムのどちらに属させるかが判断基準です。",
    note: "両者は併用もできます。AI4Kanban で git 上の作業を具体化してレビューし、承認済みの共有作業を Hermes の永続キューで実行します。",
  },
};

export default ja;
