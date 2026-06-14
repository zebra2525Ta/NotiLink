import { NextRequest, NextResponse } from "next/server";
import { detectIntent, generateProperties, generateQueryResponse, type Mode } from "@/lib/groq";
import { searchDatabases, queryDatabase } from "@/lib/notion";
import { auth } from "@/auth";

// Groqが返す英語キー → Notionプロパティ型
const GROQ_KEY_TO_TYPE: Record<string, string> = {
  title: "title", name: "title", item: "title", text: "title",
  タイトル: "title", 商品名: "title", テキスト: "title", 名前: "title",
  date: "date", time: "date", 日付: "date", 日時: "date",
  memo: "rich_text", content: "rich_text", description: "rich_text",
  quantity: "rich_text", amount: "rich_text",
  メモ: "rich_text", 数量: "rich_text", 詳細: "rich_text",
  done: "checkbox", completed: "checkbox", purchased: "checkbox",
  購入済み: "checkbox",
};

function buildNotionValue(value: string, type: string): Record<string, unknown> | null {
  if (!value) return null;
  switch (type) {
    case "title":    return { title: [{ text: { content: value } }] };
    case "rich_text": return { rich_text: [{ text: { content: value } }] };
    case "checkbox": return { checkbox: value === "true" };
    case "date": {
      const [start, end] = value.split("~");
      return end ? { date: { start: start.trim(), end: end.trim() } } : { date: { start: value.trim() } };
    }
    case "select":   return { select: { name: value } };
    case "number":   return { number: Number(value) };
    default:         return { rich_text: [{ text: { content: value } }] };
  }
}

function formatDateForDisplay(isoStr: string): string {
  const date = isoStr.split("T")[0];
  const time = isoStr.includes("T") ? isoStr.split("T")[1].slice(0, 5) : null;
  return time ? `${date} ${time}` : date;
}

async function extractWithGemini(
  imageList: { base64: string; mimeType: string }[],
  instruction: string
): Promise<string> {
  const prompt = `${instruction}\n\n抽出結果は以下の形式で1件1行で返してください。「休」の日は除外してください。\n形式：[タイトル] [YYYY-MM-DD] [開始時間]-[終了時間]\n\nタイトルの決め方：\n- 具体的な活動名があればそれを使う（例：映画、海、歯医者、友達とランチ）\n- シフト表・勤務スケジュールなら「バイト」または「仕事」\n- 特定の活動名がなければ大きなくくりで（遊び、仕事、バイト など）\n\n例：\n映画 2026-07-01 13:00-16:00\nバイト 2026-07-02 17:00-22:00\n海 2026-07-04 10:00-18:00`;

  const parts = [
    { text: prompt },
    ...imageList.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } })),
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function createNotionPage(
  accessToken: string,
  databaseId: string,
  properties: Record<string, unknown>
): Promise<void> {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error("[memo] notion create failed:", JSON.stringify(err));
    throw new Error(JSON.stringify(err));
  }
}

export interface PendingPage {
  database_id: string;
  properties: Record<string, unknown>;
  previewLabel: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.accessToken) {
      return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { mode } = body;

    // ── 確認後の実際登録 ──────────────────────────────────────────
    if (body.confirm && Array.isArray(body.pendingPages)) {
      const pages = body.pendingPages as PendingPage[];
      for (const { database_id, properties } of pages) {
        await createNotionPage(session.accessToken, database_id, properties);
      }
      return NextResponse.json({ message: `${pages.length}件をNotionに登録しました！` });
    }

    // ── 通常処理 ─────────────────────────────────────────────────
    const { text, images, imageBase64, mimeType } = body;
    if (!text?.trim()) {
      return NextResponse.json({ message: "テキストが空です" }, { status: 400 });
    }

    // 画像添付あり → Gemini で指示付き抽出（複数画像対応）
    let processedText = text as string;
    const imageList: { base64: string; mimeType: string }[] =
      Array.isArray(images) ? images :
      (imageBase64 && mimeType) ? [{ base64: imageBase64, mimeType }] : [];

    if (imageList.length > 0) {
      console.log("[memo] images attached:", imageList.length, "calling Gemini:", text);
      const extracted = await extractWithGemini(imageList, text as string);
      console.log("[memo] Gemini extracted:", extracted);
      processedText = extracted || text;
    }

    const schemas = await searchDatabases(session.accessToken);
    if (schemas.length === 0) {
      return NextResponse.json({ message: "Notionにデータベースが見つかりません" }, { status: 400 });
    }

    // Phase 1: intent 判定
    // 画像あり時はGemini抽出内容の冒頭もヒントとして渡し、DBを正しく選べるようにする
    const intentText = (imageBase64 && processedText !== text)
      ? `${text}\n\n（内容の概要：${processedText.slice(0, 400)}）`
      : text as string;
    const intent = await detectIntent(intentText, schemas, mode as Mode);
    console.log("[memo] intent:", JSON.stringify(intent));

    if (intent.intent === "query") {
      const schema = schemas.find((s) => s.id === intent.database_id);
      const pages = await queryDatabase(session.accessToken, intent.database_id);
      const message = await generateQueryResponse(text as string, schema?.title ?? "DB", pages, mode as Mode);
      return NextResponse.json({ message });
    }

    if (intent.intent === "update_purchased") {
      const pages = await queryDatabase(session.accessToken, intent.database_id);
      const searchTitle = (intent.search_title ?? "").trim().toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matched = (pages as any[]).find((p: any) =>
        Object.values(p).some((v) =>
          typeof v === "string" && v.trim().toLowerCase().includes(searchTitle)
        )
      );
      if (!matched || !matched.__page_id) {
        return NextResponse.json({ message: `「${intent.search_title}」が見つかりませんでした` });
      }
      const res = await fetch(`https://api.notion.com/v1/pages/${matched.__page_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties: { 購入済み: { checkbox: true } } }),
      });
      if (!res.ok) throw new Error(JSON.stringify(await res.json()));
      return NextResponse.json({ message: intent.message ?? `「${intent.search_title}」を購入済みにしました！` });
    }

    // Phase 2 (register): プロパティ生成
    const schema = schemas.find((s) => s.id === intent.database_id);
    if (!schema) {
      return NextResponse.json({ message: "対象データベースが見つかりません" }, { status: 400 });
    }

    const examples = await queryDatabase(session.accessToken, intent.database_id);
    const groqItemList = await generateProperties(processedText, schema, examples, mode as Mode);
    console.log("[memo] groq items:", JSON.stringify(groqItemList));

    const titleProp = schema.properties.find((p) => p.type === "title");
    const dateProp = schema.properties.find((p) => p.type === "date");
    const typeToProps = new Map<string, typeof schema.properties>();
    for (const p of schema.properties) {
      typeToProps.set(p.type, [...(typeToProps.get(p.type) ?? []), p]);
    }

    const pendingPages: PendingPage[] = [];

    for (const groqProps of groqItemList) {
      const notionProperties: Record<string, unknown> = {};
      const assigned = new Set<string>();

      for (const [groqKey, groqValue] of Object.entries(groqProps)) {
        if (!groqValue || typeof groqValue !== "string") continue;
        const keyLower = groqKey.trim().toLowerCase();

        // ① 名前完全一致
        const exact = schema.properties.find((p) => p.name.trim().toLowerCase() === keyLower);
        if (exact && !assigned.has(exact.name)) {
          const v = buildNotionValue(groqValue, exact.type);
          if (v) { notionProperties[exact.name] = v; assigned.add(exact.name); }
          continue;
        }

        // ② 型ベースマッチ
        const targetType = GROQ_KEY_TO_TYPE[keyLower];
        if (targetType) {
          const candidate = (typeToProps.get(targetType) ?? []).find((p) => !assigned.has(p.name));
          if (candidate) {
            const v = buildNotionValue(groqValue, candidate.type);
            if (v) { notionProperties[candidate.name] = v; assigned.add(candidate.name); }
            continue;
          }
        }
      }

      // titleが未設定なら埋める
      if (titleProp && !assigned.has(titleProp.name)) {
        const fallback = Object.values(groqProps).find((v) => typeof v === "string" && v.trim()) ?? text;
        notionProperties[titleProp.name] = { title: [{ text: { content: fallback } }] };
      }
      if (Object.keys(notionProperties).length === 0) {
        const key = titleProp?.name ?? "タイトル";
        notionProperties[key] = { title: [{ text: { content: text } }] };
      }

      // プレビュー用ラベル生成
      const titleVal = titleProp
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((notionProperties[titleProp.name] as any)?.title?.[0]?.text?.content ?? "")
        : "";
      const dateStart = dateProp
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((notionProperties[dateProp.name] as any)?.date?.start ?? "")
        : "";
      const dateEnd = dateProp
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((notionProperties[dateProp.name] as any)?.date?.end ?? "")
        : "";
      const dateDisplay = dateStart
        ? dateEnd
          ? `${formatDateForDisplay(dateStart)} 〜 ${formatDateForDisplay(dateEnd)}`
          : formatDateForDisplay(dateStart)
        : "";
      const previewLabel = [titleVal, dateDisplay].filter(Boolean).join("  |  ");

      pendingPages.push({
        database_id: intent.database_id,
        properties: notionProperties,
        previewLabel,
      });
    }

    // 確認画面用にプレビューを返す
    return NextResponse.json({
      preview: true,
      pendingPages,
      dbTitle: schema.title,
    });

  } catch (error) {
    console.error("[memo]", error);
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
