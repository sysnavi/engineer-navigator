# ペット素材の支給契約（開発者の手描きPNGをサイトに入れる）

キャラは自動生成（宇宙人流用）だけでなく、**人の手で描いたPNG**を正規ルートで追加できます。
「人間の生のテイストをサイトに反映する」ための仕組みです（Issue #2）。

## 手順

1. このディレクトリに種族IDのフォルダを作り、PNGを置く:

```
public/pets/<speciesId>/
  normal.png   … 必須（待機顔）
  happy.png    … 任意（にっこり差分。会話成功・なでなで時。無ければ normal で代用）
  sleep.png    … 任意（昼寝差分。無ければ normal で代用）
```

2. `src/lib/pets/species.ts` の `PET_SPECIES` に1件追加（コメントアウトの「ほしまる」例を参照）。
   `sprites.normal` などにここへのパス（`/pets/<speciesId>/normal.png`）を書くだけ。

## PNGの仕様

- **透過背景**・正方形推奨（例: 240×240。表示側で縮小するので解像度は自由）
- テイスト: 極太黒アウトライン・チャンキーピクセル・フラット彩色（見本: `docs/design/aliens-sheet.png`）
- ドット絵はにじみ防止のため `image-rendering: pixelated` で表示される。**ドットの整数倍サイズ**で書き出すときれいに出る
- アニメーション（歩行・ぴょこぴょこ・傾き）はCSS側が付けるので、**1枚絵でOK**。差分は表情だけ

## 3D（.vox）

画面のペットは 3D で出る（PNG は読み込み中と SSR の代わり）。PNG を置いて species.ts に追記したら、3D の原本を起こす:

```
npx tsx scripts/gen-png-vox.ts <speciesId>
```

- `public/pets/<speciesId>/model.vox` ができる（PNG の隣）。以後はこれが原本で、MagicaVoxel で直せる
- 一覧 `docs/design/pets-3d-sheet.png`（正面・斜め・横・うしろ）で形を確かめる
- にっこり・寝顔は 3D 側で目と口を描き換える（happy.png・sleep.png は 2D の代わり表示にだけ使う）
- 黒っぽい色は線、一番多い色が体、小さい白は目の光として扱う。顔が崩れたら .vox を手で直す

## 反映

ファイルを置いて species.ts に追記し、3D の原本を起こす → いつものビルドで反映（DBマイグレーション不要）。
