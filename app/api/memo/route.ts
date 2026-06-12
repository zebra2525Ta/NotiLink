import { NextRequest, NextResponse } from "next/server";
import { classifyMemo, type Mode } from "@/lib/groq";
import { saveToNotion } from "@/lib/notion";

export async function POST(req: NextRequest) {
  try {
    const { text, mode } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { message: "テキストが空です" },
        { status: 400 }
      );
    }

    const result = await classifyMemo(text, mode as Mode);
    await saveToNotion(result);

    return NextResponse.json({ message: result.message, db: result.db });
  } catch (error) {
    console.error("[memo]", error);
    const msg =
      error instanceof Error ? error.message : "保存に失敗しました";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
