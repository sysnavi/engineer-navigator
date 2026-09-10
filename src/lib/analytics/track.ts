import { prisma } from "@/lib/db";

// 来訪者分析のイベント記録（docs/analytics.md）。
//
// 方針:
//  - 記録は **サーバー側だけ**（Route Handler / Server Action / サーバーコンポーネント）。
//    クライアントJSに頼ると広告ブロッカーやWKWebViewで欠損し、ゲストの数字が歪む。
//  - 失敗しても本体の処理を止めない（await しても throw しない）。
//  - name は下の EVENT からしか取れない。props は個人情報や自由入力を入れない。
//
// イベント辞書（ゲスト→本登録ファネルを追うための最小セット）:
//  guest_start        ゲストを発行した（userId=ゲスト）
//  guest_gate         ゲストが登録限定の機能に触れて弾かれた。props.app=どの機能か
//  guest_needsaccount 弾かれて /welcome の「登録が必要」案内を見た
//  oauth_start        OAuthログインを開始した。props.provider / guest（ゲストからの昇格試行か）
//  oauth_result       OAuthの結果。props.outcome = new | login | linked | promoted | already-linked | fail
//                     fail のとき props.reason に理由コード（state/denied/exchange/...）
//  guest_promoted     ゲストが本登録に昇格した（userId=同じUser行）

export const EVENT = {
  guestStart: "guest_start",
  guestGate: "guest_gate",
  guestNeedsAccount: "guest_needsaccount",
  oauthStart: "oauth_start",
  oauthResult: "oauth_result",
  guestPromoted: "guest_promoted",
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

export type EventProps = Record<string, string | number | boolean | null>;

/** イベントを1件記録する。失敗は握りつぶしてログだけ出す（本体を壊さない）。 */
export async function track(
  name: EventName,
  opts: { userId?: string | null; props?: EventProps } = {}
): Promise<void> {
  try {
    await prisma.appEvent.create({
      data: {
        name,
        userId: opts.userId ?? null,
        props: opts.props ?? undefined,
      },
    });
  } catch (e) {
    console.error(`track(${name}) failed:`, e);
  }
}
