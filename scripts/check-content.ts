// コンテンツマスタの整合性チェック（npm run check:content）。
//
// このアプリのコンテンツ（ペット種族・モンスター・ガジェット・遺伝子・EXP重み）は
// TSマスタに直接書く運用なので、追加時の付け合わせ漏れが起きやすい。
// 「新しいEXPソースを足したら genes.ts にも割り当てる」といった約束事を
// 人間の注意力ではなくこのスクリプトで守る。CIやコミット前に流す想定。
//
// 落ちたらメッセージのとおりに直す。警告(WARN)は運用判断で無視してもよいが、
// エラー(ERROR)は本番で画像が出ない・EXPが入らない等の実害につながる。

import { existsSync } from "node:fs";
import { join } from "node:path";
import { PET_SPECIES, TALK_TREES } from "../src/lib/pets/species";
import {
  MONSTERS,
  GADGETS,
  TRAPS,
  RESTS,
  GADGET_CATEGORIES,
  RARITY_MIN_DEPTH,
} from "../src/lib/dungeon/content";
import { GENES } from "../src/lib/genes";
import { EXP_WEIGHTS } from "../src/lib/exp";
import { APPS } from "../src/lib/apps";

const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

const errors: string[] = [];
const warns: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warns.push(m);

function assetExists(webPath: string): boolean {
  return existsSync(join(PUBLIC, webPath.replace(/^\//, "")));
}

function dupes<T>(items: T[], key: (t: T) => string): string[] {
  const seen = new Map<string, number>();
  for (const i of items) seen.set(key(i), (seen.get(key(i)) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

// ---------------------------------------------------------------------------
// ペット種族
// ---------------------------------------------------------------------------
console.log(`ペット種族: ${PET_SPECIES.length}件`);
for (const id of dupes(PET_SPECIES, (s) => s.id)) {
  err(`ペット種族のIDが重複: ${id}（DBのspeciesIdが衝突する）`);
}
for (const s of PET_SPECIES) {
  for (const [kind, path] of Object.entries(s.sprites)) {
    if (!path) continue;
    if (!assetExists(path)) {
      const level = kind === "normal" ? err : warn;
      level(`${s.id}: ${kind}スプライトが存在しない → ${path}`);
    }
  }
  if (!s.sprites.happy) {
    warn(`${s.id}: happy差分なし（通常顔で代用される。表情が変わらない）`);
  }
  if (!TALK_TREES[s.personality]) {
    err(`${s.id}: 性格「${s.personality}」の会話ツリーが未定義`);
  }
  if (!s.intro.trim()) err(`${s.id}: 第一声(intro)が空`);
  if (!s.aiPersona.trim()) warn(`${s.id}: aiPersonaが空（AI会話で人格が出ない）`);
}

// ---------------------------------------------------------------------------
// ダンジョン
// ---------------------------------------------------------------------------
console.log(
  `ダンジョン: モンスター${MONSTERS.length} / ガジェット${GADGETS.length} / 罠${TRAPS.length} / 癒やし${RESTS.length}`
);
for (const id of dupes(MONSTERS, (m) => m.id)) err(`モンスターIDが重複: ${id}`);
for (const id of dupes(GADGETS, (g) => g.id)) {
  err(`ガジェットIDが重複: ${id}（OwnedGadgetの所持判定が壊れる）`);
}
for (const m of MONSTERS) {
  if (!assetExists(`/dungeon/${m.sprite}.png`)) {
    err(`モンスター${m.id}: スプライトが無い → /dungeon/${m.sprite}.png`);
  }
}
for (const cat of Object.keys(GADGET_CATEGORIES)) {
  if (!assetExists(`/dungeon/cat-${cat}.png`)) {
    err(`ガジェット分類「${cat}」のアイコンが無い → /dungeon/cat-${cat}.png`);
  }
}
for (const g of GADGETS) {
  if (!(g.category in GADGET_CATEGORIES)) {
    err(`ガジェット${g.id}: 未知の分類「${g.category}」`);
  }
  if (!g.flavor.trim()) warn(`ガジェット${g.id}: フレーバーテキストが空`);
  if (g.rarity === "UR" && !g.minGeneration) {
    warn(`ガジェット${g.id}: URなのにminGeneration未設定（初代でも拾えてしまう）`);
  }
}
// 深層でしか出ないレア度が、実際に到達しうるか
for (const [rarity, depth] of Object.entries(RARITY_MIN_DEPTH)) {
  const pool = GADGETS.filter((g) => g.rarity === rarity && !g.retired);
  if (pool.length === 0) err(`レア度${rarity}のガジェットが1つも無い（抽選が偏る）`);
  else if (pool.length < 2 && depth >= 6) {
    warn(`レア度${rarity}が${pool.length}件のみ（深層の楽しみが薄い）`);
  }
}
for (const icon of ["icon-chest", "icon-trap", "icon-rest"]) {
  if (!assetExists(`/dungeon/${icon}.png`)) err(`共通アイコンが無い → /dungeon/${icon}.png`);
}

// ---------------------------------------------------------------------------
// EXP × 遺伝子（付け合わせ漏れが起きやすい箇所）
// ---------------------------------------------------------------------------
const expKeys = Object.keys(EXP_WEIGHTS);
const geneSources = new Set(GENES.flatMap((g) => g.sources));
console.log(`EXPソース: ${expKeys.length}件 / 遺伝子: ${GENES.length}種`);
for (const k of expKeys) {
  if (!geneSources.has(k)) {
    err(
      `EXPソース「${k}」がどの遺伝子にも割り当てられていない` +
        `（src/lib/genes.ts の GENES[].sources に追加すること）`
    );
  }
}
for (const s of geneSources) {
  if (!expKeys.includes(s)) {
    err(`遺伝子が参照するEXPソース「${s}」が EXP_WEIGHTS に存在しない（綴り違い？）`);
  }
}
for (const g of GENES) {
  if (g.sources.length === 0) err(`遺伝子${g.id}: sourcesが空（絶対に選ばれない）`);
}

// ---------------------------------------------------------------------------
// 機能レジストリ
// ---------------------------------------------------------------------------
console.log(`機能: ${APPS.length}件`);
for (const id of dupes(APPS, (a) => a.id)) err(`機能IDが重複: ${id}`);
const appPages = APPS.filter((a) => !a.roles);
if (appPages.filter((a) => a.dock).length > 2) {
  warn("モバイルドックに載せる機能(dock:true)が3件以上（レイアウトが窮屈になる）");
}

// ---------------------------------------------------------------------------
// 結果
// ---------------------------------------------------------------------------
console.log("");
for (const w of warns) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log("");
if (errors.length) {
  console.log(`✗ エラー${errors.length}件 / 警告${warns.length}件`);
  process.exit(1);
}
console.log(`✓ 整合性OK（警告${warns.length}件）`);
