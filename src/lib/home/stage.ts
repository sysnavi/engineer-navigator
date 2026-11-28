// ホームの舞台（キャラが住む小島）の並べ方。描画は src/components/stage-scene.tsx。
// 座標はボクセル単位で島の中心が (0, 0)。x は右、y は手前。小道具の .vox は scripts/gen-stage-vox.ts が起こした原本。
// 物を足すときはここに1行足す（家具・ペット・おさんぽの入口など、あとから育てる前提）。

export type StageItem = {
  id: string;
  /** .vox の場所 */
  src: string;
  x: number;
  y: number;
  /** 足元の影の半径（0 で影なし） */
  shadow?: number;
  /** 向きのずれ（0 = 場面と同じ向き） */
  face?: number;
  /** キャラ（まばたき・笑顔・タップで反応）。小道具は false */
  actor?: boolean;
  /** ゆっくり左右を見る */
  look?: boolean;
  /** 色の差し替え（色の番号 → 色）。"var(--lemon)" のような CSS 変数も使える */
  palette?: Record<number, string>;
};

export type StageLayout = {
  ground: string;
  /** 地面の上面の高さ（物の足元が来る z） */
  groundZ: number;
  pitch: number;
  /** 地面の中心が来る高さ（0 = 上端、1 = 下端） */
  centerY: number;
  items: StageItem[];
};

export const HOME_STAGE: Omit<StageLayout, "items"> & {
  props: StageItem[];
  player: Omit<StageItem, "id" | "src">;
} = {
  ground: "/stack/stage/island.vox",
  groundZ: 5,
  pitch: 0.55,
  centerY: 0.72,
  props: [
    { id: "house", src: "/stack/stage/house.vox", x: -6, y: -12 },
    { id: "tree", src: "/stack/stage/tree.vox", x: 12, y: -6, shadow: 9 },
    { id: "mailbox", src: "/stack/stage/mailbox.vox", x: 10, y: 0, shadow: 3 },
  ],
  // 主役も島の上の決まった所に立ち、島と一緒に回る（立ち位置も向きも変わる）。
  // 家が大きいので、島のどこに立たせても 3〜5 の向きでは陰に入る。陰に入った所はシルエットで透かす（stage-scene.tsx）。
  // 最初の向きで一番手前・陰に入る割合が一番小さい所として、手前の中央に立たせている
  player: { x: 0, y: 16, shadow: 6, actor: true, look: true },
};
