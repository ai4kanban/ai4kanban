// 日本語 — the GitHub Issues comparison, mirroring `en.ts` key for key.
// Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const ja: VsGithubCopy = {
  meta: {
    title:
      "AI4KanbanとGitHub Issuesの比較：エージェント向けローカルボードとチーム向け課題管理",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "AI4KanbanとGitHub Issuesを、データの保存先、エージェントの処理コスト、チーム連携、履歴、外部参加の観点から比較します。",
    social:
      "AI4Kanbanは開発者とエージェントのローカル作業に、GitHub Issuesはチームやコミュニティの連携に適しています。",
  },
  hero: {
    badge: "比較",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4KanbanとGitHub Issuesは、異なる連携の課題を解決するツールです。AI4Kanbanはリポジトリ内にボードを置き、開発者とエージェントが直接タスクを管理できるようにします。GitHub Issuesは、チームやコミュニティが作業を共有し、議論するためのサービスです。日々の作業でローカルの効率と複数人の連携のどちらを重視するかによって、適したツールが変わります。",
    ours: {
      name: "AI4Kanban",
      body: "コードと一緒に保存するMarkdownボードで、エージェントが直接読み書きできます。",
    },
    theirs: {
      name: "GitHub Issues",
      body: "チームやコミュニティでタスク、議論、進捗を共有するためのホスティング型サービスです。",
    },
    oursDiagramAlt:
      "コードもボードも同じリポジトリのフォルダなので、エージェントはコードを読む場所でそのまま作業を更新できます。",
    theirsDiagramAlt:
      "手元のファイルは一つのウィンドウ、Issueは別のウィンドウで開くgithub.comのページなので、両者を合わせるのはあなたの仕事です。",
    oursDiagramTop: "ボードはリポジトリの中",
    oursDiagramBottom: "エージェントがコードを読み、そのままボードを更新",
    theirsDiagramTop: "課題はサーバー上、コードは手元",
    theirsDiagramBottom: "チームには最適 — 同期はあなたの仕事",
  },
  comparison: {
    heading: {
      eyebrow: "主な違い",
      title: "ローカル作業領域か、共有サービスか",
    },
    lead: "最も大きな違いは、ボードをどこに置くかです。保存先の違いによって、エージェントの処理コスト、同時作業の調整、残す履歴、外部からの参加方法が変わります。",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "作業データの保存先",
        kanban:
          "ボードはMarkdownファイルとしてリポジトリに保存されます。エージェントが直接読み書きでき、オフラインでも利用できます。",
        issues:
          "タスクはGitHubにホストされます。エージェントがアクセスするには、ネットワーク接続と `gh` CLI またはMCPが必要です。",
      },
      tokenCost: {
        dimension: "エージェントの処理コスト",
        kanban:
          "ローカル検索なら必要なテキストだけを返せるため、コンテキスト消費と応答時間を抑えられます。",
        issues:
          "リモート操作ではツール定義、JSONレスポンス、ネットワーク通信も処理するため、通常は多くのトークンを消費します。",
      },
      concurrency: {
        dimension: "複数人での同時作業",
        kanban:
          "変更を調整するサーバーがないため、2人が同じタスク番号を作成して競合する可能性があります。",
        issues:
          "サーバーがIDを割り当てて更新を同期するため、チームで安全に同時作業できます。",
      },
      history: {
        dimension: "保持する履歴",
        kanban:
          "今後の作業に影響する判断と結果を残し、古い詳細は要約します。",
        issues:
          "コメント、編集、相互参照、アクティビティを含む完全な履歴を保持します。",
      },
      contributors: {
        dimension: "外部からの参加",
        kanban:
          "参加者にはリポジトリへのアクセス権が必要で、Markdownファイルを変更して作業に参加します。",
        issues:
          "公開リポジトリなら、誰でもコードを変更せずにIssueの作成、コメント、リアクションができます。",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "選び方",
      title: "どちらが自分の作業に合うか",
    },
    oursHeading: "AI4Kanbanが適している場合",
    theirsHeading: "GitHub Issuesが適している場合",
    ours: [
      "1人で開発するか、決まった1〜2人と共同作業している。",
      "主にターミナル上のエージェントを使ってタスクを進めている。",
      "完全な操作履歴よりも、素早い実行と必要十分な判断情報を重視している。",
      "ボードをGitに保存し、オフラインでも使えて、リポジトリと一緒に移動できるようにしたい。",
    ],
    theirs: [
      "複数人が同時にタスクを割り当て、更新する必要がある。",
      "プロジェクトを公開で進めており、作業プロセスの透明性が重要である。",
      "pull request、CI、Projects、マイルストーン、自動化を活用している。",
      "外部コントリビューターにIssueの作成や議論への参加を促したい。",
    ],
    verdict:
      "2つのツールは、単純に置き換えられる関係ではありません。GitHub Issuesは**チームやコミュニティで共有するタスク管理システム**であり、AI4Kanbanは**エージェントが直接操作できるローカルボード**です。チームの調整がボトルネックならGitHub Issuesを、エージェントと効率よく作業を進めたいならAI4Kanbanを選んでください。",
    note: "両方を併用することもできます。GitHub Issuesはチームや外部向けに、AI4Kanbanはエージェントのローカル作業領域として使えます。",
  },
};

export default ja;
