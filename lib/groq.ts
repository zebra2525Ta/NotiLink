import Groq from "groq-sdk";
import type { DbSchema } from "./notion";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildDbList(schemas: DbSchema[]): string {
  return schemas
    .map((db) => {
      const props = db.properties
        .map((p) => `    {"name":"${p.name}","type":"${p.type}"}`)
        .join(",\n");
      return `{"database_id":"${db.id}","db_title":"${db.title}","properties":[\n${props}\n  ]}`;
    })
    .join(",\n");
}

function buildIntentPrompt(schemas: DbSchema[]): string {
  return `あなたはNotionを管理するAI秘書です。ユーザーの入力が「登録」か「検索・質問」かを判断し、JSON形式のみで返答してください。前置き・説明文・コードブロックは一切含めないこと。

利用可能なデータベース:
[
${buildDbList(schemas)}
]

【登録の場合】入力例：「グミ買う」「明日14時会議」「東京行きたい」
{"intent":"register","items":[{"database_id":"上記のdatabase_idをそのままコピー","properties":{"上記のname値をそのままコピー":"値"}}],"message":"秘書の一言（30文字以内）"}

【検索・質問の場合】入力例：「買い物リスト教えて」「今週の予定は？」「行きたい場所一覧」
{"intent":"query","database_id":"最も関連するDBのdatabase_idをそのままコピー","message":null}

【厳守ルール】
- database_id: 上記リストの"database_id"フィールドの値を1文字も変えずコピー
- propertiesのキー名: 上記リストの"name"フィールドの値を1文字も変えずコピー（英語・ローマ字への変換・翻訳は絶対禁止）
- checkboxタイプは"false"を設定
- dateタイプはYYYY-MM-DD形式、日時ならYYYY-MM-DDTHH:MM:00形式
- titleタイプのプロパティは必ず含めること
- 今日の日付: ${new Date().toISOString().split("T")[0]}`;
}

const MODE_PROMPTS = {
  normal: "",
  business: "messageフィールドは丁寧でフォーマルなビジネス敬語で書くこと。",
  friend: "messageフィールドはフランクで親しみやすいタメ口で書くこと。絵文字を1つ使ってよい。",
};

export type Mode = "normal" | "business" | "friend";

export interface RegisterResult {
  intent: "register";
  items: { database_id: string; properties: Record<string, string> }[];
  message: string;
}

export interface QueryResult {
  intent: "query";
  database_id: string;
  message: null;
}

export type GroqIntentResult = RegisterResult | QueryResult;

export async function detectIntent(text: string, schemas: DbSchema[], mode: Mode = "normal"): Promise<GroqIntentResult> {
  const modePrompt = MODE_PROMPTS[mode];
  const systemPrompt = buildIntentPrompt(schemas);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: modePrompt ? `${systemPrompt}\n\n${modePrompt}` : systemPrompt,
      },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? "{}";
  return JSON.parse(content) as GroqIntentResult;
}

export async function generateQueryResponse(
  question: string,
  dbTitle: string,
  pages: Record<string, string>[],
  mode: Mode = "normal"
): Promise<string> {
  const modePrompt = MODE_PROMPTS[mode];
  const pagesText = pages.length === 0
    ? "（データなし）"
    : pages.map((p, i) => `${i + 1}. ${Object.values(p).filter(Boolean).join(" / ")}`).join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `あなたはAI秘書です。Notionデータベース「${dbTitle}」の内容をもとに、ユーザーの質問に日本語で簡潔に答えてください。${modePrompt}`,
      },
      {
        role: "user",
        content: `質問: ${question}\n\nデータベースの内容:\n${pagesText}`,
      },
    ],
    temperature: 0.3,
  });

  return completion.choices[0].message.content ?? "データを取得できませんでした。";
}
