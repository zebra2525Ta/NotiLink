import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { redis } from "@/lib/push";

const CACHE_KEY = "stocks:top5";
const CACHE_TTL = 3600; // 1時間

// ニッケイ主要銘柄プール（上昇率ランキングの母集団）
const STOCK_POOL = [
  { code: "7203", name: "トヨタ" },
  { code: "6758", name: "ソニーG" },
  { code: "9984", name: "ソフトバンクG" },
  { code: "6861", name: "キーエンス" },
  { code: "8035", name: "東京エレクトロン" },
  { code: "7974", name: "任天堂" },
  { code: "9432", name: "NTT" },
  { code: "6098", name: "リクルートHD" },
  { code: "7267", name: "ホンダ" },
  { code: "6501", name: "日立" },
  { code: "8306", name: "三菱UFJ" },
  { code: "9433", name: "KDDI" },
  { code: "4063", name: "信越化学" },
  { code: "6367", name: "ダイキン" },
  { code: "4661", name: "OLC" },
  { code: "7751", name: "キヤノン" },
  { code: "8766", name: "東京海上HD" },
  { code: "6594", name: "ニデック" },
  { code: "4502", name: "武田薬品" },
  { code: "6902", name: "デンソー" },
  { code: "7011", name: "三菱重工" },
  { code: "6702", name: "富士通" },
  { code: "4543", name: "テルモ" },
  { code: "2914", name: "JT" },
  { code: "8411", name: "みずほFG" },
];

async function fetchQuote(
  apiKey: string,
  code: string,
  name: string
): Promise<{
  code: string; name: string; close: number;
  change: string; changePercent: string; positive: boolean;
  date: string; rawChangePercent: number;
} | null> {
  try {
    const res = await fetch(
      `https://api.jquants.com/v2/equities/bars/daily?code=${code}`,
      { headers: { "x-api-key": apiKey } }
    );
    const data = await res.json();
    const quotes: { Date: string; O: number; C: number }[] = data.data ?? [];
    if (quotes.length === 0) return null;
    const latest = quotes[quotes.length - 1];
    const change = latest.C - latest.O;
    const rawChangePercent = (change / latest.O) * 100;
    return {
      code,
      name,
      close: latest.C,
      change: change > 0 ? `+${change.toFixed(0)}` : change.toFixed(0),
      changePercent: rawChangePercent > 0
        ? `+${rawChangePercent.toFixed(2)}`
        : rawChangePercent.toFixed(2),
      positive: change >= 0,
      date: latest.Date,
      rawChangePercent,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
  }

  // キャッシュがあれば即返す
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  const apiKey = process.env.JQUANTS_REFRESH_TOKEN ?? "";

  // 5件ずつ並列取得してレート制限を回避
  const results = [];
  const BATCH = 5;
  for (let i = 0; i < STOCK_POOL.length; i += BATCH) {
    const batch = STOCK_POOL.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(({ code, name }) => fetchQuote(apiKey, code, name))
    );
    results.push(...batchResults);
    if (i + BATCH < STOCK_POOL.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // 上昇率で降順ソートしてトップ5を返す
  const top5 = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.rawChangePercent - a.rawChangePercent)
    .slice(0, 5)
    .map(({ rawChangePercent: _, ...rest }) => rest);

  if (top5.length > 0) {
    await redis.set(CACHE_KEY, top5, { ex: CACHE_TTL });
  }

  return NextResponse.json(top5);
}
