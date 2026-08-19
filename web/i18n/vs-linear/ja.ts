// 日本語 — the Linear comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsLinearCopy } from "./types";

const ja: VsLinearCopy = {
  meta: {
    title: "AI4Kanban vs. Linear — リポジトリでの計画か、組織での連携か",
    socialTitle: "AI4Kanban vs. Linear",
    description:
      "AI4Kanban と Linear を比較。コーディングエージェントがリポジトリ内で使う計画システムと、チームとエージェントが連携するプロダクト開発基盤の違いを解説します。",
    social:
      "Linear は組織全体の仕事を調整し、AI4Kanban は粗い依頼をリポジトリ内で実装可能な計画へ変えます。どちらの考え方が自分のワークフローに合うかを比較します。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nLinear",
    lead: "Linear は、チームがプロダクトの計画と開発を進めるための共有基盤です。AI4Kanban は、コーディングエージェントの計画環境をリポジトリ内に置きます。一方は組織をつなぎ、もう一方は計画をコードから切り離さず、粗い依頼を実装可能な仕事へ整えます。",
    ours: {
      name: "AI4Kanban",
      body: "リポジトリ内の Markdown ボード。エージェントによる要件整理に特化しています。",
    },
    theirs: {
      name: "Linear",
      body: "人とエージェントがプロダクト開発を調整する、ホスト型ワークスペースです。",
    },
    oursDiagramAlt:
      "曖昧なメモをAI4Kanbanに渡すと、受け入れ条件まで書かれた仕様になり、コードの隣に保存されます。",
    theirsDiagramAlt:
      "チームの仕事をLinearに集めると、誰が何を持ち、どこまで進んでいるかが分かる一つの共有リストになります。",
    oursDiagramTop: "入るのは曖昧なアイデア",
    oursDiagramBottom: "出るのは着手できる仕様、置き場所はコードの隣",
    theirsDiagramTop: "入るのはチーム全体の仕事",
    theirsDiagramBottom: "出るのは共有リスト：担当と進み具合が分かる",
  },
  summary: {
    heading: {
      eyebrow: "短く言うと",
      title: "どちらもエージェントに対応。ただし、扱う仕事の階層が違います",
    },
    lead: "Linear は総合的なプロダクト開発基盤です。エージェントはワークスペースの文脈を利用でき、課題をコーディングエージェントへ委任できます。外部エージェントは MCP で接続でき、Coding Sessions では Claude Code や Codex を実行して、レビュー用の pull request を返せます。",
    panel:
      "AI4Kanban が担うのは、より明確に絞られた役割です。**リポジトリ内でコーディングエージェントと計画を固める**ことに特化し、不完全な依頼を質問、判断、依存関係、実装可能なカードへ整理します。計画と履歴はレビュー可能な Markdown としてコードの隣に残ります。",
  },
  comparison: {
    heading: { eyebrow: "正面比較", title: "AI4Kanban vs. Linear" },
    lead: "{check} は、その要件により適した側を示します。**横線**はワークフロー次第です。Linear は**チーム連携、ポートフォリオ計画、外部サービスとの統合、管理されたエージェント実行**に強く、AI4Kanban は**リポジトリ内での要件整理、可搬性、git に残る計画履歴**に強みがあります。",
    ourLabel: "AI4Kanban",
    theirLabel: "Linear",
    rows: {
      bestFit: {
        dimension: "最も向く人",
        kanban: "コーディングエージェントを通じて計画と実装を進める個人開発者や小規模チーム。",
        linear: "人、プロジェクト、エージェントを横断的に調整するプロダクト・開発組織。",
      },
      sourceOfTruth: {
        dimension: "計画の保存場所",
        kanban: "プロジェクトリポジトリ内の Markdown。コードと一緒にバージョン管理されます。",
        linear: "アプリ、API、MCP server からアクセスする共有の Linear ワークスペース。",
      },
      refinement: {
        dimension: "粗いアイデアから着手可能なタスクへ",
        kanban: "ガイド付きの整理プロセスで依頼を調査し、判断を記録し、実装できる具体性に達するまでカードを詰めます。",
        linear: "Linear Agent は課題の作成、要約、更新、スコープ整理を支援します。実装結果は、課題の記述品質にも左右されます。",
      },
      agentModel: {
        dimension: "エージェントの仕組み",
        kanban: "選択したコーディング環境がボードを読み書きします。現在は Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness に対応しています。",
        linear: "Linear Agent、インストール可能な app user、課題の委任、エージェント向けガイド、ホスト型 MCP server を提供します。",
      },
      execution: {
        dimension: "実装とレビュー",
        kanban: "選択した環境が準備済みのカードを実装し、レビューは既存の git ワークフローで行います。",
        linear: "Coding Sessions がクラウドで Claude Code や Codex を実行し、pull request を作成して、diff とレビューを Linear に取り込みます。",
      },
      collaboration: {
        dimension: "人どうしの共同作業",
        kanban: "小規模チームの git ベースの共同作業に向きますが、多人数での同時編集を前提とした設計ではありません。",
        linear: "担当者、コメント、非公開チーム、ゲスト、通知、権限管理を備えたリアルタイムのワークスペース。",
      },
      portfolio: {
        dimension: "計画できる範囲",
        kanban: "カード、依存関係、優先度、ROI、release、モジュール単位の計画履歴。",
        linear: "課題、プロジェクト、サイクル、イニシアチブ、マイルストーン、タイムライン、トリアージ、分析、顧客要望。",
      },
      setup: {
        dimension: "利用開始",
        kanban: "1 つの prompt でリポジトリに導入できます。ボード自体にアカウント、データベース、ホスト型サービスは不要です。",
        linear: "ワークスペースを作成し、メンバーを招待したうえで、必要な統合とエージェント権限を設定します。",
      },
      portability: {
        dimension: "持ち運びやすさ",
        kanban: "リポジトリを clone すれば、ボード、判断、履歴も一緒に取得できます。計画画面はオフラインでも利用できます。",
        linear: "データは Linear に保存されます。管理者は課題データを CSV で出力するか、API で取得できます。",
      },
      pricing: {
        dimension: "価格",
        kanban: "Apache-2.0 のオープンソースです。費用が発生するのは、選択したコーディングエージェントのツールだけです。",
        linear: "Free は 250 件の課題と 2 チームまで。年払いの場合、Basic は 1 ユーザー月額 10 ドル、Business は 16 ドルです。Coding Sessions では AI credits も消費します。",
      },
    },
  },
  model: {
    heading: {
      eyebrow: "本質的な違い",
      title: "リポジトリの文脈 vs. 組織の文脈",
    },
    lead: "重要なのは、エージェントに対応しているかどうかではありません。**計画の文脈をどこに置くべきか**、つまりコードとともにリポジトリへ置くのか、組織の共有ワークスペースへ置くのかです。",
    ours: {
      name: "AI4Kanban — 計画をコードのそばに置く",
      is: "計画を変更する前に、エージェントはコード、過去の判断、採用されなかった案、完了した作業を確認します。未解決事項が解消されるか、あなたの判断事項として明確になるまで依頼を具体化します。",
      isnt: "組織全体を対象とする共同作業スイートではありません。強みは、コードと一緒に commit され、どの clone からでも参照できる、持続的な計画の文脈です。",
    },
    theirs: {
      name: "Linear — 組織のための統一ワークスペース",
      is: "課題はチームに属し、プロジェクトは複数チームにまたがれます。サイクル、イニシアチブ、タイムライン、文書、コメント、顧客要望が共有の文脈を作り、エージェントも同じ権限管理のもとで動きます。",
      isnt: "個人開発者の主な課題が、粗い依頼を信頼できる実装計画へ変えることなら、ここまでの広さは不要な場合があります。",
    },
    note: "併用はできますが、タスクの状態はどちらか一方を正とする必要があります。個人開発者が同じ仕事を 2 か所で管理すると、得られる価値以上に手間が増えがちです。",
  },
  wins: {
    heading: { eyebrow: "トレードオフ", title: "それぞれが勝つところ" },
    lead: "Linear は幅広い計画機能、チーム連携、管理された実行環境を提供します。AI4Kanban はエージェント主導の計画をコードのそばに置き、確認しやすく、セッションをまたいでも残る形にします。",
    oursHeading: "AI4Kanban",
    theirsHeading: "Linear",
    ours: {
      roughToReady: {
        title: "粗い依頼を実装可能な仕事へ整える",
        body: "エージェントは調査、質問、判断の記録、作業の分割を行ってから、カードを実装計画として扱います。",
      },
      repoMemory: {
        title: "計画の履歴をコードの隣に残す",
        body: "判断、採用されなかった案、依存関係、カードは、次のエージェントセッションが読めるプレーンな diff 可能ファイルです。",
      },
      anyHarness: {
        title: "選んだコーディング環境で使える",
        body: "ボードは独自のエージェントランタイムに縛られません。現在は Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness に対応し、オープンなファイル形式は他の環境でも利用できます。",
      },
      noSaas: {
        title: "別のプロジェクト管理サービスが不要",
        body: "ボード自体に、管理すべきワークスペース、ライセンス、認証、データベース、同期層はありません。リポジトリの一部として扱えます。",
      },
    },
    theirs: {
      teamSystem: {
        title: "チームでの共同作業に最適化",
        body: "同時編集、明確な担当、権限管理、コメント、非公開チーム、ゲスト、通知、完成度の高い画面を標準で備えています。",
      },
      agentPlatform: {
        title: "管理されたエージェント実行を提供",
        body: "Linear Agent、app user、MCP、課題委任、Coding Sessions、diff、pull request レビューが同じワークスペースの文脈を共有します。",
      },
      planningDepth: {
        title: "大規模なプロダクト計画に対応",
        body: "プロジェクト、サイクル、イニシアチブ、マイルストーン、タイムライン、トリアージ、分析、顧客要望によって、単一リポジトリを超えた計画に対応します。",
      },
      integrations: {
        title: "組織内の仕事を横断的につなぐ",
        body: "GitHub、GitLab、Slack、Teams、サポートツール、API、webhook、ワークスペース検索によって、計画を組織内の他の仕事と結び付けます。",
      },
    },
  },
  decision: {
    heading: { eyebrow: "選択", title: "自分のワークフローに合うのはどちら？" },
    oursHeading: "AI4Kanban が向いている場合",
    theirsHeading: "Linear が向いている場合",
    ours: [
      "個人開発者や小規模チームが、コーディングエージェントを通じて計画と実装を進める。",
      "依頼が不完全なことが多く、信頼できる計画へ落とし込む工程がボトルネックになっている。",
      "タスク、判断、計画履歴をコードと一緒にバージョン管理したい。",
      "プロジェクト管理ツールのランタイムではなく、自分でコーディング環境を選びたい。",
    ],
    theirs: [
      "多くの人が同時に仕事を作成、割り当て、議論、更新する。",
      "計画にサイクル、イニシアチブ、タイムライン、トリアージ、顧客要望、レポートが欠かせない。",
      "管理されたクラウドコーディングセッションと diff レビューをプロジェクトワークスペース内で使いたい。",
      "組織全体の統合、権限、セキュリティ制御、サポートが必要。",
    ],
    verdict:
      "組織全体で人、プロジェクト、エージェントを調整することが難しいなら Linear が適しています。不完全な依頼を確実な仕事へ変えるため、コーディングエージェントに十分で持続的な文脈を与えることが難しいなら AI4Kanban が適しています。判断基準は機能の多さではなく、計画プロセスをどこに置くべきかです。",
    note: "AI4Kanban は Linear の機能を一つずつ置き換える製品ではなく、異なる計画モデルを提供します。",
  },
};

export default ja;
