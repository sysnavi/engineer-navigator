# 引き継ぎノート（作業再開時にまず読む）

最終更新: 2026-07-18

別エージェント／別セッションで作業を継続するための現在地メモ。
設計思想は [roadmap.md](roadmap.md) / [weekly-report.md](weekly-report.md) / [data-model.md](data-model.md) / [../AGENTS.md](../AGENTS.md) に、進捗チェックボックスは roadmap.md にある。ここには**コードから読み取れない現在地**だけを書く。

## 方針転換（2026-07-17）: 個人サービスとしてリリースする

シスナビ社内ツールではなく、まず**個人向けサービス**として出す。適用済み: 週報の営業相談チェック削除・設問7を「AIメンターへの共有・相談」に・経歴書はPDF直接ダウンロード(/api/resume/pdf, pdfmake+IPAexゴシック同梱)・**週報インタビューモード**(/report?mode=interview: AIが1問ずつ聞いて7設問ドラフトに変換、部分更新で既存記入を消さない)。認証はOAuth(ハッシュのみ)で解決済み。**/conditionと同意文言はIssue #19 方針Aで解決（2026-07-23, 8fb58e7）**: コンディションは本人のみ閲覧（運営もSELECTしない）、/conditionダッシュボード・提出時アラート・週次ジョブ(410 Gone化)を撤去。src/lib/condition.ts は将来の本人向けセルフケア機能用に温存。

## いま動くもの

Phase 0（基盤）+ Phase 1 の縦切りが実装済み。**実 ANTHROPIC_API_KEY で end-to-end 動作確認済み**（2026-07-13）。

```
週報を書く(/report) → 提出 → AI解析 → SkillSuggestion生成
   → 本人が承認/却下(/skills) → EngineerSkill反映 + SkillHistory記録
```

画面は15+: `/`(ホーム) / `/report`(週報・自動保存) / `/skills`(スキルマップ＋レーダー＋成長ログ) / `/resume`(経歴書・印刷=PDF) / `/mentor`(AIメンター) / `/plan`(資格学習プラン) / `/quiz`(良問バンク=四択・腕試し) / `/roleplay`(役割シミュレーター) / `/dungeon`(ダンジョン) / `/yomoyama`(現場のよもやま掲示板) / `/walk`(おさんぽ) / `/discover`(発見) / `/home`(マイホーム) / `/u/[handle]`(公開プロフィール) / `/q/[id]`(良問の公開ページ) / `/admin`(管理者ダッシュボード) / `/welcome`(LP) / `/mypage`(きせかえ＋共有設定)。

**Phase 7 ゲーム性の土台（2026-07-18, commit 77302e5）:**
- **TOPヒーロー**: 「がんばりは、ぜんぶ経験値になる。」＋つながりパイプライン＋PLAYER_FILEカード（Lv/EXPバー/進化予告/今週のかつどう）。
- **EXP導出** `src/lib/exp.ts`: 既存データの集計から毎回導出（過去の頑張りも遡ってEXP化）。重み変更はEXP_WEIGHTSだけ。レベル=平方根カーブ、進化段階はレベルから決定的（保存不要）。
- **全活動EXP化（2026-07-18, commit 4c7f69a）**: 全16ソース（週報/公開/スキル承認/演習/腕試し/作問/良問/評価/相談/プラン作成・進行/よもやま/プロフィール公開/訪問/連続ボーナス）。**腕試しは1問につき初回のみ**（解き直しファーミング対策・実証済み）。訪問だけ `UserVisit` テーブル（1日1行・layoutでskipDuplicates記録）、🔥連続日数をカードに表示。**新しいEXP対象の機能を足したら exp.ts にもソースを足すこと。**
- **PixelAvatar** `src/components/pixel-avatar.tsx`: 段階別スプライトをCSS gridで描画（画像不要・パレット変数準拠）。
- **継承（転生）システム（2026-07-18, Issue #1）**: マイスター(Lv12)到達で「卵を産む」が解放。データは一切消さず `AvatarGeneration` に世代の墓標を1行残し、現世代EXP=「生涯EXP−スナップショット+遺産(前世代EXPの5%)」で導出（0クランプ必須・重み変更ドリフト対策）。**遺伝子** `src/lib/genes.ts`: 世代内で最も稼いだ活動カテゴリ→優性/2位→劣性（6種・決定的・乱数なし）、組み合わせ称号＋純血統(同優性3代)。**継承限定形態**: きんのたまご(gen2+ Lv1)/けんじゃ(gen2+ Lv14)/でんせつ(gen3+ Lv16)＝周回が最強への道。UI: マイページ INHERIT.sys（2段階確認モーダル→孵化演出→家系図）、TOPカードに世代・血統称号・遺伝子色オーラ枠、公開面(/u・/discover)に世代バッジ（世代数のみSELECT、コンディション鉄則は維持）。**新しいEXPソースを足したら exp.ts の EXP_WEIGHTS に加えて genes.ts の SOURCES 割当も更新すること。**
- 将来のローグライク（潜れる深さ=Lv）・レアペット・作業環境コレクションはこの上に乗せる。継承の世代数・遺伝子はローグライク(#3)の深度ボーナスの入力になる予定。
- **保存/送信の結果トースト（2026-07-21）**: 右上に数秒で消える結果チップ（`src/components/toast.tsx`）。`notify(kind, text)` をクライアントから直接、またはサーバーアクションのformは `<ActionForm action={…} ok="…">` に置き換えるだけ（成功でok文言・throwでエラートースト表示になりエラーページに落ちない）。適用済み: マイページ（表示名/目指す領域/公開プロフィール）・マイホーム（なまえ）・よもやま（投稿/コメント）。**視覚反応が既にあるUI（きせかえ・ドック・週報の下書きSAVED等）は意図的に対象外**。住み分け: 右上=結果 / 右下=TIPS / 左下=来訪者。
- **スキルレベル10段階化 + 深掘り検証（2026-07-22, Issue #25）**: レベル定義の本体は `src/lib/skill-levels.ts`（10段階×観測可能な行動・深掘り推奨閾値Lv6・旧5段階からの写像`LEVEL_MIGRATION_MAP`）。既存データはマイグレーション`skill_level_10`で写像済み（1→2,2→3,3→5,4→6,5→9。EngineerSkill/SkillHistory/SkillSuggestion全て）。**検証状態**: `EngineerSkill.verifiedBy`（null=⚠仮判定 / "interview" / "quiz"）。承認フローは `src/app/skills/suggestion-card.tsx`（クライアント）で、①深掘りインタビュー: `src/app/skills/actions.ts` の generateSkillProbe（質問2〜3個生成・probeに保存して再利用）→ submitSkillProbe（回答をルーブリック判定・suggestedLevel確定）→ 承認で verifiedBy="interview"、②そのまま承認=仮判定。**トークンゼロの裏取り**: 腕試しで同じお題（topic⊃スキル名 or 逆包含・aliases込み）の問題に累計2問正解すると verifiedBy="quiz" に自動昇格（`src/app/quiz/actions.ts` promoteSkillsVerifiedByQuiz）。ANTHROPIC_API_KEY未設定環境では深掘りボタン自体を出さず仮判定のみで運用可（aiEnabled prop）。経歴書のLEVEL_DEFSはskill-levelsから導出。⚠AI呼び出しパス（質問生成/判定）はローカルにキーが無くE2E未実施 — 本番反映後に1回まわして確認すること。
- **ローグライクダンジョン /dungeon（2026-07-19, Issue #3）**: 育てたアバターの**フルオート潜行**。サーバーが5ステップ（出発/イベント×3/結果）を`performDive`で一括確定し`DungeonRun.steps`に保存、クライアントは確定済みstepsを再生するだけ（`src/app/dungeon/player.tsx`・AIトークンゼロ）。**2026-07-21に再生を「動くRPGリプレイ」へ刷新（松演出）**: CSS描きの通路シーン（たいまつ/深度で暗くなる背景/ボス階は赤紫）でアバターが歩き、戦闘は突進の掛け合い+ダメージ数字+CRITICAL+撃破バースト、罠はシェイク+赤ビネット（回避はジャンプ）、宝箱はドロップ名ポップ、深度変化は「▼B4F」暗転の階段演出（敗走は▲で押し戻し）、最後は探索結果オーバーレイ+紙吹雪。HPゲージ/ダメージ数字は**演出専用のフレーバー**（ロジックには存在しない・結果はサーバー確定のまま）。WebAudioのピコピコSEはデフォルトOFF（localStorage記憶）。スキップ即リザルト/reduced-motion対応。CSSは globals.css の dg- プレフィックス群。⚠実装メモ: setStateのupdater内で ref.current を読むと遅延実行時に値がズレる（タイプライター行が断片化した→先にキャプチャして渡す）。基礎深度=f(現世代Lv,世代数,継承限定形態)で#1の周回報酬を回収。**コンテンツは `src/lib/dungeon/content.ts` のTSマスタに足すだけ**（モンスター12+ボス2/ガジェット31=N〜UR/罠8/癒やし6、ID文字列参照でマイグレーション不要、引退はretired:true）。ドット絵は`scripts/gen-dungeon.py`（文字マップ・25スプライト）。**挑戦回数の哲学: 1日1回+週報提出週のみ+1回。タイマー回復は意図的に無し**（依存させない・制限は「アバターの休養💤」として表示=休むのも仕事のうち）。`DungeonRun.slot`("d:日付"/"b:週開始")の@@uniqueが構造で強制。遺伝子は`GENE_DUNGEON_MODS`で得意分野化（罠回避/宝発見等）。週報提出週は「週報の盾」で敗走1回無効。**ダンジョンはEXP対象外**（意図的・遊びは消費でありファーミング誘発を避ける）。コレクションは`OwnedGadget`（1種1個・図鑑形式で未所持は???表示）。
- **UIシェル切替: デスクトップOS風UI（2026-07-20, feature/desktop-shell）**: メニュー肥大化の整理として松案を実装。**旧UIは削除せず「クラシックモード」として共存**（ロールバックはgitでなく設定で）。`resolveShell`（src/lib/shell.ts）= User.uiShell（マイページSHELL.cfgで本人切替）→ `UI_SHELL_DEFAULT` env（未設定=classic）。機能一覧は **src/lib/apps.ts の APPS レジストリが単一ソース**（クラシックナビ/スタートメニュー/デスクトップ/ドックすべてここから生成。機能追加は1件足すだけ）。desktop時: ホーム=デスクトップ（4グループ点線ゾーン+PixelIconアイコン+TODAY.sys案内所+PLAYER_FILE）、下部タスクバー（▶スタートメニュー・現在地チップ・⛏🔥トレイ）。モバイルは同コンポーネントがドック+全画面ドロワーに変形。アイコンは src/components/pixel-icon.tsx（文字マップ・画像不要）。getPlayerStats はReact cacheでリクエスト内メモ化（layout+ページの二重呼び出し対策）。デザインモック: claude.ai artifact e77cc6d5（PC/モバイル両モード）。
- **レアキャラ来訪→ペット化+マイホーム（2026-07-20, Issue #2, feature/pet-home）**: 1日1回サーバー抽選（8%＋7日会えなければ確定＝ピティ、`Encounter`に NONE/PENDING/BEFRIENDED/FLED/EXPIRED で全記録・リロード耐性）。PENDINGの間だけ全ページ左下にフローティング出現（layout組込・両シェル対応）→クリックで会話。**会話は性格4種（人懐こい/ツンデレ/おくびょう/マイペース）の定型ツリーが基本**（トークンゼロ・ボーナスはサーバー再計算で改ざん耐性）、ANTHROPIC_API_KEYがあればAI自由会話も解放（`aiTalkStep`: assertAiAllowed("pet-talk")・入力はデータ扱い・3往復でAIがbond採点）。判定=基礎55%+会話bond+**活動ボーナス**（ストリーク/今週の週報/よもやま=「毎日来てるね」体験）上限90%。成功→`Pet`作成・命名。**/home マイホーム**: 部屋（壁棚6+床6スロット）にペットが徘徊（CSS steps・決定的配置）、クリックで**なでなで**（1日1回/匹・affection+1・なつき度4段階）、ダンジョン戦利品を配置（OwnedGadget.homeSlot・@@unique）。公開プロフィールに「なかま」表示（名前と種族のみ）。**種族マスタ src/lib/pets/species.ts はスプライトをパス宣言するだけ＝宇宙人流用と開発者手描きPNG支給が同一機構**（支給契約は public/pets/README.md。人の手のテイストを入れる正規ルート）。**キャラは開発者手描きの20体（駄菓子・おばけ・レトロゲーム）を採用**、happy差分は `scripts/gen-expressions.py` が normal.png から自動生成（PNG自前デコード→ドットグリッド量子化→目・口検出→目を細め口角を上げる。`--sheet` で before/after 確認シート。同手法は汎用スキル pixel-expressions として ~/.claude/skills/ にも格納）。⚠会話モーダル中のアクションで revalidatePath すると Visitor がアンマウントされ結果UIが消える（→判定系はrevalidateせず閉じる時に router.refresh。ハマった）。**残課題**: 部屋の壁紙きせかえ／ペット同士の掛け合い／デスクトップ常駐（ホーム画面をペットが歩く）。
- **ペットにごはん（Issue #23 竹案／2026-07-24に1日3回化）**: マイホームのペットに**1日3回/匹**ごはんをあげられる（ペット感=接点を増やすため1回→3回に。`MAX_FEEDS_PER_DAY`=3 in `src/lib/pets/foods.ts`。回数は`Pet.fedCount`で数え`lastFedAt`の日付が変わるとリセット、`feedPet`が`feedsLeft`を返す）。UIは「あと N回」表示（旧`fedToday:boolean`は廃止し`feedsLeft:number`に統一＝care-menu/living-scene/desktop-scene/home page。LIVINGのリード文も「なでなで1日1回・ごはん1日3回」に修正）。ごはんマスタはTS定義・DBは所持数`FoodItem`だけ。種族ごとに好物1つ（当てると なつき度2倍＋ごはん図鑑`Pet.favoriteFoundAt`に記録）。配膳は「投げない原則」でもりつけ演出3種（皿/手のひら=なつき度8+/いっしょに=好物day）。デイリー配布3個（`DAILY_FOOD_COUNT`・`grantDailyFood`・recordVisit経由。**在庫は据え置き**＝複数匹だと1日で使い切れず「毎日ログイン＋ダンジョンで拾う」動線として機能）。ダンジョンでも拾える（`rollFood`）。おせわメニュー`care-menu.tsx`はbody直下へポータル（シーンのisolateでz-index閉じ込め回避）。**2026-08-10: マイホーム常設の「ごはん図鑑」セクションは削除**（ごはん一覧はおせわメニューで足りるため）。好物の発見記録はおせわメニューのごはん一覧に♥バッジで表示する形に移行（`favoriteFoundAt`と発見判定・なつき度2倍はそのまま。FOODSマスタの`rarity`/`desc`は読み手が消えたがフレーバーデータとして保持）。⚠なでなでは何回でも可・なつき度加算は1日1回（`petPet`のgained）／ごはんは在庫消費なので3回とも加算する（在庫が有限＝暴走しない）。
- **LOADING宇宙人（2026-07-19, Issue #7）**: 20種（10形状×2カラー）× 通常/にっこり差分 = 40PNG（`public/aliens/`）。原本は `scripts/gen-aliens.py` の文字マップ（1文字=1ドット、実行で再生成、一覧は docs/design/aliens-sheet*.png）。`<LoadingAlien>`（src/components/loading-alien.tsx）がランダム1体+3アクション（ぱたぱた/にっこり/ジャンプ、globals.cssのalien-*）を抽選、連続同キャラはsessionStorageで回避、reduced-motionは静止。**塩梅ルール: 体感1秒超の待ちだけに出す** — ルート遷移(loading.tsx)とAI待ち(sending-overlay)のみ。保存等の短い待ちには出さない（ガチャの新鮮味維持）。#2のレアキャラ来訪・図鑑と設定を共有できる。

**週報フィードバックの品質改善（2026-07-24, Issue #24）**: 週報提出時のAI「今週の成長ポイント」が要約＋一般論になっていた問題を、`src/lib/ai/analyzeReport.ts` の SYSTEM_PROMPT に**フィードバックのルール節**を足して解決。方針は確定済み（コーチ寄り／スキル＋SESキャリア軸／4〜5文、**コンディションスコア40以下の週は自動でねぎらい寄せ**）。構成を固定（良かった点の意味づけ1〜2文＋来週すぐ実行できる粒度の次の一手1〜2つ）、禁止事項を明記（週報の言い換え・羅列称賛・「相談してみましょう」等の丸投げ・3つ以上の助言）。**コンテキスト増強**: `User.targetDomains`（目指す領域＝次の一手の接続先。`domainsToLabels`）／前週の`nextText`（有言実行の対比）／直近3回の`feedbackText`（同じ助言の繰り返し防止）をuserPromptに追加。**検証済み（2026-07-24、実API・旧新プロンプトのA/B）**: seed週報は25〜64字と薄く差が出ないため、実務に近い週報（RDSスロークエリ改善でp95 1.8s→400ms／Terraform初挑戦／state管理が不安）を一時作成して比較（検証後にDBから削除済み）。旧は「〜相談してみると良いかもしれません」＝禁止した丸投げで終了。新は①成果を「経歴書に『DBチューニング実務経験』と書ける資産」と意味づけ（SESキャリア軸）②「S3バックエンド＋ロックの必要性を**15分だけ**調べる」と実行粒度を指定③目指す領域（インフラ）に接続、と合格基準「フィードバックだけ読んで来週の動きが分かる」を満たした。コンディション低の週（workloadSelf=1・「正直きつい」）では新プロンプトがねぎらい＋「まずリーダーに負荷を共有する、それだけ」に寄り、分岐も意図どおり動作。**ローカル検証には`.env`のANTHROPIC_API_KEY（設定済み）と`npx tsx --env-file=.env`が必要**（tsxは.envを自動読みしない）。

**メンターの接し方（スタンス）2026-07-24**: 本人が「やさしめ / ふつう / きびしめ」を選べるようにした（`User.mentorStance`、既定 normal）。定義は **`src/lib/ai/stance.ts` に一元化**し、用途別の断片（週報FB・チャット・深掘り質問・学習プラン）を出し分ける。**設計の芯: 変えるのは語り口と要求水準だけで、スキルの判定基準は変えない** — きびしめの人のLv5とやさしめの人のLv5が別物になると社内スキルDB・経歴書の裏付けとして比較できなくなるため、深掘りは**質問生成にだけ**スタンスを渡し、判定（`submitSkillProbe`）には渡していない。**安全側が常に勝つ**: コンディションが低い週は `LOW_CONDITION_OVERRIDE` でねぎらい優先（自己申告 conditionSelf≤2 または workloadSelf≤1 で決定的に付与＋SYSTEM_PROMPT側の40以下ルールと二重担保）。実API検証: きびしめは「stateの仕組みが曖昧なまま範囲を広げようとしています」と逃げを名指しし「自分の言葉で説明できるか確認してから手を動かす」と問い返し、経歴書に書ける/書けないを明示。やさしめは15分の一歩を提案。**きびしめ設定でもスコア12の週は「相談することだけを最優先に」となり技術的要求ゼロ**を確認。深掘り質問もきびしめだけ担当範囲の境界を問う設問が入った。マイページ STANCE.cfg の保存も実UIで検証済み（normal→strict→gentle と往復）。なお3択は `peer sr-only` のラジオなので、**E2Eで座標クリックすると当たらない**（1px幅）。テストではラベル要素かJSで選択し、保存ボタンだけ実クリックすること。**オンボーディング初回選択**も実装済み（`TutorialStep.pick="stance"` の4/8ステップ。選んだ瞬間に保存するので、その場で閉じても残る／選ばなければ既定のふつうのまま進む）。チュートリアルは**データ駆動のまま拡張できる設計を維持**した（説明だけのステップと選ばせるステップを型で分岐）。

**困りごとを実績として抽出する誤りの修正（2026-07-24, Issue #24）**: 「障害対応が続いていて正直きつい」という弱音から `障害対応 Lv7` の提案が立っていた。原因は SYSTEM_PROMPT のスキル抽出ルールに**どの欄が実績の根拠になるかの定義が無く**、週報本文を丸ごと渡していたこと。対策は2段:
- **プロンプト**: 実績の根拠は【今週やったこと】【新しく触れた技術】のみ。【詰まったこと・モヤモヤ】は困りごと、【来週やること】は予定であり実績ではないと明記。evidenceQuote もこの2欄からの原文引用に限定。
- **構造ガード** (`isFoundedOnAchievement`): 引用が実績欄に無く、かつ困りごと／予定欄にあるものは提案を作らずスキップ（`console.warn` に記録）。言い換え引用まで落とすと正当な抽出を巻き込むため「実績欄に無く、かつ非実績欄にある」ものだけを対象にしている。
実API A/B: 修正前は `Kubernetes Lv3 ←「podがなぜ落ちるのか分からないまま」` を抽出、修正後は実績欄の `テスト設計・仕様書作成 Lv4` のみ。⚠ガード関数自体は6ケースで検証済みだが、**パイプライン上でガードが発火する経路は未実証**（新プロンプトだとモデルが困りごとを引用してこないため）。

**深掘りインタビューの実機検証と修正（2026-07-24, Issue #25）**: リリース済みの機能をローカル実API・実UIで通しで回して調整。**判定機構は健全**（弱音「障害対応が続いていて正直きつい」から立った Lv7 提案に曖昧回答 → **Lv3 に降格**、Terraform Lv6 提案に具体的回答 → **Lv4** と妥当に判定。Q&A・判定根拠は `SkillSuggestion.probe` に保存され、承認で `verifiedBy="interview"` が付くところまで確認）。見つかった不備と対応:
- **判定結果と当初理由が矛盾して並ぶ**: 確定Lvの真下に旧Lvの根拠文が残り「→Lv3」「Lv7の根拠が確認できる」が同時に見えた。判定後は `当初の提案:` ラベル付き＋淡色に（suggestion-card.tsx）。
- **判定がリロードで消える**: `judged` がクライアントstateのみだったため、再訪すると確定Lvだけ残り根拠が旧提案のものに戻った。`page.tsx` から `probe` を渡し初期stateを復元。
- **AI待ちに宇宙人が出ない**: 3〜4秒の待ちがボタン内の「…」だけだった（Issue #7の塩梅ルール違反）。`SendingOverlay` を追加（承認/却下の一瞬の待ちには出さない）。⚠**`setAiWait` は `start()` の外で呼ぶこと** — React 19では非同期トランジション内のstate更新は完了まで描画されず、待ち時間中にオーバーレイが出ない（実際に一度これで空振りした）。
- **仮判定の再承認で「✓検証済み」が消える**: `decideSuggestion` が `verifiedBy` を無条件に上書きしていたため、腕試しや過去の深掘りで得た検証済みが同レベルの再承認で失われた。レベルが変わらなければ維持するよう修正（actions.ts）。

**ランディング強化（2026-07-24, Issue #15）**: `/welcome` を未登録者向けに作り直した。コピーの軸は**「がんばりは、ぜんぶ経験値になる。」**。ヒーローは**スクショ画像を置かず `PixelAvatar` の実スプライトを5段階並べている**（たまご→ひよこ→みならい→いちにんまえ→マイスター、`HERO_STAGES`）— 画像素材の管理が不要で、アバターを更新すればランディングも自動で追従する。構成は ヒーロー → TRY（ゲスト） → LOGIN → 機能3枚（週報/腕試し/ダンジョン・`FEATURES`、機能名の羅列でなく「行動→見返り」で書く） → PRIVACY（PIIレス設計を独立枠で・最大の差別化なので）。**OGPは `src/app/welcome/opengraph-image.tsx` で動的生成**（next/og・1200×630・PNG 60KB・画像ファイル不要でコピーを変えればカードも追従）。⚠satoriはCSSが限定的（flex中心・grid不可）で**CSS変数も解決できない**ため、OG画像内のドット絵は色を直値で持った軽量版を別に持っている（`PixelAvatar` は流用不可）。⚠ローカルで未ログインの見え方を確認するには `DEV_LOGIN_ENABLED="false"` にする（trueだとナビ付きのログイン状態で表示される）。セッションcookieはHttpOnlyなのでJSでは消せず、ログアウトはマイページのボタンから。

**ゲストセッション（2026-07-24, Issue #18）**: 登録なしでコア体験→OAuthで昇格。**ゲストは専用テーブルではなく本物の User 行**（`role=GUEST`）なので、**昇格は role を書き換えるだけでデータ移行が発生しない**（Issueが「要設計」としていた点はこれで解決）。発行は `POST /api/guest/start`（GETだとプリフェッチ/クローラで量産されるためPOST・IP別に1時間5回・`src/lib/guest.ts`）。解放アプリは**許可リスト方式** `GUEST_ALLOWED_APPS`（腕試し/ダンジョン/マイホーム/**マイページ**）で `src/lib/apps.ts` にある — ⚠**このファイルはクライアントからも読まれるので prisma 依存を import しないこと**（やって全ページ500にした）。マイページを解放しているのは**昇格の導線がそこにあるため**。遮断は2層: 一覧に出さない＋`requireFullAccount()`（ページ）/`requireFullAccountUser()`（Server Action・15箇所）。**AIは `assertAiAllowed` の単一チョークポイントで一括拒否**（code=`GUEST`）。掃除は `scripts/cleanup-guests.ts`（未昇格30日・`--dry-run`・`GUEST_TTL_DAYS`で調整）。**昇格E2E検証済み（2026-07-24, Google）**: 同一User.idのまま `GUEST→ENGINEER`、腕試しの記録1件も保持、`/mypage?promoted=1` で引き継ぎ完了を明示。⚠**既存アカウントと衝突した場合は `already-linked` で拒否**（ユーザー判断・①案）＝ゲストの育成データは宙に浮き30日で消える。踏む人が出たらマージを検討。⚠ローカルでゲストを試すには **`DEV_LOGIN_ENABLED="false"` が必須**（trueだと常にdevユーザー扱いでゲストを作れない）。**（2026-07-24 ユーザー実機テストで判明した2つの穴を修正）**: ①初回チュートリアルがフル版のままで、ゲストを「行けない週報」に誘導し閉じると二度と辿れず迷子にしていた → **ゲスト専用ツアー** `GUEST_TUTORIAL_STEPS`（いま遊べること＋登録の見返り、最後のCTAは行ける先=`/quiz`）を `Tutorial guest` prop で出し分け。②**トップ `/` のclassicダッシュボードはタイルを直書き**（`appsForRole`を通さず週報/スキル/メンター等11個を全員に表示）で、ロゴから来たゲストに遮断アプリが丸見えだった → `page.tsx` に**ゲスト専用ホーム分岐**を追加（許可アプリ`appsForRole`＋UNLOCK.cfg登録カードのみ）。**教訓: ゲスト遮断は「ナビ(appsForRole)を絞る」だけでは不十分。トップの直書きタイル・チュートリアル・各所のCTAなど、role非依存で全機能を並べている箇所を個別に潰す必要がある。**

**公開ページのSEO整備 Phase 1（2026-07-25, Issue #14）**: 既存の公開プロフィール(`/u/[handle]`)を検索資産にする基盤。**最重要の詰まりを解消**: `/u/` はページ側に認証が無いのに**middlewareの除外に入っておらず、未ログイン（=Googlebot）が`/welcome`に弾かれていた**＝実質クロール不可だった → matcherに`u/`（＋`sitemap.xml`/`robots.txt`）を追加。あわせて: `src/app/robots.ts`（公開は`/`,`/welcome`,`/u/`のみ・認証必須ページはDisallow・sitemap宣言）、`src/app/sitemap.ts`（`listPublicProfiles()`から`/u/<handle>`を列挙・welcome含む）、`/u/[handle]`に`generateMetadata`（内容ベースのtitle/description/canonical/OGP、descriptionに上位スキル名を織り込みロングテール狙い）。ベースURLは`src/lib/site-url.ts`（`APP_URL`・本番Vercelで要設定）。鉄則どおりコンディションは公開面に一切出さない（`loadPublicProfile`が返さない）。検証: 未ログインcurlで`/u/...`が200＋動的metadata、robots/sitemap生成、認証ページは`/welcome`へ弾かれるのを確認。⚠検証で`engineer2`の公開プロフィール項目を触り`handle=cloud-taro`/bioを復元済み。**Phase 2（2026-07-25）完了**: 良問の公開ページ`/q/[id]`（`src/lib/public-question.ts`＋`src/app/q/[id]/page.tsx`）。**答えの段差**: `loadPublicQuestion`は正解・解説を返さない（未ログインHTMLに答えを混ぜない構造保証）／未ログインは問題文＋選択肢のみ＋登録CTA／ログイン済みは`loadQuestionAnswer`で正解＋解説を出す＋腕試し導線。**インデックスは良問だけ**＝`ratingCount≥1 かつ 平均≥6`（0〜10スケール、`PUBLIC_QUESTION_MIN_AVG`）。良問はsitemap掲載＋indexable、未評価は`/q`は開けるが`robots:noindex`。**構造化データ** schema.org `Question`＋`suggestedAnswer`（`acceptedAnswer`＝正解は入れない＝答え非漏洩）。middleware除外に`q/`追加、robots.tsで`/q/`許可、sitemapに`listPublicQuestions()`（質で絞る）を追加。検証: 未ログインで問題見える/答え隠れる、ログインで答え出る、良問indexable・未評価noindex、sitemap掲載を確認。⚠any認証ユーザーが作問できるUGCなので、公開は良問（評価済み）に絞っている＝スパム/薄い問題は検索に載らない。全体停止や通報の仕組みは未実装（小規模・招待前提のため）。

**TIPS強化（2026-07-25, Issue #20の①③）**: 右下TIPSトースト（`tips-toast.tsx`/`tips.ts`）に3点追加。①**新規期間**（`User.createdAt`から3日・layoutで`isNewcomer`算出しpropで渡す）は**1日3回**まで（通常は1回）で、ランダムではなく`ONBOARDING_TIPS`を優先度順（週報→腕試し→ダンジョン→マイホーム→きせかえ、id `nc-*`）に流し、消化後は通常ランダムに合流。③**オフ設定** `User.tipsEnabled`（DB持ち・マイグレーション・マイページTIPS.cfgのトグル・`setTipsEnabled`）。localStorage状態は旧形式`{lastShown,seen}`→新形式`{day,count,seen}`を吸収する後方互換つき。**ついでに既存漏れ修正**: 従来ゲストにもTIPSが出て`/quiz/new`や`/discover`（遮断済み）に誘導していた → layoutで`role!=="GUEST"`ガード追加。②文脈TIPS（イベント連動）は#16で週報等の立ち位置が変わるため**あえて未着手**（変わってから書く方が書き直しが少ない）。検証: 新規で nc-report→nc-quiz→nc-dungeon と優先度順に出て4回目は上限で止まること、オフでトースト非マウント、ゲストで非表示を実機確認。⚠検証で `engineer2.createdAt` を一時的に今へ変更→2026-06-01へ戻した（seed値は不明なので厳密には非復元）。

**問い合わせ（2026-07-20, Issue #9）**: `/contact`（**未ログインでも開ける**＝middlewareの除外に追加）。PII非保持方針との両立が設計の芯で、**返信先メールを集めない**。ログイン済み=`Inquiry`に保存し**返信はマイページ「運営とのやりとり」**（SUPPORT.log・NEWバッジ・表示で自動既読）、未ログイン=**DBに保存せず**`notify()`でSlackへ流して破棄（任意の返信先も通知に載せるだけで保存しない）。管理は `/admin/inquiries`（未対応/全件フィルタ・返信・クローズ）、管理ダッシュボードに未対応件数バッジ。レート制限は24時間3件。カテゴリ等の定義は `src/lib/inquiry.ts`。導線: マイページ・error.tsx の「運営にご連絡ください」。

**社内公開の初期データ（2026-07-20）**: `npm run seed:launch`（`prisma/seed-launch.ts`）。開発用 seed.ts とは別で、**本番に1回流す公開用**。EN運営アカウント（正体を明かす・ハンドルなしで「EN運営」と表示・isPublic=falseで発見ページには出さない）名義で、よもやま8件（話題ふり＝空っぽ感の解消と投稿ハードル下げ）＋良問バンク27問（実用的な四択・解説つき）。**架空の同僚アカウントは作らない方針**（社内公開では露見が早く、信頼を落とすため。賑わいの演出でなく中身で「作り込まれている」と伝える）。固定IDのupsertで冪等。手順は DEPLOY.md 手順6。

**Phase 5-6 追加機能（2026-07-17）:**
- **管理者ダッシュボード /admin**（admin限定・非管理者404）: 全ユーザー分析(サマリ6枚+ユーザー表)＋BAN(停止/復帰)＋招待発行/失効を集約。マイページからは撤去。
- **良問バンク /quiz**: ユーザーが四択を作り皆で解いて育てる問題集。採点はサーバー(submitQuizAnswer)でローカル完結＝**AIトークン消費ゼロ**、正解はクライアントに渡さない。評価(0-10)は`rateQuiz`がトランザクションで**全員分を集計**(QuizQuestion.ratingSum/Count)＝1問の良問スコアは総意で決まる。QuizQuestion/QuizRating(@@unique questionId+userId)/QuizAttempt。
- **よもやま掲示板 /yomoyama**: ハンドル名で現場の話を投稿。投稿前にAI門番(src/lib/ai/moderation.ts)が①個人特定 ②会社/案件固有名 ③実在著名人 ④誹謗中傷/荒らし を検知しブロック(本文はデータ扱いでインジェクション耐性)。postYomoyamaは`assertAiAllowed`通過→門番→OKだけ保存、ブロック時は理由と修正案を返す。AIチェック失敗時は安全側でブロック。
  - **ソーシャル拡張（Issue #4, 2026-07-19）**: いいね(YomoyamaLike・postId+userId unique・楽観更新・非AIの軽量レート制限40/分)、コメント(YomoyamaComment・**投稿と同じAI門番**を通す=`addComment`)、投稿者の**コメント可否トグル**(YomoyamaPost.allowComments)、管理者の**ソフト削除**(deletedAt+deletedById・tombstone表示)。**EXPは対象外**(将来足すならファーミング対策必須)。UI: like-button.tsx / comment-form.tsx / page.tsx。
**Phase 1〜4 完了 + 会社独自ノウハウのRAG化 完了（2026-07-14）**。8bit/Y2Kデザイン + きせかえ5種。コンディション検知 src/lib/condition.ts は温存（呼び出し元はIssue #19で全撤去、将来の本人向けセルフケア用）。デモ履歴はseed投入済み（engineer2@… は要注意の物語）。

- **おさんぽ（2026-07-25, Issue #26）**: うちの子と歩くのを眺めるだけの見る専画面 `/walk`。操作不要・低負荷。
  - **世界はcanvasタイルエンジン**（`src/app/walk/walk-canvas.tsx` + `src/lib/walk/world.ts`）。内部320x180をCSSで拡大。草原→堤防→河原→街中→山道の5ビオームを巡回し、遠景/中景/地面の3層視差。地面はワールド座標に固定（列ごとにビオーム判定）なので境界が地続きに流れ、遠景・中景は境界の道標が横切る間にクロスフェードで入れ替える。
  - **⚠️描画の鉄則: 模様は必ずワールド座標（整数wx）で決めて `wx - round(phase)` で画面に置く**（`worldCols()` ヘルパー）。画面側の8px格子に描くとスクロールのたびに模様が再抽選され、全画面が同時に点滅して「目にうるさい」状態になる（実際にやらかして修正した）。ビルの窓も「ビル内の行列番号」でハッシュしてビルに固定すること。
  - **つぶやき**: 基本は辞書（`src/lib/walk/mutter.ts`・時刻×天気×場所×コンディション×なつき度×性格）でトークンゼロ。加えて1散歩に1回だけAI特別枠（`walkAiMutter`）。**AI層は完全にfail-open** — 上限/ゲスト/失敗のいずれでも例外を投げず黙って辞書に戻る（眺めているだけの画面でエラーを出さない）。コンディションが低調/高負荷なら気づかい系を強く優先（#16セルフケアの延長）。
  - **天気**: Open-Meteoへ**ブラウザから直fetch**（`src/lib/walk/weather.ts`）。**座標は当サービスのサーバーに送らない**。許可なし/失敗時は季節＋時刻の擬似天気に自動フォールバック。雨・雪・霧はcanvas内のパーティクル（`drawWeather`）。
  - **歩行の表現**: 前傾＋2コマボブ＋土ぼこり＋**瞳が右を向く walk.png**。`scripts/gen-side.py` で20種族に生成（`gen-expressions.py` のSprite再利用。瞳シフト成功12・検出不能8はnormalコピーにフォールバック）。
  - **BGM（`src/app/walk/bgm-player.tsx`）**: 開発者本人の8曲を `public/bgm` からランダム再生（全曲1周してから引き直す＝連続再生しない）。曲間5秒。**ON状態は復元しない** — ブラウザは操作なしの自動再生を必ず止めるので、復元しても「ONなのに鳴らない」だけになる。音量のみlocalStorageに記憶しON時に反映。音源は書き出し時に音量を揃えてある（元は3.4dB差→0.7dB差・128kbps・計27MB）。**⚠自動化テストでは音が出せない**（合成クリックはユーザー操作と見なされない）ので、再生確認は実機の手クリックで行うこと。

- **ペットとの会話（2026-07-26）**: おせわメニューの「はなす」＝AI会話。好物ヒントを返すだけの「ヒントをきく」（旧・話しかける／トークンゼロ）とは別機能。
  - **汎用チャットとの違いは文脈**（`src/lib/pets/talk-context.ts`）: 週報の内容・さいきん伸ばしたスキル・直近7日のダンジョン戦果・なつき度・前回の会話からの日数・その子が覚えていることを渡す。「AIが喋る」のではなく「きみを見てきた子が喋る」状態をデータで作るのが芯。
  - **⚠週の前半は今週ぶんの週報が無いのが普通**なので、直近2週間の最新を見る。今週だけを見ると月火は「何も知らない子」になる（実データで気づいた）。コンディションは粗いラベルに畳んでから渡す（生スコアは渡さない）。
  - **記憶**（`PetMemory`）: 同じ応答の中で `remember` も返させるので、抽出のための追加のAI呼び出しは無い。直近12件だけ保持。
  - **コスト**: 1往復=AI1回で実測 入力約760/出力約115tok＝**約0.6円**。`assertAiAllowed` に加えて会話専用の日次上限（既定10往復・`PET_TALK_PER_DAY`）を別枠で持つ（会話だけでAI枠を食い潰さないため）。
  - **声**は音声合成でも録音でもなく、文字数ぶんのビープ（種族idからピッチ決定）。データ不要・コスト0。
- **ダンジョン＝コマンド選択制（2026-07-26）**: フルオートの紙芝居から、ターン制コマンド戦闘＋階層の選択に作り替えた。
  - 作り替えの根拠は実測: 潜行まるごと13.8秒・イベント3回固定・**48.9%が手ぶら**・毎秒42文字でクリック待ちゼロ・ボスは地下10階以上が条件で**初心者は構造上たどり着けない**。
  - `lib/dungeon/battle.ts`（戦闘・**乱数を注入できる純関数**なのでバランスをシミュレーションで検証できる）／`lib/dungeon/session.ts`（探索の状態機械）／`app/dungeon/session-actions.ts`（サーバーアクション）／`app/dungeon/dive-player.tsx`（UI）。
  - **判定は全部サーバー**。クライアントから来るのはコマンド名だけで、HPやダメージは受け取らない。状態は `DungeonRun.state`（`status` ACTIVE/DONE）に持つので途中で閉じても続きから戻れる。潜行枠は従来どおり `slot` の `@@unique` が守る。
  - **手ぶらを構造から消した**: 敗走しても戦利品は持ち帰れる／初回は宝箱確定／それでも空なら帰り道でひとつ拾う（`finishDive`）。初回のみ「はじめての盾」1枚。
  - バランスの目安（各5000回）: 手ぶら0%・初回はB7.6F到達／ボス遭遇20%、ボス撃破率 Lv1 17%→Lv3 75%→Lv8 93%。**数値を触ったら必ずシミュレーションを回し直すこと**（1戦の勝率ではなく「HP持ち越しで何階まで行けるか」で見る）。
  - 旧 `performDive`（フルオート一括解決）と `app/dungeon/player.tsx` は残置。履歴表示の作り替え時に整理する。

## 再開手順

```bash
cd /Users/sysnavi_admin/Projects/sysnavi/engineer-navigator
docker compose up -d          # DB(port 5433)。既にvolume/migrate/seed済み
npm run dev                   # http://localhost:3000
open docs/design/styletile.html   # デザイン方向の見本（ブラウザで直接開ける）
```

## 会社独自ノウハウのRAG（このアプリの差別化の核）

AIの提案・評価を一般知識ではなく**会社のノウハウ**で裏付ける。`KnowledgeChunk` を kind で分け、各AI呼び出し前に該当kindだけを検索して system に注入する（用途外の知識が混ざらないようにするため kind 絞り込みが重要）。

```bash
# .env に VOYAGE_API_KEY（https://www.voyageai.com/）を設定してから:
npm run ingest:knowledge      # content/knowledge/<kind>/*.md を埋め込み投入
```

| kind ディレクトリ | 用途（注入先） |
|---|---|
| `learning/` | メンター・学習プラン |
| `skill-criteria/` | 週報のスキル抽出（analyzeReport） |
| `condition-playbook/` | コンディションのトーン解析・シグナル判断 |
| `role-definition/` | 役割シミュレーターの評価 |
| `rate-evidence/` | 経歴書の単価キーワード（現状は highlight.tsx の配列と対応させる運用） |

- ヘッダ `# source:` `# topic:` `# url:` 付きの .md を置いて再ingestするだけで差し替え可能（booknavi研修資産・社内規程の流用先）
- VOYAGE_API_KEY 未設定・該当なしなら全機能が従来どおり動く（RAGをスキップするだけ）
- 距離しきい値は実測ベース: 学習=0.5 / ノウハウ=0.7（src/lib/ai/retrieval.ts のコメント参照）

デモユーザー（cookie `dev-user` で切替、デフォルト engineer@sysnavi.co.jp）:
`admin@sysnavi.co.jp` / `sales@sysnavi.co.jp` / `engineer@sysnavi.co.jp`

## Git / リポジトリ

- リモート: https://github.com/sysnavi/engineer-navigator （origin/main 追跡済み）
- 初回コミット 90721d1 済み。author は tsuyoshi.shimada@sysnavi.co.jp に修正済み（グローバル git 設定も同アドレスに変更済み）
- `.env`（APIキー）と `.claude/`（マシン固有パス）は gitignore 済み

## デザイン方向（2026-07-13 確定）

**フル 8bit / Y2K / レトロGUI で振り切る。** 由来は社員総会プレゼン資料の p59〜75（午後アクティビティ区画）。
見本: [design/styletile.html](design/styletile.html)（このリポジトリ内・ブラウザで直接開ける）

- パレット: ロイヤルブルー #004AAD（枠・タイトルバー）/ #2A6FD6 / スカイ #5DADE2 / ペリウィンクル #C1DBFF / 方眼青 #D7E7F4 / ライラック #F9ECFD / **ホットピンク #F24E9C は「行動」ボタン専用** / レモン #FFD84D / ネイビー #12235F（線と文字）
- モチーフ: レトロOSウィンドウ（`週報.exe` `SKILL_MAP.sav`）/ 方眼紙デスクトップ / ピクセル見出し＋可読な本文 / ゲーム語彙（LEVEL UP・ACHIEVEMENT）/ スキルLv＝光るブロック
- 技術: アプリ本体は DotGothic16 (next/font) でピクセル見出し・本文は Hiragino 系（canvasドット化はアーティファクト見本のみ）。トークンとパレットは globals.css、共通部品は src/components/retro.tsx
- 2026-07-14 確定: ドット解像度は現行 / ホットピンク=行動専用 / スキルLv=光るブロック / パレット5種（固定色: ピンク・レモン）

## 次の一手（優先順）

1. **会社独自ノウハウのRAG化**（ユーザー最重要要望・機能完成後に着手と合意）: 全AI提案/フィードバックを社内ノウハウで裏付ける。既存 LearningChunk RAG基盤を一般化。詳細はメモリ [[knowhow-rag-direction]]
2. Phase 4 仕上げ: ロールプレイ実施履歴をスキルマップ/経歴書のエビデンスに載せる
3. 運用: 週次ジョブの本番cron化 / Slack Webhookの実チャンネル / 本番SSO / 8bit演出磨き込み

## 注意点（ハマりどころ）

- 単発 tsx スクリプトは **先頭で `import "dotenv/config"`** を書かないと DATABASE_URL 未設定で 5432 に繋ぎに行く（このDBは5433）。top-level await 不可なので async main で包む
- Prisma 7 系。client出力は `src/generated/prisma`（gitignore済み、`npx prisma generate` で再生成）。DB接続は `@prisma/adapter-pg` 経由（`src/lib/db.ts`）
- **OAuthログイン（Issue #8 竹マイナス, 2026-07-20）**: Google+GitHub。依存ライブラリなしの標準コードフロー（`src/lib/oauth.ts`・state cookieでCSRF対策・スコープ最小=Googleはopenidのみ/GitHubはscopeなし）。**保存はSHA-256(provider:sub)ハッシュのみ**（AuthIdentity・メール/名前は受け取らない）。セッションは`AuthSession`（ランダムトークン180日・DB照合・logoutでサーバー側も無効化）でen_session cookieに同居、解決順=AuthSession→Invite→dev（src/lib/auth.ts）。新規はハンドル自動生成。ログイン中はマイページAUTH.cfgから後付け連携（別ユーザー所属はalready-linked拒否）。envにCLIENT_ID/SECRETがあるプロバイダだけ/welcomeにボタン表示。**新規ユーザーは7日間、日次AI上限1/3**（usage.tsのNEWCOMER_*）。設定手順はDEPLOY.md §5
- **認証は招待リンク方式**（PII非保持）: `Invite.token` がログイン資格。`/join/<token>` で引換→`en_session` cookie→`getCurrentUser`(src/lib/auth.ts)がInvite→Userを解決。招待ユーザーは `User.email` が null（メール/氏名を持たない）。ローカルは `DEV_LOGIN_ENABLED=true` で従来のdev-cookie切替＆ゲート無効。本番はこの変数を**設定しない**（middlewareが未認証を/welcomeへ誘導）。管理者はマイページADMINで招待発行/失効。ブートストラップは `ADMIN_INVITE_TOKEN`＋seed→`/join/<token>`。将来のSSO化もgetCurrentUser差し替えで可能
- デプロイは Vercel + Neon（[DEPLOY.md](../DEPLOY.md)）。build/postinstallで `prisma generate`（生成clientはgitignore）。**マイグレーションはVercelビルドに組み込み済み**（2026-07-20〜: build = generate → `migrate deploy` → next build。Vercel環境変数 `DATABASE_URL_DIRECT`（Neonのdirect接続）が必要。手動migrateとの順序ずれで全ページ500になる事故の再発防止）。ローカル `npm run build` はローカルDB起動が前提になった点に注意
- /report 画面の「設問間の大きな空白」はアプリのバグではない（ブラウザプレビューペインが0幅で描画したアーティファクト。実ページは正常）
- **⚠スキーマを足したら dev server を再起動する（2026-07-26に2回踏んだ）**: `prisma generate` でクライアントを作り直しても、起動中の Next dev server は**古いクライアントを掴んだまま**。新しいモデル/列にアクセスすると `prisma.xxx が undefined` や `Unknown argument 'status'` で落ちる。マイグレーション適用 → generate → **dev server 再起動**までが1セット
- **マイグレーション運用**: 非対話シェルでは `migrate dev` が使えない（seed実行や@unique制約の確認プロンプトで止まる）。additive変更は「手書き migration.sql + `migrate deploy`」で適用する。適用済みmigrationを手編集するとチェックサム不整合で`migrate dev`が全面停止→`_prisma_migrations.checksum`を現ファイルのsha256に更新して整合（resetは全データ消えるので厳禁）
- **公開共有の鉄則**: 公開ビュー(/u/[handle], /discover, src/lib/public-profile.ts)にコンディション(設問1/2/5/7・スコア)を絶対に含めない。SELECTすらしない設計を維持すること
- **文言のトーン（2026-07-25）**: 説明が丁寧すぎると「生成AIっぽさ」が出る、というのがユーザーの一貫した指摘。方針は**バッサリ削る** — ページのサブタイトル（H1直下の`<p class=...text-inksoft>`）は短い体言止めか削除、仕組みの先回り解説と保険的な念押し（「いつでも戻せます」等）は全カット。**例外**: 同意ゲート・プライバシー・不可逆操作の要点（AI解析する／コンディションは本人だけ／公開は選んだ物だけ／メール・名前は持たずハッシュのみ）は短くしても必ず残す。⚠**i18n/中央コピー層は無い**（全文言がJSXべた書き）ので、直すときは各ページを個別に触る。データ化されているのは apps.ts / tips.ts / tutorial.ts / pets/species.ts / walk/mutter.ts のみ
- **脱・社内前提（Issue #16, 2026-07-25）**: 個人サービス化に伴う再設計。**①コンディション＝セルフケアログ化** — 運営アラート／SALESダッシュボードへの流出経路は#19時点で既に解体済み（週次cronは410、/conditionページ無し、alert関数は呼び出し元ゼロ）。本人だけが振り返れる自己ビューとして `src/components/self-care-log.tsx`（`getConditionSeries`で8週の☀️🌤☁️🌧トレンド＋稼働ラベル、2週未満はnull、直近2週続けて低調なら気づかいメモ）を /report 上部に追加。ヘッダに「運営を含め、これはあなた以外には見えません」。**②よもやま＝通報＋運営非表示** — 公開UGCの安全機構。`YomoyamaReport`（1投稿1ユーザー@@unique・カテゴリ4種は `src/app/yomoyama/report-categories.ts` に分離＝**"use server"ファイルは定数exportできない**ので注意）、通報は本人以外の登録ユーザーのみ・即時非表示にはせず運営確認、`hidePost/unhidePost`はADMIN限定のソフト隠し（hiddenAt/hiddenReason）、一般一覧は `where:{hiddenAt:null}` で除外・管理者のみ全件＋🚩通報数＋非表示/解除。検証済み（通報→DB記録→admin🚩→非表示→非adminに非表示→解除）
- **AIレート制限/停止**: 全AI呼び出しは `src/lib/usage.ts` の `assertAiAllowed(userId, kind)` を**トークン消費前に**通す（3ストリーミングRoute + 週報解析/メンター提案/学習プラン/ロールプレイ開始・評価/インタビュー要約）。1分15回・**1ユーザー24h50回**で拒否、24h600回超で自動停止（`AI_RATE_PER_MINUTE`/`AI_RATE_PER_DAY`/`AI_AUTO_SUSPEND_PER_DAY`で調整）。**自動停止の実効化（2026-07-24）**: 以前は拒否時に`AiUsage`を記録していなかったため24h件数が`AI_RATE_PER_DAY`を超えられず、**自動停止は一度も発火しない死んだ判定だった**（300 vs 600の頃から）。`AiUsage.blocked`（Boolean）を追加して**拒否された試行も記録**し、カウントの意味を分けた: **上限の消費（分/日/全体）は `blocked:false` だけ**で数え、**自動停止だけが試行総数（拒否込み）**で数える。記録するのは**本人の連打による拒否（RATE_MINUTE/RATE_DAY）のみ** — 全体上限や停止中による拒否は本人の落ち度ではないので記録しない（混雑した日に無関係のユーザーが自動停止に近づくのを防ぐ）。管理ダッシュボードと`aiUsageToday`も`blocked:false`で集計（実コストと一致させるため）。検証済み: 上限3・自動停止8で「3回通過→5回拒否→9回目でAUTO_SUSPENDED」、かつ拒否5件は全体枠を消費しないこと。新しいAI入口を足したら必ずこのガードを通すこと。停止/復帰は管理者のみ（マイページADMINパネル、`setUserSuspended`）。**さらに全ユーザー合算の24時間上限（Issue #17, 2026-07-24）**: **既定300回**・`AI_GLOBAL_PER_DAY`で調整。コスト実測: 週報解析1回=入力1964tok/出力371tok（claude-sonnet-5、通常$3/$15 per 1Mtok）→ 約1.8円/回、チャット込みで安全側に2.5円/回 → **300回で1日あたり最大およそ750円**（1ドル155円換算）。※当初ユーザーは「1日100円」と述べており40回に設定したが、その後1ユーザー50回・全体300回の指示があり上書きした（予算感の再確認が必要ならここを見ること）。⚠上限は「回数」であり実コストは1回の重さでぶれる。金額で厳密に抑えるならトークン量での集計が必要（`AiUsage`にトークン列がないため未実装）。到達すると当日は**全員のAIを停止**（code=`GLOBAL_DAY`）し、Slackへ**1日1回だけ**通知する（プロセス内メモリで重複抑止。複数インスタンスならインスタンスごとに1通）。週報提出などAI以外は生きる縮退のまま（`actions.ts` の try/catch で解析だけスキップ）。判定順は 停止 → 自動停止判定 → **全体上限** → 分 → 日 で、全体が止まっても悪用者の自動停止検知は先に効く。管理ダッシュボードの `AI 24H` に `消費/上限` と残数を表示。集計用に `AiUsage` へ `@@index([createdAt])` を追加（既存の複合索引は userId 先頭なので全体集計に効かない）。⚠Issueで「検討」とされていた**1ユーザーが日次上限に張り付く異常のSlack通知は未実装**（自動停止で実害は止まるため見送り）。⚠管理画面の**上限到達時の表示（⚠ 上限到達・AI全体停止中）は実際に到達させての目視未確認**（分岐は三項演算子のみ）

## 未実装・今後

- 会社独自ノウハウのRAG化（[[knowhow-rag-direction]]・最重要）
- Phase 4: ロールプレイ実施履歴のスキルマップ/経歴書反映
- 運用系: 本番cron/Slack実チャンネル/Google SSO
- ポート注意: 3000が別プロジェクトのdockerコンテナ(inno_work)に取られることがある。launch.jsonは autoPort:true 済みなので別ポートで起動する
