// マイホーム（Issue #2）: 迎えたペットが暮らし、ダンジョン戦利品を飾る部屋。
// 来訪→会話→ペット化の入口は全ページ共通のフローティング（layout側）。

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GADGETS, GADGET_CATEGORIES, RARITY_LABELS } from "@/lib/dungeon/content";
import Image from "next/image";
import { revalidatePath } from "next/cache";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";
import { speciesById } from "@/lib/pets/species";
import { Room, type PlacedGadget, type RoomPet } from "./room";
import { placeGadget, namePet } from "./actions";

function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const SLOT_LABELS = [
  ...Array.from({ length: 6 }, (_, i) => ({ value: i, label: `棚 ${i + 1}` })),
  ...Array.from({ length: 6 }, (_, i) => ({ value: 6 + i, label: `床 ${i + 1}` })),
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const [pets, owned, fledCount] = await Promise.all([
    prisma.pet.findMany({ where: { userId: user.id }, orderBy: { befriendedAt: "asc" } }),
    prisma.ownedGadget.findMany({ where: { userId: user.id } }),
    prisma.encounter.count({ where: { userId: user.id, status: "FLED" } }),
  ]);

  const roomPets: RoomPet[] = pets.map((p) => ({
    id: p.id,
    speciesId: p.speciesId,
    name: p.name,
    affection: p.affection,
    pettedToday: !!p.lastPettedAt && p.lastPettedAt.getTime() >= today().getTime(),
  }));
  const placed: PlacedGadget[] = owned
    .filter((o) => o.homeSlot !== null)
    .map((o) => {
      const def = GADGETS.find((g) => g.id === o.gadgetId);
      return def ? { ...def, homeSlot: o.homeSlot! } : null;
    })
    .filter((g): g is PlacedGadget => g !== null);
  const unplaced = owned
    .filter((o) => o.homeSlot === null)
    .map((o) => GADGETS.find((g) => g.id === o.gadgetId))
    .filter((g): g is (typeof GADGETS)[number] => !!g);
  const freeSlots = SLOT_LABELS.filter(
    (s) => !placed.some((g) => g.homeSlot === s.value)
  );

  return (
    <div className="space-y-7">
      <div>
        <PixelLabel>MY HOME — ペットと戦利品の部屋</PixelLabel>
        <PixelTitle as="h1" className="text-3xl text-royal">
          マイホーム
        </PixelTitle>
        <p className="mt-1 text-[13px] text-inksoft">
          仲間になった子がここで暮らします。クリックでなでなで（1日1回）。ダンジョンの戦利品も飾れます。
        </p>
      </div>

      <Window title="MY_HOME" titleEm=".sav" bodyClass="p-4">
        <Room pets={roomPets} placed={placed} />
        <p className="mt-2.5 text-[11.5px] text-inksoft">
          なかま {pets.length} 匹
          {fledCount > 0 && ` ／ これまで逃げられた回数 ${fledCount} 回（また会えるさ）`}
          ｜ 来訪者は1日1回抽選・しばらく会えないと必ず来てくれる
        </p>
      </Window>

      {pets.length > 0 && (
        <Window title="PETS" titleEm=".cfg">
          <PixelLabel>なかまのなまえ — いつでも変えられます</PixelLabel>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {pets.map((p) => {
              const sp = speciesById(p.speciesId);
              return (
                <form
                  key={p.id}
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
                </form>
              );
            })}
          </div>
        </Window>
      )}

      {(unplaced.length > 0 || placed.length > 0) && (
        <Window title="DECORATE" titleEm=".cfg">
          <PixelLabel>もようがえ — 戦利品を飾る</PixelLabel>
          {unplaced.length > 0 && (
            <div className="mt-3 space-y-2">
              {unplaced.map((g) => (
                <form
                  key={g.id}
                  action={async (formData: FormData) => {
                    "use server";
                    const slot = Number(formData.get("slot"));
                    await placeGadget(g.id, Number.isInteger(slot) ? slot : null);
                  }}
                  className="flex flex-wrap items-center gap-2.5 rounded-lg border-2 border-dashed border-peri bg-surface px-3 py-2"
                >
                  <b className="text-[12.5px]">{g.name}</b>
                  <span
                    className="font-pixel text-[10px] tracking-wide"
                    style={{ color: RARITY_LABELS[g.rarity].color }}
                  >
                    {g.rarity}
                  </span>
                  <span className="text-[11px] text-inksoft">
                    {GADGET_CATEGORIES[g.category]}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <select name="slot" className="field8 !w-auto !py-1 text-[12px]" defaultValue={freeSlots[0]?.value}>
                      {freeSlots.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button className="btn8 btn8-start px-3 py-1.5 text-[11.5px]">▶ 飾る</button>
                  </span>
                </form>
              ))}
            </div>
          )}
          {placed.length > 0 && (
            <div className="mt-4">
              <PixelLabel className="mb-2 !text-inksoft">飾ってあるもの</PixelLabel>
              <div className="flex flex-wrap gap-2">
                {placed.map((g) => (
                  <form
                    key={g.id}
                    action={async () => {
                      "use server";
                      await placeGadget(g.id, null);
                    }}
                  >
                    <button
                      className="chip8 flex items-center gap-1.5 rounded-lg border-2 border-line8 bg-win px-2.5 py-1 text-[11.5px] font-bold shadow-hard-sm"
                      title="クリックで片付ける"
                    >
                      {g.name}
                      <span className="font-pixel text-[9.5px] text-inksoft">
                        {SLOT_LABELS.find((s) => s.value === g.homeSlot)?.label} ×
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </Window>
      )}
    </div>
  );
}
