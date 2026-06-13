import Groq from "groq-sdk";
import type { DbSchema } from "./notion";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildSystemPrompt(schemas: DbSchema[]): string {
  const dbDescriptions = schemas
    .map((db) => {
      const props = db.properties.map((p) => `  - ${p.name} (${p.type})`).join("\n");
      return `DB名: ${db.title}\nID: ${db.id}\nプロパティ:\n${props}`;
    })
    .join("\n\n");

  return `あなたはメモを分析するAIです。以下のNotionデータベース一覧を参照し、入力テキストを適切なDBに振り分けてJSON形式のみで返答してください。前置き・説明文・コードブロックは一切含めないこと。

利用可能なデータベース:
${dbDescriptions}

出力形式:
{"items":[{"database_id":"DB_ID","properties":{"プロパティ名":"値"}}],"message":"秘書の一言（30文字以内）"}

ルール:
- 1つの入力から複数アイテムを抽出してよい（例:「グミと東京」→買い物DBと場所DBに分割）
- checkboxタイプのプロパティは"false"を設定
- dateタイプはYYYY-MM-DD形式、timeがある場合はYYYY-MM-DDTHH:MM:00形式
- 値が不明な場合はそのプロパティを省略
- 今日の日付を基準に相対日付（明日・来週など）を解決すること`;
}

const MODE_PROMPTS = {
  normal: "",
  business: "messageフィールドは丁寧でフォーマルなビジネス敬語で書くこと。",
  friend: "messageフィールドはフランクで親しみやすいタメ口で書くこと。絵文字を1つ使ってよい。",
};

export type Mode = "normal" | "business" | "friend";

export interface GroqResult {
  items: { database_id: string; properties: Record<string, string> }[];
  message: string;
}

export async function classifyMemo(text: string, schemas: DbSchema[], mode: Mode = "normal"): Promise<GroqResult> {
  const today = new Date().toISOString().split("T")[0];
  const modePrompt = MODE_PROMPTS[mode];
  const systemPrompt = buildSystemPrompt(schemas);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}${modePrompt ? `\n\n${modePrompt}` : ""}\n\n今日の日付: ${today}`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? "{}";
  return JSON.parse(content) as GroqResult;
}
