// ダンジョン（Issue #3）: 育てたアバターのフルオート探索と戦利品コレクション。
// 挑戦は1日1回+週報週ボーナス1回（依存させない設計・タイマーなし）。
// コンテンツの拡充は src/lib/dungeon/content.ts に足すだけ。

import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { getPlayerStats } from "@/lib/exp";
import { getDungeonState, getCollection, baseDepthOf } from "@/lib/dungeon/run";
import {
  GADGETS,
  GADGET_CATEGORIES,
  RARITY_LABELS,
  GENE_DUNGEON_MODS,
  type Rarity,
} from "@/lib/dungeon/content";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { DivePlayer } from "./dive-player";
import { getActiveDive } from "./session-actions";

const RARITY_ORDER: Rarity[] = ["UR", "SSR", "SR", "R", "N"];

export default async function DungeonPage() {
  const user = await getCurrentUser();
  const [stats, state, collection, activeDive] = await Promise.all([
    getPlayerStats(user.id),
    getDungeonState(user.id),
    getCollection(user.id),
    getActiveDive(), // 途中で閉じても続きから戻れる
  ]);
  const geneMod = stats.genes ? GENE_DUNGEON_MODS[stats.genes.dominant.id] : null;
  const ownedIds = new Set(collection.map((g) => g.id));
  const visibleGadgets = GADGETS.filter((g) => !g.retired);

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>DUNGEON — コマンド探索</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          ダンジョン
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          育てたアバターで潜る。どこまで行くかは、きみが決める。
        </p>
      </div>

      <Window title="DUNGEON" titleEm=".log">
        <DivePlayer
          canDive={state.canDive}
          diveKind={state.diveKind}
          restingMessage={state.restingMessage}
          avatarSprite={stats.stage.sprite}
          avatarAccent={stats.genes?.dominant.color}
          baseDepth={baseDepthOf(stats)}
          initialView={activeDive}
        />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-dashed border-peri pt-3 text-[11.5px] text-inksoft">
          <span>
            探索 {state.totalRuns} 回 ／ 最深 地下{state.maxDepth}階
          </span>
          {geneMod && (
            <span>
              血統ボーナス:{" "}
              <b style={{ color: stats.genes!.dominant.color }}>{geneMod.label}</b>
            </span>
          )}
          <span>週報を出した週は +1回（整った心で、もう一潜り）</span>
        </div>
      </Window>

      <Window title="COLLECTION" titleEm=".dat">
        <div className="flex items-baseline justify-between">
          <PixelLabel>
            戦利品コレクション — {collection.length} / {visibleGadgets.length}
          </PixelLabel>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {RARITY_ORDER.flatMap((rarity) =>
            visibleGadgets
              .filter((g) => g.rarity === rarity)
              .map((g) => {
                const owned = ownedIds.has(g.id);
                const rar = RARITY_LABELS[g.rarity];
                return (
                  <div
                    key={g.id}
                    className={`rounded-lg border-[2.5px] px-3 py-2.5 shadow-hard-sm ${
                      owned ? "border-line8 bg-win" : "border-dashed border-peri bg-surface opacity-70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md border-2 border-line8 bg-surface"
                        style={owned ? { boxShadow: `inset 0 0 0 2px ${rar.color}` } : {}}
                      >
                        {owned ? (
                          <Image
                            src={`/dungeon/cat-${g.category}.png`}
                            alt=""
                            width={28}
                            height={28}
                            style={{ imageRendering: "pixelated" }}
                            unoptimized
                          />
                        ) : (
                          <span className="font-pixel text-[13px] text-inksoft">?</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-extrabold">
                          {owned ? g.name : "？？？"}
                        </p>
                        <p className="font-pixel text-[10px] tracking-wide" style={{ color: rar.color }}>
                          {rar.label}
                          <span className="ml-1.5 text-inksoft">
                            {GADGET_CATEGORIES[g.category]}
                          </span>
                        </p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-inksoft">
                      {owned
                        ? g.flavor
                        : g.minGeneration && g.minGeneration >= 2
                          ? "継承世代だけが辿り着ける…"
                          : "まだ見ぬ逸品。深く潜れば、いつか。"}
                    </p>
                  </div>
                );
              })
          )}
        </div>
      </Window>
    </div>
  );
}
