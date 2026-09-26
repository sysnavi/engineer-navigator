"use client";

// WALK.sav — うちの子とのんびり外を歩くだけのシーン（見る専・低負荷）。
// 世界はcanvasタイルエンジン（walk-canvas.tsx）: 9ビオーム巡回（順はセッションごとにシャッフル）・視差・イベント。
// 1分に1回くらいペットがつぶやく（時刻×天気×場所×きみのコンディション×性格）。
// つぶやきは基本セリフ辞書（トークン0）。1散歩に1回だけAIの特別な一言が混じる（fail-open）。

import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonalityId } from "@/lib/pets/species";
import {
  chainFollowUp,
  pickMutter,
  petLine,
  timeToBucket,
  seasonBucket,
  type SeasonBucket,
  type MoodBucket,
  type LoadBucket,
  type TimeBucket,
  type WeatherBucket,
  type WalkContext,
} from "@/lib/walk/mutter";
import { fetchWeather, weatherFailMessage } from "@/lib/walk/weather";
import { BIOME_JA, ENTRY_LINES, type BiomeId } from "@/lib/walk/world";
import { walkItemById } from "@/lib/walk/items";
import { Window } from "@/components/retro";
import { WalkCanvas } from "./walk-canvas";
import { BgmPlayer } from "./bgm-player";
import { LeaveGuard } from "./leave-guard";
import { collectWalkItem, walkAiMutter } from "./actions";

export type WalkPet = {
  id: string;
  name: string;
  personality: PersonalityId;
  affection: number;
  spriteNormal: string;
  spriteWalk: string;
  spriteHappy: string;
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
// つぶやきの重複回避履歴。直近40件をlocalStorageに持ち、リロードや日をまたいでも被らない。
// 読み書きに失敗する環境（プライベートモード等）では黙ってメモリのみで動く（fail-open）
const RECENT_KEY = "walk-mutter-recent";
const RECENT_MAX = 40;
function loadRecent(): string[] {
  try {
    const arr: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}
function saveRecent(recent: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    /* 保存できなくても散歩は続く */
  }
}

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
  /** カギアイテムで解放済みの行き先ビオーム */
  unlocked?: BiomeId[];
}) {
  const [petId, setPetId] = useState(props.pets[0].id);
  const pet = props.pets.find((p) => p.id === petId) ?? props.pets[0];
  // 解放済みの行き先（散歩中にカギを拾ったら即ふえる）と行き先選択
  const [unlocked, setUnlocked] = useState<BiomeId[]>(props.unlocked ?? []);
  const [dest, setDest] = useState<BiomeId | null>(null);

  // 時刻・天気はクライアントでしか決まらない。ハイドレーション不一致を避けるため
  // 初期値は固定にして、マウント後の effect で実値に差し替える。
  const [time, setTime] = useState<TimeBucket>("noon");
  const [weather, setWeather] = useState<WeatherBucket>("clear");
  const [tempC, setTempC] = useState<number | null>(null);
  const [realWeather, setRealWeather] = useState(false);
  // 「いまの天気にあわせる」の進行状態と、取れなかったときの一言（押して無反応、をなくす）
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherNote, setWeatherNote] = useState<string | null>(null);
  const [biome, setBiome] = useState<BiomeId | null>(null);
  // 季節はマウント時に確定させる（散歩中に変わらないので初期化子で十分）
  const [season] = useState<SeasonBucket>(() =>
    seasonBucket(new Date().getMonth() + 1)
  );
  // ?speed= デバッグ早回し（1〜8）。SSR中はwindowが無いので1
  const [speedMul] = useState(() => {
    if (typeof window === "undefined") return 1;
    const sp = Number(new URLSearchParams(window.location.search).get("speed"));
    return Number.isFinite(sp) && sp > 1 ? Math.min(8, sp) : 1;
  });
  const [mutter, setMutter] = useState<{ text: string; special: boolean } | null>(
    null
  );

  // 「きょうのおさんぽ」欄: この散歩の記録（ページを離れたら消える・保存しない）
  const [log, setLog] = useState<LogEntry[]>([]);
  const [visited, setVisited] = useState<BiomeId[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [petCount, setPetCount] = useState(0);
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setMinutes(Math.floor((Date.now() - start) / 60000)), 10000);
    return () => clearInterval(t);
  }, []);
  // ログに載せる話し手（途中でペットを変えても、その時しゃべった子の名前が残る）
  const speakerRef = useRef(pet.name);
  useEffect(() => {
    speakerRef.current = pet.name;
  }, [pet.name]);

  // つぶやき表示（ループ・イベント・なでるから呼ぶ）。7秒で自動で消え、ログには残る
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, special: boolean) => {
    setMutter({ text, special });
    setLog((l) =>
      [{ id: Date.now() + Math.random(), at: clock(), who: speakerRef.current, text, special }, ...l].slice(
        0,
        LOG_MAX
      )
    );
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setMutter(null), 7000);
  }, []);

  // なでる: 立ち止まって笑顔＋ハート（canvas側）と、回数で変わるひとこと
  const lastPetLine = useRef<string | undefined>(undefined);
  const petThePet = () => {
    const n = petCount + 1;
    setPetCount(n);
    const line = petLine(pet.personality, n, lastPetLine.current);
    lastPetLine.current = line;
    show(line, false);
  };

  // イベント発生: セリフを出し、カギアイテム付きなら拾う（fail-open・入手時だけ✨演出）
  const handleEvent = useCallback(
    (line: string, item?: string) => {
      show(line, false);
      if (!item) return;
      collectWalkItem(item)
        .then((res) => {
          if (!res?.isNew) return;
          setFound((f) => (f.includes(res.name) ? f : [...f, res.name]));
          setTimeout(() => show(`『${res.name}』を てにいれた！`, true), 3000);
          setTimeout(() => show(res.getLine, false), 10500);
          const def = walkItemById(item);
          if (def) {
            setUnlocked((u) =>
              u.includes(def.unlocksBiome) ? u : [...u, def.unlocksBiome]
            );
          }
        })
        .catch(() => {});
    },
    [show]
  );

  // レア・特別ビオームに入った瞬間のひとこと
  const handleBiomeChange = useCallback(
    (b: BiomeId) => {
      setBiome(b);
      setVisited((v) => (v.includes(b) ? v : [...v, b]));
      const entry = ENTRY_LINES[b];
      if (entry) show(entry, true);
    },
    [show]
  );

  // 時刻bucket（マウント時＋5分ごとに更新）
  useEffect(() => {
    const update = () => setTime(timeToBucket(new Date().getHours()));
    update();
    const t = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // 天気（位置情報→Open-Meteo・失敗時は擬似）。座標はうちのサーバーに送らない。
  // マウント時は静かに試す（ダメなら擬似のまま）。ボタンからは結果を必ず一言で返す。
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyWeather = useCallback((w: Awaited<ReturnType<typeof fetchWeather>>) => {
    setWeather(w.weather);
    setTempC(w.tempC);
    setRealWeather(w.real);
  }, []);
  useEffect(() => {
    fetchWeather().then(applyWeather);
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, [applyWeather]);
  const matchWeather = async () => {
    setWeatherBusy(true);
    setWeatherNote(null);
    const w = await fetchWeather();
    applyWeather(w);
    setWeatherBusy(false);
    if (w.real) return;
    setWeatherNote(weatherFailMessage(w.reason));
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setWeatherNote(null), 8000);
  };

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
    season,
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
      season,
    };
  }, [time, weather, props.mood, props.load, pet, biome, season]);

  // つぶやきループ（ペットを変えたら作り直す）。基本は辞書、2回目あたりで1度だけAI特別枠。
  useEffect(() => {
    let alive = true;
    const recent: string[] = loadRecent();
    // 連番小ネタの「続き」。セットされていたら次のtickは辞書を引かずこれを出す
    let pendingChain: string | null = null;
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
        if (pendingChain) {
          shown = { text: pendingChain, special: false };
          pendingChain = null;
        } else {
          const text = pickMutter(ctxRef.current, recent);
          pendingChain = chainFollowUp(text);
          shown = { text, special: false };
        }
      }
      if (!alive) return;

      recent.unshift(shown.text);
      if (recent.length > RECENT_MAX) recent.pop();
      saveRecent(recent);
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
      {/* スマホ縦は 4:3 にして縦を広げる（canvasの左右1/8ずつを切り落とす）。
          --pet-x は画面上のペットの横位置（PET_X=110 / 表示幅）。吹き出しとタップ判定が使う */}
      <div className="isolate relative aspect-[4/3] w-full select-none overflow-hidden rounded-lg border-[2.5px] border-line8 bg-ink [--pet-x:29.17%] sm:aspect-[16/9] sm:[--pet-x:34.375%]">
        {/* 世界（canvasタイルエンジン）。行き先を選んだらそこから歩き直す（keyで作り直し） */}
        <div className="absolute inset-y-0 -left-[16.667%] w-[133.334%] sm:left-0 sm:w-full">
        <WalkCanvas
          key={dest ?? "auto"}
          walkSrc={pet.spriteWalk}
          normalSrc={pet.spriteNormal}
          happySrc={pet.spriteHappy}
          pettedAt={petCount}
          time={time}
          weather={weather}
          speedMul={speedMul}
          unlocked={unlocked}
          startBiome={dest}
          onBiomeChange={handleBiomeChange}
          onEvent={handleEvent}
        />
        </div>

        {/* なでる（ペットの上に透明なタップ判定。押したら canvas 側で笑顔＋ハート） */}
        <button
          type="button"
          onClick={petThePet}
          aria-label={`${pet.name}を なでる`}
          className="absolute bottom-[3%] left-[var(--pet-x)] z-20 h-[36%] w-[22%] -translate-x-1/2 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-pinkhot sm:w-[16%]"
        />
        {petCount === 0 && (
          <span className="pointer-events-none absolute bottom-1.5 left-[var(--pet-x)] z-10 -translate-x-1/2 whitespace-nowrap rounded border-2 border-line8 bg-win/90 px-1.5 font-pixel text-[9.5px] tracking-wide text-royal2">
            👆 なでてみる
          </span>
        )}

        {/* つぶやき窓（しゃべっている子の頭上に、しっぽ付きで出す） */}
        {mutter && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="absolute bottom-[calc(38%+8px)] left-[max(12px,calc(var(--pet-x)-44px))] right-3">
              <div
                className={`relative w-fit max-w-full rounded-lg border-[2.5px] px-3 py-1.5 text-[13px] leading-snug shadow-hard-sm ${
                  mutter.special
                    ? "border-pinkhot bg-quotebg"
                    : "border-line8 bg-win"
                }`}
              >
                <span className="font-pixel text-[10px] tracking-wide text-royal2">
                  {pet.name}
                  {mutter.special && <span className="ml-1 text-pinkhot">✨</span>}
                </span>
                <p className="mt-0.5 font-bold">{mutter.text}</p>
              </div>
            </div>
            {/* しっぽ（45度回した四角の下半分を吹き出しの枠線に重ねる） */}
            <span
              className={`absolute bottom-[calc(38%+2.5px)] left-[calc(var(--pet-x)-6px)] h-3 w-3 rotate-45 border-b-[2.5px] border-r-[2.5px] ${
                mutter.special ? "border-pinkhot bg-quotebg" : "border-line8 bg-win"
              }`}
            />
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

      {/* 行き先選択（カギアイテムで解放。見て分かる、が原則なので説明文なし） */}
      {unlocked.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="font-pixel text-[10px] tracking-wide text-inksoft">
            きょうは どこいく？:
          </span>
          <button
            onClick={() => setDest(null)}
            aria-pressed={dest === null}
            className={`rounded-md border-2 px-2 py-0.5 text-[11.5px] font-bold ${
              dest === null ? "border-line8 bg-royal text-white" : "border-line8 bg-surface"
            }`}
          >
            おまかせ
          </button>
          {unlocked.map((b) => (
            <button
              key={b}
              onClick={() => setDest(b)}
              aria-pressed={dest === b}
              className={`rounded-md border-2 px-2 py-0.5 text-[11.5px] font-bold ${
                dest === b ? "border-line8 bg-royal text-white" : "border-line8 bg-surface"
              }`}
            >
              {BIOME_JA[b]}
            </button>
          ))}
        </div>
      )}

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
        <LeaveGuard
          petName={pet.name}
          spriteNormal={pet.spriteNormal}
          spriteHappy={pet.spriteHappy}
        />
        <BgmPlayer />
        {!realWeather && (
          <button
            onClick={matchWeather}
            disabled={weatherBusy}
            aria-busy={weatherBusy}
            className="rounded-md border-2 border-peri bg-surface px-2 py-1 font-pixel text-[10.5px] tracking-wide text-royal2 hover:bg-win disabled:opacity-60"
            title="現在地の天気を反映します（位置情報はOpen-Meteoにだけ送られ、当サービスには保存しません）"
          >
            {weatherBusy ? "📍 しらべ中…" : "📍 いまの天気にあわせる"}
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
        {weatherNote && (
          <span role="status" className="basis-full text-[11.5px] text-inksoft">
            {weatherNote}
          </span>
        )}
      </div>

      {/* きょうのおさんぽ: この散歩の記録。つぶやきを読み逃しても後から読める */}
      <Window title="きょうのおさんぽ" titleEm=".log" className="mt-5" bodyClass="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="あるいた" value={minutes < 1 ? "1分未満" : `${minutes}分`} />
          <Stat label="なでた" value={`${petCount}回`} />
          <Stat label="みつけた" value={`${found.length}こ`} />
        </div>

        {visited.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-pixel text-[10px] tracking-wide text-inksoft">とおった場所:</span>
            {visited.map((b) => (
              <span
                key={b}
                className="rounded border-2 border-line8 bg-win px-1.5 text-[11.5px] font-bold"
              >
                {BIOME_JA[b]}
              </span>
            ))}
          </div>
        )}
        {found.length > 0 && (
          <p className="mt-2 text-[12px]">
            🎁 {found.map((n) => `『${n}』`).join(" ")}
          </p>
        )}

        <h2 className="mt-4 font-pixel text-[10.5px] tracking-wide text-royal2">つぶやき</h2>
        {log.length === 0 ? (
          <p className="mt-1.5 text-[12px] text-inksoft">
            あるいていると、{pet.name}が ときどき ひとこと話します。
          </p>
        ) : (
          <ol className="mt-1.5 max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
            {log.map((e) => (
              <li key={e.id} className="flex gap-2 text-[12.5px] leading-snug">
                <span className="shrink-0 font-pixel text-[10px] leading-[18px] text-inksoft">
                  {e.at}
                </span>
                <span>
                  <span className="mr-1 font-bold text-royal2">
                    {e.who}
                    {e.special && <span className="text-pinkhot">✨</span>}
                  </span>
                  {e.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Window>
    </div>
  );
}

type LogEntry = { id: number; at: string; who: string; text: string; special: boolean };
const LOG_MAX = 50;

/** いまの時刻を HH:MM で（ログ用・クライアントでのみ呼ぶ） */
function clock(): string {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border-2 border-line8 bg-win px-1 py-1.5">
      <div className="font-pixel text-[9.5px] tracking-wide text-inksoft">{props.label}</div>
      <div className="text-[14px] font-bold">{props.value}</div>
    </div>
  );
}
