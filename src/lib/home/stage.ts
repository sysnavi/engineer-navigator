// 舞台（地面の上に物とキャラを並べて 8 方向に回す）の並べ方の型と、ホームの島の並べ方。描画は src/components/stage-scene.tsx。
// 座標はボクセル単位で地面の中心が (0, 0)。x は右、y は手前。島の小道具の .vox は scripts/gen-stage-vox.ts が起こした原本。
// 島に物を足すときはここに1行足す。マイホームの箱庭（リビング）の並べ方は src/lib/home/living3d.ts。

export type StageItem = {
  id: string;
  /** .vox の場所。"gen:" で始まるものはプログラムで起こす（部屋の床・壁など。src/lib/home/room3d.ts） */
  src: string;
  x: number;
  y: number;
  /** 床からの高さ（壁に掛けるもの・棚に置くもの） */
  z?: number;
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
  /** 壁に付いているもの（窓・棚・ポスター）。その壁の直後に描き、壁が手前に回って消えるときは一緒に消える */
  attach?: string;
  /** キャラが床の上を歩き回る（layout.walk の範囲。家具はよける）。ときどき spot のある家具で休む */
  wander?: boolean;
  /** キャラが休みに行く家具（その子のお気に入り。無ければ空いている家具から選ぶ） */
  home?: string;
  /** 家具でのくつろぎ方（ペットが休みに来る）。sleep = 上で寝る / sit = 座る / top = てっぺん / watch = 横から見る / front = 前に陣取る */
  spot?: "sleep" | "sit" | "top" | "watch" | "front";
  /** 指で動かせる（onDrag が呼ばれる） */
  movable?: boolean;
};

export type StageLayout = {
  ground: string;
  /** 地面の上面の高さ（物の足元が来る z） */
  groundZ: number;
  pitch: number;
  /** 地面の中心が来る高さ（0 = 上端、1 = 下端） */
  centerY: number;
  /** 拡大率を決める幅（ボクセル）。舞台の幅 ÷ これ（画面の実際の画素で刻む。3〜6 倍）。省略時 84 */
  fitWidth?: number;
  /** 拡大率の下限（省略時 3）。広い部屋をスマホ幅で全体表示するときは 2 */
  minScale?: number;
  /** 縦長の枠（高さ > 幅）のときの傾き。上から見下ろす角度を深くして、床を縦に広く使う */
  portraitPitch?: number;
  /** ＋−・ピンチで寄れる（3 段まで）。寄ったらドラッグで見回す。キャラをタップしても寄らない */
  zoomable?: boolean;
  /**
   * キャラが手前の物の陰に入ったときの見せ方。
   *   silhouette（省略時・島）: 隠れた所を線の色のシルエットで透かす
   *   outline（リビング）: 透かさない。完全に隠れたときだけ、ふちを 1 ドットの線で見せる（中は塗らない）。
   *     歩く先・休む所を選ぶときも、手前の家具の陰に入る所を避ける
   */
  occlusion?: "silhouette" | "outline";
  /**
   * 部屋の大きさ（床の幅・奥行き・壁の高さ）。渡すと、向きごとに「その向きで部屋がちょうど入る」拡大率にする。
   * 回したときは短いアニメでなめらかに寄り引きする
   */
  room?: { w: number; d: number; h: number };
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
