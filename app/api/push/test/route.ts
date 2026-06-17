import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { redis, sendPush, TOKEN_KEY } from "@/lib/push";
import { searchDatabases, queryDatabase } from "@/lib/notion";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sub = await redis.get("push:subscription");
  if (!sub) return NextResponse.json({ error: "通知が許可されていません" }, { status: 400 });

  const token = (await redis.get<string>(TOKEN_KEY)) ?? session.accessToken;

  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const jstDate = jstNow.toISOString().split("T")[0];
  const jstTime = jstNow.toISOString().split("T")[1].slice(0, 5);

  let scheduleSummary = "なし";
  let shoppingSummary = "なし";

  try {
    const schemas = await searchDatabases(token);

    const scheduleSchema = schemas.find((s) =>
      s.title.includes("スケジュール") || s.title.includes("予定") || s.title.includes("カレンダー")
    );
    if (scheduleSchema) {
      const pages = await queryDatabase(token, scheduleSchema.id);
      const todayEvents = pages.filter((p) =>
        Object.values(p).some((v) => typeof v === "string" && v.startsWith(jstDate))
      );
      if (todayEvents.length > 0) {
        scheduleSummary = todayEvents
          .map((p) => { const { __page_id: _id, ...rest } = p; return Object.values(rest).filter(Boolean).join(" "); })
          .join("、");
      }
    }

    const shoppingSchema = schemas.find((s) =>
      s.title.includes("買い物") || s.title.includes("ショッピング")
    );
    if (shoppingSchema) {
      const pages = await queryDatabase(token, shoppingSchema.id);
      const unpurchased = pages.filter((p) => !Object.values(p).includes("✓"));
      if (unpurchased.length > 0) {
        shoppingSummary = unpurchased.slice(0, 5)
          .map((p) => { const { __page_id: _id, ...rest } = p; return Object.values(rest).find((v) => v && v !== "✗"); })
          .filter(Boolean).join("、");
      }
    }
  } catch (e) {
    console.error("[push/test] notion error:", e);
  }

  let weatherSummary = "不明";
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    const w = await fetch(`${base}/api/weather`).then((r) => r.json());
    weatherSummary = `${w.condition} ${w.temp}°C`;
  } catch { /* ignore */ }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{
      role: "user",
      content: `あなたはAI秘書Naviです。現在時刻${jstTime}（JST）に送るプッシュ通知を1件だけ作ってください。

【今日の日付】${jstDate}
【現在時刻】${jstTime}
【今日のスケジュール】${scheduleSummary}
【買い物リスト（未購入）】${shoppingSummary}
【天気】${weatherSummary}

titleは20文字以内、bodyは50文字以内、JSONのみ返す。
{"title":"...","body":"...","url":"/"}`,
    }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notification = JSON.parse(completion.choices[0].message.content ?? "{}") as any;
  await sendPush({ title: notification.title ?? "NotiLink", body: notification.body ?? "", url: "/" });

  return NextResponse.json({ ok: true, notification });
}
