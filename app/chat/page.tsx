"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Mode } from "@/lib/groq";
import type { PendingPage } from "@/app/api/memo/route";
import { enqueue, getPending, removeById } from "@/lib/offlineQueue";

const MODES: { value: Mode; label: string }[] = [
  { value: "normal", label: "通常" },
  { value: "business", label: "ビジネス" },
  { value: "friend", label: "友達" },
];

interface ImageData {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

interface ConfirmState {
  pendingPages: PendingPage[];
  dbTitle: string;
}

export default function Chat() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("normal");
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drainQueue = useCallback(async () => {
    const items = await getPending();
    if (items.length === 0) return;
    for (const item of items) {
      try {
        await fetch("/api/memo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.text, mode: item.mode }),
        });
        await removeById(item.id!);
      } catch { break; }
    }
    const remaining = await getPending();
    setPendingCount(remaining.length);
    if (remaining.length === 0) setReply("オフライン中のメモを送信しました！");
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => { setIsOnline(true); drainQueue(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    getPending().then((items) => setPendingCount(items.length));
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [drainQueue]);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    return () => { if (imageData?.previewUrl) URL.revokeObjectURL(imageData.previewUrl); };
  }, [imageData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setReply(null);

    if (!navigator.onLine) {
      await enqueue({ text: input, mode, timestamp: Date.now() });
      const items = await getPending();
      setPendingCount(items.length);
      setReply("オフラインのため一時保存しました。オンライン復帰後に自動送信されます。");
      setInput("");
      setImageData(null);
      setLoading(false);
      textareaRef.current?.focus();
      return;
    }

    try {
      const body: Record<string, string> = { text: input, mode };
      if (imageData) { body.imageBase64 = imageData.base64; body.mimeType = imageData.mimeType; }

      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.preview && data.pendingPages) {
        // 確認ステップへ
        setConfirmState({ pendingPages: data.pendingPages, dbTitle: data.dbTitle });
        setInput("");
        setImageData(null);
      } else {
        setReply(data.message);
        setInput("");
        setImageData(null);
      }
    } catch {
      setReply("通信エラーが発生しました。もう一度試してください。");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function handleConfirm() {
    if (!confirmState) return;
    setLoading(true);
    try {
      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, pendingPages: confirmState.pendingPages, mode }),
      });
      const data = await res.json();
      setReply(data.message);
    } catch {
      setReply("登録に失敗しました。もう一度試してください。");
    } finally {
      setConfirmState(null);
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleCancel() {
    setConfirmState(null);
    setReply("キャンセルしました。");
    textareaRef.current?.focus();
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
    const previewUrl = URL.createObjectURL(file);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setImageData({ base64, mimeType: file.type, previewUrl });
    if (fileInputRef.current) fileInputRef.current.value = "";
    textareaRef.current?.focus();
  }

  function removeImage() {
    if (imageData?.previewUrl) URL.revokeObjectURL(imageData.previewUrl);
    setImageData(null);
  }

  // ── 確認UI ─────────────────────────────────────────────────────
  const mainContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          {imageData && <p className="text-xs text-gray-500">画像を解析中...</p>}
        </div>
      );
    }

    if (confirmState) {
      return (
        <div className="max-w-sm w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 px-1">
              「{confirmState.dbTitle}」に{confirmState.pendingPages.length}件登録します
            </p>
            <div className="max-h-64 overflow-y-auto flex flex-col gap-2 pr-1">
              {confirmState.pendingPages.map((p, i) => {
                const [title, date] = p.previewLabel.split("  |  ");
                return (
                  <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="w-1 shrink-0 self-stretch bg-indigo-500 rounded-full" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{title}</p>
                      {date && <p className="text-xs text-gray-400 mt-0.5">{date}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors"
            >
              登録する
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      );
    }

    if (reply) {
      return (
        <div className="max-w-sm w-full bg-gray-800 rounded-2xl px-5 py-4 text-gray-100 leading-relaxed text-sm">
          {reply}
        </div>
      );
    }

    return <p className="text-gray-600 text-sm select-none">メモを入力してください</p>;
  };

  return (
    <main className="flex flex-col h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-lg">←</Link>
        <div className="flex flex-col items-center">
          <span className="text-base font-semibold tracking-wide">AI秘書</span>
          {!isOnline && (
            <span className="text-xs text-amber-400">
              オフライン{pendingCount > 0 ? `（${pendingCount}件待機中）` : ""}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button key={m.value} onClick={() => setMode(m.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                mode === m.value ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        {mainContent()}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 flex flex-col gap-2">
        {imageData && (
          <div className="flex items-center gap-3 px-1">
            <div className="relative w-14 h-14 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageData.previewUrl} alt="添付画像"
                className="w-14 h-14 object-cover rounded-xl border border-gray-700" />
              <button type="button" onClick={removeImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 hover:bg-gray-500 rounded-full text-xs flex items-center justify-center transition-colors">
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              画像を添付中。<br />指示を入力して送信してください。<br />例：「井上のシフトだけ登録して」
            </p>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handleImageChange} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            disabled={loading || !!confirmState}
            className={`p-3 rounded-xl transition-colors shrink-0 ${
              imageData ? "bg-indigo-900 text-indigo-300" : "bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
            }`}>
            📷
          </button>
          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={imageData ? "指示を入力（例：田中のシフトだけ登録して）" : "殴り書きOK（Enter で送信）"}
            rows={2}
            disabled={!!confirmState}
            className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600 leading-relaxed disabled:opacity-50" />
          <button type="submit" disabled={loading || !input.trim() || !!confirmState}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors shrink-0">
            {isOnline ? "送信" : "保存"}
          </button>
        </div>
      </form>
    </main>
  );
}
