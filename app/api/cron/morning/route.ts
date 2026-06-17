import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { redis } from "@/lib/push";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type ScheduledNotification = {
  time: string;   // "HH:MM" JST
  title: string;
  body: string;
  url: string;
  sent: boolean;
};

// Vercel Cron: 毎朝6:00 JST (= 21:00 UTC 前日)
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 並列でデータ取得
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const [weatherRes, newsRes, stocksRes] = await Promise.allSettled([
      fetch(`${base}/api/weather`).then(r => r.json()),
      fetch(`${base}/api/news`).then(r => r.json()),
      fetch(`${base}/api/stocks`).then(r => r.json()),
    ]);

    const weather = weatherRes.status === "fulfilled" ? weatherRes.value : null;
    const news = newsRes.status === "fulfilled" ? (newsRes.value as {title:string}[]).slice(0, 5) : [];
    const stocks = stocksRes.status === "fulfilled" ? (stocksRes.value as {name:string;changePercent:string;positive:boolean}[]).slice(0, 3) : [];

    // 祝日チェック
    const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];
    let holidayName: string | null = null;
    try {
      const hRes = await fetch(`https://holidays-jp.github.io/api/v1/date.json`);
      const hData: Record<string, string> = await hRes.json();
      holidayName = hData[jstDate] ?? null;
    } catch { /* 祝日取得失敗は無視 */ }

    const weatherSummary = weather
      ? `天気: ${weather.condition} / 気温${weather.temp}°C(最高${weather.tempMax}° 最低${weather.tempMin}°) / 湿度${weather.humidity}% / 風速${weather.windSpeed}m/s${weather.rain != null ? ` / 降水${weather.rain}mm/h` : ""}`
      : "天気情報なし";

    const newsSummary = news.length > 0
      ? news.map((n: {title:string}, i: number) => `${i+1}. ${n.title}`).join("\n")
      : "ニュースなし";

    const stockSummary = stocks.length > 0
      ? stocks.map((s: {name:string;changePercent:string;positive:boolean}) => `${s.name}: ${s.positive ? "▲" : "▼"}${s.changePercent}%`).join(", ")
      : "株価情報なし";

    const prompt = `あなたはAI秘書Naviです。今日1日のプッシュ通知スケジュールを1時間ごとに作成してください。

【今日の日付】${jstDate}${holidayName ? `（${holidayName}・祝日）` : ""}
【天気】${weatherSummary}
【今日のニュース TOP5】
${newsSummary}
【注目銘柄】${stockSummary}

【通知枠（JST）】
08:00, 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00, 20:00, 21:00, 22:00, 23:00

ルール:
- 上記の時間枠を使って16件ちょうど作成する（1時間ごと）
- 通知はNotionを開くきっかけになる内容にする
- 天気・ニュース・株価を自然に絡める
- 祝日の場合はそれに触れる
- bodyは50文字以内・自然な日本語
- JSONのみ返す・前置き不要

返答形式:
{"notifications":[{"time":"08:00","title":"タイトル","body":"本文","url":"/"},{"time":"09:00",...},... (16件)]}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw) as { notifications?: ScheduledNotification[] };
    const notifications: ScheduledNotification[] = (parsed.notifications ?? []).map(n => ({
      ...n,
      sent: false,
    }));

    const key = `notifications:schedule:${jstDate}`;
    await redis.set(key, notifications, { ex: 86400 * 2 });

    return NextResponse.json({ ok: true, count: notifications.length, date: jstDate });
  } catch (e) {
    console.error("[cron/morning]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
