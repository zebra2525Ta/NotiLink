import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserDbIds, setUserDbIds, type UserDbIds } from "@/lib/redis";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
  }
  const dbIds = await getUserDbIds(session.user.id);
  return NextResponse.json({ dbIds });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "ログインが必要です" }, { status: 401 });
  }

  const body = await req.json() as UserDbIds;
  if (!body.misc || !body.places || !body.shopping || !body.schedule) {
    return NextResponse.json({ message: "全項目を入力してください" }, { status: 400 });
  }

  await setUserDbIds(session.user.id, body);
  return NextResponse.json({ message: "保存しました" });
}
