// スキルレベルの10段階ルーブリック（Issue #25）。
// 10段階を意味あるものにする鍵は「観測可能な行動」の紐づけ。ここが判定の本体で、
// AI解析プロンプト・深掘りインタビューの判定・UIの説明表示すべてがこのマスタを参照する。
// 5段階からの移行写像は prisma/migrations の skill_level_10 と一致させること。

export const SKILL_LEVEL_MAX = 10;

/** 深掘りインタビュー（またはクイズ正解）なしに承認すると「仮判定」になる閾値。
 *  このレベル以上の提案は根拠の裏取りを推奨する（本番経験〜は申告だけでは早計） */
export const PROBE_RECOMMENDED_FROM = 6;

export type SkillLevelDef = {
  level: number;
  label: string; // 一言ラベル（UI表示用）
  behavior: string; // 観測可能な行動（判定基準の本体）
};

export const SKILL_LEVELS: SkillLevelDef[] = [
  { level: 1, label: "入門", behavior: "概要を知っている。ドキュメントや入門記事を読んだ" },
  { level: 2, label: "素振り", behavior: "チュートリアルやサンプルを自分の手で完走した" },
  { level: 3, label: "指導下で実務", behavior: "レビューや指示を受けながら実務タスクをこなした" },
  { level: 4, label: "小タスク独力", behavior: "小さめの実務タスクなら一人で完了できる" },
  { level: 5, label: "実務独力", behavior: "一通りの実務を一人で進め、詰まっても自力で解決できる" },
  { level: 6, label: "本番経験", behavior: "本番環境へのリリース・運用を経験した" },
  { level: 7, label: "障害対応", behavior: "本番の障害対応・性能チューニングまで対応できる" },
  { level: 8, label: "指導できる", behavior: "他者の作業をレビュー・指導できる" },
  { level: 9, label: "技術選定", behavior: "技術選定・設計判断を主導した経験がある" },
  { level: 10, label: "発信", behavior: "組織内外に知見を発信している（登壇・記事・OSS等）" },
];

/** 旧5段階 → 10段階の写像（マイグレーションと同一。表示側の説明にも使う） */
export const LEVEL_MIGRATION_MAP: Record<number, number> = {
  1: 2, // 学習中 → 素振り
  2: 3, // 指導下で実務 → 指導下で実務
  3: 5, // 一人で実務可 → 実務独力
  4: 6, // 本番リリース経験/指導可 → 本番経験
  5: 9, // 技術選定をリード → 技術選定
};

export function skillLevelDef(level: number): SkillLevelDef {
  return (
    SKILL_LEVELS.find((d) => d.level === level) ??
    SKILL_LEVELS[Math.min(Math.max(level, 1), SKILL_LEVEL_MAX) - 1]
  );
}

/** AIプロンプト用の1行定義リスト */
export function skillLevelRubricText(): string {
  return SKILL_LEVELS.map((d) => `${d.level}=${d.label}（${d.behavior}）`).join(" / ");
}

export function clampSkillLevel(n: number): number {
  return Math.min(Math.max(Math.round(n), 1), SKILL_LEVEL_MAX);
}

/** EngineerSkill.verifiedBy の表示 */
export const VERIFIED_LABELS: Record<string, string> = {
  interview: "深掘りで検証済み",
  quiz: "腕試しで検証済み",
};
