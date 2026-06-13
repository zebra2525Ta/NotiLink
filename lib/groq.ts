import Groq from "groq-sdk";
import type { DbSchema } from "./notion";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type Mode = "normal" | "business" | "friend";

const MODE_PROMPTS: Record<Mode, string> = {
  normal: "",
  business: "返答は丁寧でフォーマルなビジネス敬語にすること。",
  friend: "返答はフランクで親しみやすいタメ口にすること。絵文字を1つ使ってよい。",
};

export interface IntentResult {
  intent: "register" | "query";
  database_id: string;
  message: string | null;
}

// ── Phase 1: どのDBか・登録か検索かを判断 ──────────────────────────────
export async function detectIntent(
  text: string,
  schemas: DbSchema[],
  mode: Mode = "normal"
): Promise<IntentResult> {
  const dbList = schemas
    .map((s) => `  {"database_id":"${s.id}","db_title":"${s.title}"}`)
    .join(",\n");

  const modeHint = MODE_PROMPTS[mode];

  const systemPrompt = `あなたはNotionを管理するAI秘書です。ユーザーの入力が「登録」か「検索・質問」かを判断し、JSON形式のみで返答してください。前置き・説明文・コードブロックは一切含めないこと。

利用可能なデータベース:
[
${dbList}
]

【登録の場合】
{"intent":"register","database_id":"最も適切なdatabase_idをそのままコピー","message":"秘書の一言（30文字以内）"}

【検索・質問の場合】
{"intent":"query","database_id":"最も関連するdatabase_idをそのままコピー","message":null}

ルール:
- database_idは上記リストの値を1文字も変えずコピー
- messageは日本語
${modeHint ? `- ${modeHint}` : ""}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? "{}";
  return JSON.parse(content) as IntentResult;
}

function buildDateContext(): string {
  const DAY = ["日", "月", "火", "水", "木", "金", "土"];
  // JST = UTC+9
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const toJSTDateStr = (d: Date) => d.toISOString().split("T")[0];

  const todayDow = jstNow.getUTCDay();
  const lines: string[] = [`今日: ${toJSTDateStr(jstNow)}（${DAY[todayDow]}曜日）`];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(jstNow.getTime() + i * 24 * 60 * 60 * 1000);
    const label = i === 1 ? "明日" : `${i}日後`;
    lines.push(`${label}: ${toJSTDateStr(d)}（${DAY[d.getUTCDay()]}曜日）`);
  }
  return lines.join("\n");
}

// ── Phase 2: 既存データを真似してプロパティを生成（複数日対応） ──────────
export async function generateProperties(
  text: string,
  schema: DbSchema,
  examples: Record<string, string>[],
  mode: Mode = "normal"
): Promise<Record<string, string>[]> {
  const propDefs = schema.properties
    .map((p) => `- ${p.name} (${p.type}型)`)
    .join("\n");

  const examplesText =
    examples.length === 0
      ? "（既存データなし）"
      : examples
          .slice(0, 3)
          .map((row, i) => `例${i + 1}: ${JSON.stringify(row, null, 0)}`)
          .join("\n");

  const modeHint = MODE_PROMPTS[mode];

  const systemPrompt = `あなたはNotionデータベースへのデータ登録を行うAI秘書です。ユーザーの入力をNotionのプロパティに変換し、JSONのみを返してください。前置き・説明文・コードブロックは一切含めないこと。

データベース名: ${schema.title}

プロパティ定義:
${propDefs}

既存データの例（キー名・値の形式をそのまま真似すること）:
${examplesText}

【日付カレンダー】（必ずこの表を参照して正確な日付を使うこと）
${buildDateContext()}

ルール:
- キー名は上記プロパティ定義の名前を1文字も変えずコピー（英語・ローマ字変換・翻訳禁止）
- title型: イベント名・物品名など「内容のみ」。日付・時刻は絶対含めない（例: "6/19バイト"→"バイト"）
- date型: 必ず "開始~終了" のチルダ区切りで返す。時刻はJST（日本時間）で24時間表記、必ず+09:00を付ける
  ・日付のみ → "YYYY-MM-DDT00:00:00+09:00~YYYY-MM-DDT23:58:00+09:00"
  ・日付+開始時間 → "YYYY-MM-DDTHH:MM:00+09:00~YYYY-MM-DDT23:58:00+09:00"
  ・日付+開始〜終了時間 → "YYYY-MM-DDTHH:MM:00+09:00~YYYY-MM-DDTHH:MM:00+09:00"
- rich_text型: 補足・メモ
- checkbox型: "true" または "false"
- title型は必ず含める
${modeHint ? `- ${modeHint}` : ""}

【複数日・複数件の場合】
複数の日付・曜日が指定された場合は、itemsに複数のオブジェクトを入れること。
{"items":[{"プロパティ名":"値",...},{"プロパティ名":"値",...}]}

【1件の場合】
{"items":[{"プロパティ名":"値",...}]}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content ?? '{"items":[]}';
  console.log("[groq] generateProperties raw:", content);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = JSON.parse(content) as any;

  // {"items":[...]} 形式
  if (Array.isArray(parsed.items)) return parsed.items as Record<string, string>[];
  // フォールバック: オブジェクト直返しや配列直返し
  if (Array.isArray(parsed)) return parsed as Record<string, string>[];
  return [parsed] as Record<string, string>[];
}

// ── クエリ結果を自然言語で返す ────────────────────────────────────────
export async function generateQueryResponse(
  question: string,
  dbTitle: string,
  pages: Record<string, string>[],
  mode: Mode = "normal"
): Promise<string> {
  const modeHint = MODE_PROMPTS[mode];
  const pagesText =
    pages.length === 0
      ? "（データなし）"
      : pages.map((p, i) => `${i + 1}. ${Object.values(p).filter(Boolean).join(" / ")}`).join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `あなたはAI秘書です。Notionデータベース「${dbTitle}」の内容をもとに、ユーザーの質問に日本語で簡潔に答えてください。${modeHint}`,
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
