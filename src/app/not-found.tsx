import Link from "next/link";
import { Window, PixelTitle, PixelLabel } from "@/components/retro";

// 404（notFound() 呼び出し・存在しないURL）。8bitの迷子画面。

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Window title="404" titleEm=".err">
        <div className="text-center">
          <PixelLabel className="!text-pinkhot">NOT FOUND</PixelLabel>
          <PixelTitle as="h1" className="mt-1 text-3xl text-royal">
            ページが見つかりません
          </PixelTitle>
          <p className="mt-3 text-[13px] text-inksoft">
            URLが違うか、権限が無いか、もう存在しないページです。
          </p>
          <Link href="/" className="btn8 btn8-start mt-5 inline-block text-[12px]">
            ← ホームへ戻る
          </Link>
        </div>
      </Window>
    </div>
  );
}
