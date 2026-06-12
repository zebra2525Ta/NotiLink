import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `あなたはメモを分析するAIです。ユーザーの入力テキストを解析し、含まれるアイテムをすべて登録対象として以下のJSON形式のみで返答してください。前置き・説明文・コードブロックは一切含めないこと。

分類ルール:
- "schedule": 日付・時間・予定・約束・イベントに関するもの
- "places": 行きたい場所・スポット・観光地に関するもの
- "shopping": 買い物・購入したいもの・欲しいものに関するもの
- "misc": 上記に分類できないもの、または曖昧なもの

出力形式（itemsは必ず配列。1件でも配列に入れること）:
{"items":[{"db":"schedule","data":{"title":"タイトル","date":"YYYY-MM-DD","time":"HH:MM","memo":"補足"}},{"db":"places","data":{"placeName":"場所名","area":"地域・エリア","memo":"メモ"}},{"db":"shopping","data":{"itemName":"商品名","quantity":"数量（不明なら空文字）"}},{"db":"misc","data":{"text":"元のテキストそのまま"}}],"message":"秘書の一言（30文字以内）"}

注意:
- 入力に複数のアイテムが含まれる場合、itemsに複数要素を追加すること（例:「グミ、東京」→ shoppingにグミ、placesに東京を別々に登録）
- timeが不明な場合はtime:""、dateが不明な場合はdate:""とすること
- 今日の日付を基準に相対日付（明日・来週など）を解決すること`;

const MODE_PROMPTS = {
  normal: "",
  business: "messageフィールドは丁寧でフォーマルなビジネス敬語で書くこと。",
  friend: "messageフィールドはフランクで親しみやすいタメ口で書くこと。絵文字を1つ使ってよい。",
};

export type Mode = "normal" | "business" | "friend";

export interface GroqItem {
  db: "schedule" | "places" | "shopping" | "misc";
  data: Record<string, string>;
}

export interface GroqResult {
  items: GroqItem[];
  message: string;
}

export async function classifyMemo(text: string, mode: Mode = "normal"): Promise<GroqResult> {
  const today = new Date().toISOString().split("T")[0];
  const modePrompt = MODE_PROMPTS[mode];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}${modePrompt ? `\n\n${modePrompt}` : ""}\n\n今日の日付: ${today}`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? "{}";
  return JSON.parse(content) as GroqResult;
}
