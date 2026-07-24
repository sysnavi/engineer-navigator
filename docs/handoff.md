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

画面は15+: `/`(ホーム) / `/report`(週報・自動保存) / `/skills`(スキルマップ＋レーダー＋成長ログ) / `/resume`(経歴書・印刷=PDF) / `/mentor`(AIメンター) / `/plan`(資格学習プラン) / `/quiz`(良問バンク=四択・腕試し) / `/roleplay`(役割シミュレーター) / `/yomoyama`(現場のよもやま掲示板) / `/discover`(発見) / `/u/[handle]`(公開プロフィール) / `/admin`(管理者ダッシュボード) / `/welcome`(招待制LP) / `/mypage`(きせかえ＋共有設定)。

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
- **ペットにごはん（Issue #23 竹案／2026-07-24に1日3回化）**: マイホームのペットに**1日3回/匹**ごはんをあげられる（ペット感=接点を増やすため1回→3回に。`MAX_FEEDS_PER_DAY`=3 in `src/lib/pets/foods.ts`。回数は`Pet.fedCount`で数え`lastFedAt`の日付が変わるとリセット、`feedPet`が`feedsLeft`を返す）。UIは「あと N回」表示（旧`fedToday:boolean`は廃止し`feedsLeft:number`に統一＝care-menu/living-scene/desktop-scene/home page。LIVINGのリード文も「なでなで1日1回・ごはん1日3回」に修正）。ごはんマスタはTS定義・DBは所持数`FoodItem`だけ。種族ごとに好物1つ（当てると なつき度2倍＋ごはん図鑑`Pet.favoriteFoundAt`に記録）。配膳は「投げない原則」でもりつけ演出3種（皿/手のひら=なつき度8+/いっしょに=好物day）。デイリー配布3個（`DAILY_FOOD_COUNT`・`grantDailyFood`・recordVisit経由。**在庫は据え置き**＝複数匹だと1日で使い切れず「毎日ログイン＋ダンジョンで拾う」動線として機能）。ダンジョンでも拾える（`rollFood`）。おせわメニュー`care-menu.tsx`はbody直下へポータル（シーンのisolateでz-index閉じ込め回避）。⚠なでなでは何回でも可・なつき度加算は1日1回（`petPet`のgained）／ごはんは在庫消費なので3回とも加算する（在庫が有限＝暴走しない）。
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

**問い合わせ（2026-07-20, Issue #9）**: `/contact`（**未ログインでも開ける**＝middlewareの除外に追加）。PII非保持方針との両立が設計の芯で、**返信先メールを集めない**。ログイン済み=`Inquiry`に保存し**返信はマイページ「運営とのやりとり」**（SUPPORT.log・NEWバッジ・表示で自動既読）、未ログイン=**DBに保存せず**`notify()`でSlackへ流して破棄（任意の返信先も通知に載せるだけで保存しない）。管理は `/admin/inquiries`（未対応/全件フィルタ・返信・クローズ）、管理ダッシュボードに未対応件数バッジ。レート制限は24時間3件。カテゴリ等の定義は `src/lib/inquiry.ts`。導線: マイページ・error.tsx の「運営にご連絡ください」。

**社内公開の初期データ（2026-07-20）**: `npm run seed:launch`（`prisma/seed-launch.ts`）。開発用 seed.ts とは別で、**本番に1回流す公開用**。EN運営アカウント（正体を明かす・ハンドルなしで「EN運営」と表示・isPublic=falseで発見ページには出さない）名義で、よもやま8件（話題ふり＝空っぽ感の解消と投稿ハードル下げ）＋良問バンク27問（実用的な四択・解説つき）。**架空の同僚アカウントは作らない方針**（社内公開では露見が早く、信頼を落とすため。賑わいの演出でなく中身で「作り込まれている」と伝える）。固定IDのupsertで冪等。手順は DEPLOY.md 手順6。

**Phase 5-6 追加機能（2026-07-17）:**
- **管理者ダッシュボード /admin**（admin限定・非管理者404）: 全ユーザー分析(サマリ6枚+ユーザー表)＋BAN(停止/復帰)＋招待発行/失効を集約。マイページからは撤去。
- **良問バンク /quiz**: ユーザーが四択を作り皆で解いて育てる問題集。採点はサーバー(submitQuizAnswer)でローカル完結＝**AIトークン消費ゼロ**、正解はクライアントに渡さない。評価(0-10)は`rateQuiz`がトランザクションで**全員分を集計**(QuizQuestion.ratingSum/Count)＝1問の良問スコアは総意で決まる。QuizQuestion/QuizRating(@@unique questionId+userId)/QuizAttempt。
- **よもやま掲示板 /yomoyama**: ハンドル名で現場の話を投稿。投稿前にAI門番(src/lib/ai/moderation.ts)が①個人特定 ②会社/案件固有名 ③実在著名人 ④誹謗中傷/荒らし を検知しブロック(本文はデータ扱いでインジェクション耐性)。postYomoyamaは`assertAiAllowed`通過→門番→OKだけ保存、ブロック時は理由と修正案を返す。AIチェック失敗時は安全側でブロック。
  - **ソーシャル拡張（Issue #4, 2026-07-19）**: いいね(YomoyamaLike・postId+userId unique・楽観更新・非AIの軽量レート制限40/分)、コメント(YomoyamaComment・**投稿と同じAI門番**を通す=`addComment`)、投稿者の**コメント可否トグル**(YomoyamaPost.allowComments)、管理者の**ソフト削除**(deletedAt+deletedById・tombstone表示)。**EXPは対象外**(将来足すならファーミング対策必須)。UI: like-button.tsx / comment-form.tsx / page.tsx。
**Phase 1〜4 完了 + 会社独自ノウハウのRAG化 完了（2026-07-14）**。8bit/Y2Kデザイン + きせかえ5種。コンディション検知 src/lib/condition.ts は温存（呼び出し元はIssue #19で全撤去、将来の本人向けセルフケア用）。デモ履歴はseed投入済み（engineer2@… は要注意の物語）。

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
- **マイグレーション運用**: 非対話シェルでは `migrate dev` が使えない（seed実行や@unique制約の確認プロンプトで止まる）。additive変更は「手書き migration.sql + `migrate deploy`」で適用する。適用済みmigrationを手編集するとチェックサム不整合で`migrate dev`が全面停止→`_prisma_migrations.checksum`を現ファイルのsha256に更新して整合（resetは全データ消えるので厳禁）
- **公開共有の鉄則**: 公開ビュー(/u/[handle], /discover, src/lib/public-profile.ts)にコンディション(設問1/2/5/7・スコア)を絶対に含めない。SELECTすらしない設計を維持すること
- **AIレート制限/停止**: 全AI呼び出しは `src/lib/usage.ts` の `assertAiAllowed(userId, kind)` を**トークン消費前に**通す（3ストリーミングRoute + 週報解析/メンター提案/学習プラン/ロールプレイ開始・評価/インタビュー要約）。1分15回・24h300回で拒否、24h600回超で自動停止（`AI_RATE_PER_MINUTE`/`AI_RATE_PER_DAY`/`AI_AUTO_SUSPEND_PER_DAY`で調整）。新しいAI入口を足したら必ずこのガードを通すこと。停止/復帰は管理者のみ（マイページADMINパネル、`setUserSuspended`）。**さらに全ユーザー合算の24時間上限（Issue #17, 2026-07-24）**: **既定40回 = 1日およそ100円**（ユーザー指定の予算）・`AI_GLOBAL_PER_DAY`で調整。算出根拠は実測: 週報解析1回=入力1964tok/出力371tok（claude-sonnet-5、通常$3/$15 per 1Mtok）→ 約1.8円/回。チャットは履歴を積むぶん高いので安全側に2.5円/回として 100÷2.5≒40回。**ユーザーが増えたら要再検討**（ユーザー本人の意向）。⚠上限は「回数」であり実コストは1回の重さでぶれる。金額で厳密に抑えるならトークン量での集計が必要（`AiUsage`にトークン列がないため未実装）。到達すると当日は**全員のAIを停止**（code=`GLOBAL_DAY`）し、Slackへ**1日1回だけ**通知する（プロセス内メモリで重複抑止。複数インスタンスならインスタンスごとに1通）。週報提出などAI以外は生きる縮退のまま（`actions.ts` の try/catch で解析だけスキップ）。判定順は 停止 → 自動停止判定 → **全体上限** → 分 → 日 で、全体が止まっても悪用者の自動停止検知は先に効く。管理ダッシュボードの `AI 24H` に `消費/上限` と残数を表示。集計用に `AiUsage` へ `@@index([createdAt])` を追加（既存の複合索引は userId 先頭なので全体集計に効かない）。⚠Issueで「検討」とされていた**1ユーザーが日次上限に張り付く異常のSlack通知は未実装**（自動停止で実害は止まるため見送り）。⚠管理画面の**上限到達時の表示（⚠ 上限到達・AI全体停止中）は実際に到達させての目視未確認**（分岐は三項演算子のみ）

## 未実装・今後

- 会社独自ノウハウのRAG化（[[knowhow-rag-direction]]・最重要）
- Phase 4: ロールプレイ実施履歴のスキルマップ/経歴書反映
- 運用系: 本番cron/Slack実チャンネル/Google SSO
- ポート注意: 3000が別プロジェクトのdockerコンテナ(inno_work)に取られることがある。launch.jsonは autoPort:true 済みなので別ポートで起動する
