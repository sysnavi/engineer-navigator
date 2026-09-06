// おさんぽの天気取得（クライアント専用）。
//
// 【プライバシー】位置情報はブラウザからOpen-Meteoへ直接投げる。うちのサーバーには
// 座標を一切送らない（AGENTS.md/セーフティの「位置情報をURLやサーバーに載せない」に準拠）。
// Open-Meteo は APIキー不要・無料・商用可。
//
// 許可が下りない/失敗した場合は「季節＋時刻」からの擬似天気に自動フォールバックする
// （散歩は眺めるだけの演出なので、天気が取れなくても止めない）。

import { timeToBucket, weatherCodeToBucket, type WeatherBucket } from "./mutter";

/** 実データが取れなかった理由（UIで「なぜ合わなかったか」を出すため） */
export type WeatherFailReason =
  | "unsupported" // この環境に位置情報APIが無い
  | "denied" // 位置情報の許可が下りていない（一度拒否すると以後ブラウザは再度聞かない）
  | "unavailable" // 端末が現在地を測れなかった
  | "timeout" // 測位が時間内に終わらなかった
  | "network"; // Open-Meteo に届かなかった／応答が読めなかった

export type WalkWeather = {
  weather: WeatherBucket;
  /** 実測気温（℃）。擬似天気のときは null */
  tempC: number | null;
  /** 実データが取れたか（UI表示の出し分け用） */
  real: boolean;
  /** real=false のときだけ入る。擬似天気に落ちた理由 */
  reason?: WeatherFailReason;
};

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("no geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 30 * 60 * 1000, // 30分キャッシュ（散歩ごとに測り直さない）
      enableHighAccuracy: false, // 街レベルで十分・電池にやさしく
    });
  });
}

/** 季節＋時刻からのそれらしい擬似天気（実データが取れないときの保険） */
function pseudoWeather(reason: WeatherFailReason): WalkWeather {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const t = timeToBucket(now.getHours());
  // 冬は時々ゆき、梅雨どきは時々あめ、それ以外は晴れ/くもり。夜はくもり寄り。
  let weather: WeatherBucket = "clear";
  if (month === 12 || month <= 2) weather = t === "night" ? "cloudy" : "clear";
  else if (month === 6 || month === 7) weather = "rain";
  else weather = t === "night" ? "cloudy" : "clear";
  return { weather, tempC: null, real: false, reason };
}

/** getCurrentPosition の失敗を理由に分類する（code: 1=拒否 2=測位不能 3=タイムアウト） */
function positionFailReason(err: unknown): WeatherFailReason {
  if (err instanceof Error && err.message === "no geolocation") return "unsupported";
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

/** 擬似天気に落ちた理由を、ボタンの横に出す短い日本語にする */
export function weatherFailMessage(reason: WeatherFailReason | undefined): string {
  switch (reason) {
    case "denied":
      return "位置情報の許可がないみたい。端末やブラウザの設定で許可してね";
    case "unsupported":
      return "この環境では位置情報が使えないみたい";
    case "timeout":
      return "現在地がなかなか測れなかった。もう一度おしてみてね";
    case "network":
      return "天気サービスにつながらなかった。もう一度おしてみてね";
    case "unavailable":
    default:
      return "現在地がわからなかった。もう一度おしてみてね";
  }
}

/**
 * 現在地の天気を返す。位置情報許可→Open-Meteo。失敗時は擬似天気。
 * 例外は投げない（常に WalkWeather を返す）。
 */
export async function fetchWeather(): Promise<WalkWeather> {
  let pos: GeolocationPosition;
  try {
    pos = await getPosition();
  } catch (err) {
    return pseudoWeather(positionFailReason(err));
  }
  try {
    const { latitude, longitude } = pos.coords;
    // 座標はOpen-Meteoにだけ渡す。小数2桁に丸めて精度も落とす（街区までは特定させない）
    const lat = latitude.toFixed(2);
    const lon = longitude.toFixed(2);
    const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const res = await fetch(url);
    if (!res.ok) return pseudoWeather("network");
    const json = await res.json();
    const code = json?.current?.weather_code;
    const temp = json?.current?.temperature_2m;
    if (typeof code !== "number") return pseudoWeather("network");
    return {
      weather: weatherCodeToBucket(code),
      tempC: typeof temp === "number" ? Math.round(temp) : null,
      real: true,
    };
  } catch {
    return pseudoWeather("network");
  }
}
