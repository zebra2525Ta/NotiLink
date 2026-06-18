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

  const jstHour = jstNow.getUTCHours();

  const themeMap: Record<number, string> = {
    8:  "今日の天気と気温をメインに、一日の準備を促す内容にすること",
    9:  "今日のスケジュールをメインに、直近の予定を伝える内容にすること",
    10: "買い物リストをメインに、買い忘れがないか確認させる内容にすること",
    11: "天気をメインに、昼前の外出や服装に関するアドバイスにすること",
    12: "スケジュールをメインに、午後の予定を確認させる内容にすること",
    13: "買い物リストをメインに、帰り道に買えるものを提案する内容にすること",
    14: "天気をメインに、夕方以降の天候変化に触れる内容にすること",
    15: "スケジュールをメインに、夕方以降の予定を思い出させる内容にすること",
    16: "買い物リストをメインに、今日中に買えるか確認させる内容にすること",
    17: "天気と体調をメインに、帰宅時間帯の気温差に触れる内容にすること",
    18: "スケジュールをメインに、夜の予定や翌日の準備を促す内容にすること",
    19: "買い物リストをメインに、明日以降に向けた買い出し提案にすること",
    20: "天気をメインに、明日の天気予報を交えた内容にすること",
    21: "スケジュールをメインに、明日の予定を確認させ就寝準備を促す内容にすること",
    22: "買い物リストをメインに、明日の買い物リマインドにすること",
    23: "一日を振り返り、ねぎらいと明日への一言にすること",
  };
  const theme = themeMap[jstHour] ?? "スケジュール・買い物・天気をバランスよく絡めた内容にすること";

  const HISTORY_KEY = "push:history";
  const history = await redis.lrange<string>(HISTORY_KEY, 0, 7);
  const historyText = history.length > 0
    ? `【直近の通知（これと同じ内容・表現は絶対に使わないこと）】\n${history.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
    : "";

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
${historyText}

【今回のテーマ】${theme}

ルール:
- 上記テーマに従い、対応する情報（スケジュール／買い物リスト／天気）を必ずメインに使うこと
- 対応する情報が「なし」の場合のみ、他の情報を代わりに使うこと
- タメ口・友達感覚でおせっかいなくらい気にかける口調にすること
- 絵文字は使わないこと
- titleは20文字以内
- bodyは50文字以内
- messageはNaviからの一言（80文字以内・タメ口でおせっかいな励ましや心配の言葉）
- JSONのみ返す・前置き不要

{"title":"...","body":"...","message":"...","url":"/"}`,
    }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notification = JSON.parse(completion.choices[0].message.content ?? "{}") as any;

  const historyEntry = `${notification.title ?? ""}：${notification.body ?? ""}`;
  await redis.lpush(HISTORY_KEY, historyEntry);
  await redis.ltrim(HISTORY_KEY, 0, 7);

  if (notification.message) {
    await redis.set("push:latest_message", {
      message: notification.message,
      time: jstTime,
      date: jstDate,
    });
  }

  await sendPush({ title: notification.title ?? "NotiLink", body: notification.body ?? "", url: "/" });

  return NextResponse.json({ ok: true, notification });
}
