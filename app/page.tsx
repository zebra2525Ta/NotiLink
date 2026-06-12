"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        body: JSON.stringify({ text: input }),
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

  return (
    <main className="flex flex-col h-screen bg-gray-950 text-white">
      <header className="flex items-center px-5 py-4 border-b border-gray-800">
        <span className="text-base font-semibold tracking-wide">AI秘書</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        {loading ? (
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        ) : reply ? (
          <div className="max-w-sm w-full bg-gray-800 rounded-2xl px-5 py-4 text-gray-100 leading-relaxed text-sm">
            {reply}
          </div>
        ) : (
          <p className="text-gray-600 text-sm select-none">
            メモを入力してください
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-gray-800 flex gap-3 items-end"
      >
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
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0"
        >
          送信
        </button>
      </form>
    </main>
  );
}
