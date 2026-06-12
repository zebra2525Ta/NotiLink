"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Mode } from "@/lib/groq";

const MODES: { value: Mode; label: string }[] = [
  { value: "normal", label: "通常" },
  { value: "business", label: "ビジネス" },
  { value: "friend", label: "友達" },
];

export default function Chat() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("normal");
  const [ocrLoading, setOcrLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    setReply(null);

    try {
      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, mode }),
      });
      const data = await res.json();
      setReply(data.message);
      setInput("");
    } catch {
      setReply("通信エラーが発生しました。もう一度試してください。");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      setInput(data.text);
    } catch {
      setReply("画像の読み取りに失敗しました。");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="flex flex-col h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-lg">
          ←
        </Link>
        <span className="text-base font-semibold tracking-wide">AI秘書</span>
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                mode === m.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        {loading || ocrLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            {ocrLoading && <p className="text-xs text-gray-500">画像を読み取り中...</p>}
          </div>
        ) : reply ? (
          <div className="max-w-sm w-full bg-gray-800 rounded-2xl px-5 py-4 text-gray-100 leading-relaxed text-sm">
            {reply}
          </div>
        ) : (
          <p className="text-gray-600 text-sm select-none">メモを入力してください</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 flex gap-3 items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || ocrLoading}
          className="p-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 rounded-xl transition-colors shrink-0"
          title="画像から読み取る"
        >
          📷
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="殴り書きOK（Enter で送信）"
          rows={2}
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 leading-relaxed"
        />
        <button
          type="submit"
          disabled={loading || ocrLoading || !input.trim()}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0"
        >
          送信
        </button>
      </form>
    </main>
  );
}
