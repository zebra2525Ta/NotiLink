"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // iOS PWAのスタンドアロンモード検出
    setIsStandalone(
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }, []);

  async function handleLogin() {
    setLoading(true);
    await signIn("notion", { callbackUrl: "/" });
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white px-6">
      <div className="flex flex-col items-center gap-8 w-full max-w-xs">
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">🤖</span>
          <h1 className="text-2xl font-bold tracking-tight">AI秘書</h1>
          <p className="text-sm text-gray-400 text-center">
            Notionアカウントでログインして<br />はじめましょう
          </p>
        </div>

        {isStandalone ? (
          // PWAスタンドアロンモード：SafariでOAuthを完了させる
          <div className="flex flex-col items-center gap-4 w-full">
            <p className="text-xs text-amber-400 text-center leading-relaxed">
              ホーム画面アプリからのNotionログインは<br />
              Safariで行う必要があります
            </p>
            <a
              href="/login"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-900 rounded-2xl text-sm font-semibold transition-colors"
            >
              <span className="text-lg">N</span>
              <span>Safariでログイン</span>
            </a>
            <p className="text-xs text-gray-500 text-center">
              ログイン完了後、このアプリを再度開いてください
            </p>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-900 rounded-2xl text-sm font-semibold transition-colors"
          >
            {loading ? (
              <span className="text-gray-500">ログイン中...</span>
            ) : (
              <>
                <span className="text-lg">N</span>
                <span>Notionでログイン</span>
              </>
            )}
          </button>
        )}
      </div>
    </main>
  );
}
