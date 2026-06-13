import { NextRequest, NextResponse } from "next/server";
import { detectIntent, generateProperties, generateQueryResponse, type Mode } from "@/lib/groq";
import { searchDatabases, queryDatabase, saveToNotion } from "@/lib/notion";
import { auth } from "@/auth";

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

    // Phase 2 (register): 対象DBの既存データを取得してプロパティを生成
    const schema = schemas.find((s) => s.id === intent.database_id);
    if (!schema) {
      return NextResponse.json({ message: "対象データベースが見つかりません" }, { status: 400 });
    }

    const examples = await queryDatabase(session.accessToken, intent.database_id);
    console.log("[memo] examples fetched:", examples.length);

    const properties = await generateProperties(text, schema, examples, mode as Mode);
    console.log("[memo] generated properties:", JSON.stringify(properties));

    // 最後の砦: Groqが {} を返してもタイトルプロパティにユーザー入力を入れる
    if (Object.keys(properties).length === 0) {
      const titleProp = schema.properties.find((p) => p.type === "title");
      if (titleProp) properties[titleProp.name] = text;
    }

    await saveToNotion([{ database_id: intent.database_id, properties }], session.accessToken, schemas);

    return NextResponse.json({ message: intent.message, count: 1 });

  } catch (error) {
    console.error("[memo]", error);
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
