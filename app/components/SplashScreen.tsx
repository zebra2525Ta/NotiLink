"use client";

import { useState, useEffect } from "react";
import NotiLinkLogo from "./NotiLinkLogo";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: "#190E00" }}
    >
      <NotiLinkLogo size={80} />
      <div
        className="mt-6 w-20"
        style={{ borderTop: "1px solid rgba(252, 211, 77, 0.35)" }}
      />
      <p
        className="mt-4 text-lg font-bold tracking-[0.25em]"
        style={{ color: "#FCD34D" }}
      >
        NOTILINK
      </p>
    </div>
  );
}
