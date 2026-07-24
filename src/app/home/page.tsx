// マイホーム（Issue #2 → #12 松で見た目充実化）:
// DESKTOP.sav = ガジェットで組む作業環境（自由配置・デスク進化）
// LIVING.sav  = ペットが暮らすリビング（デスクへの遊びに行きイベント付き）
// 来訪→会話→ペット化の入口は全ページ共通のフローティング（layout側）。

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GADGETS, GADGET_CATEGORIES, RARITY_LABELS } from "@/lib/dungeon/content";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { speciesById } from "@/lib/pets/species";
import {
  deskTier,
  deskVisitorIndex,
  themeCss,
  WALLPAPERS,
  FLOORS,
} from "@/lib/home/scene";
import { FOODS, MAX_FEEDS_PER_DAY } from "@/lib/pets/foods";
import { FoodSprite } from "@/components/pets/food-sprite";
import { DesktopScene, type DeskGadget, type DeskVisitor } from "./desktop-scene";
import { LivingScene, type RoomPet } from "./living-scene";
import type { FoodStock } from "./care-menu";
import { ActionForm } from "@/components/toast";
import { namePet, placeGadgetAt, setRoomTheme } from "./actions";

function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [pets, owned, fledCount, foodRows] = await Promise.all([
    prisma.pet.findMany({ where: { userId: user.id }, orderBy: { befriendedAt: "asc" } }),
    prisma.ownedGadget.findMany({ where: { userId: user.id } }),
    prisma.encounter.count({ where: { userId: user.id, status: "FLED" } }),
    prisma.foodItem.findMany({ where: { userId: user.id } }),
  ]);

  const ownedDefs = owned
    .map((o) => GADGETS.find((g) => g.id === o.gadgetId))
    .filter((g): g is (typeof GADGETS)[number] => !!g);
  const desk = deskTier(ownedDefs);

  const placed: DeskGadget[] = owned
    .filter((o) => o.deskX !== null && o.deskY !== null)
    .map((o) => {
      const def = GADGETS.find((g) => g.id === o.gadgetId);
      return def ? { ...def, x: o.deskX!, y: o.deskY!, z: o.deskZ } : null;
    })
    .filter((g): g is DeskGadget => g !== null);
  const stored = owned
    .filter((o) => o.deskX === null || o.deskY === null)
    .map((o) => GADGETS.find((g) => g.id === o.gadgetId))
    .filter((g): g is (typeof GADGETS)[number] => !!g);

  // きょうデスクに遊びに来ている子（決定的抽選）。リビングには居ない
  const visitIdx = deskVisitorIndex(
    today().toISOString().slice(0, 10),
    user.id,
    pets.length
  );
  const visitorPet = visitIdx === null ? null : pets[visitIdx];
  // きょう この子に あと何回あげられるか（lastFedAt が今日でなければ回数リセット）
  const feedsLeftOf = (p: { lastFedAt: Date | null; fedCount: number }) => {
    const fedToday =
      !!p.lastFedAt && p.lastFedAt.getTime() >= today().getTime() ? p.fedCount : 0;
    return Math.max(0, MAX_FEEDS_PER_DAY - fedToday);
  };
  const visitor: DeskVisitor | null = visitorPet
    ? {
        id: visitorPet.id,
        speciesId: visitorPet.speciesId,
        name: visitorPet.name,
        affection: visitorPet.affection,
        pettedToday:
          !!visitorPet.lastPettedAt &&
          visitorPet.lastPettedAt.getTime() >= today().getTime(),
        feedsLeft: feedsLeftOf(visitorPet),
      }
    : null;

  const roomPets: RoomPet[] = pets
    .filter((p) => p.id !== visitorPet?.id)
    .map((p) => ({
      id: p.id,
      speciesId: p.speciesId,
      name: p.name,
      affection: p.affection,
      pettedToday: !!p.lastPettedAt && p.lastPettedAt.getTime() >= today().getTime(),
      feedsLeft: feedsLeftOf(p),
    }));

  // ごはんの在庫（0個も含めて全種返す。おせわメニュー側で持っている分だけ出す）
  const stocks: FoodStock[] = FOODS.map((f) => ({
    foodId: f.id,
    count: foodRows.find((r) => r.foodId === f.id)?.count ?? 0,
  }));

  const wallpaperCss = themeCss(WALLPAPERS, user.homeWallpaper, "cream");
  const floorCss = themeCss(FLOORS, user.homeFloor, "wood");

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>MY HOME — ペットと戦利品の家</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          マイホーム
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          デスクにガジェットを飾って自分の作業環境を組み、リビングでは仲間がのんびり暮らします。
        </p>
      </div>

      {/* ===== デスクの作業環境（自由配置） ===== */}
      <Window title="DESKTOP" titleEm=".sav" bodyClass="p-4">
        <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <PixelLabel>WORKSTATION — ドラッグで模様替え</PixelLabel>
          <span className="font-pixel text-[10.5px] tracking-wide text-royal2">
            🖥 {desk.name}
            <span className="text-inksoft">（{desk.hint}）</span>
          </span>
        </div>
        <DesktopScene
          gadgets={placed}
          desk={desk}
          wallpaperCss={wallpaperCss}
          floorCss={floorCss}
          visitor={visitor}
          stocks={stocks}
        />
        {stored.length > 0 && (
          <div className="mt-3">
            <PixelLabel className="!text-inksoft">収納BOX — クリックで飾る</PixelLabel>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {stored.map((g) => (
                <form
                  key={g.id}
                  action={async () => {
                    "use server";
                    await placeGadgetAt(g.id);
                  }}
                >
                  <button
                    className="flex items-center gap-1.5 rounded-lg border-2 border-line8 bg-win px-2.5 py-1 text-[11.5px] font-bold shadow-hard-sm"
                    title={`${g.name} — ${g.flavor}`}
                  >
                    <Image
                      src={`/dungeon/cat-${g.category}.png`}
                      alt=""
                      width={16}
                      height={16}
                      style={{ imageRendering: "pixelated" }}
                      unoptimized
                    />
                    {g.name}
                    <span
                      className="font-pixel text-[9px]"
                      style={{ color: RARITY_LABELS[g.rarity].color }}
                    >
                      {RARITY_LABELS[g.rarity].label}
                    </span>
                    <span className="font-pixel text-[9px] text-inksoft">
                      {GADGET_CATEGORIES[g.category]}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
      </Window>

      {/* ===== リビング（ペットの生活圏） ===== */}
      <Window title="LIVING" titleEm=".sav" bodyClass="p-4">
        <PixelLabel className="mb-2.5">LIVING ROOM — なかまの居場所</PixelLabel>
        <LivingScene
          pets={roomPets}
          wallpaperCss={wallpaperCss}
          floorCss={floorCss}
          awayName={visitor?.name ?? null}
          stocks={stocks}
        />
        <p className="mt-2.5 text-[11.5px] text-inksoft">
          なかま {pets.length} 匹
          {fledCount > 0 && ` ／ これまで逃げられた回数 ${fledCount} 回（また会えるさ）`}
          ｜ クリックで おせわメニュー（なでなで1日1回・ごはん1日3回）｜
          ときどきデスクに遊びに行きます
        </p>

        {/* ===== ごはん図鑑 ===== */}
        <div className="mt-4 rounded-lg border-2 border-line8 bg-surface p-3">
          <PixelLabel className="mb-2">GOHAN — ごはん図鑑</PixelLabel>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {FOODS.map((f) => {
              const count = stocks.find((s) => s.foodId === f.id)?.count ?? 0;
              // 好物を見つけた子だけ名前を出す（見つけるまでは ？？？）
              const lovers = pets
                .filter(
                  (p) =>
                    p.favoriteFoundAt &&
                    speciesById(p.speciesId)?.favoriteFoodId === f.id
                )
                .map((p) => p.name);
              return (
                <div
                  key={f.id}
                  className="flex items-start gap-2.5 rounded-lg border-2 border-line8 bg-win px-2.5 py-2"
                >
                  <span className="shrink-0 pt-0.5">
                    <FoodSprite id={f.id} px={3} label={f.name} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-extrabold">
                      {f.name}
                      <span className="ml-1.5 font-pixel text-[10px] text-lemon">
                        {"★".repeat(f.rarity)}
                      </span>
                      <span className="ml-1.5 font-pixel text-[10px] text-royal2">
                        x{count}
                      </span>
                    </p>
                    <p className="text-[11px] leading-snug text-inksoft">{f.desc}</p>
                    <p className="mt-0.5 text-[10.5px] font-bold text-inksoft">
                      {f.semiFavorite
                        ? "みんなの ごちそう（+2）"
                        : lovers.length > 0
                          ? `好物: ${lovers.join("・")} ♥`
                          : "好物: ？？？"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Window>

      {/* ===== きせかえ（壁紙・床は2部屋共通） ===== */}
      <Window title="ROOM" titleEm=".cfg">
        <PixelLabel>もようがえ — 壁紙と床をえらぶ</PixelLabel>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(
            [
              { kind: "wallpaper" as const, label: "壁紙", list: WALLPAPERS, current: user.homeWallpaper },
              { kind: "floor" as const, label: "床", list: FLOORS, current: user.homeFloor },
            ]
          ).map((group) => (
            <div key={group.kind}>
              <p className="mb-1.5 text-[12px] font-extrabold">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.list.map((t) => (
                  <form
                    key={t.id}
                    action={async () => {
                      "use server";
                      await setRoomTheme(group.kind, t.id);
                    }}
                  >
                    <button
                      aria-pressed={group.current === t.id}
                      className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5 text-[11.5px] font-bold shadow-hard-sm ${
                        group.current === t.id
                          ? "border-line8 bg-royal text-white"
                          : "border-line8 bg-surface"
                      }`}
                    >
                      <i
                        className="h-5 w-5 rounded border-2 border-line8"
                        style={{ background: t.css }}
                      />
                      {t.name}
                      {group.current === t.id && " ★"}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Window>

      {/* ===== ペットの名前 ===== */}
      {pets.length > 0 && (
        <Window title="PETS" titleEm=".cfg">
          <PixelLabel>なかまのなまえ — いつでも変えられます</PixelLabel>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {pets.map((p) => {
              const sp = speciesById(p.speciesId);
              return (
                <ActionForm
                  key={p.id}
                  ok="なまえを保存しました"
                  action={async (formData: FormData) => {
                    "use server";
                    await namePet(p.id, String(formData.get("name") ?? ""));
                    revalidatePath("/home");
                  }}
                  className="flex items-center gap-2.5 rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2"
                >
                  {sp && (
                    <Image
                      src={sp.sprites.normal}
                      alt=""
                      width={36}
                      height={36}
                      style={{ imageRendering: "pixelated" }}
                      unoptimized
                    />
                  )}
                  <input
                    name="name"
                    defaultValue={p.name}
                    maxLength={12}
                    className="field8 min-w-0 flex-1 !py-1 text-[12.5px]"
                    aria-label={`${p.name}のなまえ`}
                  />
                  <button className="btn8 px-3 py-1.5 text-[11.5px]">保存</button>
                </ActionForm>
              );
            })}
          </div>
        </Window>
      )}
    </div>
  );
}
