// 3D の絵を canvas の 1 枚絵にする（DOM の canvas を使うのでクライアント専用）。
import { loadStackModel, resolveColor } from "@/components/stack-sprite";
import { frameBounds, modelStack, renderStack, type Expr } from "@/lib/stack";

/**
 * .vox を 1 枚の絵（canvas）にする。canvas に描く画面（おさんぽのペット・ダンジョンの敵）用。
 * 余白を切り落とし（下端 = 足元）、height を渡すと高さがそれに近くなる整数倍に拡大する（省略時は等倍）
 */
export async function voxCanvas(vox: string, o: { dir: number; expr?: Expr; height?: number }) {
  const model = await loadStackModel(vox, false);
  const f = renderStack(modelStack(model, -1, o.expr ?? "n"), { dir: o.dir, line: resolveColor("var(--line, #12235f)") });
  const b = frameBounds(f) ?? { x0: 0, y0: 0, x1: f.w - 1, y1: f.h - 1 };
  const w = b.x1 - b.x0 + 1,
    h = b.y1 - b.y0 + 1;
  const src = document.createElement("canvas");
  src.width = f.w;
  src.height = f.h;
  const sg = src.getContext("2d");
  if (!sg) throw new Error("canvas");
  const img = sg.createImageData(f.w, f.h);
  img.data.set(new Uint8Array(f.px.buffer, f.px.byteOffset, f.px.byteLength));
  sg.putImageData(img, 0, 0);
  const n = o.height ? Math.min(8, Math.max(1, Math.round(o.height / h))) : 1;
  const out = document.createElement("canvas");
  out.width = w * n;
  out.height = h * n;
  const g = out.getContext("2d");
  if (!g) throw new Error("canvas");
  g.imageSmoothingEnabled = false;
  g.drawImage(src, b.x0, b.y0, w, h, 0, 0, w * n, h * n);
  return out;
}
