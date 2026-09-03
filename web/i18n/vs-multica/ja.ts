import type { VsMulticaCopy } from "./types";

const ja: VsMulticaCopy = {
  meta: {
    title:
      "AI4Kanban vs. Multica：AIプロジェクト管理か、マルチエージェント基盤か",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "AI4Kanbanは、導入後すぐ使えるAIプロジェクト管理。Multicaは、複数のエージェントを構築・運用するための汎用プラットフォームです。",
    social:
      "どちらもエージェントにタスクを実行させられます。違いは、プロジェクトを管理する製品か、エージェントチームを構築する基盤かです。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nMultica",
    lead: "どちらもエージェントにタスクを実行させられます。**AI4Kanbanはすぐに使えるAIプロジェクト管理、Multicaは汎用的なマルチエージェント基盤です。**",
    ours: {
      name: "AI4Kanban",
      body: "人が方向性とアイデアを示し、重要な判断を担います。エージェントはタスクの発見、要件の明確化、優先順位付け、実行を担い、学びをプロジェクトの記憶に戻します。",
    },
    theirs: {
      name: "Multica",
      body: "複数のエージェントを作成し、それぞれの責務、Skills、実行環境を設定します。分担、実行、再試行、レビュー、チーム連携を一つの場所で管理できます。",
    },
    oursDiagramAlt:
      "作りたいものを伝えると、ボードが自分で計画して進めます。作成も命名も割り当ても必要なエージェントはありません。",
    theirsDiagramAlt:
      "Multicaが用意するのは基盤であってチームではありません。エージェントは自分で作成し、実行後の割り当て・監視・再試行も自分に戻ってきます。",
    oursDiagramTop: "作りたいものを伝えるだけ",
    oursDiagramBottom: "あとはボードが計画して進める — 設定するエージェントはなし",
    theirsDiagramTop: "エージェントは一つずつ自分で作る",
    theirsDiagramBottom: "割り当ても監視も再試行も、そのままあなたの仕事",
  },
  boundary: {
    heading: {
      eyebrow: "位置付け",
      title: "用途の異なる2つの製品",
    },
    lead: "AI4Kanbanは、人とAIが一緒にプロジェクトを管理するための製品です。Multicaは、複数のエージェントを作成・編成・実行するための製品です。",
    stages: {
      discover: "方向を決める",
      refine: "AIと明確化",
      prioritize: "一緒に進める",
      assign: "エージェントを作る",
      run: "チームを設定",
      review: "タスクを運用",
    },
    oursLabel: "AI4Kanban",
    theirsLabel: "Multica",
    oursJob: "プロジェクトを管理する",
    theirsJob: "エージェントを動かす",
  },
  backlog: {
    heading: {
      eyebrow: "標準機能",
      title: "それぞれ何が入っているか",
    },
    lead: "どちらも導入したその日から完成していますが、完成している対象が違います。AI4Kanbanはプロジェクト管理そのもの、Multicaはエージェントを動かす仕組みです。",
    ours: {
      label: "AI4Kanban",
      title: "プロジェクト管理がそのまま動く",
      items: [
        "人とAIが共有する進め方",
        "カードの全工程を扱うボード",
        "リポジトリに残るプロジェクトの記憶",
      ],
    },
    theirs: {
      label: "Multica",
      title: "エージェント基盤がそのまま動く",
      items: [
        "エージェントの識別情報、Instructions、Skills",
        "Squad、チャット、タスクキュー",
        "自動化、再試行、実行履歴",
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "主な違い",
      title: "選ぶ前に見るポイント",
    },
    lead: "{check} はその用途により適した選択肢、**ダッシュ**は一長一短を示します。",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "製品の役割",
        kanban:
          "人とAIが協働するための、完成されたプロジェクト管理ワークフロー。",
        multica:
          "マルチエージェントチーム向けの汎用ワークスペース。役割とフローは利用者が定義。",
      },
      backlog: {
        dimension: "能動的なプロジェクト管理",
        kanban:
          "エージェントがプロジェクトと記憶を読み、タスクを提案・明確化・優先順位付け。",
        multica:
          "エージェント、Skill、Autopilotで実現できるが、動作は自分で設定。",
      },
      refinement: {
        dimension: "要件の明確化",
        kanban:
          "コードとプロジェクト記録から文脈を補い、人には判断が必要な論点だけを確認。",
        multica:
          "既成の要件明確化フローはなく、Agent InstructionsまたはSkillに定義。",
      },
      memory: {
        dimension: "長期記憶",
        kanban:
          "プロジェクトの決定、却下理由、設計を見直した教訓を次の計画に反映。",
        multica:
          "Skillsは作業方法を、コメントと実行履歴は実行過程を保存。",
      },
      execution: {
        dimension: "実行管理",
        kanban:
          "Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness、ZCode、Grok Build でカードを実行し、提案からアーカイブまでの状態を管理。",
        multica:
          "複数のエージェントを並列実行し、キュー、再試行、リプレイ、コスト集計、レビューゲート、PR・CI連携を提供。",
      },
      teams: {
        dimension: "チーム連携",
        kanban:
          "ローカル優先。個人開発者や、gitで連携する小規模チーム向け。",
        multica:
          "マルチユーザーのワークスペース、ロール、Squad、コメント、権限、通知。",
      },
      storage: {
        dimension: "導入と保存",
        kanban:
          "カードと記憶はリポジトリ内に保存。データベース、アカウント、ボードサーバーは不要。",
        multica:
          "PostgreSQL、サーバー、ローカルdaemonを使用。ホスト版とセルフホスト版を選択可能。",
      },
      license: {
        dimension: "ライセンス",
        kanban:
          "Apache-2.0。商用利用、ホスティング、組み込みも可能。",
        multica:
          "ソース閲覧可能。ホスティングサービスと商用組み込みはMultica Licenseで制限。",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "長期記憶",
      title: "記憶する内容が違う",
    },
    lead: "どちらも実行のあいだに記録を残します。残す中身が違います。",
    ours: {
      eyebrow: "プロジェクトの判断",
      title: "なぜそう決めたのか",
      examples: ["decisions.md", "rejected.md", "redesign.md"],
      question: "なぜアイデアXが提案されなくなったのか？",
      answer:
        "`rejected.md`に却下理由が残っています。新しい根拠がない限り、再提案されません。",
    },
    theirs: {
      eyebrow: "作業方法",
      title: "エージェントはどう動くべきか",
      examples: ["Instructions", "SKILL.md", "実行履歴"],
      question: "このエージェントはセキュリティレビューをどう進めるべきか？",
      answer: "手順、対象ファイル、要件を記したSkillを追加します。",
    },
    note: "",
  },
  horizon: {
    heading: {
      eyebrow: "自分で構築",
      title: "Multicaで同様の管理を行うには",
    },
    lead: "Multicaでもプロジェクトマネージャーエージェントは作れます。作成自体はすぐ終わりますが、次の4つは自分で答えを決め、プロジェクトが変わるたびに決め直すことになります。",
    visionLabel: "自分で作る部分",
    visionTitle: "プロジェクト管理の振る舞い",
    items: [
      "プロジェクトの目標をどう理解するか",
      "やる価値のある仕事をどう見つけるか",
      "曖昧な要件をどう明確にするか",
      "実行のあいだに何を覚えておくか",
    ],
    note: "",
  },
  wins: {
    heading: {
      eyebrow: "それぞれの強み",
      title: "課題に合う方を選ぶ",
    },
    lead: "AI4Kanbanは用途が明確で、機能が揃い、すぐ使えます。Multicaは汎用性と柔軟性が高く、複数のエージェント運用に向きます。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "すぐ使えるプロジェクト管理",
        body: "先にプロジェクトマネージャーエージェントを設計する必要はありません。導入後すぐに、人とエージェントが同じ方法で計画・明確化・実行できます。",
      },
      rejectionMemory: {
        title: "却下した案を繰り返さない",
        body: "過去の判断を次の計画に反映し、同じ議論の繰り返しを減らします。",
      },
      repoNative: {
        title: "すべてgitに保存",
        body: "カードと記憶は読みやすくdiffも可能。別途ボードサービスを運用する必要はありません。",
      },
    },
    theirs: {
      operations: {
        title: "充実した実行管理",
        body: "キュー、再試行、リプレイ、レビュー、コスト集計、PR・CI連携を標準で提供します。",
      },
      teams: {
        title: "人と複数のエージェントに対応",
        body: "ワークスペース、ロール、Squad、コメント、権限、通知を一つのプラットフォームに集約します。",
      },
      runtimeReach: {
        title: "幅広いランタイム対応",
        body: "ローカルdaemonから多様なエージェントCLIに接続できます。AI4Kanbanは現在、Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness、ZCode、Grok Build に対応しています。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "選び方", title: "どちらを選ぶべきか？" },
    oursHeading: "AI4Kanbanが向く場合",
    theirsHeading: "Multicaが向く場合",
    ours: [
      "人とAIが一緒にプロジェクトを管理する方法を、すぐに使いたい。",
      "計画、要件の明確化、実行までエージェントに参加してほしい。",
      "プロジェクトの決定や却下理由を今後の計画に反映したい。",
      "追加サービス不要の、軽量でリポジトリ中心の仕組みを使いたい。",
    ],
    theirs: [
      "役割の異なる複数のエージェントを作成・運用したい。",
      "人とエージェントでワークスペース、Issue、実行履歴を共有したい。",
      "再試行、リプレイ、コスト集計、PR・CI連携が必要。",
      "プロジェクト管理エージェント、Skills、ワークフローを自分で定義できる。",
    ],
    verdict:
      "**すぐ使えるAIプロジェクト管理**が必要ならAI4Kanban。**マルチエージェントチームを構築・運用する汎用基盤**が必要ならMultica。どちらもエージェントでタスクを実行できますが、前者はプロジェクト管理、後者はマルチエージェント運用に適しています。",
    note: "",
  },
};

export default ja;
