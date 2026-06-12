import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `あなたはメモを分析するAIです。ユーザーの入力テキストを解析し、以下のJSON形式のみで返答してください。前置き・説明文・コードブロックは一切含めないこと。

分類ルール:
- "schedule": 日付・時間・予定・約束・イベントに関するもの
- "game": ゲームのタイトル・攻略・メモに関するもの。gameNameにゲーム名を正確に入れること
- "places": 行きたい場所・スポット・観光地に関するもの
- "shopping": 買い物・購入したいもの・欲しいものに関するもの
- "misc": 上記に分類できないもの、または曖昧なもの

出力形式（dbの値に応じてdataの内容が変わる）:

scheduleの場合:
{"db":"schedule","data":{"title":"タイトル","date":"YYYY-MM-DD","time":"HH:MM","memo":"補足"},"message":"秘書の一言（30文字以内）"}

gameの場合:
{"db":"game","gameName":"ゲーム名","data":{"title":"メモタイトル","memo":"詳細"},"message":"秘書の一言（30文字以内）"}

placesの場合:
{"db":"places","data":{"placeName":"場所名","area":"地域・エリア","memo":"メモ"},"message":"秘書の一言（30文字以内）"}

shoppingの場合:
{"db":"shopping","data":{"itemName":"商品名","quantity":"数量（不明なら空文字）"},"message":"秘書の一言（30文字以内）"}

miscの場合:
{"db":"misc","data":{"text":"元のテキストそのまま"},"message":"秘書の一言（30文字以内）"}

注意: timeが不明な場合はtime:""、dateが不明な場合はdate:""とすること。今日の日付を基準に相対日付（明日・来週など）を解決すること。`;

export interface GroqResult {
  db: "schedule" | "game" | "places" | "shopping" | "misc";
  gameName?: string;
  data: Record<string, string>;
  message: string;
}

export async function classifyMemo(text: string): Promise<GroqResult> {
  const today = new Date().toISOString().split("T")[0];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n今日の日付: ${today}`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? "{}";
  return JSON.parse(content) as GroqResult;
}
