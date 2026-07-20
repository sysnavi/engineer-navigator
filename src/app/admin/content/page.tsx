// コンテンツカタログ（管理者限定）。TSマスタの中身を絵つきで一覧する。
//
// コンテンツはコードに直接書く運用（DBに持たない）なので、この画面は
// マスタを読んで描くだけ。1件足せば即座にここに出る＝ドキュメントのように
// 陳腐化しない。素材の紐付けミス（絵が出ない）もここで目視できる。
// 機械的な抜け漏れ検出は `npm run check:content` の担当。

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PET_SPECIES, TALK_TREES } from "@/lib/pets/species";
import {
  MONSTERS,
  GADGETS,
  TRAPS,
  RESTS,
  GADGET_CATEGORIES,
  RARITY_LABELS,
  RARITY_MIN_DEPTH,
  GENE_DUNGEON_MODS,
  type Rarity,
} from "@/lib/dungeon/content";
import { GENES } from "@/lib/genes";
import { EXP_WEIGHTS, STAGES } from "@/lib/exp";
import { APPS, APP_GROUPS, DOCK_DEFAULT } from "@/lib/apps";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { PixelIcon } from "@/components/pixel-icon";

const PERSONALITY_LABELS: Record<string, string> = {
  friendly: "人懐こい",
  tsun: "ツンデレ",
  shy: "おくびょう",
  pace: "マイペース",
};
const RARITY_ORDER: Rarity[] = ["UR", "SSR", "SR", "R", "N"];

function Dot(props: { src: string; size?: number; alt?: string }) {
  return (
    <Image
      src={props.src}
      alt={props.alt ?? ""}
      width={props.size ?? 40}
      height={props.size ?? 40}
      style={{ imageRendering: "pixelated" }}
      unoptimized
    />
  );
}

export default async function ContentCatalogPage() {
  const me = await getCurrentUser();
  if (me.role !== "ADMIN") notFound();

  const counts = {
    pets: PET_SPECIES.filter((s) => !s.retired).length,
    monsters: MONSTERS.filter((m) => !m.retired && !m.boss).length,
    bosses: MONSTERS.filter((m) => !m.retired && m.boss).length,
    gadgets: GADGETS.filter((g) => !g.retired).length,
    traps: TRAPS.filter((t) => !t.retired).length,
    rests: RESTS.filter((r) => !r.retired).length,
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PixelLabel>CONTENT CATALOG — コンテンツ一覧（管理者）</PixelLabel>
          <PixelTitle as="h1" className="text-3xl text-royal">
            コンテンツ一覧
          </PixelTitle>
          <p className="mt-1 text-[13px] text-inksoft">
            ゲーム内コンテンツはコード（TSマスタ）に直接書く運用です。ここはその中身を絵つきで確認する画面で、マスタに1件足せばそのまま反映されます。
          </p>
        </div>
        <Link href="/admin" className="btn8 text-[12px]">
          ← 管理ダッシュボード
        </Link>
      </div>

      <Window title="SUMMARY" titleEm=".dat">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "ペット種族", n: counts.pets, file: "src/lib/pets/species.ts" },
            { label: "モンスター", n: counts.monsters, file: "src/lib/dungeon/content.ts" },
            { label: "ボス", n: counts.bosses, file: "src/lib/dungeon/content.ts" },
            { label: "ガジェット", n: counts.gadgets, file: "src/lib/dungeon/content.ts" },
            { label: "罠", n: counts.traps, file: "src/lib/dungeon/content.ts" },
            { label: "癒やし", n: counts.rests, file: "src/lib/dungeon/content.ts" },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-lg border-2 border-line8 bg-surface px-3 py-2 shadow-hard-sm"
            >
              <p className="font-pixel text-[10px] tracking-wide text-inksoft">{c.label}</p>
              <p className="font-pixel text-[20px] text-royal">{c.n}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg border-2 border-dashed border-peri bg-quotebg px-3 py-2 text-[11.5px] text-inksoft">
          追加・変更は各マスタファイルを編集するだけ（DBマイグレーション不要）。
          絵の追加手順は <code>public/pets/README.md</code>、
          抜け漏れの検出は <code>npm run check:content</code>。
        </p>
      </Window>

      {/* ---------- ペット種族 ---------- */}
      <Window title="PET_SPECIES" titleEm=".ts">
        <PixelLabel>来訪キャラ {counts.pets}種 — src/lib/pets/species.ts</PixelLabel>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {PET_SPECIES.filter((s) => !s.retired).map((s) => (
            <div
              key={s.id}
              className="flex gap-3 rounded-lg border-2 border-line8 bg-surface px-3 py-2.5"
            >
              <div className="flex shrink-0 flex-col items-center gap-1">
                <Dot src={s.sprites.normal} size={44} alt={s.name} />
                {s.sprites.happy ? (
                  <Dot src={s.sprites.happy} size={30} />
                ) : (
                  <span className="font-pixel text-[9px] text-[var(--crit)]">差分なし</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold">
                  {s.name}
                  <span className="ml-1.5 font-pixel text-[9.5px] font-normal text-inksoft">
                    {s.id}
                  </span>
                </p>
                <p className="font-pixel text-[10px] tracking-wide text-royal2">
                  {PERSONALITY_LABELS[s.personality] ?? s.personality} ／ 出現重み {s.weight}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed">「{s.intro}」</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-inksoft">
                  AI人格: {s.aiPersona}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <PixelLabel className="!text-inksoft">性格別の会話ツリー</PixelLabel>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(TALK_TREES).map(([pid, tree]) => (
              <div key={pid} className="rounded-lg border-2 border-dashed border-peri px-3 py-2">
                <p className="font-pixel text-[11px] tracking-wide text-royal">
                  {PERSONALITY_LABELS[pid] ?? pid}
                </p>
                <p className="mt-1 text-[11.5px] text-inksoft">{tree.first.lines[0]}</p>
                <p className="mt-1 text-[11px]">
                  選択肢: {tree.first.choices.map((c) => `「${c.label}」(+${c.bond})`).join(" / ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Window>

      {/* ---------- ダンジョン ---------- */}
      <Window title="DUNGEON_CONTENT" titleEm=".ts">
        <PixelLabel>
          モンスター {counts.monsters}＋ボス {counts.bosses} — src/lib/dungeon/content.ts
        </PixelLabel>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MONSTERS.filter((m) => !m.retired).map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 rounded-lg border-2 px-2.5 py-2 ${
                m.boss ? "border-pinkhot bg-quotebg" : "border-line8 bg-surface"
              }`}
            >
              <Dot src={`/dungeon/${m.sprite}.png`} size={40} alt={m.name} />
              <div className="min-w-0">
                <p className="text-[12.5px] font-extrabold">
                  {m.name}
                  {m.boss && <span className="ml-1 font-pixel text-[9px] text-pinkhot">BOSS</span>}
                </p>
                <p className="font-pixel text-[9.5px] tracking-wide text-inksoft">
                  地下{m.minDepth}階〜 ／ 重み{m.weight}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-inksoft">{m.encounter}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <PixelLabel>ガジェット {counts.gadgets}種（レア度順）</PixelLabel>
          <p className="mt-1 text-[11.5px] text-inksoft">
            解禁深度: {RARITY_ORDER.map((r) => `${r}=地下${RARITY_MIN_DEPTH[r]}階`).join(" / ")}
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {RARITY_ORDER.flatMap((rar) =>
              GADGETS.filter((g) => g.rarity === rar && !g.retired).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-2 rounded-md border-2 border-line8 bg-surface px-2 py-1.5"
                >
                  <Dot src={`/dungeon/cat-${g.category}.png`} size={22} />
                  <span className="text-[12px] font-bold">{g.name}</span>
                  <span
                    className="font-pixel text-[9.5px]"
                    style={{ color: RARITY_LABELS[g.rarity].color }}
                  >
                    {g.rarity}
                    {g.minGeneration ? `/${g.minGeneration}代〜` : ""}
                  </span>
                  <span className="ml-auto truncate text-[10.5px] text-inksoft" title={g.flavor}>
                    {g.flavor}
                  </span>
                </div>
              ))
            )}
          </div>
          <p className="mt-2 font-pixel text-[10px] tracking-wide text-inksoft">
            分類: {Object.entries(GADGET_CATEGORIES).map(([k, v]) => `${v}(${k})`).join(" / ")}
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <PixelLabel>罠 {counts.traps}種</PixelLabel>
            <ul className="mt-2 space-y-1">
              {TRAPS.filter((t) => !t.retired).map((t) => (
                <li key={t.id} className="text-[11.5px]">
                  <b>{t.name}</b>
                  <span className="text-inksoft"> — {t.hit}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <PixelLabel>癒やし・出会い {counts.rests}種</PixelLabel>
            <ul className="mt-2 space-y-1">
              {RESTS.filter((r) => !r.retired).map((r) => (
                <li key={r.id} className="text-[11.5px]">
                  <b>{r.name}</b>
                  <span className="font-pixel text-[9px] text-royal2">
                    {r.effect === "deepen" ? " [+1階]" : " [次に強く]"}
                  </span>
                  <span className="text-inksoft"> — {r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Window>

      {/* ---------- 成長・遺伝子 ---------- */}
      <Window title="GROWTH" titleEm=".ts">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <PixelLabel>遺伝子 {GENES.length}種 — src/lib/genes.ts</PixelLabel>
            <div className="mt-2 space-y-1.5">
              {GENES.map((g) => (
                <div key={g.id} className="rounded-md border-2 border-line8 bg-surface px-2.5 py-1.5">
                  <p className="text-[12px] font-bold" style={{ color: g.color }}>
                    {g.name}
                    <span className="ml-1.5 font-pixel text-[9.5px] text-inksoft">{g.id}</span>
                  </p>
                  <p className="text-[11px] text-inksoft">
                    {g.desc}
                    {GENE_DUNGEON_MODS[g.id] && ` ／ 潜行: ${GENE_DUNGEON_MODS[g.id].label}`}
                  </p>
                  <p className="font-pixel text-[9px] tracking-wide text-inksoft">
                    EXP: {g.sources.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <PixelLabel>EXP重み {Object.keys(EXP_WEIGHTS).length}ソース — src/lib/exp.ts</PixelLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(EXP_WEIGHTS).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-md border-2 border-line8 bg-surface px-2 py-0.5 font-pixel text-[10px]"
                >
                  {k} <span className="text-[var(--good)]">+{v}</span>
                </span>
              ))}
            </div>
            <p className="mt-2 rounded-lg border-2 border-dashed border-peri bg-quotebg px-3 py-2 text-[11px] text-inksoft">
              EXPソースを足したら <code>genes.ts</code> のどれかの遺伝子にも割り当てること。
              忘れると <code>npm run check:content</code> がエラーで教えてくれます。
            </p>

            <PixelLabel className="mt-4">進化段階 {STAGES.length}形態</PixelLabel>
            <div className="mt-2 space-y-1">
              {STAGES.map((s) => (
                <p key={s.name} className="text-[11.5px]">
                  <b>{s.name}</b>
                  <span className="text-inksoft">
                    {" "}
                    — Lv{s.minLevel}〜
                    {s.minGeneration ? `／第${s.minGeneration}世代以降（継承限定）` : ""}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </Window>

      {/* ---------- 機能レジストリ ---------- */}
      <Window title="APPS" titleEm=".ts">
        <PixelLabel>機能 {APPS.length}件 — src/lib/apps.ts（ナビ・ホーム・スタートメニュー共通）</PixelLabel>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(APP_GROUPS) as (keyof typeof APP_GROUPS)[]).map((gid) => (
            <div key={gid}>
              <p className="font-pixel text-[10px] tracking-[0.14em] text-royal2">
                {APP_GROUPS[gid]}/
              </p>
              <div className="mt-1 space-y-1">
                {APPS.filter((a) => a.group === gid).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-[12px]">
                    <PixelIcon id={a.id} px={2} />
                    <span className="font-bold">{a.name}</span>
                    {a.roles && (
                      <span className="font-pixel text-[9px] text-pinkhot">
                        {a.roles.join("/")}
                      </span>
                    )}
                    {DOCK_DEFAULT.includes(a.id) && <span className="font-pixel text-[9px] text-inksoft">dock初期</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Window>
    </div>
  );
}
