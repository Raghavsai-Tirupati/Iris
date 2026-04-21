"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import StatusIndicator from "@/components/StatusIndicator";
import IrisBloom from "@/components/IrisBloom";
import { AppState, AppMode } from "@/lib/types";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";


function speakText(text: string, rate = 1.0) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

function playChime(freq: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Non-critical
  }
}

// ─── Main App ───────────────────────────────────────────────────────────────

export default function Home() {
  const cameraRef = useRef<CameraFeedHandle>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const isListeningRef = useRef(false);
  const modeRef = useRef<AppMode>("scene");
  const audioUnlockedRef = useRef(false);
  const [screen, setScreen] = useState<"landing" | "dismissing" | "camera">("landing");
  const [mode, setMode] = useState<AppMode>("scene");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Speech recognition setup ──────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + " ";
      }
      transcriptRef.current = text.trim();
    };
    recognition.onend = () => {};
    recognition.onerror = () => {};
    recognitionRef.current = recognition;
  }, []);

  // ── Reset on idle — keep responseText visible ─────────
  useEffect(() => {
    if (appState === "idle") frameRef.current = null;
  }, [appState]);

  // ── First tap — unlock audio, welcome, go to camera ───
  const handleFirstTap = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    const a = document.createElement("audio");
    a.src = SILENT_WAV;
    a.play().then(() => a.pause()).catch(() => {});
    if (audioRef.current) {
      audioRef.current.src = SILENT_WAV;
      audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      "Welcome to Iris. Hold anywhere to speak, release to send."
    );
    u.rate = 1.0;
    window.speechSynthesis.speak(u);

    cameraRef.current?.startCamera();
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); })
      .catch(() => {});

    setMode("scene");
    modeRef.current = "scene";
    setTimeout(() => {
      setScreen("dismissing");
      setTimeout(() => setScreen("camera"), 400);
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch mode in camera view ────────────────────────
  const switchMode = useCallback(() => {
    const newMode = modeRef.current === "scene" ? "read" : "scene";
    setMode(newMode);
    modeRef.current = newMode;
    speakText(newMode === "scene" ? "Switched to scene mode." : "Switched to read mode.");
  }, []);

  // ── Speak fallback ────────────────────────────────────
  const speakFallback = useCallback((text: string | null) => {
    if (text) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.5;
      u.onend = () => setAppState("idle");
      u.onerror = () => setAppState("idle");
      window.speechSynthesis.speak(u);
    } else {
      setAppState("idle");
    }
  }, []);

  // ── Silent hazard reporting ────────────────────────────
  const reportHazardIfNeeded = useCallback((text: string, currentMode: AppMode) => {
    if (currentMode !== "scene") return;
    const hazardPattern = /stair|step|pothole|obstruct|uneven|construct|block|curb|crack|barrier|hazard|caution|watch out|be careful|obstacle|tripping|slip/i;
    if (!hazardPattern.test(text)) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        fetch("/api/hazard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            description: text,
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // ── Process request ───────────────────────────────────
  const processRequest = useCallback(
    async (transcript: string) => {
      const currentMode = modeRef.current;
      if (!transcript && currentMode === "read") transcript = "Read all visible text.";
      if (!transcript && currentMode === "scene") transcript = "Describe what you see.";
      if (!transcript) { setAppState("idle"); return; }

      setAppState("thinking");
      const imageBase64 = frameRef.current;
      if (!imageBase64) {
        setResponseText("I couldn't capture an image. Please try again.");
        setAppState("speaking");
        const u = new SpeechSynthesisUtterance("I couldn't capture an image. Please try again.");
        u.rate = 1.0;
        u.onend = () => setAppState("idle");
        window.speechSynthesis.speak(u);
        return;
      }

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageBase64, transcript, history: [], mode: currentMode }),
        });
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("audio/mpeg")) {
          const blob = await response.blob();
          const text = decodeURIComponent(response.headers.get("X-Response-Text") || "");
          setResponseText(text || null);
          setAppState("speaking");
          reportHazardIfNeeded(text, currentMode);
          const audio = audioRef.current;
          if (audio) {
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.playbackRate = 1.5;
            audio.onended = () => { URL.revokeObjectURL(url); setAppState("idle"); };
            audio.onerror = () => { URL.revokeObjectURL(url); speakFallback(text); };
            audio.play().catch(() => speakFallback(text));
          } else {
            speakFallback(text);
          }
        } else {
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          setResponseText(data.text);
          setAppState("speaking");
          reportHazardIfNeeded(data.text, currentMode);
          speakFallback(data.text);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Something went wrong";
        setResponseText(msg);
        setAppState("speaking");
        speakFallback(msg);
      }
    },
    [speakFallback, reportHazardIfNeeded]
  );

  // ── Hold-to-talk: press down → listen, lift → send ───
  const handlePressDown = useCallback(() => {
    if (appState === "speaking") {
      window.speechSynthesis.cancel();
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      setAppState("idle");
      return;
    }
    if (appState === "thinking" || isListening) return;

    window.speechSynthesis.cancel();
    playChime(1200);
    setResponseText(null);
    frameRef.current = null;
    transcriptRef.current = "";
    setIsListening(true);
    setAppState("listening");
    frameRef.current = cameraRef.current?.capture() || null;
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setTimeout(() => {
      try { recognitionRef.current?.start(); } catch { /* */ }
    }, 50);
  }, [appState, isListening]);

  const handlePressUp = useCallback(() => {
    if (!isListeningRef.current) return;
    playChime(440);
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setTimeout(() => {
      const transcript = transcriptRef.current;
      transcriptRef.current = "";
      processRequest(transcript);
    }, 300);
  }, [processRequest]);

  return (
    <main className="fixed inset-0 bg-[#efe7d6]">
      {/* ── Landing — bloom animation ── */}
      {(screen === "landing" || screen === "dismissing") && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: "#efe7d6",
            padding: 40,
            animation: screen === "dismissing" ? "fadeOut 0.4s ease-out forwards" : undefined,
          }}
          onClick={handleFirstTap}
          onTouchStart={(e) => { e.preventDefault(); handleFirstTap(); }}
          role="button"
          tabIndex={0}
          aria-label="Tap to start Iris"
        >
          <div className="relative z-[2] flex flex-col items-center">
            <div
              style={{ width: 280, height: 280, display: "grid", placeItems: "center" }}
              role="img"
              aria-label="Iris logo: a lily blooming"
            >
              <IrisBloom />
            </div>

            {/* Wordmark */}
            <div style={{
              marginTop: 32, display: "flex", alignItems: "center", gap: 14,
              opacity: 0, transform: "translateY(10px)",
              animation: "textUp 1.2s cubic-bezier(.22,.61,.36,1) 2.4s forwards",
            }}>
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: 72, fontWeight: 400, fontStyle: "italic",
                letterSpacing: "0.01em", color: "#1e1a15",
              }}>Iris</span>
            </div>

            {/* Tagline */}
            <div style={{
              marginTop: 10, fontSize: 12, fontWeight: 300,
              letterSpacing: "0.42em", textTransform: "uppercase" as const,
              color: "rgba(30,26,21,0.45)",
              opacity: 0, transform: "translateY(8px)",
              animation: "textUp 1.2s cubic-bezier(.22,.61,.36,1) 2.7s forwards",
            }}>See with sound</div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 left-0 right-0 text-center z-[2]" style={{
            fontSize: 10, fontWeight: 400, letterSpacing: "0.4em",
            textTransform: "uppercase" as const, color: "rgba(30,26,21,0.2)",
            opacity: 0, animation: "textUp 1.6s ease-out 3.0s forwards",
          }}>
            Hook &apos;Em Hacks 2026 <span style={{ display: "inline-block", margin: "0 0.8em", opacity: 0.7 }}>&bull;</span> UT Austin
          </div>
        </div>
      )}

      <CameraFeed ref={cameraRef} />

      {screen === "camera" && (
        <StatusIndicator
          state={appState}
          mode={mode}
          isListening={isListening}
          responseText={responseText}
          onSwitchMode={switchMode}
        />
      )}

      <audio ref={audioRef} className="hidden" playsInline />

      {screen === "camera" && (
        <div
          className="fixed inset-0 z-40"
          onMouseDown={handlePressDown}
          onMouseUp={handlePressUp}
          onTouchStart={(e) => { e.preventDefault(); handlePressDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressUp(); }}
          role="button"
          tabIndex={0}
          aria-label={
            isListening
              ? "Release to send your question"
              : appState === "thinking"
                ? "Analyzing your question"
                : appState === "speaking"
                  ? "Tap to stop response"
                  : mode === "scene"
                    ? "Hold to speak, release to send"
                    : "Hold to speak, release to read text"
          }
        />
      )}
    </main>
  );
}
