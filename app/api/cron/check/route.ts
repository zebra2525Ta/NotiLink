import { NextResponse } from "next/server";
import { redis, sendPush, TOKEN_KEY } from "@/lib/push";
import { searchDatabases, queryDatabase } from "@/lib/notion";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const jstHour = jstNow.getUTCHours();
  if (jstHour < 8 || jstHour >= 24) {
    return NextResponse.json({ ok: true, reason: "outside hours" });
  }

  const sub = await redis.get("push:subscription");
  if (!sub) return NextResponse.json({ ok: true, reason: "no subscription" });

  const token = await redis.get<string>(TOKEN_KEY);
  if (!token) return NextResponse.json({ ok: true, reason: "no token" });

  const jstDate = jstNow.toISOString().split("T")[0];
  const jstTime = jstNow.toISOString().split("T")[1].slice(0, 5);

  // Notionからスケジュール・買い物リストを取得
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
          .map((p) => {
            const { __page_id: _id, ...rest } = p;
            return Object.values(rest).filter(Boolean).join(" ");
          })
          .join("、");
      }
    }

    const shoppingSchema = schemas.find((s) =>
      s.title.includes("買い物") || s.title.includes("ショッピング")
    );
    if (shoppingSchema) {
      const pages = await queryDatabase(token, shoppingSchema.id);
      const unpurchased = pages.filter((p) => {
        const checked = Object.values(p).find((v) => v === "✓");
        return !checked;
      });
      if (unpurchased.length > 0) {
        shoppingSummary = unpurchased
          .slice(0, 5)
          .map((p) => {
            const { __page_id: _id, ...rest } = p;
            return Object.values(rest).find((v) => v && v !== "✗");
          })
          .filter(Boolean)
          .join("、");
      }
    }
  } catch (e) {
    console.error("[cron/check] notion error:", e);
  }

  // 天気取得
  let weatherSummary = "不明";
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const w = await fetch(`${base}/api/weather`).then((r) => r.json());
    weatherSummary = `${w.condition} ${w.temp}°C（最高${w.tempMax}° 最低${w.tempMin}°）`;
  } catch { /* ignore */ }

  // Groqで通知1件生成
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: `あなたはAI秘書Naviです。現在時刻${jstTime}（JST）に送るプッシュ通知を1件だけ作ってください。

【今日の日付】${jstDate}
【現在時刻】${jstTime}
【今日のスケジュール】${scheduleSummary}
【買い物リスト（未購入）】${shoppingSummary}
【天気】${weatherSummary}

ルール:
- 時間帯に合った内容にする（朝・昼・夜など）
- スケジュール・買い物・天気のうち関連するものを自然に絡める
- titleは20文字以内
- bodyは50文字以内
- JSONのみ返す・前置き不要

{"title":"...","body":"...","url":"/"}`,
      },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notification = JSON.parse(raw) as any;

  await sendPush({
    title: notification.title ?? "NotiLink",
    body: notification.body ?? "",
    url: notification.url ?? "/",
  });

  console.log("[cron/check] sent:", JSON.stringify(notification));
  return NextResponse.json({ ok: true, sent: 1, notification });
}
