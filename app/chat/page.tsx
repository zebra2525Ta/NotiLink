"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Camera } from "lucide-react";
import NotiLinkLogo from "@/app/components/NotiLinkLogo";
import type { Mode } from "@/lib/groq";
import type { PendingPage } from "@/app/api/memo/route";
import { enqueue, getPending, removeById } from "@/lib/offlineQueue";

const S = {
  bg: "#0d0f14", surf: "#141720", surf2: "#1a1e2a",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.12)",
  text: "#e8eaf0", muted: "#9ca3af",
  accent: "#6366f1", accent2: "#818cf8",
};

const MODES: { value: Mode; label: string }[] = [
  { value: "normal", label: "通常" },
  { value: "business", label: "ビジネス" },
  { value: "friend", label: "友達" },
];

interface ImageAttachment {
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
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  useEffect(() => {
    const preset = sessionStorage.getItem("chatPreset");
    if (preset) { setInput(preset); sessionStorage.removeItem("chatPreset"); }
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.previewUrl)); };
  }, [images]);

  function clearImages() {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  }

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
      clearImages();
      setLoading(false);
      textareaRef.current?.focus();
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = { text: input, mode };
      if (images.length > 0) {
        body.images = images.map(({ base64, mimeType }) => ({ base64, mimeType }));
      }
      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.preview && data.pendingPages) {
        setConfirmState({ pendingPages: data.pendingPages, dbTitle: data.dbTitle });
        setInput("");
        clearImages();
      } else {
        setReply(data.message);
        setInput("");
        clearImages();
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
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newImages = await Promise.all(
      files.map(async (file) => {
        const previewUrl = URL.createObjectURL(file);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        return { base64, mimeType: file.type, previewUrl };
      })
    );
    setImages((prev) => [...prev, ...newImages].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
    textareaRef.current?.focus();
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const centerContent = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 7, height: 7, borderRadius: "50%", background: S.accent2,
                display: "inline-block",
                animation: "bounce 1s infinite",
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>
          {images.length > 0 && (
            <p style={{ fontSize: 12, color: S.muted }}>画像を解析中...</p>
          )}
        </div>
      );
    }

    if (confirmState) {
      return (
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, color: S.muted, marginBottom: 4 }}>
            「{confirmState.dbTitle}」に {confirmState.pendingPages.length}件 登録します
          </p>
          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {confirmState.pendingPages.map((p, i) => {
              const [title, date] = p.previewLabel.split("  |  ");
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: S.surf2, borderRadius: 12, padding: "12px 14px", border: `0.5px solid ${S.border2}` }}>
                  <div style={{ width: 2, alignSelf: "stretch", background: S.accent, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: S.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
                    {date && <p style={{ fontSize: 12, color: S.muted, margin: "3px 0 0" }}>{date}</p>}
                    {p.bodyContent && <p style={{ fontSize: 11, color: S.muted, margin: "4px 0 0", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bodyContent.slice(0, 40)}...</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={handleConfirm} style={{
              flex: 1, padding: "12px", borderRadius: 12, border: "none",
              background: S.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              登録する
            </button>
            <button onClick={handleCancel} style={{
              flex: 1, padding: "12px", borderRadius: 12, border: `0.5px solid ${S.border2}`,
              background: "transparent", color: S.muted, fontSize: 14, cursor: "pointer",
            }}>
              キャンセル
            </button>
          </div>
        </div>
      );
    }

    if (reply) {
      return (
        <div style={{
          width: "100%", maxWidth: 400,
          background: S.surf, borderRadius: 16, padding: "16px 18px",
          border: `0.5px solid ${S.border2}`, fontSize: 14, color: S.text, lineHeight: 1.7,
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}>
          <p style={{ fontSize: 10, color: S.accent2, letterSpacing: "0.08em", marginBottom: 8, fontWeight: 500 }}>NAVI</p>
          {reply}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `rgba(99,102,241,0.1)`, border: `0.5px solid rgba(99,102,241,0.25)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20, color: S.accent2 }}>✦</span>
        </div>
        <p style={{ fontSize: 13, color: S.muted }}>Naviに話しかけてください</p>
      </div>
    );
  };

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100svh", background: S.bg, color: S.text, fontFamily: "var(--font-mplus), system-ui, sans-serif" }}>

      {/* ── ヘッダー ── */}
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `0.5px solid ${S.border}`, background: S.surf }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: S.muted, cursor: "pointer", padding: "4px 6px", display: "flex", alignItems: "center" }}>
          <ChevronLeft size={22} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <NotiLinkLogo size={16} bg={S.surf} />
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.05em" }}>Navi</span>
          {!isOnline && (
            <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(245,158,11,0.12)", color: "#fbbf24", borderRadius: 20, border: "0.5px solid rgba(245,158,11,0.3)" }}>
              オフライン{pendingCount > 0 ? ` ${pendingCount}件待機` : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {MODES.map((m) => (
            <button key={m.value} onClick={() => setMode(m.value)} style={{
              padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none",
              background: mode === m.value ? S.accent : S.surf2,
              color: mode === m.value ? "#fff" : S.muted,
              transition: "background 0.15s",
            }}>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── 中央エリア ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
        {centerContent()}
      </div>

      {/* ── 入力フォーム ── */}
      <form onSubmit={handleSubmit} style={{ flexShrink: 0, padding: "12px 14px", borderTop: `0.5px solid ${S.border}`, background: S.surf, display: "flex", flexDirection: "column", gap: 10 }}>

        {images.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt={`添付${i + 1}`} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 10, border: `0.5px solid ${S.border2}` }} />
                <button type="button" onClick={() => removeImage(i)} style={{
                  position: "absolute", top: -6, right: -6, width: 18, height: 18,
                  background: S.surf2, border: `0.5px solid ${S.border2}`, borderRadius: "50%",
                  fontSize: 10, color: S.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</button>
              </div>
            ))}
            <p style={{ fontSize: 11, color: S.muted }}>指示を入力して送信<br /><span style={{ color: S.border2 }}>最大5枚</span></p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageChange} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            disabled={loading || !!confirmState || images.length >= 5}
            style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: 10, border: `0.5px solid ${S.border2}`,
              background: images.length > 0 ? "rgba(99,102,241,0.15)" : S.surf2,
              color: images.length > 0 ? S.accent2 : S.muted,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Camera size={18} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={images.length > 0 ? "指示を入力（例：田中のシフトだけ登録して）" : "殴り書きOK（Enter で送信）"}
            rows={2}
            disabled={!!confirmState}
            style={{
              flex: 1, background: S.surf2, borderRadius: 12, padding: "10px 14px",
              fontSize: 14, color: S.text, resize: "none", border: `0.5px solid ${S.border2}`,
              outline: "none", lineHeight: 1.6, fontFamily: "inherit",
              opacity: confirmState ? 0.5 : 1,
            }}
          />

          <button type="submit" disabled={loading || !input.trim() || !!confirmState} style={{
            flexShrink: 0, padding: "10px 18px", borderRadius: 12, border: "none",
            background: loading || !input.trim() || confirmState ? S.surf2 : S.accent,
            color: loading || !input.trim() || confirmState ? S.muted : "#fff",
            fontSize: 14, fontWeight: 600, cursor: loading || !input.trim() || confirmState ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}>
            {isOnline ? "送信" : "保存"}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </main>
  );
}
