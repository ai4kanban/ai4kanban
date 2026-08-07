import type { VsMulticaCopy } from "./types";

const ja: VsMulticaCopy = {
  meta: {
    title: "AI4Kanban vs. Multica——仕事を決めるか、エージェント群を運用するか",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "タスク発見、要件整理、意思決定の記憶、エージェント実行、チーム、基盤、ライセンスの観点から AI4Kanban と Multica を比較します。",
    social:
      "どちらもコーディングエージェントをカンバンに載せます。AI4Kanban は存在すべき仕事を決め、Multica は実行するエージェントを決めます。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nMultica",
    lead: "どちらもコーディングエージェントをカンバンに載せる製品です。本当の境界は、**エージェントがいつ登場するか**にあります。AI4Kanban は上流でタスクを判断し、具体化します。Multica はすでに存在する Issue を受け取り、実行を運用します。",
    ours: {
      name: "AI4Kanban",
      body: "リポジトリ内で動く計画ループです。エージェントが仕事を提案し、曖昧な案を育て、ボードを並べ替え、過去の判断を記憶します。",
    },
    theirs: {
      name: "Multica",
      body: "人とエージェントのチーム向けプロジェクト運用基盤です。Issue を割り当てると、キュー投入、配信、監視、再試行、レビューを担います。",
    },
    oursDiagramAlt:
      "AI4Kanban がプロジェクトを読み、芽生えたアイデアを準備完了のカードへ変えます。",
    theirsDiagramAlt:
      "Multica が準備完了の Issue を受け取り、エージェントランタイムへ配信します。",
    oursDiagramTop: "プロジェクト読解 · 仕事の発見",
    oursDiagramBottom: "曖昧な案 → 準備完了カード",
    theirsDiagramTop: "準備完了 Issue + 担当者",
    theirsDiagramBottom: "配信 · 実行 · レビュー",
  },
  boundary: {
    heading: {
      eyebrow: "境界線",
      title: "同じボード。「準備完了」の反対側。",
    },
    lead: "カンバンは表面にすぎません。AI4Kanban は**タスクが準備完了になる前**の判断に集中し、Multica は**準備完了になった後**の仕組みに集中します。両者は受け渡し点で接続できますが、同じシステムではありません。",
    stages: {
      discover: "発見",
      refine: "具体化",
      prioritize: "優先順位",
      assign: "割り当て",
      run: "実行",
      review: "レビュー",
    },
    oursLabel: "AI4Kanban · 仕事を決める",
    theirsLabel: "Multica · 仕事を運用する",
    handoffLabel: "準備完了",
    principle:
      "**Multica は、どのエージェントがタスクを実行するかを決めます。AI4Kanban は、どのタスクが存在すべきかを決めます。**「同じアイデアでは？」への、最も短く実用的な答えです。",
  },
  backlog: {
    heading: {
      eyebrow: "Backlog テスト",
      title: "Todo に入る前、何が起きるか？",
    },
    lead: "Multica 自身のタスクモデルが境界を明確にしています。**Backlog の Issue はエージェントを起動しません**。人が実在する仕事だと判断し、先へ進めるまでは駐車場です。AI4Kanban では、未完成のボードこそエージェントが計画を進める場所です。",
    ours: {
      label: "Backlog は活動中",
      title: "エージェントがカードを育てる",
      body: "依頼を仕事として扱う前に、エージェントがコードとモジュール記憶を読みます。",
      steps: [
        "未完成のアイデアを提案または取り込む",
        "文脈を解決し、本当に必要な判断を表に出す",
        "価値と依存関係で実装可能なカードを並べる",
      ],
      state: "エージェント起動中",
    },
    theirs: {
      label: "Backlog は駐車中",
      title: "エージェントは Todo を待つ",
      body: "人が Issue の説明と受け入れ条件を用意し、仕事が承認されて初めて割り当てが実行を開始します。",
      steps: [
        "人が Issue を書く、または承認する",
        "人が Backlog → Todo へ移す",
        "デーモンが担当者をキュー投入して配信する",
      ],
      state: "エージェント休止中",
    },
    note: "Multica には quick-create もありますが、一回限りの転記機能です。自由文を Issue へ整形して終了し、コードベースの調査、質問、仮定の記録は行いません。",
  },
  comparison: {
    heading: {
      eyebrow: "正面比較",
      title: "見出しではなく、出荷済み製品を比べる",
    },
    lead: "{check} はその観点でより明確に適する側、**ダッシュ**は設計上のトレードオフを示します。Multica が実際に出荷した運用基盤を正当に評価し、将来構想とは分けて比較します。",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "製品が始まる地点",
        kanban:
          "タスクより前。プロジェクトを調べ、仕事を提案し、ボードに置くべきものを決めます。",
        multica:
          "タスクが存在した後。Issue、担当者、優先度、実行指示を受け取ります。",
      },
      backlog: {
        dimension: "Backlog の動作",
        kanban:
          "エージェントが未完成カードを能動的に育て、依頼されていない仕事も提案できます。",
        multica:
          "駐車場です。Backlog の Issue は割り当て済みエージェントを起こしません。",
      },
      refinement: {
        dimension: "曖昧な案から具体案へ",
        kanban:
          "反復する具体化ループがコードと記憶を読み、仮定を明示し、未解決のプロダクト判断だけを質問します。",
        multica:
          "説明は自由文です。ファイル、制約、期待結果、受け入れ条件は人が書くよう案内されます。",
      },
      memory: {
        dimension: "蓄積されるもの",
        kanban:
          "プロジェクト判断、再設計の教訓、出荷済み作業、却下理由が次の提案に影響します。",
        multica:
          "再利用可能な Skills が作業手順を保存し、Issue 活動と実行履歴が実行経緯を保存します。",
      },
      execution: {
        dimension: "実行運用",
        kanban:
          "選んだコーディング環境へ実装を渡します。再試行、再実行、トークン費用、フリート管理は内蔵しません。",
        multica:
          "キュー投入、配信、ストリーミング、計測、再試行、再実行、レビュールール、PR・CI 連携を提供します。",
      },
      teams: {
        dimension: "人とエージェントのチーム",
        kanban:
          "ローカル優先で、個人開発者または git で協働する小規模チーム向けです。",
        multica:
          "複数人ワークスペース、ロール、Squad、受信箱、コメント、権限、通知を備えます。",
      },
      storage: {
        dimension: "保存方式と基盤",
        kanban:
          "リポジトリ内の Markdown。データベース、アカウント、ボードサーバー、MCP は不要です。",
        multica:
          "PostgreSQL + pgvector、Go サーバー、ローカルデーモン、OAuth、ホスト型またはセルフホスト型の構成です。",
      },
      license: {
        dimension: "ライセンス",
        kanban:
          "Apache License 2.0。商用利用、ホスティング、組み込みも可能です。",
        multica:
          "ソース閲覧可能な Multica License で、ホストサービスと商用組み込みに制限があります。",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "二種類の記憶",
      title: "どう行うかと、なぜ決めたか",
    },
    lead: "どちらも知識を蓄積しますが、軸が異なります。Multica Skills はエージェントに**ある種類の仕事をどう行うか**を教えます。AI4Kanban のモジュール記憶は、**このプロジェクトが何を決め、何を除外したか**を記録します。",
    ours: {
      eyebrow: "プロジェクトの判断",
      title: "AI4Kanban は却下を覚える",
      body: "エージェントは提案や具体化の前に、リポジトリ内の簡潔なファイルを読みます。完全な会話記録ではなく、次の計画判断が過去の誤りを繰り返さないための記憶です。",
      examples: ["rejected.md", "redesign.md", "memory.md"],
      question: "なぜボードは案 X を提案しなくなったのか？",
      answer:
        "`rejected.md` が案と却下理由を保存するため、新しい根拠で判断が変わらない限り再登場しません。",
    },
    theirs: {
      eyebrow: "作業方法",
      title: "Multica は手順書を覚える",
      body: "Skills は手書きまたはインポートされた `SKILL.md` のまとまりで、エージェント間で共有されます。Issue コメントと実行履歴は何が起きたかを示しますが、完了作業から判断記憶を自動生成しません。",
      examples: ["SKILL.md", "コメント", "実行履歴"],
      question: "このエージェントはセキュリティレビューをどう行うべきか？",
      answer:
        "その仕事の手順、ファイル、指示を含む再利用可能な Skill を割り当てます。",
    },
    note: "違いは手順と判断です。手順書は実行を改善し、却下記録は誤った仕事が再提案されるのを防ぎます。",
  },
  horizon: {
    heading: {
      eyebrow: "構想と現状",
      title: "重なる範囲は近づいている",
    },
    lead: "Multica の `VISION.md` は上流へ踏み込んでいます。意図を構造化し、文脈を集め、不確実性を明示し、判断と結果を結びつけるエージェントを描いています。現在の Multica 製品よりも、AI4Kanban が今掲げる考え方にかなり近い内容です。",
    shippedLabel: "現在の出荷内容",
    visionLabel: "表明された方向",
    shippedTitle: "Issue を実行する",
    shippedBody:
      "Backlog は待機します。デーモンは担当者に Issue を読んで完了するよう指示します。具体化はコード作成後、レビューと修正で行われます。",
    visionTitle: "意図を育てる",
    visionBody:
      "将来のエージェントは意図を構造化された仕事へ変え、既知の事実と未決の判断を分離するとされています。",
    marker: "この差に注目",
    note: "これは現実の競争上の脅威ですが、未出荷機能を現行製品へ加点する理由にはなりません。誠実な比較は出荷済み同士で行い、表明された方向も明記します。",
  },
  wins: {
    heading: {
      eyebrow: "トレードオフ",
      title: "それぞれが明確に先行する領域",
    },
    lead: "機能数の競争ではありません。AI4Kanban は意図的に小さく、ライフサイクルの早い段階を担います。実行に入った後は Multica の範囲が大幅に広がります。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "エージェントが仕事の判断を助ける",
        body: "プロジェクト文脈から提案し、粗い依頼を実装可能なカードへ変え、実行前に価値と依存関係で並べます。",
      },
      rejectionMemory: {
        title: "却下された案は却下されたまま",
        body: "判断と再設計の記憶が後の計画に反映されるため、プロジェクトが除外した方向を繰り返し提案しません。",
      },
      repoNative: {
        title: "計画レイヤー全体が git に収まる",
        body: "カードと記憶はコード横の読みやすく差分可能なファイルです。ボードサービスは不要で、純粋な Apache-2.0 条件です。",
      },
    },
    theirs: {
      operations: {
        title: "本格的な実行コントロールプレーン",
        body: "実行の再生、再試行、レビュールール、PR・CI 連携、トークン計測、Webhook、添付、多様な運用ビューをすでに出荷しています。",
      },
      teams: {
        title: "複数人運用のための設計",
        body: "ワークスペース、ロール、Squad、スレッド、通知、権限、永続的なエージェント ID が、人とエージェントの組織を支えます。",
      },
      runtimeReach: {
        title: "はるかに広いランタイム対応",
        body: "Multica は約二十種類のエージェント CLI をローカルデーモンやクラウドランタイムで接続します。AI4Kanban は現在 Claude Code と Codex に対応します。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "結論", title: "どちらを使うべきか？" },
    oursHeading: "AI4Kanban が向く場合",
    theirsHeading: "Multica が向く場合",
    ours: [
      "ボトルネックが配信ではなく、正しい仕事の判断と具体化にある。",
      "コードとプロジェクト記憶からエージェントにタスクを提案させたい。",
      "却下理由と設計判断を将来の計画に反映したい。",
      "ボード基盤のない小さなリポジトリネイティブ構成を好む。",
      "構築するものに純粋な Apache-2.0 条件が重要である。",
    ],
    theirs: [
      "タスクはすでに存在し、確実な実行がボトルネックである。",
      "複数の人と名前付きエージェントが共有運用空間を必要とする。",
      "再試行、再実行、費用計測、PR・CI 連携、レビュールールが必要である。",
      "幅広いランタイム、Squad、チャット、Webhook、モバイルアクセスが必要である。",
      "サーバー型プラットフォームの運用または購入を受け入れられる。",
    ],
    verdict:
      "AI4Kanban は、仕事が準備完了になる前に**何を行うかを決め、育てる**ために選びます。Multica は、準備完了後に**仕事を割り当て、運用する**ために選びます。両方必要なら、接続点は明確です。AI4Kanban が承認済みカードを作り、その後 Multica Issue を作成して実行します。",
    note: "両者は補完できますが、同じタスク状態に二つのライブな正本を置かないでください。明確な受け渡し点を決めます。",
  },
};

export default ja;
