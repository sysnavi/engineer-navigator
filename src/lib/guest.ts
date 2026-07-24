import { prisma } from "@/lib/db";
import { generateHandle } from "@/lib/oauth";
import type { Role } from "@/generated/prisma/enums";

// ゲストセッション（Issue #18）— 登録なしで「育てて潜る」コア体験だけ触れる一時アカウント。
//
// 設計の芯:
//  - ゲストは **本物の User 行**（role=GUEST）。専用の仮テーブルを作らないので、
//    OAuth連携時は role を書き換えるだけで昇格でき、育成データの移行が要らない。
//  - 解放するのは遊び系のコアループだけ。判定は1箇所（GUEST_ALLOWED_APPS と
//    assertNotGuest）に集約し、画面ごとの散らばった if を避ける。
//  - 未昇格のまま30日で掃除（scripts/cleanup-guests.ts）。

// 解放アプリの一覧は src/lib/apps.ts の GUEST_ALLOWED_APPS（クライアントからも
// 読まれるファイルなので、prisma依存のこのファイルには置かない）。

/** ゲストが触れないことをユーザーに伝える文言（登録への導線を兼ねる） */
export const GUEST_BLOCKED_MESSAGE =
  "この機能はアカウント登録後に使えます。マイページから連携すると、育てたアバターや戦利品はそのまま引き継がれます。";

export function isGuest(user: { role: Role }): boolean {
  return user.role === "GUEST";
}

/**
 * ゲストが触れない機能のサーバー側ガード。
 * 画面を隠すだけでは直リンクやServer Actionの直接呼び出しを防げないため、
 * 書き込み・AI呼び出しの入口で必ずこれを通す。
 */
export function assertNotGuest(user: { role: Role }): void {
  if (isGuest(user)) throw new Error(GUEST_BLOCKED_MESSAGE);
}

/**
 * ゲストに解放していない画面のゲート。ログイン必須＋ゲストなら /welcome へ戻す。
 * 画面を一覧から隠すだけでは直URLで入れてしまうため、対象ページの先頭で
 * getCurrentUser() の代わりにこれを呼ぶ。
 */
export async function requireFullAccount() {
  const { getCurrentUser } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");
  const user = await getCurrentUser();
  if (isGuest(user)) redirect("/welcome?guest=needsaccount");
  return user;
}

// 同一IPからのゲスト大量発行を防ぐ。DBに状態を持つほどではないので
// プロセス内メモリで十分（複数インスタンスならインスタンスごとの緩い制限になる）。
const ISSUE_WINDOW_MS = 60 * 60_000; // 1時間
const ISSUE_MAX_PER_IP = 5;
const issuedByIp = new Map<string, number[]>();

export function canIssueGuest(ip: string): boolean {
  const now = Date.now();
  const recent = (issuedByIp.get(ip) ?? []).filter((t) => now - t < ISSUE_WINDOW_MS);
  issuedByIp.set(ip, recent);
  // Mapが無限に育たないよう、古いIPを間引く
  if (issuedByIp.size > 10_000) {
    for (const [k, v] of issuedByIp) {
      if (v.every((t) => now - t >= ISSUE_WINDOW_MS)) issuedByIp.delete(k);
    }
  }
  return recent.length < ISSUE_MAX_PER_IP;
}

export function recordGuestIssue(ip: string): void {
  const list = issuedByIp.get(ip) ?? [];
  list.push(Date.now());
  issuedByIp.set(ip, list);
}

/** ゲストUserを1件作る（cookieの発行は呼び出し側） */
export async function createGuestUser() {
  const handle = await generateHandle();
  return prisma.user.create({
    data: {
      name: "ゲスト",
      role: "GUEST",
      handle,
      isPublic: false, // ゲストは公開プロフィールを持たない
    },
  });
}
