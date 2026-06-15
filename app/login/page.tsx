"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import NotiLinkLogo from "@/app/components/NotiLinkLogo";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }, []);

  async function handleLogin() {
    setLoading(true);
    await signIn("notion", { callbackUrl: "/" });
  }

  return (
    <main
      className="flex flex-col items-center justify-center min-h-screen px-6"
      style={{ backgroundColor: "#100E0A", color: "#F0ECE4" }}
    >
      <div className="flex flex-col items-center gap-8 w-full max-w-xs">
        <div className="flex flex-col items-center gap-3">
          <NotiLinkLogo size={72} />
          <h1
            className="text-2xl font-bold tracking-[0.15em] mt-2"
            style={{ color: "#FCD34D" }}
          >
            NOTILINK
          </h1>
          <p className="text-sm text-center" style={{ color: "#B8AD9B" }}>
            Notionアカウントでログインして<br />はじめましょう
          </p>
        </div>

        <div
          className="w-full border-t"
          style={{ borderColor: "rgba(252, 211, 77, 0.2)" }}
        />

        {isStandalone ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <p
              className="text-xs text-center leading-relaxed"
              style={{ color: "#FCD34D" }}
            >
              ホーム画面アプリからのNotionログインは<br />
              Safariで行う必要があります
            </p>
            <a
              href="/login"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-sm font-semibold transition-colors"
              style={{ backgroundColor: "#F59E0B", color: "#100E0A" }}
            >
              <span className="text-lg font-bold">N</span>
              <span>Safariでログイン</span>
            </a>
            <p className="text-xs text-center" style={{ color: "#6B6248" }}>
              ログイン完了後、このアプリを再度開いてください
            </p>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: loading ? "#6B6248" : "#F59E0B",
              color: "#100E0A",
            }}
          >
            {loading ? (
              <span>ログイン中...</span>
            ) : (
              <>
                <span className="text-lg font-bold">N</span>
                <span>Notionでログイン</span>
              </>
            )}
          </button>
        )}
      </div>
    </main>
  );
}
