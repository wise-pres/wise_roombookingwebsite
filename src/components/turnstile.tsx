"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "error-callback": (errorCode: string) => void;
    "expired-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileProps = {
  siteKey: string;
  onTokenChange: (token: string) => void;
};

export function Turnstile({ siteKey, onTokenChange }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    let cancelled = false;
    window.turnstile.ready(() => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) {
        return;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => {
          setError("");
          onTokenChange(token);
        },
        "error-callback": (errorCode) => {
          onTokenChange("");
          setError(`Human verification could not load (error ${errorCode}). Refresh the page and try again.`);
        },
        "expired-callback": () => {
          onTokenChange("");
          setError("Human verification expired. Please complete it again.");
        },
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onTokenChange, scriptReady, siteKey]);

  return (
    <div className="turnstile-verification">
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setError("Human verification could not load. Check your connection and refresh the page.")}
      />
      <div ref={containerRef} />
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
