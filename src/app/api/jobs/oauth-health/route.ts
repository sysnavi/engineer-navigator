import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  OAUTH_PROVIDERS,
  enabledProviders,
  probeAuthorize,
  probeToken,
  type OAuthProvider,
  type ProbeResponse,
} from "@/lib/oauth";
import {
  checkEnabled,
  checkEvents,
  classifyAuthorize,
  classifyToken,
  formatHealthSlack,
  isHealthy,
  summarizeEvents,
  type HealthCheck,
} from "@/lib/oauth-health";

// OAuth登録の見張り（docs/analytics.md「6」）。Secret と本番DBがあるのは Vercel 側だけなので
// 判定はここで行い、Slack 投稿は呼び出し元（GitHub Actions・scripts/oauth-health/post.ts）が行う。
// 認証は weekly-insights と同じ Authorization: Bearer <JOB_SECRET>。
// 応答にも Secret は含めない（判定結果の文言だけ）。

export const maxDuration = 30;

const DAY_MS = 86400_000;

async function probe(
  provider: OAuthProvider,
  key: "authorize" | "token",
  run: () => Promise<ProbeResponse>,
  classify: (p: OAuthProvider, r: ProbeResponse) => HealthCheck
): Promise<HealthCheck> {
  try {
    return classify(provider, await run());
  } catch (e) {
    return {
      provider,
      key,
      status: "warn",
      message: `プロバイダに接続できない（${e instanceof Error ? e.message : String(e)}）`,
    };
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.JOB_SECRET;
  if (!secret) {
    return Response.json({ error: "JOB_SECRET が未設定です" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const enabled = enabledProviders();

  const configChecks = await Promise.all(
    OAUTH_PROVIDERS.map(async (provider) => {
      const e = checkEnabled(provider, enabled);
      if (e.status !== "ok") return [e];
      return [
        e,
        await probe(provider, "authorize", () => probeAuthorize(provider, appUrl), classifyAuthorize),
        await probe(provider, "token", () => probeToken(provider, appUrl), classifyToken),
      ];
    })
  );

  const rows = await prisma.appEvent.findMany({
    where: {
      name: { in: ["oauth_start", "oauth_result"] },
      createdAt: { gte: new Date(Date.now() - DAY_MS) },
    },
    select: { name: true, props: true },
  });
  const summary = summarizeEvents(rows);

  const checks = [...configChecks.flat(), ...checkEvents(summary)];
  return Response.json({
    ok: isHealthy(checks),
    checks,
    summary,
    text: formatHealthSlack({ checks, summary, appUrl }),
  });
}
