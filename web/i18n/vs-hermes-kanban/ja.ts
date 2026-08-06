// 日本語 — the Hermes Agent Kanban comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const ja: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — 軽量なファイルボード vs. 堅牢なランタイム",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "ai4kanban のファイルベースのボードは、Nous Research の Hermes Agent Kanban とどう違うか。重なりの大きい 2 つのエージェント向けカンバンで、一方はどのエージェント（Hermes でも）でも動く diff 可能なただのファイル、もう一方は名前付きエージェントが多数タスクを取り合う、共有された堅牢な SQLite キューです。",
    social:
      "重なりの大きい 2 つのエージェント向けカンバン。ai4kanban はどのエージェント（Hermes でも）でも動く軽量なファイルボード。Hermes は同じボードを、多数の名前付きエージェントが共有する堅牢なキューごと同梱しています。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "エージェント向けのカンバンが 2 つ、重なる部分はかなりあります。違いは、ボードがスタックのどこに座っているか。ai4kanban は上にどんなエージェントでも載せられる軽量な*ボード層*、Hermes Agent Kanban はそのボードを自前のランタイムに溶かし込んでいます。",
    ours: {
      name: "AI4Kanban",
      body: "リポジトリのなかの Markdown ボード。ランタイムも実行も、保守までもその上に載ります。エージェントを替えても、ボードはそのまま。",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "ボード、ディスパッチャ、名前付きエージェントがひとつのランタイム。堅牢で全部入りですが、ボードは Hermes から外れません。",
    },
    oursDiagramAlt:
      "カンバンは一番下にある Markdown のボード。エージェントランタイム、実行、保守はその上に積まれた差し替え可能な層。",
    theirsDiagramAlt:
      "SQLite のボード、ディスパッチャ、名前付きエージェントが内側に溶け込んだ、ひとつの Hermes ランタイム。",
    taskLayer: "タスク層 · 実行 + 保守",
    boardLayer: "カンバン · Markdown ファイル（git）",
    runtimeLabel: "Hermes ランタイム",
  },
  summary: {
    heading: {
      eyebrow: "手短に言うと",
      title: "Hermes Kanban でよくないですか？",
    },
    lead: "もっともな疑問です。実際かなり重なります。どちらもエージェントが計画し作業するカンバンなので、ai4kanban は**Hermes Kanban の軽量な代替**だと思ってください。同じボードの発想から、同梱のランタイムを引いたものです。違いはその下にあります。",
    oursHeading: "AI4Kanban — ファイルでできたボード",
    theirsHeading: "Hermes Kanban — ランタイムの中にあるボード",
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
    whenLabel: "ai4kanban を選ぶとき",
    when: "ボードを**コードと一緒にバージョン管理したい**とき、すでに動かしている環境の中に留まりたいとき、あるいはタスクボードのためだけにランタイムを運用したくないとき、ai4kanban を選んでください。**すでに Hermes を深く使っている**なら Hermes Kanban を。そのボードは、あなたが整えたディスパッチャ、名前付きプロファイル、チャットからの操作にそのまま噛み合います。結局どちらも堅牢なキューです。ai4kanban のそれは git のファイル、Hermes のそれは SQLite の行というだけ。",
  },
  harness: {
    heading: {
      eyebrow: "実行環境の対応",
      title: "どのエージェントがボードを動かせる？",
    },
    lead: "いちばんはっきりした違いです。ai4kanban のボードはただのファイルなので、**リポジトリを読めるエージェントならどれでも動かせます**。Hermes 自身も含めて。Hermes Kanban のボードはランタイムの `kanban_*` ツールの向こうにあるので、動かせるのは Hermes だけです。",
    oursSub: "ファイルを読めるエージェントなら何でも",
    theirsSub: "Hermes のみ",
    supported: "対応",
    notSupported: "非対応",
    note: "……そして ai4kanban の行はまだまだ続きます。Windsurf、OpenCode、Gemini CLI、ファイルを読めるものなら何でも。Hermes Kanban には他のエージェントの入り口がありません。",
  },
  comparison: {
    heading: { eyebrow: "真っ向比較", title: "AI4Kanban vs. Hermes Kanban" },
    lead: "{check} は明確な勝ち、**ダッシュ**はトレードオフ。ai4kanban は簡潔さと可搬性で、Hermes は共有された堅牢なキューと規模で勝ちます。残りは引き分けです。",
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
        kanban: "ひとり用のボード。育つと grep が扱いづらくなります。",
        hermes:
          "多数のボードにまたがる多数のエージェントまでスケール。マルチテナントで、Discord / Slack / メール / SMS から操作できます。",
      },
    },
  },
  memory: {
    heading: { eyebrow: "記憶 vs. 監査", title: "それぞれのボードが覚えていること" },
    lead: "本質的な違いは、ai4kanban の記憶が**計画への入力**だという点です。次の提案を賢くするために存在します。Hermes のログは**実行からの出力**で、過去を再生できるように存在します。",
    ours: {
      heading: "AI4Kanban",
      verdict: "結論を覚え、残りは忘れる。",
      body: "小さなファイルが 4 つ、**意図的に刈り込まれています**。`archive.md`（何をリリースしたか）、`rejected.md`（何を、なぜ却下したか）、`redesign.md`（繰り返してはいけない設計ミス）、`memory.md`（過去のスキャンで分かったこと）。エージェントは提案やカード執筆の前にすべて読みます。完全な履歴は git の仕事です。",
      q: "案 X がボードに無いのはなぜ？",
      a: "`rejected.md` の 1 行。その案と、却下した理由です。死んだ案は死んだままです。",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "すべてのイベントを覚え、何も要約しない。",
      body: "状態遷移はすべて**追記専用のログ**に落ち、試行ごとに終了コードとワーカーの全出力が残ります。監査とクラッシュ復旧のために作られていて、次の案を導くためではありません。",
      q: "タスク 42 は昨夜どうなった？",
      a: "`claimed → crashed → reclaimed → completed`、試行ごとのログ付きで読めます。",
    },
    note: "選び抜かれた記憶はエージェントを次に賢くし、監査ログは過去を再構成可能にします。どちらも互いの代わりにはなりません。",
  },
  autonomy: {
    heading: {
      eyebrow: "自律のレベル",
      title: "エージェントにどこまで任せる？",
    },
    lead: "Hermes Kanban が約束するのは**「一行放り込んで、あとは放置」**、完全な自律です。ai4kanban は**エージェント支援型**で、しかもプランモードより手前から始まります。半分しか固まっていないアイデアをボードに保存し、`refine` がそれを具体的な要件に変え、コードが書かれる前にあなたが承認します。",
    stops: {
      traditional: {
        level: "自律なし",
        term: "人が回す",
        heading: "従来のカンバン",
        detail:
          "タスクは全部あなたが思いつき、あなたが分解します。Trello や Jira はそれを記録するだけ。",
      },
      kanban: {
        level: "半自律",
        term: "エージェント支援型",
        heading: "AI4Kanban",
        detail:
          "`refine` のたびに足りない部分を掘り、要件を埋めます。何かが作られる前にあなたが目を通します。",
      },
      hermes: {
        level: "完全自律",
        term: "投げっぱなし",
        heading: "Hermes Kanban",
        detail:
          "一行入れれば、タスクツリーが出てくる。分解され、終わるまで無人で処理されます。Claude Code の `/goal` も同じ賭けです。",
      },
    },
    scaleLeft: "計画は全部あなた",
    scaleMiddle: "エージェントが計画、あなたが承認",
    scaleRight: "計画は全部エージェント",
    worstCaseLabel: "レベル別の最悪ケース",
    worstCaseTheirs:
      "**投げっぱなし：**序盤の小さな誤解が、間違ったタスクの木にまるごと育つ。しかも作られ、トークンも使われた後で。",
    worstCaseOurs:
      "**エージェント支援型：**間違った Markdown カード 1 枚。あなたが目を通した時点で捕まえられ、まだ何も作られていません。",
    note: "1 回の refine が、抜けていた手順を補い、脇道のアイデアを別のカードに切り出し、すでに終わっている TODO にチェックを入れ、好みの判断が要るものは質問としてあなたに残します。質問が尽きると、カードは**ready** に変わります。読んで、作るだけです。",
  },
  gui: {
    heading: { eyebrow: "2 つのダッシュボード", title: "カンバンボードの GUI" },
    lead: "どちらも Web ボードを備えていますが、役割が違います。ai4kanban のボードは**エージェントを操る操作面**で、カードの操作が実行を起こします。Hermes のボードは**ディスパッチャへのライブな窓**で、フリートがいま何をしているかを映します。",
    ours: {
      heading: "AI4Kanban — ローカルボード",
      body: "Markdown ファイルの上に載るローカルの Web ボード。カードの操作（*実装、レビュー、アーカイブ*）が作業をエージェントに引き渡し、途中で人に確認しながら流れてくるログを眺められます。",
      alt: "ai4kanban のローカル Web ボード。Blockers、UI、Skill、Docs、Distribution の各列と「Create task」ボタンのある明るい配色のボード。",
    },
    theirs: {
      heading: "Hermes Kanban — ディスパッチャのライブビュー",
      body: "イベントログを追いかけるライブなボード。列をまたぐドラッグ&ドロップ、実行履歴と終了ステータスのバッジが並ぶサイドドロワー、そして同じボードを Discord、Slack、SMS からも操作できます。",
      alt: "Hermes Agent のカンバンダッシュボード。Triage、Todo、Scheduled、Ready の各列とオーケストレーション用ツールバーのある暗い配色のボード。",
    },
  },
  wins: {
    heading: { eyebrow: "トレードオフ", title: "それぞれが勝つところ" },
    lead: "どちらが一方的に優れているわけではありません。ai4kanban は自前のインフラを持たない軽量なファイルボードに、Hermes Kanban は多数のエージェントが無人で回す共有された堅牢な作業キューに最適化されています。実行環境そのものの機能、つまり並列実行、オーケストレーション、ダッシュボードは両方にあるので、ここには挙げていません。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "自前のインフラを持たない",
        body: "データベースもゲートウェイもデーモンもなし。すでに動かしているエージェントの他は、ボードはただの Markdown ファイルです。追加で入れるものも、生かし続けるものもなく、飛行機の中でも動きます。",
      },
      diffable: {
        title: "diff できてバージョン管理できるファイル",
        body: "ボードはリポジトリに住み、リポジトリと一緒に移動します。使っているバージョン管理がそのまま効きます。タスクや計画の変更はすべてレビュー可能な diff。プロジェクトの外に SQLite はなく、問い合わせるイベントログもなく、特定のエージェントスタックに縛られることもありません。",
      },
      selfPruning: {
        title: "自分で刈り込む記憶",
        body: "なぜその案を却下したか、何をリリースしたかを記録するので、エージェントは死んだ作業を蒸し返さず前へ提案します。残すのは次のタスクを導くものだけで、完全な監査ログではありません。",
      },
      onePrompt: {
        title: "プロンプト 1 つで入る",
        body: "スキルファイル 1 枚と小さなスクリプト。設定するプロファイルも、調整するディスパッチャもありません。ファイルを読めるエージェントがすでに立っている場所で出迎えます。Hermes も含めて。",
      },
    },
    theirs: {
      manyAgents: {
        title: "ひとつのボードに、多数の名前付きエージェント",
        body: "複数の名前付きエージェント、そして人がタスクを取り、作業を引き継ぐ、ひとつの堅牢なボード。ディスパッチャが着手可能なタスクを監視し、それぞれに割り当てられたエージェントを立ち上げます。ai4kanban のボードは、あなたがいまいる 1 つの実行環境が回します。",
      },
      selfHealing: {
        title: "自己修復するタスクキュー",
        body: "キューはクラッシュをまたいで各タスクを追います。取得 TTL、ハートビート、期限切れ取得の回収、リトライ、サーキットブレーカー。ワーカーが途中で落ちてもボードが取り戻して再試行します。ai4kanban のファイルも消えはしませんが、落ちた実行は次のスケジュールを待つだけです。",
      },
      autoDecompose: {
        title: "タスクを自動で分解する",
        body: "粗いタスクを放り込めば、ディスパッチャの LLM 分解器が子タスクのグラフに展開し、それぞれを専門エージェントに割り振ります。手作業の分解は不要です。ai4kanban のほうは、カードを TODO と手入れするタスクグラフに分けます。",
      },
      fleetReach: {
        title: "フリート規模の到達範囲",
        body: "多数のボードにまたがる多数のエージェントのために作られ、マルチテナントで、Discord、Telegram、Slack、メール、SMS から操作できます。ai4kanban のほうは、あなたのリポジトリとターミナルに留まる簡素なひとり用ボードです。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "選び方", title: "どちらを使うべき？" },
    oursHeading: "こんなときは ai4kanban",
    theirsHeading: "こんなときは Hermes Kanban",
    ours: [
      "ファイルベースのボードが欲しい。タスクや計画の変更がすべてレビュー可能な diff になる。",
      "自前のインフラを持たせたくない。ただのファイル、オフライン可、持ち運べて、ロックインなし。",
      "エージェントに依存させたくない。Claude Code、Cursor、Hermes 自身でも。",
      "ひとりで作っていて、全部入りのエンジンより簡素なボードを重んじる。",
    ],
    theirs: [
      "すでに Hermes を深く使っている。プロファイル、ゲートウェイ、チャット操作まで整っている。",
      "多数の名前付きエージェント、そして人が共有する堅牢なボードが 1 つ欲しい。",
      "クラッシュをまたいで進行中のタスクを自動で拾い直すキューが欲しい。",
      "ディスパッチャにタスクを自動分解させ、専門エージェントに振らせたい。",
      "多数のボードとチャットプラットフォームにまたがるフリート規模の作業を回している。",
    ],
    verdict:
      "名前から受ける印象よりずっと重なっています。どちらもエージェント向けのカンバンです。分かれ目は何が同梱されているか。ai4kanban は**自動化を実行環境に任せたファイルベースのボード**、Hermes Agent Kanban は同じボードを**共有された堅牢な作業キューで包んだもの**です。多数のエージェントが共有し、クラッシュにも耐えるボードが欲しいなら Hermes を。リポジトリに置いておき、必要になったときだけ広げる簡素なボードが欲しいなら ai4kanban を。",
    note: "並べて使うこともできます。ai4kanban は git のなかで計画し刈り込む軽い場所として、Hermes は何をやるか決まった後で重い共有作業を回す堅牢なキューとして。",
  },
};

export default ja;
