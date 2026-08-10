// 日本語 — the Task Master comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsTaskMasterCopy } from "./types";

const ja: VsTaskMasterCopy = {
  meta: {
    title: "AI4Kanban vs. Task Master — 仕様を書くか、聞かれて固めるか",
    socialTitle: "AI4Kanban vs. Task Master",
    description:
      "AI4Kanban と Task Master（Taskmaster）の比較。Task Master は書き上げた PRD を依存順のバックログに分割します。AI4Kanban は曖昧な着想から始め、着手できるカードになるまで質問を重ねます。",
    social:
      "Task Master は PRD がなければ始まりません。AI4Kanban は一文から始め、残りを質問します。どちらの出発点が自分の進め方に合うかを確かめてください。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nTask Master",
    lead: "どちらもチャット画面ではなくタスク一覧をコーディングエージェントに渡します。Task Master は書き上げた要件ドキュメントを受け取り、依存順のバックログに分割します。AI4Kanban はその一歩手前から始めます。曖昧な一文を渡すと、作る価値のあるものになるまで質問を重ねます。",
    ours: {
      name: "AI4Kanban",
      body: "リポジトリの中の Markdown ボード。エージェントが仕事を提案し、決められないことを尋ね、出荷したものを保管します。",
    },
    theirs: {
      name: "Task Master",
      body: "あらゆる AI エディタ向けのタスクエンジン。PRD を解析し、サブタスクへ展開し、バックログを消化します。",
    },
    oursDiagramAlt:
      "曖昧な一文が AI4Kanban に入り、自力で答えられない点だけが質問として返り、仕上がったカードが出てきます。",
    theirsDiagramAlt:
      "書き上げた要件ドキュメントが Task Master に入り、依存順に番号の付いたタスクへ分割されて返ってきます。",
    oursDiagramTop: "入力：曖昧な一文",
    oursDiagramBottom: "質問してから、カードを書く",
    theirsDiagramTop: "入力：書き上げたドキュメント",
    theirsDiagramBottom: "出力：依存順に番号の付いたタスク",
  },
  summary: {
    heading: {
      eyebrow: "要点",
      title: "違いは、こちらが何を用意しなければならないかです。",
    },
    lead: "Task Master（公式ドキュメントの表記は `Taskmaster`）は、コーディングエージェント向けタスク管理として最もよく知られた存在で、その役割をきちんと果たします。要件ドキュメントを読み、依存関係付きのタスクへ分割し、それぞれの複雑さを採点し、重いものをサブタスクへ展開し、ブロックされていない次のタスクを渡してくれます。すでに仕様を書いている人には、これでほぼ十分です。",
    panel:
      "AI4Kanban は、仕様がまだない前提に立ちます。渡すのは一文だけ。エージェントがコードとプロジェクトの記憶を読み、自分で決められることは決め、本当に未解決の点だけを尋ね、着手できる具体性になるまでこれを繰り返します。**質問こそが製品です。**ボードは、その答えが残る場所です。",
    note: "2026 年 8 月 10 日時点の確認：Task Master の最新リリースは 0.43.1（2026 年 3 月 31 日）、`main` の最新コミットは 2026 年 4 月 23 日で、同じチームがホスト型の計画ワークスペース Hamster を開発しています。パッケージは今も月に約 78,000 回インストールされており、広く使われているがリポジトリは静かなツール、という状態です。放棄されたわけではありません。",
  },
  start: {
    heading: {
      eyebrow: "初日",
      title: "どちらかが役に立つ前に、用意しなければならないもの",
    },
    lead: "目指すものは同じ、推測なしでコーディングエージェントが終えられるタスクです。違うのは、始める時点で何を求められるか。ほぼそこが比較のすべてです。",
    ours: {
      label: "AI4Kanban",
      title: "一文で足りる",
      steps: [
        "大まかな着想を口にするだけ。形式もドキュメントもテンプレートも要りません。",
        "エージェントがコードとプロジェクトの過去の決定を読み、決められることは決め、まだ開いている問いだけを尋ねます。",
        "カードを書き、価値と依存関係でボードの中に位置づけ、あなたの答えを次回のために残します。",
      ],
    },
    theirs: {
      label: "Task Master",
      title: "まず書かれたドキュメント",
      steps: [
        "要件ドキュメントを書きます。公式ガイドはチャットモデルと一緒に書き上げ、`.taskmaster/docs/prd.txt` として保存することを勧めています。",
        "`parse-prd` が依存関係付きのタスクへ分割し、`expand` がサブタスクへ砕き、`analyze-complexity` がさらに分割すべきものを採点します。",
        "`next` が、何にもブロックされていない最優先のタスクを渡します。",
      ],
    },
    note: "どちらの道も難しくはありません。ただしドキュメントが曖昧なら、Task Master は曖昧なドキュメントを分割します。`update-task` で文脈を足すことも、research モデルに調べさせることもできますが、この流れの中に、あなたが本当は何を意図したのかを尋ねる工程はありません。",
  },
  comparison: {
    heading: { eyebrow: "項目別", title: "AI4Kanban vs. Task Master" },
    lead: "{check} はその項目で選びやすいほうを示し、**ダッシュ**は進め方次第という意味です。Task Master が強いのは**対応範囲、バッチ実行、そして最新情報の調査**。AI4Kanban が強いのは**曖昧な着想を実際の仕様まで運ぶことと、決めた内容を残すこと**です。",
    ourLabel: "AI4Kanban",
    theirLabel: "Task Master",
    rows: {
      startingPoint: {
        dimension: "タスクはどこから来るか",
        kanban:
          "あなたの大まかな一文。あるいはコードとボードを読んだエージェントが自分から出す提案。",
        taskMaster:
          "先に書いた要件ドキュメントを解析してタスク化。プロンプトから 1 件ずつ追加することもできます。",
      },
      vagueRequest: {
        dimension: "依頼が曖昧なとき",
        kanban:
          "リファインのループが、記憶とコードで答えられるものに答え、残りを尋ねます。問いが開いている限りカードは「準備完了」になりません。",
        taskMaster:
          "ドキュメントの具体性がそのままタスクの具体性になります。タスクの更新や展開、research モデルによる調査は可能です。",
      },
      board: {
        dimension: "ディスク上のボードの姿",
        kanban:
          "`docs/kanban/` 配下にカード 1 枚につき Markdown 1 ファイル、加えてプレーンテキストの記憶ファイル。差分が文章として読めます。",
        taskMaster:
          "1 つの `.taskmaster/tasks/tasks.json` が全タスクとサブタスクを保持。`generate` でタスクごとのテキストファイルも書けます。",
      },
      setup: {
        dimension: "用意するもの",
        kanban:
          "プロンプト 1 つ。MCP サーバーも API キーもモデル設定も不要で、考えるのはコーディングエージェント自身のモデルです。",
        taskMaster:
          "MCP サーバーまたは CLI に加えて、main・research・fallback のモデル設定。Claude Code と Codex のプロバイダーは追加のキーが不要ですが、他の多くは必要です。",
      },
      execution: {
        dimension: "実行を回す",
        kanban:
          "カードの実装と保管はあなたのエージェントが行います。バッチ実行の仕組みも、強制されるテスト手順もありません。",
        taskMaster:
          "`loop` が新しい Claude Code セッションを連続で立ち上げ、テスト・lint・重複などのプリセットを備えます。`autopilot` は専用ブランチで red-green-commit の TDD サイクルを回します。",
      },
      memory: {
        dimension: "何が引き継がれるか",
        kanban:
          "モジュールごとの記憶：決定、却下した案、設計の修正、出荷した仕事。次の提案の前に読まれるので、一度の「いいえ」は「いいえ」のままです。",
        taskMaster:
          "サブタスクに追記されるタイムスタンプ付きのメモ、保存された調査ファイル、複数のタスク一覧を分けるタグ。",
      },
      reach: {
        dimension: "どこで動くか",
        kanban:
          "現時点では Claude Code と Codex。ボードはただのファイルなので、別のハーネスでも新しい形式は不要で、つなぐだけです。",
        taskMaster:
          "Cursor、Windsurf、VS Code、Claude Code、Codex、Kiro、Amazon Q ほか。MCP または CLI 経由で、15 を超えるモデルプロバイダーに対応します。",
      },
      teams: {
        dimension: "複数人で使う",
        kanban:
          "協働の手段は git です。ブランチを切り、プルリクエストで計画をレビューし、マージする。リアルタイム同期はありません。",
        taskMaster:
          "オープンソース版もローカルですが、同じチームがホスト型の Hamster を提供しています。共有ブリーフと同期を備え、クリエイター 1 人あたり月 40 ドルからです。",
      },
      license: {
        dimension: "ライセンス",
        kanban:
          "Apache-2.0。利用も fork も、これで作ったものの販売も自由で、追加条件はありません。",
        taskMaster:
          "MIT に Commons Clause 付き。個人・商用・学術利用は無料ですが、Task Master 自体の販売と、ホスティングサービスとしての提供はできません。",
      },
    },
  },
  boardShape: {
    heading: {
      eyebrow: "ディスク上では",
      title: "1 つの JSON か、カード 1 枚につき 1 ファイルか",
    },
    lead: "どちらのボードもリポジトリの中にあり、コードと一緒にバージョン管理されます。違うのは、差分が人に何を見せるかです。",
    oursLabel: "AI4Kanban",
    theirsLabel: "Task Master",
    oursCaption:
      "カード 1 枚が Markdown 1 ファイル。プルリクエストには、読んで反論できる言葉として計画の変更が現れます。",
    theirsCaption:
      "1 つのファイルがバックログ全体を抱えます。差分に出るのは JSON — 正確ですが、読ませるために書かれたものではありません。",
    note: "Task Master は 0.42.0 でプロセス間のファイルロックを追加し、同時書き込みでデータが失われないようにしました。ファイルが分かれていればその競合自体が起きません。ぶつかるのは、2 つの実行が同じカードを編集したときだけです。",
  },
  wins: {
    heading: { eyebrow: "トレードオフ", title: "それぞれの強み" },
    lead: "Task Master は対応範囲が広く、人が見ていなくても長く走り、調べ物にも出かけられます。AI4Kanban は意図的に狭く、タスクが存在する前の区間で勝負します。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Task Master",
    ours: {
      asksFirst: {
        title: "作る前に尋ねる",
        body: "エージェントは大まかな一文を問いの列に変え、コードと過去の決定から答えられるものは自分で片づけ、他の誰にも決められないものだけを渡します。",
      },
      diffablePlan: {
        title: "計画が読める文章である",
        body: "カードはすべて Markdown ファイルです。コードと同じように計画をレビューできます — 差分で、言葉で、何かが書かれる前に。",
      },
      moduleMemory: {
        title: "却下したことを覚えている",
        body: "決定、却下した案、設計の修正はモジュールごとに保存され、次の提案の前に読まれます。だからボードは同じ提案を二度しません。",
      },
      nothingToWire: {
        title: "立ち上げるものがない",
        body: "MCP サーバーも API キーもモデル役割の設定も不要で、毎回の会話にツール定義が入ることもありません。プロンプト 1 つでリポジトリに入ります。",
      },
    },
    theirs: {
      everywhere: {
        title: "ほぼどこでも動く",
        body: "Cursor、Windsurf、VS Code、Claude Code、Codex、Kiro ほかに対応し、MCP か CLI 経由で、ローカルを含む 15 を超えるモデルプロバイダーを使えます。",
      },
      research: {
        title: "調査モデルを内蔵している",
        body: "専用の research 役割が、タスクを書くときや展開するときに最新の情報を取り込み、調べた内容をタスクのそばに保存します。",
      },
      batchRuns: {
        title: "寝ている間も働ける",
        body: "`loop` はタスクごとに新しいセッションを立ち上げ、テスト・lint・重複・コードの臭いのプリセットを備えます。`autopilot` は専用ブランチで厳格な TDD サイクルを回します。",
      },
      proven: {
        title: "すでに知られている定番",
        body: "GitHub のスターは約 28,000、npm のインストールは月およそ 78,000 回。ドキュメントと Discord、そして真似できる長年の運用例があります。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "選び方", title: "どちらが自分の進め方に合うか" },
    oursHeading: "AI4Kanban を選ぶのは",
    theirsHeading: "Task Master を選ぶのは",
    ours: [
      "着想がいつも一文から始まり、仕様を書く段階で止まってしまうとき。",
      "計画とその理由を、コードのそばで、差分としてレビューしたいとき。",
      "決定と却下をボードに覚えさせ、同じことを何度も聞かせたくないとき。",
      "MCP サーバーをもう一つ動かし、API キーを増やし、モデルを設定するのは避けたいとき。",
    ],
    theirs: [
      "すでに要件ドキュメントを書いていて、それをうまく分割し順序づけたいとき。",
      "Cursor、Windsurf、VS Code、Kiro で作業し、ボードもエディタの中に置きたいとき。",
      "バッチでの自律実行や、厳格なテストファーストの手順を最初から使いたいとき。",
      "計画の中に最新情報の調査を組み込みたい、または当方が対応していないモデルプロバイダーを使いたいとき。",
    ],
    verdict:
      "Task Master は、仕様が書き終わった地点から始まります。AI4Kanban はその手前から始まり、曖昧な着想からエージェントに渡す価値のあるタスクまでの区間そのものを仕事にします。ドキュメントを上手に書けるなら、今日多くを片づけるのは Task Master です。そのドキュメントがいつまでも書かれないなら、まず埋めるべきはその区間です。",
    note: "両者は排他的ではありません。練り上げた AI4Kanban のカードから PRD を書けば、解析は問題なく通ります。ただしタスクの状態はどちらか一方のボードが持たなければ、二つを維持し続けることになります。",
  },
};

export default ja;
