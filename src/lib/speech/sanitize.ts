// TTS読み上げ用のテキスト整形（純ロジック・DBに触らない）。
// インタビューの質問文には絵文字・記号・選択肢の区切り "/" が多く、
// そのまま読み上げると「スラッシュ」「タイヨウ」等のノイズになるため取り除く。

/** 絵文字・記号類（Extended_Pictographic）と異体字セレクタ・ZWJ */
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** 読み上げに不要な装飾記号（読点として意味を持つものは残す） */
const DECORATION_RE = /[★☆▶◀■□●○◆◇※｜|]/g;

export function sanitizeForSpeech(text: string): string {
  return (
    text
      .replace(EMOJI_RE, "")
      .replace(DECORATION_RE, "")
      // 選択肢の区切り "A / B / C" は「A、B、C」として読む
      .replace(/\s*\/\s*/g, "、")
      // 箇条書きの行頭記号
      .replace(/^[・\-*]\s*/gm, "")
      // マークダウン強調の残骸
      .replace(/\*+/g, "")
      // 連続する空白・改行を1つの区切りに（行頭・行末の余白も落とす）
      .replace(/[ \t]+/g, " ")
      .replace(/^[ \t]+|[ \t]+$/gm, "")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}
