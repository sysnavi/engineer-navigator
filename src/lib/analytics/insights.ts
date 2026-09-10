// 週次テコ入れ提案（docs/analytics.md「週次テコ入れ提案」）の純ロジック。
// 来訪者分析の数字（今週 / 先週）から「どこがボトルネックか」を決定的なルールで診断し、
// 優先順に並べる。AI は文章化と優先順位の説明に使うだけで、診断の根拠はここで作る
// （API キーが無くても提案は出る）。数字の定義は queries.ts。

import type { VisitorAnalytics } from "./queries";
import { pct } from "./stats";

export type Finding = {
  key: string;
  priority: 1 | 2 | 3; // 1=最優先
  title: string; // 何が起きているか
  evidence: string; // 数字の根拠
  action: string; // 次にやること（具体的に）
};

// 判定に使う最小サンプル。これ未満は「まだ言えない」として扱い、集客の提案に寄せる
const MIN_GUESTS = 5;

function stepUsers(a: VisitorAnalytics, key: string): number {
  return a.funnel.steps.find((s) => s.key === key)?.users ?? 0;
}

function sumWau(a: VisitorAnalytics): number {
  return a.wau.guest + a.wau.member;
}

/** 今週（current）と先週（previous・7日前を基準にした同じ集計）から所見を作る。 */
export function diagnose(current: VisitorAnalytics, previous: VisitorAnalytics): Finding[] {
  const f: Finding[] = [];
  const a = current;
  const started = stepUsers(a, "started");
  const returned = stepUsers(a, "returned");
  const gated = stepUsers(a, "gated");
  const wall = stepUsers(a, "wall");
  const oauth = stepUsers(a, "oauth");
  const promoted = stepUsers(a, "promoted");

  // --- 来訪の勢い（WAU の前週比） ---
  const wauNow = sumWau(a);
  const wauPrev = sumWau(previous);
  if (wauPrev > 0 && wauNow < wauPrev * 0.8) {
    f.push({
      key: "wau-down",
      priority: 2,
      title: "週間の来訪者が減っている",
      evidence: `WAU ${wauPrev} → ${wauNow}（${pct(wauNow, wauPrev)}）`,
      action: "LP（/welcome）への流入元を Vercel Analytics で確認し、減った経路（SNS投稿・検索）にテコ入れする",
    });
  }

  // --- ゲスト→登録ファネル ---
  if (started < MIN_GUESTS) {
    f.push({
      key: "few-guests",
      priority: 1,
      title: "ゲストの数がまだ少なく、ファネルの判断ができない",
      evidence: `30日のお試し開始 ${started}人（判断には ${MIN_GUESTS}人以上ほしい）`,
      action: "まずは集客。SNS投稿の頻度・LPの「ためしてみる」の位置を見直し、ゲスト数を増やしてから登録率を見る",
    });
  } else {
    // 各段の落差。分母が小さい段は判定しない
    const drops: { key: string; from: number; to: number; title: string; action: string }[] = [
      {
        key: "drop-return",
        from: started,
        to: returned,
        title: "お試し初日で離脱している（2日目に戻ってこない）",
        action: "初日の体験を見直す。ゲスト用チュートリアルの最後のCTA、初回のダンジョン・腕試しの手応え、翌日に戻る理由（来訪者・連続ボーナス）の見せ方",
      },
      {
        key: "drop-gate",
        from: started,
        to: gated,
        title: "ゲストが登録限定の機能に出会えていない（登録の動機がない）",
        action: "ゲストのホームやチュートリアルで、週報→経歴書・AIメンターの「味見」を増やす。遮断される機能の露出を意図的に作る",
      },
      {
        key: "drop-wall",
        from: gated,
        to: wall,
        title: "弾かれた人に登録案内が届いていない",
        action: "Server Action 側の遮断（via=action）はページ遷移しないので案内が出ない。エラー文言に連携ボタンを付ける",
      },
      {
        key: "drop-oauth",
        from: wall,
        to: oauth,
        title: "登録案内を見ても連携ボタンを押していない",
        action: "/welcome の UNLOCK 枠の文言・「引き継がれる」の訴求・ボタンの位置をA/B。「お試しを続ける」に流れていないか確認",
      },
      {
        key: "drop-promote",
        from: oauth,
        to: promoted,
        title: "連携を始めたのに登録が完了していない（OAuth途中の失敗）",
        action: "連携結果の内訳（キャンセル / 既存アカウント衝突 / 通信失敗）を見て、多い理由を潰す",
      },
    ];
    const worst = drops
      .filter((d) => d.from >= MIN_GUESTS)
      .map((d) => ({ ...d, rate: d.to / d.from }))
      .sort((x, y) => x.rate - y.rate)[0];
    if (worst && worst.rate < 0.5) {
      f.push({
        key: worst.key,
        priority: 1,
        title: worst.title,
        evidence: `${worst.from}人 → ${worst.to}人（${pct(worst.to, worst.from)}）が最大の落差`,
        action: worst.action,
      });
    }
    // 登録率そのもの
    f.push({
      key: "conversion",
      priority: promoted / started < 0.1 ? 2 : 3,
      title: `ゲストの登録率は ${pct(promoted, started)}`,
      evidence: `お試し開始 ${started}人 / 登録完了 ${promoted}人` +
        (a.funnel.medianDaysToPromote !== null ? ` / 登録までの中央値 ${a.funnel.medianDaysToPromote}日` : ""),
      action: promoted / started < 0.1
        ? "10%を最初の目標に。上の最大落差から手を付ける"
        : "登録率は悪くない。登録後の定着（D7）に軸足を移す",
    });
  }

  // --- 既存アカウント衝突（データが宙に浮く） ---
  const collided = a.funnel.oauthOutcomes.find((o) => o.outcome === "already-linked")?.count ?? 0;
  if (collided > 0) {
    f.push({
      key: "already-linked",
      priority: 2,
      title: "ゲストの連携が既存アカウントと衝突している",
      evidence: `30日で ${collided}件。お試しで育てたデータが宙に浮き、30日で消える`,
      action: "ゲストのデータを既存アカウントへマージする導線（または「戻る前に注意」の案内）を作る",
    });
  }
  const fails = a.funnel.oauthOutcomes
    .filter((o) => o.outcome.startsWith("fail:"))
    .reduce((s, o) => s + o.count, 0);
  if (oauth >= 3 && fails / Math.max(1, oauth) >= 0.3) {
    f.push({
      key: "oauth-fail",
      priority: 1,
      title: "OAuth の失敗が多い",
      evidence: `連携開始 ${oauth}人に対し失敗 ${fails}件（${a.funnel.oauthOutcomes
        .filter((o) => o.outcome.startsWith("fail:"))
        .map((o) => `${o.outcome.slice(5)} ${o.count}`)
        .join(", ")}）`,
      action: "理由コード別に確認。denied が多ければ同意画面の説明、state/exchange が多ければ設定・障害を疑う",
    });
  }

  // --- 定着（D7 が判定できる最新の週） ---
  const judged = [...a.retention].reverse().find((r) => r.d7 !== null && r.size >= 3);
  if (judged && judged.d7! < 30) {
    f.push({
      key: "retention-d7",
      priority: 2,
      title: "登録した人が翌週に戻ってきていない",
      evidence: `${judged.weekStart} 週の登録 ${judged.size}人の D7 = ${judged.d7}%`,
      action: "翌週に戻る理由を作る。週報の提出リマインド（PWA通知）、週明けの「先週のふりかえり」カード、来訪者の確定再訪",
    });
  }

  // --- 機能利用（登録済みが週報を使っていない） ---
  const report = a.features.find((x) => x.key === "report");
  if (a.members >= 5 && report && report.users / a.members < 0.2) {
    f.push({
      key: "report-unused",
      priority: 2,
      title: "登録済みの大半が週報を書いていない",
      evidence: `30日で週報を書いた人 ${report.users}/${a.members}（${pct(report.users, a.members)}）`,
      action: "週報がコア（経歴書・スキルマップの源泉）なのに使われていない。ホームの導線とインタビュー形式の入口を目立たせる",
    });
  }

  return f.sort((x, y) => x.priority - y.priority);
}

export type Proposal = {
  headline: string; // 1行の総括
  priorities: { title: string; why: string; action: string }[]; // 最大3つ
};

/** AI が使えないときの提案（所見の上位3つをそのまま） */
export function fallbackProposal(findings: Finding[]): Proposal {
  const top = findings.slice(0, 3);
  return {
    headline:
      top.length === 0
        ? "目立ったボトルネックはありません。集客を続けつつデータを貯めましょう"
        : `今週の最優先: ${top[0].title}`,
    priorities: top.map((x) => ({ title: x.title, why: x.evidence, action: x.action })),
  };
}

/** Slack（mrkdwn）用の本文。週次ジョブと手動実行で同じ形にする。 */
export function formatSlack(params: {
  current: VisitorAnalytics;
  previous: VisitorAnalytics;
  proposal: Proposal;
  appUrl: string;
  aiUsed: boolean;
}): string {
  const { current: a, previous: p, proposal } = params;
  const wau = sumWau(a);
  const wauPrev = sumWau(p);
  const arrow = wauPrev === 0 ? "" : wau > wauPrev ? " ↑" : wau < wauPrev ? " ↓" : " →";
  const steps = a.funnel.steps.map((s) => `${s.label} ${s.users}`).join(" → ");

  const lines = [
    `📈 *来訪者分析 — 今週のテコ入れ提案*`,
    `> ${proposal.headline}`,
    ``,
    `*数字（直近30日 / WAU は前週比）*`,
    `• WAU ${wau}${arrow}（先週 ${wauPrev}）／ MAU ${a.mau.member + a.mau.guest}／ 登録済み累計 ${a.members}`,
    `• 新規: 直接 ${a.newDirect30} ／ ゲスト昇格 ${a.promoted30} ／ ゲスト発行 ${a.newGuests30}（登録率 ${pct(a.promoted30, a.newGuests30)}）`,
    `• ゲストファネル: ${steps}`,
  ];
  if (a.funnel.gateByApp.length > 0) {
    lines.push(
      `• 弾かれた機能: ${a.funnel.gateByApp.slice(0, 3).map((g) => `${g.app} ${g.count}`).join(", ")}`
    );
  }
  lines.push(``, `*次にやること*`);
  proposal.priorities.forEach((x, i) => {
    lines.push(`*${i + 1}. ${x.title}*`, `　根拠: ${x.why}`, `　→ ${x.action}`);
  });
  lines.push(
    ``,
    `詳細: ${params.appUrl}/admin/analytics ${params.aiUsed ? "（提案文は AI 生成・数字はDB集計）" : "（AI未使用・ルール診断のみ）"}`
  );
  return lines.join("\n");
}
