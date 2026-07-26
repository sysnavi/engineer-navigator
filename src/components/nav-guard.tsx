"use client";

// 画面遷移の見張り（おさんぽの引き止めなどに使う共通の仕組み）。
//
// 【設計の経緯】
//  1. 最初は「クリックを capture で拾って preventDefault」で止めていた。
//     → React / Next の Link がイベントを処理する順に依存し、止まったり止まらなかったり。
//  2. 次に React Context で見張りを配った。
//     → Provider は動いているのに見張りが登録されない状態になった（実測で確認）。
//        Server Component の children 越しに context を配る形は、事故ったときに
//        「何も起きない」ので原因が見えにくい。
//  3. そこで **モジュール単位の singleton** にした。仕組みが単純で、
//     どこから読んでも同じ1つの値を見るので、届かない事故が起きない。
//
// 使い方:
//   - 遷移を止めたい画面: useNavGuard((href) => boolean) を呼ぶ
//     （true=通す / false=止める）。アンマウントで自動解除。
//   - ナビのリンク: <Link> ではなく <GuardedLink> を使う。
// 見張りが未登録なら、ふつうの Link と完全に同じ挙動になる。

import Link from "next/link";
import { useEffect, useRef, type ComponentProps } from "react";

/** 遷移してよければ true、止めるなら false */
export type NavGuardFn = (href: string) => boolean;

let currentGuard: NavGuardFn | null = null;

/** 遷移してよいか問い合わせる（GuardedLink から呼ばれる） */
export function navAllowed(href: string): boolean {
  return currentGuard ? currentGuard(href) : true;
}

/** いま見張りが登録されているか（デバッグ・テスト用） */
export function hasNavGuard(): boolean {
  return currentGuard !== null;
}

/** 画面側から見張りを登録する。アンマウント時に自動で解除される */
export function useNavGuard(fn: NavGuardFn) {
  // 最新の関数を毎回参照できるようにrefへ逃がす（依存で登録し直さない）
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    const g: NavGuardFn = (href) => fnRef.current(href);
    currentGuard = g;
    return () => {
      // 自分が登録したものだけ外す（画面が入れ替わる途中の取り違えを防ぐ）
      if (currentGuard === g) currentGuard = null;
    };
  }, []);
}

/**
 * 見張りに問い合わせてから遷移する Link。
 * 見張りが無い画面ではふつうの Link と同じ。
 */
export function GuardedLink(props: ComponentProps<typeof Link>) {
  const { onClick, href, ...rest } = props;
  return (
    <Link
      {...rest}
      href={href}
      onClick={(e) => {
        // 新しいタブで開く操作は邪魔しない
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const to = typeof href === "string" ? href : String(href);
        if (!navAllowed(to)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
