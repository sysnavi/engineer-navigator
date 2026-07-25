"use client";

// WALK.sav — うちの子とのんびり外を歩くだけのシーン（見る専・低負荷）。
// 背景を右→左に流して前進の錯覚を作り、本体はその場で歩行アニメ。
// 1分に1回くらいペットがつぶやく（時刻×天気×きみのコンディション×性格）。
// つぶやきは基本セリフ辞書（トークン0）。1散歩に1回だけAIの特別な一言が混じる（fail-open）。

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
import { walkAiMutter } from "./actions";

export type WalkPet = {
  id: string;
  name: string;
  personality: PersonalityId;
  affection: number;
  spriteNormal: string;
};

// 時刻ごとの空（8bitらしいくっきりグラデ）
const SKY: Record<TimeBucket, string> = {
  morning: "linear-gradient(180deg,#ffe6b8 0%,#bfe6ff 70%,#d9f2e8 100%)",
  noon: "linear-gradient(180deg,#8fd0ff 0%,#c7ecff 70%,#e6f7ff 100%)",
  evening: "linear-gradient(180deg,#ffcf9a 0%,#ff9fb8 55%,#b98ad6 100%)",
  night: "linear-gradient(180deg,#10163c 0%,#2a2a63 75%,#3b3a72 100%)",
};
// 夕方・夜はうっすら暗幕をかけて全体をなじませる
const TINT: Partial<Record<TimeBucket, string>> = {
  evening: "rgba(40,20,60,0.10)",
  night: "rgba(8,10,30,0.34)",
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
  const [mutter, setMutter] = useState<{ text: string; special: boolean } | null>(
    null
  );

  // 時刻bucket（マウント時＋5分ごとに更新。日跨ぎ・境界のため）
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
    };
  }, [time, weather, props.mood, props.load, pet]);

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
      setMutter(shown);
      const cur = shown;
      setTimeout(() => {
        if (alive) setMutter((m) => (m === cur ? null : m));
      }, 7000);

      timer = setTimeout(run, 55000 + Math.random() * 15000);
    };

    timer = setTimeout(run, 4000); // 最初のひとことは早めに
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [petId]);

  const isNight = time === "night";

  return (
    <div>
      <div
        className="isolate relative aspect-[16/9] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8"
        style={{ background: SKY[time] }}
      >
        {/* お日さま / お月さま */}
        {isNight ? (
          <>
            <div className="absolute right-[14%] top-[14%] h-9 w-9 rounded-full border-2 border-line8 bg-[#f4f0d0]" />
            {[
              [22, 20],
              [40, 12],
              [68, 26],
              [80, 16],
              [55, 30],
            ].map(([x, y], i) => (
              <i
                key={i}
                className="walk-twinkle absolute block h-[3px] w-[3px] bg-white"
                style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s` }}
              />
            ))}
          </>
        ) : (
          <div
            className="absolute h-11 w-11 rounded-full border-2 border-line8"
            style={{
              right: time === "evening" ? "16%" : "12%",
              top: time === "evening" ? "40%" : "12%",
              background: time === "evening" ? "#ff9d5c" : "#ffdf5a",
            }}
          />
        )}

        {/* くもり/はれ のときだけ 雲を流す */}
        {(weather === "clear" || weather === "cloudy") && (
          <>
            <Cloud className="top-[16%]" durationDelay="-4s" />
            <Cloud className="top-[26%]" durationDelay="-15s" small />
          </>
        )}

        {/* 遠景の丘（ゆっくり流れる＝視差の一番奥） */}
        <div
          className="walk-far absolute inset-x-0 bottom-[27%] h-[20%]"
          style={{
            background:
              "radial-gradient(circle at 60px 60px, #8fb98a 60px, transparent 61px) repeat-x",
            backgroundSize: "120px 60px",
            opacity: 0.8,
          }}
        />
        {/* 中景の茂み */}
        <div
          className="walk-mid absolute inset-x-0 bottom-[24%] h-[14%]"
          style={{
            background:
              "radial-gradient(circle at 24px 30px, #5f9e4a 22px, transparent 23px) repeat-x",
            backgroundSize: "96px 44px",
          }}
        />
        {/* 地面（手前・いちばん速い） */}
        <div
          className="walk-near absolute inset-x-0 bottom-0 h-[27%] border-t-2 border-line8"
          style={{
            background:
              "repeating-linear-gradient(90deg,#8ac559 0 10px,#7ebd4e 10px 20px)",
          }}
        />
        {/* 土の道 */}
        <div
          className="walk-near absolute inset-x-0 bottom-[3%] h-[10%]"
          style={{
            background:
              "repeating-linear-gradient(90deg,#d9b784 0 16px,#cfa974 16px 32px)",
          }}
        />

        {/* うちの子（その場で歩行・足元にかげ） */}
        <div className="absolute bottom-[9%] left-1/2 -translate-x-1/2">
          <div className="relative flex flex-col items-center">
            <span className="alien-patapata block w-[84px]" style={{ animationDuration: "0.5s" }}>
              <Image
                src={pet.spriteNormal}
                alt={pet.name}
                width={96}
                height={96}
                style={{ width: "100%", height: "auto", imageRendering: "pixelated" }}
                unoptimized
                priority
              />
            </span>
            <span
              className="mt-[-4px] block h-2 w-[54px] rounded-[50%]"
              style={{ background: "rgba(0,0,0,0.22)" }}
            />
          </div>
        </div>

        {/* つぶやき窓（本体の頭上・シーン幅に収める） */}
        {mutter && (
          <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
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

        {/* 雨/雪/霧のオーバーレイ */}
        {weather === "rain" && (
          <div
            className="walk-rain pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(105deg,rgba(255,255,255,0.5) 0 2px,transparent 2px 9px)",
            }}
          />
        )}
        {weather === "storm" && (
          <div
            className="walk-rain pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(100deg,rgba(255,255,255,0.6) 0 2px,transparent 2px 7px)",
            }}
          />
        )}
        {weather === "snow" && (
          <div
            className="walk-snow pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle,#fff 1.6px,transparent 2px) 0 0 / 26px 26px",
            }}
          />
        )}
        {weather === "fog" && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "rgba(230,235,240,0.34)" }}
          />
        )}

        {/* 時刻の暗幕（夕方・夜） */}
        {TINT[time] && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: TINT[time] }}
          />
        )}
      </div>

      {/* 天気チップ＋ペット切替 */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="rounded-md border-2 border-line8 bg-win px-2 py-1 font-pixel text-[10.5px] tracking-wide">
          {WEATHER_EMOJI[weather]} {WEATHER_JA[weather]}
          {tempC != null && ` ${tempC}℃`}
        </span>
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

function Cloud(props: { className?: string; durationDelay?: string; small?: boolean }) {
  const s = props.small ? 0.7 : 1;
  return (
    <div
      className={`walk-cloud pointer-events-none absolute ${props.className ?? ""}`}
      style={{ right: "-30%", animationDelay: props.durationDelay, transform: "translateX(0)" }}
    >
      <span
        className="block rounded-full border-2 border-line8 bg-white/85"
        style={{ width: 54 * s, height: 22 * s }}
      />
    </div>
  );
}
