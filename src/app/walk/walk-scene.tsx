"use client";

// WALK.sav — うちの子とのんびり外を歩くだけのシーン（見る専・低負荷）。
// 世界はcanvasタイルエンジン（walk-canvas.tsx）: 5ビオーム巡回・視差・イベント。
// 1分に1回くらいペットがつぶやく（時刻×天気×場所×きみのコンディション×性格）。
// つぶやきは基本セリフ辞書（トークン0）。1散歩に1回だけAIの特別な一言が混じる（fail-open）。

import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonalityId } from "@/lib/pets/species";
import {
  pickMutter,
  timeToBucket,
  type MoodBucket,
  type LoadBucket,
  type TimeBucket,
  type WeatherBucket,
  type WalkContext,
} from "@/lib/walk/mutter";
import { fetchWeather } from "@/lib/walk/weather";
import { BIOME_JA, type BiomeId } from "@/lib/walk/world";
import { WalkCanvas } from "./walk-canvas";
import { walkAiMutter } from "./actions";

export type WalkPet = {
  id: string;
  name: string;
  personality: PersonalityId;
  affection: number;
  spriteNormal: string;
  spriteWalk: string;
};

// 夕方・夜はうっすら暗幕をかけて全体をなじませる（canvasの上に重ねる）
const TINT: Partial<Record<TimeBucket, string>> = {
  evening: "rgba(40,20,60,0.10)",
  night: "rgba(8,10,30,0.30)",
};

const WEATHER_EMOJI: Record<WeatherBucket, string> = {
  clear: "☀️",
  cloudy: "☁️",
  rain: "🌧",
  snow: "❄️",
  fog: "🌫",
  storm: "⛈",
};
const WEATHER_JA: Record<WeatherBucket, string> = {
  clear: "はれ",
  cloudy: "くもり",
  rain: "あめ",
  snow: "ゆき",
  fog: "きり",
  storm: "かみなり",
};

export function WalkScene(props: {
  pets: WalkPet[];
  mood: MoodBucket;
  load: LoadBucket;
}) {
  const [petId, setPetId] = useState(props.pets[0].id);
  const pet = props.pets.find((p) => p.id === petId) ?? props.pets[0];

  // 時刻・天気はクライアントでしか決まらない。ハイドレーション不一致を避けるため
  // 初期値は固定にして、マウント後の effect で実値に差し替える。
  const [time, setTime] = useState<TimeBucket>("noon");
  const [weather, setWeather] = useState<WeatherBucket>("clear");
  const [tempC, setTempC] = useState<number | null>(null);
  const [realWeather, setRealWeather] = useState(false);
  const [biome, setBiome] = useState<BiomeId | null>(null);
  // ?speed= デバッグ早回し（1〜8）。SSR中はwindowが無いので1
  const [speedMul] = useState(() => {
    if (typeof window === "undefined") return 1;
    const sp = Number(new URLSearchParams(window.location.search).get("speed"));
    return Number.isFinite(sp) && sp > 1 ? Math.min(8, sp) : 1;
  });
  const [mutter, setMutter] = useState<{ text: string; special: boolean } | null>(
    null
  );

  // つぶやき表示（ループ・イベントの両方から呼ぶ）。7秒で自動で消える
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, special: boolean) => {
    setMutter({ text, special });
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setMutter(null), 7000);
  }, []);

  // 時刻bucket（マウント時＋5分ごとに更新）
  useEffect(() => {
    const update = () => setTime(timeToBucket(new Date().getHours()));
    update();
    const t = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // 天気（位置情報→Open-Meteo・失敗時は擬似）。座標はうちのサーバーに送らない。
  const loadWeather = () => {
    fetchWeather().then((w) => {
      setWeather(w.weather);
      setTempC(w.tempC);
      setRealWeather(w.real);
    });
  };
  useEffect(() => {
    loadWeather();
  }, []);

  // つぶやきループが常に最新の文脈を読めるよう ref に載せる（更新は effect 内で）
  const ctxRef = useRef<WalkContext>({
    time: "noon",
    weather: "clear",
    mood: props.mood,
    load: props.load,
    personality: pet.personality,
    affection: pet.affection,
    petName: pet.name,
    biome: null,
  });
  useEffect(() => {
    ctxRef.current = {
      time,
      weather,
      mood: props.mood,
      load: props.load,
      personality: pet.personality,
      affection: pet.affection,
      petName: pet.name,
      biome,
    };
  }, [time, weather, props.mood, props.load, pet, biome]);

  // つぶやきループ（ペットを変えたら作り直す）。基本は辞書、2回目あたりで1度だけAI特別枠。
  useEffect(() => {
    let alive = true;
    const recent: string[] = [];
    let aiUsed = false;
    let tick = 0;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      if (!alive) return;
      tick++;
      let shown: { text: string; special: boolean } | null = null;

      if (!aiUsed && tick >= 2) {
        aiUsed = true;
        try {
          const ai = await walkAiMutter({
            petId,
            time: ctxRef.current.time,
            weather: ctxRef.current.weather,
            biome: ctxRef.current.biome ?? undefined,
          });
          if (alive && ai?.reply) shown = { text: ai.reply, special: true };
        } catch {
          /* AIが無理でも黙って辞書へ */
        }
      }
      if (!shown) {
        shown = { text: pickMutter(ctxRef.current, recent), special: false };
      }
      if (!alive) return;

      recent.unshift(shown.text);
      if (recent.length > 6) recent.pop();
      show(shown.text, shown.special);

      timer = setTimeout(run, 55000 + Math.random() * 15000);
    };

    timer = setTimeout(run, 4000); // 最初のひとことは早めに
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [petId, show]);

  return (
    <div>
      <div className="isolate relative aspect-[16/9] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8 bg-ink">
        {/* 世界（canvasタイルエンジン） */}
        <WalkCanvas
          walkSrc={pet.spriteWalk}
          normalSrc={pet.spriteNormal}
          time={time}
          weather={weather}
          speedMul={speedMul}
          onBiomeChange={setBiome}
          onEventLine={(line) => show(line, false)}
        />

        {/* つぶやき窓（canvasの上・シーン幅に収める） */}
        {mutter && (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center">
            <div
              className={`max-w-[86%] rounded-lg border-[2.5px] px-3 py-2 text-[13px] leading-snug shadow-hard-sm ${
                mutter.special
                  ? "border-pinkhot bg-quotebg"
                  : "border-line8 bg-win/95"
              }`}
            >
              <span className="font-pixel text-[10px] tracking-wide text-royal2">
                {pet.name}
                {mutter.special && <span className="ml-1 text-pinkhot">✨</span>}
              </span>
              <p className="mt-0.5 font-bold">{mutter.text}</p>
            </div>
          </div>
        )}

        {/* 雨・雪・霧はcanvas内のパーティクル（walk-canvas.tsx drawWeather）で降らせる */}

        {/* 時刻の暗幕（夕方・夜） */}
        {TINT[time] && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: TINT[time] }}
          />
        )}
      </div>

      {/* 天気・場所チップ＋ペット切替 */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="rounded-md border-2 border-line8 bg-win px-2 py-1 font-pixel text-[10.5px] tracking-wide">
          {WEATHER_EMOJI[weather]} {WEATHER_JA[weather]}
          {tempC != null && ` ${tempC}℃`}
        </span>
        {biome && (
          <span className="rounded-md border-2 border-line8 bg-win px-2 py-1 font-pixel text-[10.5px] tracking-wide text-royal2">
            📍 {BIOME_JA[biome]}
          </span>
        )}
        {!realWeather && (
          <button
            onClick={loadWeather}
            className="rounded-md border-2 border-peri bg-surface px-2 py-1 font-pixel text-[10.5px] tracking-wide text-royal2 hover:bg-win"
            title="現在地の天気を反映します（位置情報はOpen-Meteoにだけ送られ、当サービスには保存しません）"
          >
            📍 いまの天気にあわせる
          </button>
        )}

        {props.pets.length > 1 && (
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="font-pixel text-[10px] tracking-wide text-inksoft">
              いっしょに歩く子:
            </span>
            {props.pets.map((p) => (
              <button
                key={p.id}
                onClick={() => setPetId(p.id)}
                aria-pressed={p.id === petId}
                className={`rounded-md border-2 px-2 py-0.5 text-[11.5px] font-bold ${
                  p.id === petId
                    ? "border-line8 bg-royal text-white"
                    : "border-line8 bg-surface"
                }`}
              >
                {p.name}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
