# Slides OUTLINE — OpenADMET PXR Challenge (Track 1) 発表構成案

**目的**: `MODEL_REPORT.md` を素材に、ラボ内発表（研究室ミーティング）用の30分トークの
スライド構成を作る。本ドキュメントはコンテンツの叩き台であり、`slides/index.html`
の実装前にレビュー・修正するための作業用ファイル。内容が固まったら削除してよい。

- **想定聴衆**: 機械学習寄りの人と創薬・薬理寄りの人が同じ部屋にいる混合聴衆。
  PXRの生物学もML用語も、どちらも前提知識にしない。
- **長さ**: 30分（19スライド、1スライドあたり平均1.5〜2分想定）。
- **トーン**: 「95チーム中4位」という成果報告がまず先。TabPFN/Caruana/Boltz-2などの
  技術は「なぜ選んだか」「どれだけ効いたか」という文脈でのみ登場させ、技術ディープ
  ダイブにはしない。
- **数値の出典**: 本アウトラインに書かれている数値はすべて `MODEL_REPORT.md` から
  引用したもの。創作した数値は一切ない（引用元が本文にない場合はチャート欄で明記）。
- **使い方**: 各スライド案は目安。統合・分割・順序入れ替えは歓迎。`slides/index.html`
  実装（Task 9）に入る前に、このファイルの内容についてN283Tのレビューを受けること。

---

### Slide 1: 表紙

- タイトル: OpenADMET PXR Induction Challenge — Track 1 (Activity) 振り返り
- サブタイトル: 95チーム中4位（Tier 1）／個人参加・ソロ開発
- 発表者名・日付（プレースホルダー）

**Chart/figure**: none

**Presenter notes** (draft): まず自己紹介と、この発表がOpenADMET PXR Induction
Challengeの個人参加の振り返りであることを伝える。詳細は後で話すので、ここでは
タイトルだけ簡潔に。

---

### Slide 2: TL;DR

- **95チーム中4位**（Tier 1）で、構造だけからヒトPXR活性化（pEC50）を予測。
  MAEはPhase 1が **0.4059**、Phase 2が **0.4113**。
- 決め手は **multi-fidelity transfer learning**（Buterez et al., 2024）。
  安価な単一濃度アッセイ log2fc の「予測値」が単独最強の特徴量になった。
- その周りに **9メンバーのCaruanaアンサンブル**（読み出しはすべてTabPFN）。
  Boltz-2は構造予測ではなく学習表現として採用。
- 効いたのはキャリブレーション1回だけ。Phase 1のテールゲートとPhase 2の
  追加施策はほぼノイズか悪化——**やめ時を見極めたこと**が地味に効いた。

**Chart/figure**: none

**Presenter notes** (draft): このスライドが今日の話の全て。あとの18枚は、この4行を
どう裏付けるかの詳細。忙しい人はこのスライドだけ覚えて帰ってもらって構わない、
という体で話す。

---

### Slide 3: PXRとは／課題設定

- **PXR（pregnane X receptor）**: 体内に入った異物・薬物を感知し、薬物代謝酵素の
  遺伝子発現をオンにする核内受容体。ML側の聴衆向けに一言で：「薬同士の飲み合わせ
  リスク（薬物相互作用）に関わるセンサー分子」。
- タスク: 513化合物（blind test）についてPXR活性化の強さ（**pEC50**、高いほど
  強い誘導）を構造から予測する回帰タスク。
- 評価指標: **MAE**（平均絶対誤差、低いほど良い）。
- チャレンジ運営: OpenADMET、期間 2026-04-01 → 2026-07-01。

**Chart/figure**: none

**Presenter notes** (draft): 化学・薬理の人には自明だが、ML寄りの人のためにPXRを
一言で説明する。ここは深入りせず、「なぜこの受容体を予測したいのか」の直感だけ
共有できれば十分。

---

### Slide 4: データの全体像

- 学習データ: **4,140件**のラベル付き化合物（pEC50）。
- テストは2分割: Analog Set 1 (AS1) **253件**（Phase 2開始時に公開）、
  Analog Set 2 (AS2) **260件**（最後までブラインド）。テスト計 **513件**。
- データは実は多段階のアッセイ・ファネル: 用量反応試験からpEC50とEmax、
  PXR-null対照アッセイから選択性、そして**単一濃度スクリーニング**から
  log2 fold-change（**log2fc**、8.25 µMと33 µMの2濃度）が、より多くの化合物に
  対して得られる。
- log2fcが実測されている化合物は8.25 µMで**2,722件**、33 µMで**2,659件**
  （pEC50の4,140件よりは少ないが、桁違いに安いアッセイ）。
- log2fc予測モデルの事前学習には**13,136件**の化合物を使用（学習4,140件より
  広い、log2fcのみのコーパス）。

**Chart/figure**: NEW — needs data plan: アッセイファネルの図（漏斗 or 積み上げ図）。
必要な数値: Train 4,140 / AS1 253 / AS2 260 / Test計 513（§1表）、log2fc実測
2,722件（8.25µM）・2,659件（33µM）（§3）、log2fc事前学習コーパス13,136件（§5.2）。
対照アッセイの化合物数は本文に数値がないため図には含めない。

**Presenter notes** (draft): ここが今日の話の伏線。「pEC50は4,140件しかないが、
安価なlog2fcアッセイはもっと広くカバーしている」という非対称性が、この後の
multi-fidelity戦略の出発点になる。

---

### Slide 5: 最終結果（Phase 1 / Phase 2）

- 最終順位: **95チーム中4位**（Tier 1、有意水準トップ層）。
- Phase 1（AS1+AS2、513件、338チーム中）: MAE **0.4059**（4位）、RAE 0.5359、
  R² 0.6496、Spearman ρ 0.8343、Kendall τ 0.6459。
- Phase 2（AS2のみ、260件、95チーム中）: MAE **0.4113**（4位）、RAE 0.5703、
  R² 0.6008、Spearman ρ 0.8161、Kendall τ 0.6225。
- 2つのPhaseはテスト対象が異なるため、数値は直接比較できない点に注意。

**Chart/figure**: 既存 — `slides/assets/js/charts/results.js` +
`slides/assets/data/results.js`（Phase 1 / Phase 2 の5指標比較バーチャート）。
そのまま使用可能。

**Presenter notes** (draft): まず結果を見せてから、なぜこの結果になったかを
掘り下げる構成。「4位」という数字だけでなく、MAE以外の指標（Spearman/Kendall）も
一貫して良いことに触れ、順位相関も強いモデルであることを示す。

---

### Slide 6: 出発点——pEC50だけでは頭打ち

- 最初はpEC50の学習ラベルだけから特徴量とモデルを構築していた。
- しかし学習ラベルは**4,140件のみ**で、精度はすぐに頭打ちになった。
- データセットには安価な補助アッセイ（log2fc）があることは分かっていたが、
  それをどう使えばよいか分からなかった。
- log2fcを疑似pEC50ラベルに変換する試みは、むしろ精度を**下げた**（失敗）。

**Chart/figure**: none（具体的な「頭打ち」時点のMAE数値は本文に記載がないため
図示しない。ナラティブのみ）。

**Presenter notes** (draft): ここは「詰まった」話。正直に、疑似ラベル変換という
自然に見えるアイデアが失敗したことを話す。次のスライドで、この停滞をどう
突破したかにつなげる。

---

### Slide 7: 突破口——Multi-fidelity transfer learning

- 突破口になった論文: Buterez et al., **"Transfer learning with graph neural
  networks for improved molecular property prediction in the multi-fidelity
  setting"**（*Nature Communications*, 2024）。
  DOI: 10.1038/s41467-024-45566-8（論文URLより。本文中はURLリンクのみで
  "DOI:" という明記はない点に留意）。
- 化学側向けに一言で: **multi-fidelity**設定とは「少数の高コスト高精度測定
  （pEC50）」と「多数の安価な低精度測定（log2fc）」が共存する状況で、低精度
  シグナルを「予測値」または「表現（representation）」として使うと、
  「追加ラベル」として使うより高精度側の予測が向上するというアイデア。
- この論文にたどり着いた経緯: Claude Codeに「pEC50は少ない・補助アッセイは
  豊富・疑似ラベル化は失敗した」という状況を整理した調査プロンプトを書かせ、
  それをChatGPT Deep Researchに投げて見つけた。
- Track 1への対応づけ:
  高精度ターゲット=pEC50（4,140件）／低精度測定=log2fc／低精度モデル出力=
  predicted log2fc（**pred**、特徴量の主軸）／低精度表現=log2fc事前学習
  encoderの凍結embedding（多様性の軸）／下流の高精度モデル=TabPFN。

**Chart/figure**: NEW — 図表というよりは概念図。§3の対応表（5行）をそのまま
ダイアグラムとして再構成する（新規の数値データは不要）。

**Presenter notes** (draft): ここが今日のスライドの中で一番「発見の物語」らしい
部分。論文名はしっかり画面に出す。技術的詳細（GNNアーキテクチャなど）には
立ち入らず、「安いデータを予測値や表現として使うと効く」という着想だけを
伝える。

---

### Slide 8: 最強の特徴量——predicted log2fc（pred）

- Buterez et al.に倣い、ChemPropで単一濃度log2fcを予測するモデルを学習し、
  その予測値 **pred**（8.25 µMと33 µMの2列）を特徴量として使用。
- predはpEC50との相関が実測log2fcより強い: Pearson r ≈ **0.75, 0.80**
  （学習4,140件全体）に対し、実測値はr ≈ **0.72, 0.50**（かつ実測がある
  2,722件・2,659件でのみ）。
- 構造だけから計算できるため、predは**すべての化合物**（ブラインドテストも
  含む）に存在する——実測log2fcはテスト時には存在しない。
- 簡易モデルでの比較（学習pEC50で当てはめ、unblind後のtest=AS1+AS2で評価）:

| Feature | Model | Dims | MAE | Spearman |
|---|---|---:|---:|---:|
| pred 8.25 µM | linear | 1 | 0.609 | 0.782 |
| pred 33 µM | linear | 1 | 0.571 | 0.746 |
| pred log2fc（両方） | linear | 2 | 0.572 | 0.725 |
| Boltz-2 affinity | linear | 1 | 0.747 | 0.602 |
| RDKit記述子 | LightGBM (untuned) | 217 | 0.570 | 0.677 |
| Phase 1提出（参考） | ensemble | ~2,100 | 0.406 | 0.834 |

- predの2列だけの線形回帰が、217次元RDKit記述子＋LightGBMと**同等以上**の
  性能（MAEはほぼ同じ、順位相関はpredの方が良い）。

**Chart/figure**: NEW — needs data plan: 上表6行（feature, model, dims, MAE,
Spearman）をバーチャート化。§3「How far does pred alone get?」の表がそのまま
データソース（`scripts/ablation_baselines.py`の post-challenge held-out fits、
本番モデルではない点は注記）。

**Presenter notes** (draft): このスライドが今日のハイライトの一つ。「たった2列の
予測値が、217次元の記述子スタック一式と互角」というインパクトを強調する。
なぜ効くかは前スライドのmulti-fidelityの理屈で説明済みなので、ここは数字で
畳みかける。

---

### Slide 9: アンサンブル構成 I——9メンバー、TabPFN、Caruana選択

- 最終システムは**9メンバー**。分子→特徴量の作り方は異なるが、読み出しは
  全メンバー**TabPFN**で統一。多くのencoderはlog2fcで事前学習し**凍結**。
- 3つのファミリー:
  - **Tabular core**（2メンバー）: CheMeleon+2D記述子+Boltz+pred、約2,103次元。
    tabular-full（全次元）とtabular-top500（LightGBM-gain上位500選択）。
  - **Frozen embeddings**（5メンバー）: ChemProp, KERMT, MoLFormer, GatedGCN,
    AttentiveFP。log2fcで事前学習し凍結したembeddingをTabPFNで読む。
  - **Boltz-2 structural**（2メンバー）: Boltz-pocket, Boltz-allpairs。
- メンバー単体のOOF MAEと重み（本文に明記されている範囲）:

| Member | Family | OOF MAE | Weight |
|---|---|---:|---:|
| tabular-top500 | tabular core | (本文に個別値の記載なし) | 0.309 |
| tabular-full | tabular core | (本文に個別値の記載なし) | 0.288 |
| ChemProp | frozen embed | 0.437 | 0.151 |
| KERMT | frozen embed | 0.448 | 0.111 |
| MoLFormer | frozen embed | 0.475 | 0.040 |
| GatedGCN | frozen embed | 0.474 | 0.018 |
| AttentiveFP | frozen embed | 0.484 | 0.002 |
| Boltz-pocket | structural | ~0.486 | (本文に数値の記載なし) |
| Boltz-allpairs | structural | ~0.486 | (本文に数値の記載なし) |

- 組み合わせ方は**Caruana forward selection**（Caruana et al., ICML 2004）:
  OOF誤差を最も下げるメンバーを貪欲に足していく。重みはバギングした選択
  回数由来なので、1メンバーが暴走しにくい。

**Chart/figure**: NEW — needs data plan: 上表9行をバーチャート化
（OOF MAEと重みの2軸）。tabular-full/top500の個別OOF MAEとBoltz-2 2メンバーの
weightはMODEL_REPORT.md本文に明記がなく、値が欠けている点をそのまま可視化するか、
数値を確認してから埋める必要あり（要フォローアップ）。

**Presenter notes** (draft): 9メンバーもあるが、聞く側が全部覚える必要はない。
「3つのグループがある」「読み出しは全部TabPFN」の2点だけ持ち帰ってもらえば
十分、という前置きをしてから表を見せる。

---

### Slide 10: アンサンブル構成 II——相関構造とBoltz-2の使い方

- 9メンバーは**独立ではない**: メンバー間相関はr = **0.81〜0.98**（平均**0.88**）。
  2つのtabular coreはほぼ同一（**0.98**）、2つのBoltz-2も同様（**0.97**）。
- つまりこのアンサンブルは「独立な視点の合成」というより、強いが相関した
  メンバー（特にtop500）が支配しすぎないための**バッファ**として機能している。
- 最も相関が低いのはBoltz-2の2メンバー（他メンバーとの相関 ~0.81〜0.88）。
  単体では弱くても、この非相関性ゆえに重みを得ている。
- Boltz-2は「構造予測」ではなく「学習表現」として効いた点が意外な発見:
  予測構造・affinityスコアはノイズが多く単体では使えなかったが、Boltz-2内部の
  trunk表現（token単体テンソルsとペアテンソルz）をpoolingした1,024次元
  ベクトルをTabPFNに渡すと、単体でMAE **~0.486**。log2fcを一切使わない
  メンバーとしては健闘（比較として、from-scratchのChemPropは**~0.484**）。
- top500への依存はリスクでもあった: OOF最適で重みを0.84まで上げると
  AS2 MAEが**0.422**まで悪化する一方、実使用重み0.31なら**0.405**
  （post-hoc, issue #222の検証）。

**Chart/figure**: NEW — needs data plan: メンバー間相関のサマリー（範囲
0.81–0.98、平均0.88、near-duplicateペア0.98/0.97、Boltz-2の非相関度
0.81–0.88）。9×9の完全な相関行列はMODEL_REPORT.md本文には数値として
記載がないため、サマリー統計のみの可視化にとどめるか、詳細行列が必要な場合は
別途データ提供を要確認。

**Presenter notes** (draft): 「9モデルの多様性アンサンブル」に見えて、実態は
かなり相関している——ここを正直に話す。Boltz-2が「構造予測ではなく表現として
使うと効いた」という話は、今日のもう一つの意外性のある発見として強調する。

---

### Slide 11: キャリブレーション——唯一の明確な勝ち筋

- アンサンブル構築後に残っていたレバーは2つ: 出力のキャリブレーションと、
  一連のテールゲート。
- 単純なアフィン変換によるキャリブレーションで、生のCaruanaブレンドの
  public leaderboard MAE **約0.441**が**約0.408**まで改善。
- 実装は4,140件のOOF予測に対して1次元の回帰（正の傾きのアフィン変換、
  isotonic版もあり）を、5-fold nested CVで過学習しないよう検証。
- 出荷版`calibrated_importance`は共変量シフト補正つき: 各学習化合物を
  密度比 `P(test|x)/(1−P(test|x))`（[1/3, 3]でクリップ）で重み付けし、
  ブラインドテストに似た学習点を重視。この一手が0.44→0.41の実質的な
  改善の正体。

**Chart/figure**: NEW — needs data plan: 生アンサンブル(0.441) →
キャリブレーション後(0.408)の2本バーチャート（§6冒頭の段落が出典）。

**Presenter notes** (draft): ここが「効いた」施策の話。キャリブレーションという
地味な後処理1つが、この後のどんな工夫よりも効いたという事実を先に言って
しまい、次のスライドで「その後は何をやってもほぼ横ばいだった」という
コントラストにつなげる。

---

### Slide 12: テールゲート——横ばいの探索と未解決のテール

- キャリブレーション後のid50〜id60チューニングは、public leaderboardを
  見ながらの探索。結果はほぼ横ばい:

| id | 変更内容 | Public-LB MAE |
|---|---|---:|
| id50 | internal-decorrelation blend | 0.4092 |
| id51 | meta-axis anchor | 0.4073 |
| id52 | re-pooled Boltz trunk swap | 0.4087 |
| id53 | trunk core-only variant | 0.4106 |
| id54 | id51 + potent gate | 0.4096 |
| **id55** | + top500 swap + soft potent-46 gate（アンカー） | 0.4071 |
| id56 | Optuna-tuned member swap | 0.4135 |
| id57 | softer potent gate (g50) | 0.4074 |
| id58 | combo gate rank | 0.4075 |
| id59 | high-activity lift rank | 0.4077 |
| **id60** | id55を再提出（Phase 1最終） | 0.4059 |

- id55とid60は同一モデル。0.4071と0.4059の差は純粋なリーダーボードの
  ばらつきで、「改善」と称した施策の多くよりも大きい。
- 唯一未解決だったのは**テール**: pEC50 ≥ 6の高活性化合物が系統的に
  過小予測され、そのビンでのバイアスは**約-0.8**（1 log unit近く平均に
  引き寄せられる）。log2fc・環数・family-gapなどのゲートを試したが、
  public leaderboard上ではノイズと区別できなかった。

**Chart/figure**: NEW — needs data plan: id50〜id60の11点をライン/バーチャートで
「横ばい」を視覚化（§6の表がそのまま出典）。テールのバイアス(-0.8)は
別途キャプションで補足。

**Presenter notes** (draft): このスライドで伝えたいのは「頑張って11回チューニング
したが、実質何も変わらなかった」という正直な事実。グラフがほぼ横一直線に
見えることそのものが主張になる。テール問題は最後まで解けなかった、と
はっきり言う。

---

### Slide 13: Phase 1の教訓——やめ時を見極める

- Phase 1終了時、public leaderboardでは**8位前後**（本文表現："around
  eighth"、正確な順位数値は本文になし）で、他チームより見劣りする状況だった。
- しかしそのボードは「追いかけるべきでないノイズの多い代理指標」と判断し、
  それ以上の無理な最適化はしなかった。
- 結果、ブラインドの最終テストでは**95チーム中4位**。Public leaderboardを
  追いかけすぎなかったことが、後から振り返ると良い判断だった。

**Chart/figure**: NEW — needs data plan: 「Public LB ~8位前後」→
「最終ブラインド 4位/95」の2点比較チャート。8位は本文が"around eighth"と
表現する概数であり、正確な数値ではない点をラベルに明記する。

**Presenter notes** (draft): ここは今日のプロセス面のハイライトの一つ。
「見た目のスコアが悪くても、無理に追いかけない」という判断が結果的に
報われた、という話を、次のPhase 2の反例とセットで聞いてもらう。

---

### Slide 14: Phase 2の教訓——何をやっても悪化した

- Phase 2はフルブラインドで、public leaderboardという指標すら存在しない
  状態で進んだ。
- Phase 1アンカー（id55=id60）はAS2で**0.4075**。そこから加えた変更は
  すべて悪化方向に動いた:

| id | 追加内容 | AS2 MAE | Δ vs id60 |
|---|---|---:|---:|
| **id60 (=id55)** | Phase 1アンカー | 0.4075 | baseline |
| id61 | AS1ラベル＋top500 AS1-aug blend (α 0.40) | 0.4121 | +0.0046 |
| id62 | + ChEMBL pairrankゲート | 0.4115 | +0.0040 |
| **id63** | + composite gate, α 0.45（最終提出） | 0.4123 | +0.0048 |

- 何が悪かったか: (1) 公開されたAS1ラベルで再学習してブレンドしたが、
  AS1再学習はAS2をほとんど改善せず、誤差を持ち込んだだけだった。
  (2) 外部ChEMBL/公開PXRデータから作った高活性検出ゲート（AUC ~0.88）は
  「どの化合物か」は当てても「どれだけ動かすか」を外し、順位で稼いだ分より
  MAEで損をした。(3) 低活性側のシフトは一度も適用しなかった——これだけは
  結果的に正しかった。
- 率直に言えば: Phase 1アンカー以降、AS2に対して何をしても悪化した。
  やる前は逆だと思っていた。

**Chart/figure**: NEW — needs data plan: id60→id61→id62→id63の4点バー/ライン
チャート（§7表が出典）。

**Presenter notes** (draft): ここは今日いちばん正直に話すべきスライド。
「良かれと思ってやったことが全部裏目に出た」というnull resultを、恥ずかしがらず
そのまま見せる。特に低活性側に手を出さなかった判断が結果的に正しかった点は
強調する。

---

### Slide 15: 答え合わせ（issue #222）——後知恵で見えたこと

- 挑戦後、公開されたAS1+AS2の正解ラベルで候補を再評価（issue #222）:

| 候補 | AS2 MAE |
|---|---:|
| 提出したid63 | 0.4123 |
| 保守的なid60アンカー（何もしなかった場合） | 0.4075 |
| 未提出のid55shape（もし出していたら） | **0.4056** |
| 優勝チームのスコア | 0.4061 |
| 機械的なanchor-residual stacker（後付け、LBを一切見ずに構築） | 約0.405 |
| importance-calibrated ensemble（参考） | 約0.407 |

- 何もしない（id60アンカーのまま）が、実際に提出したid63より良かった。
- ベンチした未提出案id55shapeは、優勝スコア0.4061をわずかに下回る0.4056——
  出していれば**1位**だった。動かしすぎ・自前のpreflightチェック不合格が
  見送り理由。
- top500の重みは実使用0.31で、AS2最適0.33に近かった。逆にOOF最適化に
  任せると0.84まで膨らみ、AS2 MAEは0.422まで悪化する（Slide 10参照）。
- 「足すこと」がこの3択の中で最悪の選択だった、というのが後知恵の結論。
  提出時点でどれが勝ち筋かを見分ける方法はなかった。

**Chart/figure**: NEW — needs data plan: 上表6行の比較バーチャート
（§7末尾の段落群が出典）。

**Presenter notes** (draft): ブラインドコンペの本質的な難しさを一番よく表す
スライド。「後から見れば分かるが、当時は分からなかった」という点を強調し、
判断の正しさではなく「判断できない状況だった」という事実の方を伝える。

---

### Slide 16: AI支援ワークフロー（軽く触れる程度）

- 停滞を破ったButerez et al.の発見は、Claude Codeに状況整理の調査プロンプトを
  書かせ、それをChatGPT Deep Researchに投げるという流れで見つけた
  （Slide 7参照）。
- コーディング・イテレーション全般でAIコーディングエージェントとChatGPTに
  大きく頼った（本人談）。
- この話自体は別の場できちんと書きたいとのことで、今日は「研究の主役では
  ない」位置づけとして触れるにとどめる。

**Chart/figure**: NEW — simple process diagram（データチャートではなく概念図）:
「状況整理プロンプト（Claude Code）→ ChatGPT Deep Research → Buterez et al.
発見」の3ステップ矢印図。数値データは不要。

**Presenter notes** (draft): ここは短めに。「AIをどう使ったか」の詳細に踏み込むと
今日の主役（PXR予測の中身）がぼやけるので、1枚で軽く触れて次に進む、という
ことを聴衆にも明言してから話す。

---

### Slide 17: 結論——持ち帰ってほしいこと

- 決め手はモデルではなく**フレーミング**だった: multi-fidelity transfer
  learningに辿り着いたことが、この提出が機能した最大の理由。
- **安価な活性データは過小評価されている。** 低コスト・単一濃度アッセイを
  pEC50モデルの背骨にするアイデアは、ノイズの多いハイスループット計測が
  豊富でゴールドスタンダードのラベルが乏しい、実際のスクリーニングにも
  転用できるはず。
- **生の信号をそのまま使う。** predicted log2fcは、エンジニアリングされた
  記述子や基盤モデルのembeddingを単体では上回った。直接関連する測定が
  存在するなら、汎用特徴量に頼る前にまずそれをモデル化すべき。
- **TabPFNは体格以上に効いた**読み出しヘッドだった。LightGBMや（本文では
  詳しく触れていない）KANの読み出しも同じベクトル上で強かった。
- **予測構造・affinityは期待外れだった。** Boltz-2のポーズとaffinityヘッドは
  直接使うにはノイズが多すぎ、学習表現として使って初めて効いた。活性予測
  という点では既製のaffinityモデルが最も弱いリンクだった。

**Chart/figure**: none

**Presenter notes** (draft): §8の結論を4つの箇条書きにまとめて読み上げる。
ここは新しい情報を足さず、これまで話した内容の要約であることを明言する。

---

### Slide 18: おわりに——個人的な振り返りと謝辞

- 初めてのコンペティション参加で、95チーム中4位は想定以上の結果だった。
- 全工程を**個人**で、**1台のコンシューマー向けゲーミングPC**で完走した。
- OpenADMETチームへの謝辞: よく設計されたベンチマークを運営し、データと
  unblind後のラベルを公開してくれたことが、この振り返りと答え合わせ
  （issue #222）を可能にした。

**Chart/figure**: none

**Presenter notes** (draft): 発表の締めとして、個人的な感想と謝辞を短く。
ここで技術的な話は増やさず、次のスライド（参考文献）にそのままつなげる。

---

### Slide 19: 参考文献・リンク集（付録）

- Buterez et al., "Transfer learning with graph neural networks for improved
  molecular property prediction in the multi-fidelity setting", *Nature
  Communications*, 2024. <https://www.nature.com/articles/s41467-024-45566-8>
- Caruana et al., "Ensemble Selection from Libraries of Models", ICML 2004.
  <https://dl.acm.org/doi/10.1145/1015330.1015432>
- Working repository（コード・特徴量パイプライン・日次ログ）:
  [N283T/pxr-iduction-challenge](https://github.com/N283T/pxr-iduction-challenge)
- 公開研究ログ: Phase 1 issue
  [#100](https://github.com/N283T/pxr-iduction-challenge/issues/100)、
  Phase 2 issue
  [#208](https://github.com/N283T/pxr-iduction-challenge/issues/208)、
  答え合わせログ issue
  [#222](https://github.com/N283T/pxr-iduction-challenge/issues/222)。
- チャレンジページ: <https://huggingface.co/spaces/openadmet/pxr-challenge>
- データ: [openadmet/pxr-challenge-train-test](https://huggingface.co/datasets/openadmet/pxr-challenge-train-test)
- 運営の書き起こし: [Phase 1結果](https://openadmet.ghost.io/woah-were-halfway-there/)、
  [最終まとめ](https://openadmet.ghost.io/its-the-end-of-the-pxr-challenge-as-we-know-it-and-i-feel-fine/)

**Chart/figure**: none

**Presenter notes** (draft): 質疑応答のための保険スライド。基本的に読み上げず、
質問が出たときに参照する形で使う。
