"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function Login() {
  const [loading, setLoading] = useState(false);

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
      </div>
    </main>
  );
}
