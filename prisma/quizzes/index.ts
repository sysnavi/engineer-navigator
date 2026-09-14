// 資格カタログの章ごとの追加問題（資格別にファイルを分けている）。
//
// 各章1問だけでは1セッション10問の出題に足りないため、章ごとに最低6問まで増やした分。
// 最初の1問ずつは prisma/seed-cert-quizzes.ts にある（そちらが章の網羅を担保し、
// こちらが厚みを足す）。
//
// 追加するときの決まりごと:
//   - topic は src/lib/certifications.ts の CertChapter.topic そのまま（★唯一の正）
//   - 良問の条件は prisma/seed-quizzes.ts の冒頭コメントに従う
//   - 構造の不備は npm run check:quizzes が見る（id重複・選択肢4つ・answerIndexの範囲など）

import type { SeedQuiz } from "../seed-quizzes";
import { QUIZZES_IP } from "./ip";
import { QUIZZES_FE } from "./fe";
import { QUIZZES_AP } from "./ap";
import { QUIZZES_AWS_SAA } from "./aws-saa";
import { QUIZZES_JSTQB } from "./jstqb";
import { QUIZZES_LPIC } from "./lpic";

export const CERT_QUIZZES_EXTRA: SeedQuiz[] = [
  ...QUIZZES_IP,
  ...QUIZZES_FE,
  ...QUIZZES_AP,
  ...QUIZZES_AWS_SAA,
  ...QUIZZES_JSTQB,
  ...QUIZZES_LPIC,
];
