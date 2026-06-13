import { NextRequest, NextResponse } from "next/server";
import { detectIntent, generateProperties, generateQueryResponse, type Mode } from "@/lib/groq";
import { searchDatabases, queryDatabase, saveToNotion } from "@/lib/notion";
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.accessToken) {
      return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
    }

    const { text, mode } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ message: "テキストが空です" }, { status: 400 });
    }

    const schemas = await searchDatabases(session.accessToken);
    if (schemas.length === 0) {
      return NextResponse.json({ message: "Notionにデータベースが見つかりません" }, { status: 400 });
    }

    // Phase 1: 登録 or 検索か、どのDBかを判断
    const intent = await detectIntent(text, schemas, mode as Mode);
    console.log("[memo] intent:", JSON.stringify(intent));

    if (intent.intent === "query") {
      const schema = schemas.find((s) => s.id === intent.database_id);
      const pages = await queryDatabase(session.accessToken, intent.database_id);
      const message = await generateQueryResponse(text, schema?.title ?? "DB", pages, mode as Mode);
      return NextResponse.json({ message });
    }

    if (intent.intent === "update_purchased") {
      // 買い物リストの既存アイテムを検索して購入済みをチェック
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err));
      }
      return NextResponse.json({ message: intent.message ?? `「${intent.search_title}」を購入済みにしました！` });
    }

    // Phase 2 (register): 対象DBの既存データを取得してプロパティを生成
    const schema = schemas.find((s) => s.id === intent.database_id);
    if (!schema) {
      return NextResponse.json({ message: "対象データベースが見つかりません" }, { status: 400 });
    }

    const examples = await queryDatabase(session.accessToken, intent.database_id);
    console.log("[memo] examples fetched:", examples.length);

    const groqItemList = await generateProperties(text, schema, examples, mode as Mode);
    console.log("[memo] groq items:", JSON.stringify(groqItemList));

    const titleProp = schema.properties.find((p) => p.type === "title");
    const typeToProps = new Map<string, typeof schema.properties>();
    for (const p of schema.properties) {
      typeToProps.set(p.type, [...(typeToProps.get(p.type) ?? []), p]);
    }

    let createdCount = 0;
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

      // titleが未設定なら確実に埋める
      if (titleProp && !assigned.has(titleProp.name)) {
        const fallback = Object.values(groqProps).find((v) => typeof v === "string" && v.trim()) ?? text;
        notionProperties[titleProp.name] = { title: [{ text: { content: fallback } }] };
      }
      if (Object.keys(notionProperties).length === 0) {
        const key = titleProp?.name ?? "タイトル";
        notionProperties[key] = { title: [{ text: { content: text } }] };
      }

      console.log("[memo] creating page:", JSON.stringify(notionProperties));

      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: intent.database_id },
          properties: notionProperties,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("[memo] notion create failed:", JSON.stringify(err));
        throw new Error(JSON.stringify(err));
      }
      createdCount++;
    }

    return NextResponse.json({ message: intent.message, count: createdCount });

  } catch (error) {
    console.error("[memo]", error);
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
