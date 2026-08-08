import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

// モバイルアプリのOAuth引換券（設計はprisma/schema.prismaのMobileLoginTicket参照）。
//
// フロー全体:
// 1. WebViewが乱数verifierを作り、SHA-256だけを /start?client=mobile&vh=... に渡す
// 2. OAuthはアプリ内ブラウザ（SafariVC/カスタムタブ）で完結。callbackが身元ハッシュを
//    引換券に載せ、ディープリンク jp.engnavi.app://auth?token=... でアプリへ戻す
// 3. WebViewが /api/auth/mobile/exchange に token+verifier をPOST →
//    検証OKなら通常のセッションcookieがWebViewに発行される
// verifierの生値はWebViewの外に出ないので、スキームを乗っ取った他アプリが
// tokenを拾ってもセッションに引き換えられない。
//
// 重要: モバイルフローはcookieを一切使わない。SFSafariViewController等の
// cookie jarはOAuthのリダイレクト連鎖でcookieを保持しないことがあり
// （ITP/バウンストラッキング対策）、cookie頼みのstate検証は実機で必ず壊れた。
// 代わりにOAuthのstateパラメータ自体を署名付きトークン（signMobileState）にして
// プロバイダと往復させ、callbackでは署名検証だけで完結させる。

/** アプリへ戻るディープリンク（iOS/Androidのネイティブ設定と揃えること） */
export const MOBILE_DEEPLINK = "jp.engnavi.app://auth";

/** 旧方式の残骸cookie（現在は未使用。callbackで掃除だけする） */
export const MOBILE_OAUTH_COOKIE = "en_oauth_mobile";

// ディープリンク往復用の短命券。一回使い切り＋verifier拘束があるので、
// 「開きますか？」ダイアログで迷っても死なないよう余裕を持たせる
const TICKET_TTL_MS = 10 * 60_000;
const STATE_TTL_MS = 10 * 60_000; // 認可画面での操作時間（webのstate cookieと同じ）

// 署名鍵はOAuthクライアントシークレット（サーバー限定の秘密）から導出。
// 専用のenv追加なしで、シークレットが変われば発行済みstateも自然に失効する。
function mobileStateKey(): Buffer {
  const material = `en-mobile-state:${process.env.GOOGLE_CLIENT_SECRET ?? ""}:${process.env.GITHUB_CLIENT_SECRET ?? ""}`;
  return createHash("sha256").update(material).digest();
}

/** モバイル用のstate値。形式: m.<verifierHash>.<失効epoch>.<HMAC> */
export function signMobileState(verifierHash: string): string {
  const exp = Date.now() + STATE_TTL_MS;
  const mac = createHmac("sha256", mobileStateKey())
    .update(`${verifierHash}.${exp}`)
    .digest("base64url");
  return `m.${verifierHash}.${exp}.${mac}`;
}

/** stateがモバイル形式か（callbackのフロー分岐に使う。検証はverifyMobileState） */
export function isMobileState(state: string | null): boolean {
  return !!state && state.startsWith("m.");
}

/** 署名・期限を検証してverifierHashを返す。不正はnull */
export function verifyMobileState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 4 || parts[0] !== "m") return null;
  const [, vh, expStr, mac] = parts;
  if (!isVerifierHash(vh)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const expect = createHmac("sha256", mobileStateKey())
    .update(`${vh}.${exp}`)
    .digest();
  let got: Buffer;
  try {
    got = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  return vh;
}

export function isVerifierHash(v: string): boolean {
  return /^[0-9a-f]{64}$/.test(v);
}

export async function createMobileLoginTicket(
  provider: string,
  providerHash: string,
  verifierHash: string
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.mobileLoginTicket.create({
    data: {
      token,
      provider,
      providerHash,
      verifierHash,
      expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    },
  });
  // ついで掃除: 使われず期限切れになった券を消す（テーブルを太らせない）
  await prisma.mobileLoginTicket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return token;
}

/** 券を検証して身元を返す。不明・期限切れ・verifier不一致は拒否。
 *  正当なverifier持ちの「2回目」は拒否せず成功を返す（冪等）——ディープリンクの
 *  二重配送で、成功済みログインの上にエラー画面が被さる事故を防ぐため。
 *  verifierの生値は本人のWebViewしか持たないので、重複許容でも第三者は引き換え不能。
 *  拒否理由はサーバーログに残す（実機の不具合はここでしか切り分けられない） */
export async function consumeMobileLoginTicket(
  token: string,
  verifier: string
): Promise<
  | { ok: true; provider: string; providerHash: string }
  | { ok: false; reason: string }
> {
  const reject = (reason: string) => {
    console.warn(`[mobile-oauth] ticket reject: ${reason} (token=${token.slice(0, 8)}…)`);
    return { ok: false as const, reason };
  };
  const ticket = await prisma.mobileLoginTicket.findUnique({
    where: { token },
  });
  if (!ticket) return reject("not-found");
  if (ticket.expiresAt < new Date()) {
    await prisma.mobileLoginTicket.deleteMany({ where: { id: ticket.id } });
    return reject("expired");
  }

  const vh = createHash("sha256").update(verifier).digest();
  const stored = Buffer.from(ticket.verifierHash, "hex");
  if (vh.length !== stored.length || !timingSafeEqual(vh, stored)) {
    // 不正な引き換え試行。オラクルにしないよう券ごと破棄する
    await prisma.mobileLoginTicket.deleteMany({ where: { id: ticket.id } });
    return reject("verifier-mismatch");
  }

  // 消費印を付ける（行は失効まで残す。掃除はcreate時のdeleteMany）。
  // count=0 = 既に消費済み = 二重配送の後着。verifier検証済みなので成功扱い
  const claimed = await prisma.mobileLoginTicket.updateMany({
    where: { id: ticket.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) {
    console.log(
      `[mobile-oauth] duplicate exchange tolerated (token=${token.slice(0, 8)}…)`
    );
  }
  return { ok: true, provider: ticket.provider, providerHash: ticket.providerHash };
}
