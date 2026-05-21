"use client";

/**
 * InstallPrompt — shows an "Add to Home Screen" banner on mobile browsers.
 *
 * On Android/Chrome: catches the browser's beforeinstallprompt event and shows a
 * native-install button.
 * On iOS/Safari: shows a manual instruction (Safari doesn't support the event).
 * Dismissed state is saved in localStorage.
 */

import { useState, useEffect } from "react";
import { X, Smartphone, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid,    setShowAndroid]    = useState(false);
  const [showIOS,        setShowIOS]        = useState(false);

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show if already dismissed
    if (localStorage.getItem("rk_pwa_dismissed")) return;

    // Android / Chrome — catch the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroid(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS / Safari — detect and show manual guide
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari) setShowIOS(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem("rk_pwa_dismissed", "1");
    setShowAndroid(false);
    setShowIOS(false);
    setDeferredPrompt(null);
  }

  async function installAndroid() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
    setShowAndroid(false);
  }

  if (!showAndroid && !showIOS) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-brand-black text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        {/* App icon */}
        <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center shrink-0">
          <span className="text-white font-black text-lg">R</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Install Robotek FinOS</p>

          {showAndroid && (
            <>
              <p className="text-xs text-white/60 mt-0.5">
                Add to your home screen for quick access — works like a real app.
              </p>
              <button
                onClick={installAndroid}
                className="mt-2.5 flex items-center gap-1.5 bg-brand-red hover:bg-brand-maroon text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Install App
              </button>
            </>
          )}

          {showIOS && (
            <>
              <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                Tap <span className="inline-flex items-center gap-0.5 font-semibold text-white"><Share className="w-3 h-3" /> Share</span>, then <strong className="text-white">"Add to Home Screen"</strong> to install.
              </p>
            </>
          )}
        </div>

        <button
          onClick={dismiss}
          className="text-white/50 hover:text-white p-1 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
