"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export default function PushSetup() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => null);
    const perm = Notification.permission;
    setPermission(perm);
    // 未決定の場合のみバナーを表示（少し遅延してスプラッシュ後）
    if (perm === "default") {
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setPermission("granted");
    } catch {
      setPermission("denied");
    }
    setShow(false);
  }

  async function requestAndSubscribe() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") await subscribe();
    else setShow(false);
  }

  async function sendTest() {
    setTesting(true);
    await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    setTesting(false);
  }

  if (permission === "granted") {
    return (
      <button
        onClick={sendTest}
        disabled={testing}
        style={{
          position: "fixed", bottom: 20, right: 16, zIndex: 9999,
          background: "#1a1e2a", border: "0.5px solid rgba(99,102,241,0.4)",
          borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#9ca3af",
          cursor: "pointer",
        }}
      >
        {testing ? "送信中..." : "通知テスト"}
      </button>
    );
  }

  if (!show || permission !== "default") return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: 16, right: 16, zIndex: 9999,
      background: "#1a1e2a", border: "0.5px solid rgba(99,102,241,0.4)",
      borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0", margin: 0 }}>
          Naviからの通知を受け取る
        </p>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
          1日10件、天気・予定・ニュースをお届けします
        </p>
      </div>
      <button
        onClick={() => setShow(false)}
        style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 18, cursor: "pointer", padding: 4, flexShrink: 0 }}
      >
        ✕
      </button>
      <button
        onClick={requestAndSubscribe}
        style={{
          background: "#6366f1", color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
        }}
      >
        許可する
      </button>
    </div>
  );
}
