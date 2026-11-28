"use client";

// ペットの絵（3D）。今までの <Image src="/pets/<id>/<顔>.png"> の置き換えで、同じ大きさの指定のまま使える。
//   <PetSprite src={sp.sprites.happy} alt="" width={96} height={96} style={...} />
// - 種族と顔は PNG の場所から決まる（/pets/<id>/normal|happy|sleep|walk.png → /pets/<id>/model.vox）
//   happy = にっこり / sleep = 目を閉じる / walk = 横向きで歩く。.vox は scripts/gen-png-vox.ts が起こした原本
// - PNG は今までどおり置いたまま（並べ方の大きさを決める・読み込み中と SSR の代わり）。
//   3D はその幅の正方形で、足元を PNG の下端にそろえて重ねる。3D が出たら PNG は見えなくする
// - /pets/ 以外の絵（宇宙人流用など）は PNG のまま

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { StackSprite, type StackAction } from "@/components/stack-sprite";
import { petVoxSrc } from "@/lib/stack/assets";

const MOOD: Record<string, { action: StackAction; dir?: number }> = {
  normal: { action: "idle" },
  happy: { action: "happy" },
  sleep: { action: "sleep" },
  // 歩きの PNG は右を向いている。3D は右斜め前（真横だと薄くて顔が見えない）
  walk: { action: "walk", dir: 7 },
};

/** PNG の場所 → 3D の原本と顔。/pets/ の PNG でなければ null */
export function petModelOf(src: string) {
  const m = /^\/pets\/([\w-]+)\/(normal|happy|sleep|walk)\.png$/.exec(src);
  return m ? { vox: petVoxSrc(m[1]), ...MOOD[m[2]] } : null;
}

export function PetSprite(props: {
  src: string;
  alt: string;
  width: number;
  height: number;
  style?: CSSProperties;
  className?: string;
  draggable?: boolean;
}) {
  const model = petModelOf(props.src);
  const imgRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState(0);
  // 3D が出た原本（種族が替わったら、新しい 3D が出るまで PNG を見せる）
  const [readyVox, setReadyVox] = useState<string | null>(null);
  const vox = model?.vox;
  const ready = !!vox && readyVox === vox;
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !vox) return;
    const ro = new ResizeObserver(() => setSize(Math.round(img.getBoundingClientRect().width)));
    ro.observe(img);
    return () => ro.disconnect();
  }, [vox]);

  const img = (
    <Image
      ref={imgRef}
      src={props.src}
      alt={props.alt}
      width={props.width}
      height={props.height}
      draggable={props.draggable}
      className={props.className}
      style={{ imageRendering: "pixelated", ...props.style, ...(ready ? { visibility: "hidden" } : null) }}
      unoptimized
    />
  );
  if (!model) return img;
  return (
    <span style={{ position: "relative", display: "inline-block", lineHeight: 0, maxWidth: "100%", width: props.style?.width }}>
      {img}
      {size > 0 && (
        <StackSprite
          src={model.vox}
          size={size}
          action={model.action}
          dir={model.dir}
          onReady={() => setReadyVox(model.vox)}
          style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", pointerEvents: "none" }}
        />
      )}
    </span>
  );
}

