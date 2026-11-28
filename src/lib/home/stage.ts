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
  /**
   * 描く段: "floor" = 床に敷くもの（ラグなど。いつも一番奥）、"wall" = 部屋の壁（手前側に来た壁は描かない＝カットアウェイ）。
   * 省略時はふつうの物（奥行きの順に描く）
   */
  layer?: "floor" | "wall";
  /** キャラが床の上を歩き回る（layout.walk の範囲。家具はよける） */
  wander?: boolean;
};

export type StageLayout = {
  ground: string;
  /** 地面の上面の高さ（物の足元が来る z） */
  groundZ: number;
  pitch: number;
  /** 地面の中心が来る高さ（0 = 上端、1 = 下端） */
  centerY: number;
  /** 拡大率を決める幅（ボクセル）。舞台の幅 ÷ これ の整数倍（3〜6 倍）。省略時 84 */
  fitWidth?: number;
  /** 拡大率の下限（省略時 3）。広い部屋をスマホ幅で全体表示するときは 2 */
  minScale?: number;
  /** 縦長の枠（高さ > 幅）のときの傾き。上から見下ろす角度を深くして、床を縦に広く使う */
  portraitPitch?: number;
  /** ＋−・ピンチで寄れる。寄ったらドラッグで見回し、キャラをタップするとその子を追う */
  zoomable?: boolean;
  /**
   * 部屋の大きさ（床の幅・奥行き・壁の高さ）。渡すと、向きごとに「その向きで部屋がちょうど入る」拡大率にする
   * （横長の部屋を縦長の画面で見るとき、長い辺が奥へ向く向きでは大きく出せる）
   */
  room?: { w: number; d: number; h: number };
  /** 縦長の枠で最初に向ける向き（部屋の長い辺を奥へ向けると大きく出せる） */
  portraitDir?: number;
  /** 歩き回るキャラの範囲（床の座標） */
  walk?: { x0: number; x1: number; y0: number; y1: number };
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
