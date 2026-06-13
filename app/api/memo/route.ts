import { NextRequest, NextResponse } from "next/server";
import { classifyMemo, type Mode } from "@/lib/groq";
import { searchDatabases, saveToNotion } from "@/lib/notion";
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

    const result = await classifyMemo(text, schemas, mode as Mode);
    await saveToNotion(result.items, session.accessToken, schemas);

    return NextResponse.json({ message: result.message, count: result.items.length });
  } catch (error) {
    console.error("[memo]", error);
    const msg = error instanceof Error ? error.message : "保存に失敗しました";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
