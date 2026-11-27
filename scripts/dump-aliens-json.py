# gen-aliens.py の文字マップ（原本）を JSON で出す。PNG は書き出さない。
# 使い道: scripts/gen-alien-vox.ts が読んで、宇宙人の .vox（3Dの叩き台）を作る。
import json, pathlib
src = (pathlib.Path(__file__).resolve().parent / "gen-aliens.py").read_text()
head = src.split("def render(")[0]   # 文字マップとキャラ定義だけを実行する
ns = {"__file__": str(pathlib.Path(__file__).resolve().parent / "gen-aliens.py")}
exec(head.replace("os.makedirs(BASE, exist_ok=True)", ""), ns)
out = []
for cid, shape, name, body, sub in ns["CHARS"]:
    normal, smile_patch = ns["SHAPES"][shape]
    out.append({"id": cid, "shape": shape, "name": name, "body": body, "sub": sub,
                "rows": normal, "smile": {str(k): v for k, v in smile_patch.items()}})
print(json.dumps({"common": {k: v for k, v in ns["COMMON"].items() if v}, "chars": out}, ensure_ascii=False))
