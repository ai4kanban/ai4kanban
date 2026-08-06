// 日本語 — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const ja: VsGithubCopy = {
  meta: {
    title: "AI4Kanban vs. GitHub Issues——仕事が違えば、最適なツールも違う",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "AI4Kanban のファイルベースのボードと GitHub Issues を実務の観点から比較します。ローカルの Markdown とリモート API、トークン消費量、エージェントからの扱いやすさ、チームでの共同作業、それぞれに適した利用場面を取り上げます。",
    social:
      "AI4Kanban は GitHub Issues の代替を目指すものではありません。速度、トークン、エージェント、チームの観点から両者を比較します。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban は GitHub Issues の代替を目指すものではありません。両者が解消するボトルネックは異なります。GitHub Issues は、チームで長期的に共有でき、公開での共同作業にも対応する記録基盤です。一方、AI4Kanban はエージェントが直接操作できる、非公開かつローカルな作業スペースです。どちらを選ぶべきかは、実際に何が作業を遅らせているかで決まります。",
    ours: {
      name: "AI4Kanban",
      body: "リポジトリに保存するプレーンな Markdown。エージェントがすばやく読み書きできるローカルボードです。",
    },
    theirs: {
      name: "GitHub Issues",
      body: "API 経由で利用するホスト型データベース。チームやコミュニティで共有する記録基盤として設計されています。",
    },
  },
  summary: {
    heading: {
      eyebrow: "要点",
      title: "GitHub Issues だけでは不十分なのか",
    },
    lead: "GitHub Issues だけでも実現できます。AI4Kanban で行えることのほとんどは、GitHub Issues に `gh` CLI または GitHub MCP サーバーを組み合わせれば実行できます。重要な違いは、そのために必要な運用コストです。",
    panel:
      "エージェントが GitHub Issues 経由で同じ処理を行う場合、一般に**扱うデータ量**と**ツール呼び出し**が増え、**トークン消費量**も**ネットワーク遅延**も大きくなります。また、リモートツールを使わせるために、**より明示的な指示**が必要になることもあります。AI4Kanban には GitHub ほど幅広い共同作業機能や連携機能はありません。その代わり、ローカル環境での直接的で高速なアクセスを重視しています。主にエージェントと作業する個人開発者にとっては、この速さのほうが価値を持つ場合があります。",
  },
  comparison: {
    heading: { eyebrow: "項目別比較", title: "AI4Kanban vs. GitHub Issues" },
    lead: "以下の表では、14 の観点から両者を比較します。{check} は明確な優位、**ダッシュ**は用途に応じたトレードオフを示します。AI4Kanban は**速度とローカルアクセス**に強く、GitHub Issues は**規模の拡大や複数人での共同作業**に適しています。",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "保存方法",
        kanban:
          "リポジトリ内のプレーンな Markdown ファイルを Git でバージョン管理します。",
        issues: "データは GitHub に保存され、画面や API からアクセスします。",
      },
      offline: {
        dimension: "オフライン利用",
        kanban: "ボードがディスク上にあるため、そのまま利用できます。",
        issues:
          "Issue のデータを利用するには、ネットワーク接続と認証が必要です。",
      },
      agentReads: {
        dimension: "エージェントからの読み取り",
        kanban:
          "Read、Grep、Glob などのファイルシステムツールで直接読み取ります。",
        issues: "`gh` CLI または MCP のリモート呼び出しを使用します。",
      },
      tokenCost: {
        dimension: "1 回の検索に必要なトークン",
        kanban: "通常は少量です。`grep` なら一致した内容だけを返せます。",
        issues:
          "通常は多くなります。エージェントがツール定義と JSON レスポンスを処理するためです。",
      },
      latency: {
        dimension: "レイテンシ",
        kanban: "ローカルディスクへのアクセスなので、ほぼ即時です。",
        issues: "リクエストのたびにネットワークからの応答を待ちます。",
      },
      setup: {
        dimension: "導入",
        kanban:
          "1 つのプロンプトでインストールでき、中核はスキルファイルと小さなスクリプトです。",
        issues: "GitHub アカウント、認証、CLI または MCP の設定が必要です。",
      },
      lockIn: {
        dimension: "プラットフォームへの依存",
        kanban:
          "ホスト型プラットフォームに依存しません。ボードはプレーンテキストで、リポジトリとともに移動します。",
        issues:
          "エクスポートまたは移行しない限り、データは GitHub に残ります。",
      },
      metadata: {
        dimension: "メタデータ",
        kanban: "優先度や工数など、必要な項目に意図的に絞っています。",
        issues:
          "ラベル、マイルストーン、担当者、プロジェクトなどの豊富な項目を備えています。",
      },
      concurrency: {
        dimension: "同時利用",
        kanban:
          "排他制御がないため、2 人が #1894 のような同じタスク番号を作る可能性があります。",
        issues:
          "サーバーが ID を割り当てるため、複数人でも安全に同時利用できます。",
      },
      history: {
        dimension: "意思決定の履歴",
        kanban:
          "案を見送った理由やリリース済みの内容など、今後の作業に影響する判断を残します。",
        issues: "コメント、編集、アクティビティの履歴をすべて保持します。",
      },
      closing: {
        dimension: "作業の完了処理",
        kanban: "すべての項目が完了したらカードをアーカイブします。",
        issues:
          "関連する pull request やワークフローから Issue を自動でクローズできます。",
      },
      search: {
        dimension: "大規模な検索",
        kanban:
          "小さなボードでは `grep` が高速ですが、規模が大きくなると扱いにくくなります。",
        issues:
          "インデックス付き全文検索と保存済みフィルターは、大量のデータに対応しています。",
      },
      contributors: {
        dimension: "外部コントリビューター",
        kanban:
          "Markdown をコミットすれば参加できますが、気軽にタスクを登録できる画面はありません。",
        issues:
          "公開リポジトリでは、コードを送らなくても Issue の作成、コメント、リアクションができます。",
      },
      transparency: {
        dimension: "透明性",
        kanban:
          "すべてのカードがリポジトリに残り、メモリーハブだけが重要な情報に絞り込まれます。",
        issues:
          "Issue は共有しやすく、OSS コミュニティで一般的な公開ワークフローに適しています。",
      },
    },
  },
  wins: {
    heading: { eyebrow: "トレードオフ", title: "それぞれの強み" },
    lead: "どちらか一方があらゆる場面で優れているわけではありません。AI4Kanban は、開発者とエージェントが作業をすばやく前に進めることを重視しています。GitHub Issues は、多くの人やシステムの情報を同期させることを重視しています。",
    oursHeading: "AI4Kanban",
    theirsHeading: "GitHub Issues",
    ours: {
      tokenLight: {
        title: "効率的なローカルアクセス",
        body: "MCP の呼び出しもネットワーク接続も必要ありません。エージェントはリモート API をページ単位で取得する代わりに、ローカルの Markdown を検索します。これによりトークン消費量とレイテンシを抑え、作業途中の認証切れによる中断も避けられます。",
      },
      agentsUseIt: {
        title: "エージェントの普段の操作に合う",
        body: "エージェントは、リモートの Issue トラッカーより先にファイルシステムツールを使う傾向があります。Markdown のボードは、エージェントが使い慣れた環境に最初から存在します。必要な指示が少なくなり、タスクの状態を誤って推測する余地も減ります。",
      },
      offline: {
        title: "持ち運べて、オフラインでも使える",
        body: "ボードは Git で管理するプレーンなファイルの集まりです。ネットワークに接続できないときや GitHub が利用できないときも作業を続けられます。SaaS や特定のプラットフォームに依存せず、リポジトリをクローンすればボード全体も一緒に取得できます。",
      },
      memory: {
        title: "次の判断につながる記憶",
        body: "AI4Kanban は、今後の作業を導く情報を残します。案を見送った理由、すでにリリースした内容、現在地から目標までに残っていることです。エージェントは、完了済みまたは破棄済みの作業を繰り返さず、次に進むための提案を行いやすくなります。",
      },
    },
    theirs: {
      teams: {
        title: "チームの調整を前提とした設計",
        body: "サーバーが割り当てる ID、安全な同時更新、担当者の設定により、複数人のワークフローに対応できます。AI4Kanban には調整用のデータベースがないため、2 人が別々にタスク #1894 を作成して競合する可能性があります。",
      },
      transparency: {
        title: "幅広いコミュニティが参加しやすい",
        body: "Issue は公開し、URL で共有できます。外部のコントリビューターも問題の報告、コメント、リアクションができます。ローカルでの速さよりも開かれた参加を重視するなら、GitHub Issues が適しています。",
      },
      fullContext: {
        title: "操作履歴をすべて保持",
        body: "AI4Kanban は古い情報を意図的に圧縮し、アーカイブしたカードを 1 行の要約にします。GitHub Issues はコメント、編集、相互参照を Issue の履歴として保持します。",
      },
      integration: {
        title: "成熟した連携機能",
        body: "GitHub Issues は、pull request による自動クローズ、コミットへのリンク、Projects、ラベル、マイルストーン、インデックス付き検索、豊富なサードパーティ製ツールと連携できます。",
      },
    },
  },
  ergonomics: {
    heading: {
      eyebrow: "重要な違い",
      title: "エージェントがファイルを扱いやすい理由",
    },
    lead: "実際の違いは、エージェントに作業を任せると明確になります。**「優先度が高い未完了タスクを探して」**と依頼した場合、2 つのツールでは処理の流れが大きく異なります。",
    issues: {
      title: "あなた › エージェント + GitHub MCP",
      chip: "複数回の呼び出し",
      lines: [
        "優先度が高い未クローズの Issue を探して",
        "list_issues(state:open, labels:high)",
        "4.2 KB の JSON——18 件の Issue とすべてのフィールド",
        "ページ分割、絞り込み、要約……",
        "認証の更新 · レート制限の処理 · 再試行",
      ],
      footer: "複数回のツール呼び出し · 数 KB の JSON · 毎回ネットワーク接続",
    },
    kanban: {
      title: "あなた › エージェント + AI4Kanban",
      chip: "1 回の呼び出し",
      lines: [
        "優先度が高い未完了タスクを探して",
        'grep -rl "Priority: high" docs/kanban/todo',
        "3 つのファイルパス",
        "完了——呼び出しは 1 回、ネットワーク接続なし",
      ],
      footer: "1 回のツール呼び出し · 数個のパス · すべてローカル",
    },
    note: "こうした追加処理は日々積み重なります。次に行う作業を尋ねるとき、タスクをアーカイブするとき、ボードを確認するとき、その情報源が GitHub Issues なら、その都度リモート操作が発生します。両方を選べる場合、明示的にリモートの Issue トラッカーを使うよう指示しない限り、モデルは使い慣れた手軽なファイルシステムツールを選ぶ傾向があります。",
  },
  decision: {
    heading: { eyebrow: "選び方", title: "どちらを使うべきか" },
    oursHeading: "AI4Kanban が適している場合",
    theirsHeading: "GitHub Issues が適している場合",
    ours: [
      "1 人で作業するか、信頼できる 1〜2 人と共同作業している。",
      "主にターミナル上のエージェントを通じて作業を進めている。",
      "すべての操作履歴を残すことより、作業を前に進め、判断を簡潔に記録することを重視する。",
      "ボードを Git に保存し、オフラインでも利用できる持ち運びやすい形にしたい。",
    ],
    theirs: [
      "公開で開発しており、作業プロセスの透明性を重視している。",
      "複数人が同時にバックログを更新する必要がある。",
      "pull request や CI との連携、Projects、マイルストーンを活用している。",
      "外部コントリビューターに Issue を作成して議論へ参加してほしい。",
    ],
    verdict:
      "AI4Kanban と GitHub Issues は、直接置き換えられる関係ではありません。GitHub Issues は**チームで共有する記録基盤**であり、AI4Kanban は**エージェントが直接操作できる高速なローカルボード**です。ボトルネックが人どうしの調整にあるなら GitHub Issues を、開発者とエージェントが作業を進める効率にあるなら AI4Kanban を選んでください。",
    note: "個人開発者の多くは、GitHub Issues を公開の Issue トラッカー、AI4Kanban をエージェントが日常的に使う非公開の作業スペースとして、両方を併用しています。",
  },
};

export default ja;
