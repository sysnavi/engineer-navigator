# おさんぽ用の歩き差分 walk.png を生成する（瞳を進行方向=右に寄せる）。
#
#   python3 scripts/gen-side.py public/pets/*/normal.png
#
# 体は正面のまま・目線だけ右＝カービィ式の「右に歩いてる」表現。実際の傾き・ボブは
# canvas 側（walk-canvas.tsx）でかける。検出できない子は normal.png のコピーで
# フォールバックする（散歩に出られない子を作らない）。
# 検出・加工・検算の機構は gen-expressions.py の Sprite を再利用する。

import importlib.util
import os
import shutil
import sys

_spec = importlib.util.spec_from_file_location(
    "gen_expressions", os.path.join(os.path.dirname(__file__), "gen-expressions.py")
)
_ge = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ge)


def shift_eyes_right(sp):
    """瞳を1セル右へ。pupil型=瞳だけ移動 / bar型=棒ごと1セル右へ。
    右隣に地の色（白目・体色）が無い目は動かせないので False。"""
    eyes, _ = sp.features()
    if not eyes:
        return []
    log = []
    for y, l, r in eyes:
        for seg in (l, r):
            style = sp.eye_style(seg, y)
            if style == "pupil":
                # 目全体を1セル右へ（右端の外に地があるときだけ）
                if not sp.body(seg[-1] + 1, y):
                    continue
                for x in seg:
                    sp.erase(x, y)
                for x in seg:
                    sp.paint(x + 1, y)
                log.append(f"pupil→({seg[0] + 1}-{seg[-1] + 1},{y})")
            else:
                # 黒棒: 左端を消して右端の右に足す＝棒ごと右シフト
                if not sp.body(seg[-1] + 1, y):
                    continue
                if sp.erase(seg[0], y):
                    sp.paint(seg[-1] + 1, y)
                    log.append(f"bar→({seg[0] + 1}-{seg[-1] + 1},{y})")
    return log


def main():
    files = sys.argv[1:]
    if not files:
        print("usage: python3 scripts/gen-side.py public/pets/*/normal.png")
        sys.exit(1)
    ok, fell = 0, []
    for path in files:
        out = os.path.join(os.path.dirname(path), "walk.png")
        label = os.path.basename(os.path.dirname(path))
        try:
            sp = _ge.Sprite(path)
            trusted, why = sp.check_detection()
            if not trusted:
                raise RuntimeError(why)
            log = shift_eyes_right(sp)
            if not log:
                raise RuntimeError("動かせる瞳が見つからない")
            safe, problem = sp.verify_edits()
            if not safe:
                raise RuntimeError(problem)
            sp.save(out)
            ok += 1
            print(f"OK       {label:<18} {' '.join(log)}")
        except Exception as e:  # フォールバック: 正面のまま散歩に出す
            shutil.copyfile(path, out)
            fell.append(label)
            print(f"FALLBACK {label:<18} {e}")
    print(f"-- 生成 {ok} / フォールバック {len(fell)} / 計 {len(files)}")
    if fell:
        print(f"-- normalコピーで代用: {', '.join(fell)}")


if __name__ == "__main__":
    main()
