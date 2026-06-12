import { NextRequest, NextResponse } from "next/server";
import { classifyMemo, type Mode } from "@/lib/groq";
import { saveToNotion } from "@/lib/notion";
import { getUserDbIds } from "@/lib/redis";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.accessToken) {
      return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
    }

    const dbIds = await getUserDbIds(session.user.id);
    if (!dbIds) {
      return NextResponse.json({ message: "セットアップが必要です", needsSetup: true }, { status: 400 });
    }

    const { text, mode } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ message: "テキストが空です" }, { status: 400 });
    }

    const result = await classifyMemo(text, mode as Mode);
    await saveToNotion(result, session.accessToken, dbIds);

    return NextResponse.json({ message: result.message, count: result.items.length });
  } catch (error) {
    console.error("[memo]", error);
    const msg = error instanceof Error ? error.message : "保存に失敗しました";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
