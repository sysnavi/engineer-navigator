import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
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

/** アプリへ戻るディープリンク（iOS/Androidのネイティブ設定と揃えること） */
export const MOBILE_DEEPLINK = "jp.engnavi.app://auth";

/** OAuth開始→callback間で「モバイルフロー」を伝えるcookie名（値=verifierHash） */
export const MOBILE_OAUTH_COOKIE = "en_oauth_mobile";

const TICKET_TTL_MS = 2 * 60_000; // ディープリンク往復に十分な短命

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

/** 券を消費して身元を返す。無効・期限切れ・verifier不一致はnull（券は必ず消える） */
export async function consumeMobileLoginTicket(
  token: string,
  verifier: string
): Promise<{ provider: string; providerHash: string } | null> {
  const ticket = await prisma.mobileLoginTicket.findUnique({
    where: { token },
  });
  if (!ticket) return null;
  // 先に消してから検証（一回使い切り）。count=0は並行リクエストに先を越された場合
  const deleted = await prisma.mobileLoginTicket.deleteMany({
    where: { id: ticket.id },
  });
  if (deleted.count === 0) return null;
  if (ticket.expiresAt < new Date()) return null;

  const vh = createHash("sha256").update(verifier).digest();
  const stored = Buffer.from(ticket.verifierHash, "hex");
  if (vh.length !== stored.length || !timingSafeEqual(vh, stored)) return null;

  return { provider: ticket.provider, providerHash: ticket.providerHash };
}
