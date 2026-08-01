// 日本語 — mirrors `en.ts` key for key. See that file for the inline markup
// rules (`code`, **bold**, *italic*, \n).
//
// Product names (AI4Kanban, Claude Code, GitHub Issues, Hermes Agent Kanban,
// Vibe Kanban), file names, track names and shell commands stay as they are.
import type { SiteCopy } from "./types";

const ja: SiteCopy = {
  shared: {
    nav: {
      install: "インストール",
      usage: "使い方",
      boardUi: "ボード UI",
      features: "機能",
      recipes: "レシピ",
      compare: "比較",
      compareMore: "比較ページは順次追加予定…",
      github: "GitHub ↗",
    },
    footer: {
      license: "Apache License 2.0",
      origin: "もとは次のプロダクト向けに作ったスキルです：",
    },
    code: {
      copy: "コピー",
      copied: "コピーしました",
      copyAria: "クリップボードにコピー",
      copiedAria: "コピーしました",
    },
    language: { label: "言語" },
    vs: "vs",
    bottomLine: "結論",
    cta: { install: "ai4kanban をインストール", github: "GitHub で見る ↗" },
  },

  home: {
    meta: {
      title: "AI4Kanban — あなたと一緒に育つ AI プロジェクト管理",
      description:
        "Claude Code のための AI プロジェクト管理。スキルとローカルのボード UI で構成されます。ぼんやりしたアイデアを渡すと、エージェントが自律的に分解し、自分で判断できることは判断し、残りをあなたと明確にしていきます。実体は git のなかのただの Markdown です。",
      social:
        "ぼんやりしたアイデアを渡してください。エージェントがそれを自律的に分解し、自分で判断できることは自分で判断し、残りをあなたに確認します。そして細部まで着手できる明確さになるまで、バックグラウンドで推し進めます。",
    },
    hero: {
      badge: "Claude Code のスキル + ローカルボード UI",
      title: "あなたと一緒に育つ\nAI プロジェクト管理。",
      lead: "ぼんやりしたアイデアを渡してください。エージェントがそれを自律的に分解し、自分で判断できることは自分で判断し、残りをあなたに確認します。そして細部まで着手できる明確さになるまで、バックグラウンドで推し進めます。ボードの実体は `docs/kanban/` にあるただの Markdown。git で管理され、データベースも MCP も必要ありません。",
      ctaInstall: "プロンプト 1 つでインストール",
      ctaGithub: "GitHub で見る",
    },
    quickview: {
      caption: "ターミナルに描画したボード。git にあるファイルそのものです。",
      taskView: "タスク名",
      fileView: "ファイルパス",
      frontAria: "{view}ビュー（前面）",
      flipAria: "{view}ビューに切り替え",
    },
    features: {
      breakDown: {
        title: "自律的な分解",
        body: "エージェントがアイデアを読み、サブタスクに切り分けます。紛れ込んでいた無関係な要望は、独立したタスクとして取り出されます。",
      },
      clarify: {
        title: "ループでの明確化",
        body: "エージェントはまずそのアイデアを疑うところから始めます。記憶と常識で決められることは自分で決め、残りはあなたに回します。質問が尽きるまでループし続けます。",
      },
      alwaysOn: {
        title: "24 時間稼働",
        body: "分解と問い直しは、そのアイデアが明確な仕様になるまで裏で走り続けます。",
      },
      traceable: {
        title: "判断の追跡可能性",
        body: "その仕様がどう形になっていったかを、いつでも一歩ずつ見返せます。",
      },
      proposes: {
        title: "自発的なタスク提案",
        body: "エージェントが各モジュールの記憶から機能案を持ち出してきます。1 つ却下すればそれが記録され、同じ種類の案は二度と出てきません。",
      },
      selfEvolving: {
        title: "自己進化",
        body: "あなたが口を出すたび、その判断が記録され、エージェントのその後の決定を導きます。記憶はプロジェクトのモジュール単位で整理されます。",
      },
      orders: {
        title: "依存関係と優先順位",
        body: "ただ分解するだけではありません。依存関係を洗い出し、効果と手間を天秤にかけて、正しい順番で進むようにします。",
      },
      lifecycle: {
        title: "デリバリまでの一貫管理",
        body: "仕様が固まっても仕事は終わりません。提案、明確化、実装、アーカイブと、タスクの一生をまるごと回すので、ボードには常にプロジェクトの実態が映ります。",
      },
    },
    featuresNote:
      "AI4Kanban は小さなチーム向けに作られています。いまのコーディングエージェントは、明確な仕様さえ渡せば動くコードにしてくれます。けれどぼんやりしたアイデアを渡せば、間違った前提の上に間違ったものを作ってしまいます。AI4Kanban はあなたが過去に下した判断を覚えていて、それを手がかりに、同じぼんやりしたアイデアを着手できるだけ具体的な仕様に変えます。",
    install: {
      heading: { eyebrow: "セットアップ", title: "プロンプト 1 つでインストール" },
      lead: "プロジェクトのルートで、Claude Code（あるいはシェルコマンドを実行できる任意のエージェント）にこう伝えてください：",
      note: "エージェントはまずコードベースを読み、そのうえで `npx ai4kanban install` というコマンドを 1 つ実行します。これでスキルが入り、ボードができます。設定を埋め、プロジェクトのゴールをあなたに尋ね——セットアップが尋ねるのはこれだけです——そこから最初の意思決定を固め、最初の 10 個のタスクを作るところまでエージェントが進めます。あとで更新するときも同じくコマンド 1 つ、`npx ai4kanban update` です。",
    },
    board: {
      heading: { eyebrow: "使い方", title: "Claude Code のなかで AI4Kanban を使う" },
      lead: "入れてしまえば、あとは普通の言葉で動かせます：",
      terminal: "you › claude",
      rows: {
        whatsNext: {
          say: '"/kanban 次は何をやる？"',
          does: "ボードとあなたの情報源を読み、新しいタスクを 3 つ提案する",
        },
        addTask: {
          say: '"/kanban タスクを追加：…"',
          does: "その案を吟味し、カードを書き、索引に加える",
        },
        refine: {
          say: '"/kanban refine #4"',
          does: "カード #4 を見直し、具体化に向けて 1 段階進める",
        },
        review: {
          say: '"/kanban ボードを見直して"',
          does: "各カードの明確さ・重複・実は完了済みかを点検する",
        },
        done: {
          say: '"/kanban #4 は完了"',
          does: "アーカイブに圧縮して、カードを削除する",
        },
        badIdea: {
          say: '"/kanban #4 はダメな案だった"',
          does: "理由を rejected.md に記録し、二度と提案しないようにする",
        },
      },
    },
    ui: {
      heading: {
        eyebrow: "ボード UI",
        title: "ブラウザで開けるローカルのボード",
      },
      lead: "聞くより見たいときは？ コマンド 1 つで、同じ Markdown ファイルの上にボードが開きます。IDE のツリーでファイルを探さなくてもタスクを丸ごと読めますし、同じプロンプトを打ち直さずクリックひとつで動かせます。",
      optional:
        "これは任意です。インストール時に余計なものは入りません。使いたくなったら Claude に頼むだけ：",
      started:
        "Claude がビルド済みのサーバーを立ち上げてくれます。localhost のみ、コンパイルも不要です。",
      actionsLead:
        "各カードのボタンが、その操作をエージェントに引き渡します。チャットは不要です：",
      actions: {
        implement: { label: "実装", body: "このカードを Claude に渡して作らせる" },
        edit: { label: "編集", body: "カードを直す。実行はしない" },
        refine: { label: "詳細化", body: "詰まったカードを 1 歩進める" },
        resolve: { label: "回答", body: "カードに残っている質問に答える" },
        archive: { label: "アーカイブ", body: "終わったカードをしまう" },
        reject: { label: "却下", body: "カードを捨てて理由を残す" },
      },
      shots: {
        board: {
          label: "ボード表示",
          alt: "ai4kanban のローカル Web ボード。Blockers、UI、Skill、Docs、Distribution の各列に Markdown カードが並び、#ID、優先度と ROI のバッジ、サブタスクの進捗バーが付いている。",
        },
        detail: {
          label: "カード詳細",
          alt: "ローカルボードのタスク詳細ページ。タイトル、実装 / レビュー / 編集 / 却下 の操作、トラック・優先度・ROI・TODO・ブロッカーのメタ情報行、そしてカード本文全体。",
        },
      },
      frontAria: "{view}（前面）",
      flipAria: "{view}に切り替え",
    },
    presets: {
      heading: { eyebrow: "プリセット", title: "インディーハッカー向けプリセット" },
      lead: "誰も見ていないところで一日中作り込んでしまうのは、ひとり開発の典型的な落とし穴です。このプリセットは時間を 3 つに割ります。ユーザーを見つける、需要を確かめる、作る。Claude が新しい作業を 1 つに偏らせず、3 つに散らし続けます。",
      tracks: {
        growth: {
          body: "ユーザーの前に出る。投稿、直接の声かけ、ローンチ。Claude が試す価値のある方法を提案し、下書きまで書きます。",
        },
        validation: {
          body: "深く作り込む前に、市場が本当に欲しがっているかを確かめる。正直な問いを投げ、試用を配り、結論を残す。",
        },
        building: {
          body: "MVP に留める。自分の仕事を増幅するとき、プロダクトを強くするとき、ユーザーがはっきり求めたときだけ作る。",
        },
      },
      note: "`indie-hacker` プリセットにはレビュー関門も付いています。堀（moat）テストと信頼テスト、さらに、作り始める前に Reddit や X へ投げて市場を検証する方法も入っています。インストール時に自分のトラックと配分に差し替えられます。",
    },
    advanced: {
      heading: {
        eyebrow: "機能",
        title: "フラットなリストではなく、Markdown でやるプロジェクト管理",
      },
      lead: "フラットな ToDo リストは、しょせんただのリストです。これはリストにできない 4 つのことをします。繰り返しの仕事、大きな仕事のサブタスク、やったことの記憶、そしてスループットの集計です。",
      recurring: {
        title: "繰り返しタスク",
        body: "一度やって終わり、では済まない仕事があります。そういう仕事は 1 枚ずつカードにして `docs/kanban/todo/recurring/` に置き（アーカイブされることのない仕事です）、Claude Code の `/loop` に、毎朝など好きな周期で回させましょう。",
        examples: {
          competitors: {
            label: "競合ウォッチ",
            body: "競合が何をリリースし、何を変えたかを見て、反応すべきものに印を付ける。",
          },
          listening: {
            label: "ソーシャルリスニング",
            body: "Reddit や Slack の新しい投稿を拾い、重要なものを浮かび上がらせる。",
          },
          boardReview: {
            label: "ボード点検",
            body: "バックログを一掃して、古い・重複・実は完了済みのカードを見つける。",
          },
        },
        ladderLead:
          "どの仕事にも同じ自動化レベルが要るわけではありません。カードはどの段にいても構いません。自分の手でやるものから、Claude に任せるもの、スクリプトが勝手に回すものまで：",
        ladder: {
          ask: { label: "あなたが手でやる" },
          agent: { label: "Claude が代わりにやる" },
          script: { label: "コマンドが回す。人は不要" },
        },
        ladderNote:
          "各仕事は、上げられるところまで上げましょう。手を動かし続けるものもあれば、勝手に回り出すものもあります。",
      },
      group: {
        title: "グループタスク",
        body: "着手できないほど大きなタスクは、たいていそのまま放置されます。1 枚のカードに収まらなくなったら、それは**グループタスク**になります。専用のフォルダに、追跡用の `root.md` と、部品ごとのカードが 1 枚ずつ。各部品は自分の ID を持ち、*Blocked by* と *Related* のリンクでつながるので、次に手を付けるものが常に分かります。",
      },
      memory: {
        title: "プロジェクトの記憶",
        body: "ボードを回すことはループです。毎回、Claude が 3 つの情報源から新しい作業を提案し、あなたが判断し、その結果を記憶ハブに畳み込みます。だから次の回は、やり直しではなく前回の続きから始まります。",
        hubLabel: "docs/kanban/：あなたの判断を溜めるハブ",
        files: {
          memory: {
            body: "各スキャンのメモが次に引き継がれ、情報源ごとに読み込み位置が残ります。だから変わった分だけを読み直します。",
          },
          archive: {
            body: "リリースした作業は 1 行に縮みます。提案の前にここを読むので、済んだことを再提案しません。",
          },
          rejected: {
            body: "あなたが却下した案は理由ごと残るので、二度と持ち出してきません。",
          },
          redesign: {
            body: "あなたが正した設計ミスはメモになり、次のカードが同じ間違った筋書きを繰り返しません。",
          },
        },
        loop: {
          aria: "ループ：提案し、あなたが判断し、学ぶ。そしてまた最初から。",
          centerCaption: "読み書き",
          stepLabel: "ステップ",
          stages: {
            propose: {
              label: "提案",
              body: "3 つの情報源から、まだリリースも棚上げもされていない作業を探します：",
            },
            decide: {
              label: "あなたが判断",
              body: "やる、飛ばす、あるいは筋書きを直す。Claude に一言返せば十分です。",
            },
            learn: {
              label: "学習",
              body: "結果とあなたのフィードバックをハブに畳み込み、次の回の出だしを鋭くします。",
            },
          },
          sources: {
            project: {
              label: "あなたのプロジェクト",
              body: "コードベース、ボード、ドキュメント、チームのチャット。すでにあるものをつなぎ、やる価値のある作業にします。",
            },
            outside: {
              label: "外の世界",
              body: "Reddit、Slack、あなたの CRM。繰り返しタスクが新しいシグナルを取り込み、見つけたものをボードに置きます。",
            },
            you: {
              label: "あなた",
              body: "あなた自身の方向づけとフィードバック。ボードに残るので、良い判断が失われることも、二度聞かれることもありません。",
            },
          },
        },
      },
      metrics: {
        title: "タスクの指標",
        body: "アーカイブされたカード 1 枚がリリース 1 単位。だからあなたの速度は、作業のすぐ隣、git のなかの数字にすぎません。外部ツールと同期させる必要はありません。",
        chart: {
          aria: "12 日間の日次スループット：タスクの合計・完了・作成・却下。",
          series: {
            total: "合計",
            completed: "完了",
            created: "作成",
            rejected: "却下",
          },
          caption:
            "`metrics.csv` は 1 日 1 行。完了、作成、却下、そしてその合計です。スクリプトが更新し続けるので、あなたが触ることはありません。",
        },
      },
    },
  },

  vsGithub: {
    meta: {
      title: "AI4Kanban vs. GitHub Issues — 別の仕事には別の道具を",
      socialTitle: "AI4Kanban vs. GitHub Issues",
      description:
        "ai4kanban のファイルベースのボードは GitHub Issues とどう違うか：ローカルの Markdown とリモート API、トークンコスト、エージェントにとっての扱いやすさ、チーム、そしてどちらをいつ使うか。",
      social:
        "代替品ではありません。別のボトルネックのための別の道具です。速度・トークン・エージェント・チームでの真っ向勝負。",
    },
    hero: {
      badge: "比較",
      title: "AI4Kanban vs.\nGitHub Issues",
      lead: "代替品ではありません。別のボトルネックのための別の道具です。GitHub Issues は共有され、消えず、公開された正式な記録。ai4kanban はプライベートでローカル、エージェントのために作られた作業面。いま実際に何が足を引っ張っているかで選んでください。",
      ours: {
        name: "AI4Kanban",
        body: "リポジトリのなかのただの Markdown。エージェントの手元にある高速なローカル下書き板。",
      },
      theirs: {
        name: "GitHub Issues",
        body: "API の向こうにあるデータベース。共有され公開された正式な記録。",
      },
    },
    summary: {
      heading: {
        eyebrow: "手短に言うと",
        title: "GitHub Issues でよくないですか？",
      },
      lead: "よいです。ai4kanban がやることのほとんどは、GitHub Issues に `gh` CLI か GitHub の MCP サーバーを足せばできます。違うのは、そこに至るコストです。",
      panel:
        "同じ作業を GitHub Issues でやると、**ノイズが増え**、**やり取りが増え**、**トークンが増え**、**レイテンシが上がり**、そもそもエージェントに使わせるための**プロンプトも重くなり**ます。ai4kanban は GitHub の広さを手放してローカルの速さを取ります。そしてエージェントを回してひとりで作る人にとって、足りないのはたいてい速さのほうです。",
    },
    comparison: {
      heading: { eyebrow: "真っ向比較", title: "AI4Kanban vs. GitHub Issues" },
      lead: "14 の観点。{check} は明確な勝ち、**ダッシュ**はどちらが劣るでもない意図的なトレードオフで、必要なもの次第です。ai4kanban は**速度とローカル性**の行を取り、GitHub Issues は**規模と協働**の行を取ります。",
      ourLabel: "AI4Kanban",
      theirLabel: "GitHub Issues",
      rows: {
        storage: {
          dimension: "保存先",
          kanban: "リポジトリのなかのただの Markdown、git の中に。",
          issues: "API の向こうにある GitHub のデータベース。",
        },
        offline: {
          dimension: "オフラインで使えるか",
          kanban: "使えます。ディスク上のファイルにすぎません。",
          issues: "使えません。ネットワークと認証が必要です。",
        },
        agentReads: {
          dimension: "エージェントの読み方",
          kanban: "ネイティブのファイル操作：Read、Grep、Glob。",
          issues: "gh CLI か MCP の往復。",
        },
        tokenCost: {
          dimension: "1 回の照会あたりのトークン",
          kanban: "少ない。grep は一致した行しか返しません。",
          issues: "多い。JSON のペイロードとツールスキーマ。",
        },
        latency: {
          dimension: "レイテンシ",
          kanban: "ローカルディスク、事実上ゼロ。",
          issues: "呼び出しごとにネットワーク往復。",
        },
        setup: {
          dimension: "導入",
          kanban: "プロンプト 1 つ：スキルファイル 1 枚と小さなスクリプト。",
          issues: "アカウント、認証トークン、MCP の設定。",
        },
        lockIn: {
          dimension: "ベンダーロックイン",
          kanban: "なし。ボードはリポジトリと一緒に移動します。",
          issues: "GitHub の上にしか存在しません。",
        },
        metadata: {
          dimension: "メタデータ",
          kanban: "意図的に最小限。優先度と工数、ひとりで作る人に必要なのはこれだけ。",
          issues: "ラベル、マイルストーン、担当者、プロジェクト。チームを束ねるために。",
        },
        concurrency: {
          dimension: "同時編集",
          kanban: "なし。2 人が同時に #1894 を作れば ID がぶつかります。",
          issues: "ID はサーバーが割り当てるので、チームでも安全。",
        },
        history: {
          dimension: "意思決定の履歴",
          kanban:
            "次のタスクを導く判断だけに刈り込まれます。なぜその案を却下したか、何をリリースしたか。だからエージェントは前へ提案し、済んだ作業や死んだ作業をやり直しません。",
          issues: "コメント履歴も編集履歴も丸ごと残り、何も落ちません。",
        },
        closing: {
          dimension: "作業の締め方",
          kanban: "項目にチェックが付いたらそのタスクをアーカイブします。",
          issues: "紐づいた PR と CI から issue を自動クローズします。",
        },
        search: {
          dimension: "規模が大きいときの検索",
          kanban: "grep。小さなボードなら速いが、育つと扱いづらい。",
          issues: "索引付きの全文検索と保存済みフィルタ。",
        },
        contributors: {
          dimension: "外部からの貢献",
          kanban:
            "できますが、Markdown にコミットする形だけ。気軽に起票する手段はありません。",
          issues: "誰でもコミットなしに起票・コメント・リアクションできます。",
        },
        transparency: {
          dimension: "透明性",
          kanban: "カードはすべてリポジトリ上に見えたまま。刈り込まれるのは記憶ハブだけです。",
          issues: "公開されリンクもできる、オープンソースの既定解。",
        },
      },
    },
    wins: {
      heading: { eyebrow: "トレードオフ", title: "それぞれが勝つところ" },
      lead: "どちらが一方的に優れているわけではありません。ai4kanban は 1 体のエージェントが速く動くことに、GitHub Issues は大勢が足並みを揃えることに最適化されています。",
      oursHeading: "AI4Kanban",
      theirsHeading: "GitHub Issues",
      ours: {
        tokenLight: {
          title: "トークンが軽く、待ち時間がない",
          body: "MCP もネットワークもなし。エージェントはリモート API をページングする代わりに、ローカルの Markdown を grep します。トークンは減り、レイテンシは下がり、作業の途中で認証を更新する必要もありません。",
        },
        agentsUseIt: {
          title: "エージェントが実際に使う",
          body: "エージェントは GitHub Issues を検索したがりません。既定ではファイルシステムのツールに手を伸ばします。Markdown のボードは、エージェントがすでに立っている場所で出迎えます。プロンプトは軽くなり、でっち上げのタスク状態も減ります。",
        },
        offline: {
          title: "オフラインで、あなたのもの",
          body: "git のなかのただのファイル。飛行機の中でも動きますし、GitHub が落ちても動きます。SaaS 依存もロックインもなし。リポジトリを clone すればボードごと付いてきます。",
        },
        memory: {
          title: "提案のためにチューニングされた記憶",
          body: "次のタスクを導く判断だけを記録します。なぜその案を却下したか、何をリリースしたか、ゴールまでの差はどれだけか。だからエージェントは前へ提案します。済んだ作業をやり直すことも、あなたが潰した案を蒸し返すこともありません。",
        },
      },
      theirs: {
        teams: {
          title: "チームのために作られている",
          body: "サーバー割り当ての ID、安全な同時編集、担当者。ai4kanban にはデータベースがないので、2 人が同時に #1894 を作って衝突しえます。",
        },
        transparency: {
          title: "透明性と到達範囲",
          body: "公開されリンクもでき、外部の貢献者が起票・コメント・リアクションできます。生の速さより開かれていることが大事なときの正しい住処です。",
        },
        fullContext: {
          title: "文脈まるごと、ずっと",
          body: "ai4kanban はわざと圧縮します。アーカイブしたカードは 1 行に縮みます。GitHub ではすべてのコメント、編集、相互リンクがそのまま残ります。",
        },
        integration: {
          title: "深い連携",
          body: "PR からの自動クローズ、コミットへのリンク、プロジェクトボード、ラベル、マイルストーン、そしてサードパーティツールの一大エコシステムと、規模に耐える索引付き検索。",
        },
      },
    },
    ergonomics: {
      heading: { eyebrow: "肝心なところ", title: "エージェントがファイルを好む理由" },
      lead: "本当の差は、エージェントが実際に作業したときに現れます。同じことを頼んでみてください。**「優先度の高い未完了タスクを探して」**。2 つの道筋はほとんど似ていません。",
      issues: {
        title: "you › agent + GitHub MCP",
        chip: "何往復も",
        lines: [
          "優先度の高い未クローズの issue を探して",
          "list_issues(state:open, labels:high)",
          "4.2 KB の JSON — issue 18 件、全フィールド付き",
          "ページング、絞り込み、要約…",
          "認証更新 · レート制限ヘッダ · リトライ",
        ],
        footer: "ツール呼び出し数回 · 数 KB の JSON · 毎回ネットワーク",
      },
      kanban: {
        title: "you › agent + ai4kanban",
        chip: "1 往復",
        lines: [
          "優先度の高い未完了タスクを探して",
          'grep -rl "Priority: high" docs/kanban/todo',
          "ファイルパスが 3 つ",
          "完了。1 回の呼び出し、ネットワークなし",
        ],
        footer: "呼び出し 1 回 · パス数個 · すべてローカル",
      },
      note: "しかもこれは積み上がります。「次は何をやる？」のたび、アーカイブのたび、ボード点検のたびに、GitHub Issues では往復のコストを払うことになります。そしてモデルは、選べるなら黙ってリモートのツールを避け、ファイルのほうへ手を伸ばします。",
    },
    decision: {
      heading: { eyebrow: "選び方", title: "どちらを使うべき？" },
      oursHeading: "こんなときは ai4kanban",
      theirsHeading: "こんなときは GitHub Issues",
      ours: [
        "ひとりで、あるいは気心の知れた少人数で作業している。",
        "ターミナルのエージェント越しに作業を進めている。",
        "記録を残すことより、前に進むことを重んじる。",
        "ボードを git に置きたい。オフラインで、持ち運べる形で。",
      ],
      theirs: [
        "公開の場で作っていて、透明性が大事。",
        "複数人が同時にバックログをいじる。",
        "PR/CI のリンク、プロジェクトボード、マイルストーンに頼っている。",
        "外部の貢献者に起票して議論してほしい。",
      ],
      verdict:
        "そもそも競合ではありません。GitHub Issues は**共有された正式な記録**、ai4kanban は**エージェントの手元にある高速なローカル下書き板**です。ボトルネックが人と人の調整なら GitHub Issues を、エージェントと一緒に出す量なら ai4kanban を使ってください。",
      note: "ひとりで作る人の多くは両方使っています。GitHub Issues を公開のトラッカーに、ai4kanban を自分のエージェントが毎日触る非公開の作業面に。",
    },
  },

  vsHermes: {
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
  },

  vsVibe: {
    meta: {
      title: "AI4Kanban vs. Vibe Kanban — 計画のボード vs. エージェントのコックピット",
      socialTitle: "AI4Kanban vs. Vibe Kanban",
      description:
        "2026 年 4 月に Bloop が事業を畳み、Vibe Kanban は止まりました。ai4kanban のファイルベースのボードはどう違うか。リポジトリに置く軽量な計画ボードと、多数のコーディングエージェントを並列で回すコックピット、そして何が引き継げるのか。",
      social:
        "Vibe Kanban の運営会社が事業を畳みました。リポジトリに置く計画ボードとエージェント編成のコックピット、その正直な違いと、何が引き継げるのか。",
    },
    hero: {
      badge: "比較",
      title: "AI4Kanban vs.\nVibe Kanban",
      lead: "Vibe Kanban は多数のコーディングエージェントを並列で回すコックピットで、その運営会社 Bloop は 2026 年 4 月に事業を畳みました。ai4kanban は、あなたのエージェントがリポジトリのなかのただのファイルとして編集する計画ボードです。埋めているボトルネックが違います。以下は正直な違いと、実際に引き継げるものです。",
      ours: {
        name: "AI4Kanban",
        body: "リポジトリのなかのただの Markdown。エージェントが編集する計画ボード。",
      },
      theirs: {
        name: "Vibe Kanban",
        body: "ローカルの Web アプリ。多数のエージェントを並列で回すコックピット。",
      },
    },
    summary: {
      heading: {
        eyebrow: "手短に言うと",
        title: "Vibe Kanban が止まった。次はどこへ？",
      },
      lead: "Vibe Kanban の運営会社 Bloop は 2026 年 4 月に事業を畳みました。有料プランは解約・返金され、クラウド機能は撤去され、プロジェクトは完全ローカルになりました。Apache-2.0 のオープンソースとして残されましたが、元のリポジトリは 2026 年 4 月末以降、新しいコミットがありません。その先行きは作った当のチームではなくコミュニティのフォークに委ねられています。",
      panel:
        "Vibe Kanban で価値を感じていたのが**ボード**、つまりコーディングエージェントに渡す作業を落ち着いて並べ、研ぎ澄ます場所なら、ai4kanban はそれを git のなかのただのファイルとして渡します。畳む会社もなければ、生かし続けるサーバーもありません。価値を感じていたのが**多数のエージェントを並列で回すエンジン**なら、先に言っておきます。ai4kanban はそれではありません。3 セクション読ませてから失望させるより、いま言っておきます。",
    },
    comparison: {
      heading: { eyebrow: "真っ向比較", title: "AI4Kanban vs. Vibe Kanban" },
      lead: "10 の観点。{check} は明確な勝ち、**ダッシュ**は必要なもの次第の意図的なトレードオフです。ai4kanban は**軽さと計画**の行を取り、Vibe Kanban は**並列エージェントとレビュー**の行を取ります。そこは本当に強いので、はっきりそう言います。",
      ourLabel: "AI4Kanban",
      theirLabel: "Vibe Kanban",
      rows: {
        whatFor: {
          dimension: "何のためのものか",
          kanban:
            "エージェントがリポジトリ内で編集する計画ボード。作業を並べ、研ぎ澄ます。",
          vibe: "多数のコーディングエージェントを並列で回し、その成果物をレビューするコックピット。",
        },
        orchestration: {
          dimension: "並列エージェントの編成",
          kanban: "なし。回すのは 1 体で、ボード自体はエージェントを動かしません。",
          vibe: "本領。多数のエージェントを同時に、それぞれ隔離された git worktree で動かします。",
        },
        review: {
          dimension: "エージェント出力のレビュー",
          kanban: "担当外。diff はあなたの実行環境が見せます。",
          vibe: "内蔵。インラインの diff レビュー、ライブプレビュー、pull request の処理まで。",
        },
        planning: {
          dimension: "計画と詳細化",
          kanban:
            "refine のループが、粗いアイデアを着手できる具体的なタスクに変えます。",
          vibe: "最小限。ボードはおおむねエージェント実行を並べて追うだけです。",
        },
        onDisk: {
          dimension: "ディスク上の実体",
          kanban: "リポジトリのなかのただの Markdown、git の中に。",
          vibe: "設定ディレクトリに置かれたローカルの SQLite データベース。",
        },
        runsAs: {
          dimension: "動作形態",
          kanban: "ただのファイル。サーバーなし、生かし続けるものもなし。",
          vibe: "起動して動かし続けるローカル Web アプリ（Rust バックエンド + Web UI）。",
        },
        setup: {
          dimension: "導入",
          kanban: "プロンプト 1 つ：スキルファイル 1 枚と小さなスクリプト。",
          vibe: "npx vibe-kanban、加えて各エージェント CLI のインストールとサインイン。",
        },
        whichAgents: {
          dimension: "動かせるエージェント",
          kanban:
            "ファイルを読めるエージェントなら何でも。Claude Code、Codex、Cursor など。",
          vibe: "つないである各エージェント CLI。Claude Code、Codex、Gemini など。",
        },
        lockIn: {
          dimension: "ベンダーロックイン",
          kanban: "なし。ボードはリポジトリと一緒に移動するファイルです。",
          vibe: "Apache-2.0 で自前ホストも可能、終了前にデータエクスポートも出ました。",
        },
        maintenance: {
          dimension: "誰が保守しているか",
          kanban: "現役で保守されています。",
          vibe: "Bloop は 2026 年 4 月に事業を畳み、元のリポジトリはその後止まっています。",
        },
      },
    },
    purpose: {
      heading: {
        eyebrow: "本当の違い",
        title: "計画のボード vs. 編成のコックピット",
      },
      lead: "この 2 つはループの別の地点に立っています。一方は**何を作るか**を決める場所、もう一方は**それを作るエージェントを回す**場所です。片方をもう片方と取り違えると失望するので、率直に書きます。",
      ours: {
        name: "AI4Kanban — 計画のほう",
        is: "エージェントがリポジトリのなかのただの Markdown として読み書きするボード。粗いアイデアを保存し、refine のループがそれを着手できるタスクに研ぎ、コードが書かれる前にあなたが承認します。作業は git のなか、変更するコードのすぐ隣に住みます。",
        isnt: "エージェントを動かすことも、worktree を用意することも、その差分を見ることもしません。それはあなたの実行環境の仕事です。これは地図であって、エンジンではありません。",
      },
      theirs: {
        name: "Vibe Kanban — エンジンのほう",
        is: "多数のコーディングエージェントを同時に、それぞれ自分の git worktree に隔離して動かし、その diff のレビューとアプリのプレビューを 1 か所でできるローカル Web アプリ。価値は並列実行によるスループットにあります。",
        isnt: "半分しか固まっていないアイデアを計画に研ぐためには作られていません。ボードはおおむね実行を並べて追うだけで、詳細化は最小限です。",
      },
      note: "ボードだけを目当てに Vibe Kanban を使っていた人はたくさんいます。あなたもそうなら、ai4kanban はその軽い引っ越し先です。git のなかのファイル、動かし続けるものはなし。エージェントを並列で回すために使っていたなら、コミュニティのフォークを追ってください。ai4kanban はあのエンジンの代わりにはなりません。",
    },
    wins: {
      heading: { eyebrow: "トレードオフ", title: "それぞれが勝つところ" },
      lead: "どちらが一方的に優れているわけではありません。ai4kanban はどんなツールより長生きする軽量なファイルボードに、Vibe Kanban は多数のエージェントを同時に回してレビューすることに最適化されています。",
      oursHeading: "AI4Kanban",
      theirsHeading: "Vibe Kanban",
      ours: {
        nothingRunning: {
          title: "動かし続けるものが何もない",
          body: "ボードはリポジトリのなかのただの Markdown。Web アプリもデータベースもサーバーもありません。すでに動かしているエージェント以外に入れるものはなく、落ちるものもありません。",
        },
        planning: {
          title: "並べるだけでなく、計画する",
          body: "refine のループが足りない部分を掘り、粗いアイデアを、コードが書かれる前にあなたが承認する具体的なカードに変えます。Vibe Kanban のボードはおおむねエージェント実行を並べるものです。",
        },
        outlives: {
          title: "どんな会社より長生きする",
          body: "SaaS も、同梱のランタイムも、止まりうるリポジトリもありません。ボードは git のなかのファイルなので、リポジトリを clone すれば付いてきます。Bloop の終了は、まさにこれが避けているリスクです。",
        },
        anyAgent: {
          title: "どのエージェントでも、いつでも",
          body: "ただのファイルなので、ファイルを読めるエージェントならどれでも動かせます。Claude Code、Codex、Cursor、次に乗り換える何であっても。特定ツールの対応 CLI 一覧に縛られません。",
        },
      },
      theirs: {
        parallel: {
          title: "多数のエージェントを同時に回す",
          body: "存在理由そのものです。作業を複数のコーディングエージェントに扇状に配り、それぞれ自分の git ブランチと worktree に隔離して衝突させません。ai4kanban はそもそもエージェントを動かしません。",
        },
        reviewInPlace: {
          title: "実行とレビューが同じ場所に",
          body: "インラインの diff レビュー、アプリを確認する内蔵ブラウザ、pull request の処理。すべてコックピットの中にあります。ボードを離れずにエージェントの出力を見て導けます。",
        },
        boardUi: {
          title: "本物のボード UI",
          body: "エージェント実行を回すために作られた Web ボード。タスクを立ち上げ、働くさまを眺め、ワークスペースを切り替える。編成のために設計されていて、grep するただのファイルではありません。",
        },
        support: {
          title: "幅広いエージェント対応",
          body: "マルチエージェント編成の先駆けで、多くのエージェント CLI が最初からつながっています。Claude Code、Codex、Gemini など。",
        },
      },
    },
    decision: {
      heading: { eyebrow: "選び方", title: "どちらを使うべき？" },
      oursHeading: "こんなときは ai4kanban",
      theirsHeading: "こんなときは Vibe Kanban",
      ours: [
        "エージェントがリポジトリの中で直接編集する計画ボードが欲しい。",
        "インフラをゼロにしたい。git のなかのファイル、動かすものも生かし続けるものもなし。",
        "自分のボードを、いつか畳むかもしれないプロダクトに預けたくない。",
        "エージェントは一度に 1 体で、並列より明快な計画を重んじる。",
      ],
      theirs: [
        "多数のコーディングエージェントを、それぞれ隔離して並列で回したい。",
        "インラインの diff レビューとライブプレビューをひとつのコックピットで使いたい。",
        "エージェント実行の編成とレビューこそが本当のボトルネック。",
        "Bloop が畳んだいま、コミュニティのフォークに頼るのは構わない。",
      ],
      verdict:
        "埋めているボトルネックが違います。Vibe Kanban は多数のエージェントを回す**編成のコックピット**、ai4kanban は 1 体のエージェントがあなたのリポジトリで編集する**計画のボード**です。作業を並べる Vibe Kanban のボードが好きだったなら、ai4kanban はそれを、どんな会社より長生きするただのファイルとして渡します。並列エージェントのエンジンが好きだったなら、ai4kanban はそれではありません。はっきりそう言っておきます。",
      note: "Bloop が畳んだいま、会社を背負わずに引き継ぐ価値があるのはあのボードの部分です。そしてそれこそが ai4kanban です。",
    },
  },

  vsLinear: {
    meta: {
      title: "AI4Kanban vs. Linear — リポジトリ内の AI プロジェクト管理",
      socialTitle: "AI4Kanban vs. Linear",
      description:
        "ai4kanban と Linear app を比較。コーディングエージェント向けにリポジトリ内で計画を研ぐループと、Linear のチームワークスペース、エージェント基盤、プロジェクト、課題管理の違い。",
      social:
        "Linear は優れたチームシステム、ai4kanban はリポジトリ内の計画ループ。それぞれが向く場面を、エージェント、価格、ワークフローまで含めて比較します。",
    },
    hero: {
      badge: "比較",
      title: "AI4Kanban vs.\nLinear",
      lead: "Linear は人とエージェントが連携する、完成度の高いプロジェクト管理ワークスペースです。ai4kanban は、粗いアイデアをエージェントが着手可能なタスクまで研ぐ、リポジトリ内の計画ボード。安い Linear ではなく、計画の置き方そのものが違います。",
      ours: {
        name: "AI4Kanban",
        body: "リポジトリ内のただの Markdown。エージェントが計画のループを担います。",
      },
      theirs: {
        name: "Linear",
        body: "ホストされたチームワークスペース。人とエージェントが一緒に計画し、作り、レビューします。",
      },
    },
    summary: {
      heading: {
        eyebrow: "短く言うと",
        title: "Linear にもエージェントはいる。違うのは計画の居場所です",
      },
      lead: "Linear は、課題管理に AI を足しただけの製品ではありません。Linear Agent はワークスペース全体の文脈を扱い、エージェント基盤は課題をコーディングエージェントへ委任し、MCP server は外部エージェントをつなぎます。Coding Sessions では Claude Code や Codex を動かし、レビュー用の pull request まで返せます。",
      panel:
        "ai4kanban を選ぶ理由はもっと絞られます。**リポジトリの中で、エージェントに計画のループを持たせたい**ときです。粗い依頼が、質問、判断、依存関係、着手可能なカードへ変わります。ボードと記憶はレビューできる Markdown としてコードの隣に残ります。",
    },
    comparison: {
      heading: { eyebrow: "正面比較", title: "AI4Kanban vs. Linear" },
      lead: "{check} はその行で明確に向く側、**横線**は働き方次第という意味です。Linear は**チーム連携、ポートフォリオ計画、統合、内蔵のエージェント実行**で勝ちます。ai4kanban は**リポジトリ内での詳細化、可搬性、git に残る計画の記憶**で勝ちます。",
      ourLabel: "AI4Kanban",
      theirLabel: "Linear",
      rows: {
        bestFit: {
          dimension: "最も向く人",
          kanban: "コーディングエージェントが仕事を進める個人開発者と小さなチーム。",
          linear: "人、プロジェクト、エージェントを調整するプロダクト・開発チーム。",
        },
        sourceOfTruth: {
          dimension: "信頼できる情報源",
          kanban: "プロジェクトのリポジトリにある Markdown。コードと一緒に版管理されます。",
          linear: "アプリ、API、MCP からアクセスする共有の Linear ワークスペース。",
        },
        refinement: {
          dimension: "粗いアイデアから着手可能なタスクへ",
          kanban: "refine と resolve のループが答えられることは答え、残りを記録し、カードが具体的になるまで続きます。",
          linear: "Linear Agent は下書き、要約、更新、範囲決めを助けます。Coding Sessions の結果は課題の書き方にも左右されます。",
        },
        agentModel: {
          dimension: "エージェントの仕組み",
          kanban: "今使っている実行環境がボードを読み書きします。Claude Code と Codex はすでに接続済みです。",
          linear: "Linear Agent に、インストール可能な app user、課題の委任、エージェント向けガイド、ホスト型 MCP server が加わります。",
        },
        execution: {
          dimension: "実装とレビュー",
          kanban: "選んだ実行環境が ready カードを実装し、レビューもその環境と git の流れに残ります。",
          linear: "Coding Sessions がクラウドで Claude Code や Codex を動かし、PR を開き、diff とレビューを Linear に置きます。",
        },
        collaboration: {
          dimension: "人どうしの共同作業",
          kanban: "小さなチームが git で協力する形。同じボードの同時編集は得意ではありません。",
          linear: "メンバー、担当者、コメント、非公開チーム、ゲスト、権限を備えたリアルタイムのワークスペース。",
        },
        portfolio: {
          dimension: "計画できる範囲",
          kanban: "カード、依存関係、優先度、ROI、release、モジュール別の記憶。",
          linear: "課題、プロジェクト、サイクル、イニシアチブ、マイルストーン、タイムライン、トリアージ、分析、顧客要望。",
        },
        setup: {
          dimension: "導入",
          kanban: "1 つの prompt でリポジトリに導入。ボードにアカウント、DB、リモートサービスは不要です。",
          linear: "ワークスペースを作り、チームの必要に応じて統合とエージェントのアクセスを設定します。",
        },
        portability: {
          dimension: "持ち運びやすさ",
          kanban: "リポジトリを clone すれば、ボード、判断、履歴も付いてきます。オフラインでも動きます。",
          linear: "データは Linear に置かれ、管理者は課題を CSV で書き出したり API を使ったりできます。",
        },
        pricing: {
          dimension: "価格",
          kanban: "Apache-2.0 で無料。料金がかかるのは自分で選んだコーディングエージェントだけです。",
          linear: "Free は 250 課題、2 チーム。Basic は年払いで 1 人月額 10 ドル、Business は 16 ドル。Coding Sessions は AI credits も使います。",
        },
      },
    },
    model: {
      heading: {
        eyebrow: "本当の違い",
        title: "リポジトリの記憶 vs. チームのワークスペース",
      },
      lead: "いまはどちらもエージェントに対応しています。大事なのは、**どの文脈が計画を持つか**です。プロジェクトのリポジトリか、会社で共有するワークスペースか。",
      ours: {
        name: "AI4Kanban — リポジトリが一緒に計画する",
        is: "計画を変える前に、エージェントはコード、過去の判断、却下した案、出荷済みの仕事を読みます。未解決の質問に答えが出るか、あなたへ明確に渡されるまで研ぎ続けます。",
        isnt: "広い共同作業のスイートではありません。役立つ計画の記憶はコードと一緒に commit され、clone のたびに付いてきます。",
      },
      theirs: {
        name: "Linear — ワークスペースが全員をつなぐ",
        is: "課題はチームに属し、プロジェクトはチームをまたげます。サイクル、イニシアチブ、タイムライン、文書、コメント、顧客要望が共有の文脈を作り、エージェントも同じ権限付きの場所で働きます。",
        isnt: "本当の問題が、粗い依頼を信頼できる仕様に変えることだけなら、個人開発者には大きすぎる仕組みです。",
      },
      note: "併用はできますが、どちらがタスク状態を持つか決める必要があります。個人開発者にとって、2 つの信頼できる情報源は価値より手順を増やしがちです。",
    },
    wins: {
      heading: { eyebrow: "トレードオフ", title: "それぞれが勝つところ" },
      lead: "Linear は広さ、連携、一体化した実行で勝ちます。ai4kanban はエージェント主導の計画をローカルで見える形にし、実行の合間にも失われにくくします。",
      oursHeading: "AI4Kanban",
      theirsHeading: "Linear",
      ours: {
        roughToReady: {
          title: "粗い依頼を着手可能な仕事にする",
          body: "最初の課題説明を仕様扱いせず、エージェントがループの中で質問し、調べ、分け、解決します。",
        },
        repoMemory: {
          title: "計画の記憶がコードの隣にある",
          body: "判断、却下した案、依存関係、カードは、次のエージェント実行が最初から読む、diff 可能なただのファイルです。",
        },
        anyHarness: {
          title: "好きな実行環境を使える",
          body: "ボードは Linear Agent や 1 つのコーディング統合に縛られません。Claude Code と Codex はすでに使え、形式は他の環境にも開かれています。",
        },
        noSaas: {
          title: "管理するボード SaaS がない",
          body: "計画面にワークスペース、席、認証、DB、同期層はありません。ボードはリポジトリの一部です。",
        },
      },
      theirs: {
        teamSystem: {
          title: "人のチームのための本格的なシステム",
          body: "同時編集、担当、権限、コメント、非公開チーム、ゲスト、通知、完成度の高い画面を備えています。",
        },
        agentPlatform: {
          title: "エージェントと実行が組み込み済み",
          body: "Linear Agent、app user、MCP、課題委任、Coding Sessions、diff、pull request レビューが同じ文脈を共有します。",
        },
        planningDepth: {
          title: "深いプロダクト計画",
          body: "プロジェクト、サイクル、イニシアチブ、マイルストーン、タイムライン、トリアージ、分析、顧客要望は小さなリポジトリボードを大きく超えます。",
        },
        integrations: {
          title: "統合と検索できる文脈",
          body: "GitHub、GitLab、Slack、Teams、サポートツール、API、webhook、ワークスペース検索が会社の仕事をつなぎます。",
        },
      },
    },
    decision: {
      heading: { eyebrow: "選び方", title: "どちらを使うべき？" },
      oursHeading: "こんなときは ai4kanban",
      theirsHeading: "こんなときは Linear のまま",
      ours: [
        "個人開発者か小さなチームが、コーディングエージェントで仕事を進める。",
        "入力は粗いことが多く、計画のループがボトルネックになっている。",
        "タスクと長く残す判断を、コードの隣の git に置きたい。",
        "ボード内蔵のランタイムではなく、自分で実行環境を選びたい。",
      ],
      theirs: [
        "複数人が同時に仕事を作り、割り当て、話し合い、更新する。",
        "サイクル、イニシアチブ、タイムライン、トリアージ、顧客要望、レポートに頼っている。",
        "クラウドのコーディングセッションと diff レビューを管理ツール内で使いたい。",
        "全社の統合、権限、セキュリティ制御、サポートが必要。",
      ],
      verdict:
        "Linear は優れた**チームシステム**、ai4kanban は鋭い**リポジトリ内の計画ループ**です。人どうしの調整がボトルネックなら Linear を使い続けてください。コーディングエージェントが曖昧な仕事を受け取り、その背景の判断を何度も失うなら、ボードをリポジトリに入れ、そこで研がせるほうが合います。",
      note: "機能ごとに Linear を置き換えるのではなく、計画モデルを変える選択です。",
    },
  },
};

export default ja;
