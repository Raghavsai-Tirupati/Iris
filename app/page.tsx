"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import StatusIndicator from "@/components/StatusIndicator";
import { AppState, AppMode, Message } from "@/lib/types";

const HazardMap = dynamic(() => import("./dashboard/HazardMap"), { ssr: false });

interface Hazard {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  timestamp: number;
}

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
  const frameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const isListeningRef = useRef(false);
  const historyRef = useRef<Message[]>([]);
  const modeRef = useRef<AppMode>("scene");
  const modeSelectedRef = useRef(false);
  const modeListenRef = useRef<SpeechRecognition | null>(null);
  const audioUnlockedRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [screen, setScreen] = useState<"landing" | "dismissing" | "camera">("landing");
  const [mode, setMode] = useState<AppMode>("scene");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [landingHazards, setLandingHazards] = useState<Hazard[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    fetch("/api/hazard")
      .then((r) => r.json())
      .then(setLandingHazards)
      .catch(() => {});
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Speech recognition setup ──────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + " ";
      }
      transcriptRef.current = text.trim();
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognition.start(); } catch { /* already running */ }
      }
    };

    recognition.onerror = () => {};
    recognitionRef.current = recognition;
  }, []);

  // ── Reset on idle ─────────────────────────────────────
  useEffect(() => {
    if (appState === "idle") {
      cameraRef.current?.unfreeze();
      setResponseText(null);
    }
  }, [appState]);

  // ── First tap — unlock audio + welcome speech (must use onTouchStart on iOS) ──
  const handleFirstTap = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    // 1. Unlock HTMLAudioElement with user gesture
    const a = document.createElement("audio");
    a.src = SILENT_WAV;
    a.play().then(() => a.pause()).catch(() => {});
    if (audioRef.current) {
      audioRef.current.src = SILENT_WAV;
      audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
    }

    // 2. Request mic permission
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        if (!modeSelectedRef.current) startModeListening();
      })
      .catch(() => {
        if (!modeSelectedRef.current) startModeListening();
      });

    // 3. Speak welcome — must be in the SAME touchstart handler for iOS Safari
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      "Welcome to Iris. Tap anywhere to describe your surroundings, or hold and speak to ask a question. Say scene mode or read mode to begin."
    );
    u.rate = 1.0;
    window.speechSynthesis.speak(u);

    setAudioReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start listening for voice mode selection ──────────
  const startModeListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (modeSelectedRef.current) return;
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + " ";
      }
      const lower = transcript.toLowerCase();
      if (lower.includes("scene")) {
        handleSelectMode("scene");
      } else if (lower.includes("read")) {
        handleSelectMode("read");
      }
    };

    recognition.onend = () => {
      if (!modeSelectedRef.current) {
        try { recognition.start(); } catch { /* */ }
      }
    };
    recognition.onerror = () => {};

    modeListenRef.current = recognition;
    try {
      recognition.start();
      setVoiceListening(true);
    } catch { /* */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mode selection ────────────────────────────────────
  const handleSelectMode = useCallback(
    (selectedMode: AppMode) => {
      if (modeSelectedRef.current) return;
      modeSelectedRef.current = true;
      setVoiceListening(false);
      try { modeListenRef.current?.stop(); } catch { /* */ }

      setMode(selectedMode);
      modeRef.current = selectedMode;
      window.speechSynthesis.cancel();

      if (selectedMode === "scene") {
        speakText("Scene mode. Tap anywhere to ask about what you see.");
      } else {
        speakText("Read mode. Tap anywhere and I'll read any text in view.");
      }

      setScreen("dismissing");
      setTimeout(() => setScreen("camera"), 400);
    },
    []
  );

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

      if (!transcript && currentMode === "read") {
        transcript = "Read all visible text.";
      }
      if (!transcript && currentMode === "scene") {
        transcript = "Describe what you see.";
      }
      if (!transcript) {
        setAppState("idle");
        return;
      }

      setAppState("thinking");

      const imageBase64 = frameRef.current;
      if (!imageBase64) {
        setResponseText("I couldn't capture an image. Please try again.");
        setAppState("speaking");
        const u = new SpeechSynthesisUtterance(
          "I couldn't capture an image. Please try again."
        );
        u.rate = 1.0;
        u.onend = () => setAppState("idle");
        window.speechSynthesis.speak(u);
        return;
      }

      const history = historyRef.current;
      const newHistory: Message[] = [
        ...history,
        { role: "user", content: transcript },
      ];

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imageBase64,
            transcript,
            history: newHistory.slice(-10),
            mode: currentMode,
          }),
        });

        const contentType = response.headers.get("content-type");

        if (contentType?.includes("audio/mpeg")) {
          const blob = await response.blob();
          const text = decodeURIComponent(
            response.headers.get("X-Response-Text") || ""
          );
          historyRef.current = [
            ...newHistory,
            { role: "assistant", content: text },
          ];
          setResponseText(text || null);
          setAppState("speaking");
          reportHazardIfNeeded(text, currentMode);

          const audio = audioRef.current;
          if (audio) {
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.playbackRate = 1.5;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              setAppState("idle");
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              speakFallback(text);
            };
            audio.play().catch(() => speakFallback(text));
          } else {
            speakFallback(text);
          }
        } else {
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          historyRef.current = [
            ...newHistory,
            { role: "assistant", content: data.text },
          ];
          setResponseText(data.text);
          setAppState("speaking");
          reportHazardIfNeeded(data.text, currentMode);
          speakFallback(data.text);
        }
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : "Something went wrong";
        setResponseText(msg);
        setAppState("speaking");
        speakFallback(msg);
      }
    },
    [speakFallback, reportHazardIfNeeded]
  );

  // ── Screen tap handler ────────────────────────────────
  const handleScreenTap = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.src = SILENT_WAV;
      audio.play().then(() => audio.pause()).catch(() => {});
    }
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));

    const isBusy = appState === "thinking" || appState === "speaking";
    if (isBusy) return;

    if (isListening) {
      // Second tap — stop listening and send
      playChime(440);
      setIsListening(false);
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      try { recognitionRef.current?.stop(); } catch { /* */ }
      const transcript = transcriptRef.current;
      transcriptRef.current = "";
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      processRequest(transcript);
    } else {
      // First tap — start listening + 3s silence auto-send
      playChime(1200);
      setIsListening(true);
      setAppState("listening");
      transcriptRef.current = "";
      try { recognitionRef.current?.start(); } catch { /* */ }
      frameTimeoutRef.current = setTimeout(() => {
        frameRef.current = cameraRef.current?.captureAndFreeze() || null;
      }, 500);

      // Auto-send after 3s if no speech detected
      silenceTimerRef.current = setTimeout(() => {
        if (!isListeningRef.current) return;
        const transcript = transcriptRef.current;
        if (!transcript.trim()) {
          setIsListening(false);
          try { recognitionRef.current?.stop(); } catch { /* */ }
          transcriptRef.current = "";
          processRequest("");
        }
      }, 3000);
    }
  }, [appState, isListening, processRequest]);

  return (
    <main className="fixed inset-0 bg-[#0a0a0a]">
      {/* ── Landing screen — triptych layout ──────────── */}
      {(screen === "landing" || screen === "dismissing") && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{
            background: "#000",
            animation: screen === "dismissing" ? "fadeOut 0.4s ease-out forwards" : undefined,
          }}
        >
          {/* Tap-to-start overlay — uses onTouchStart (required for iOS speechSynthesis) */}
          {!audioReady && (
            <div
              className="fixed inset-0 z-[60]"
              onClick={handleFirstTap}
              onTouchStart={(e) => { e.preventDefault(); handleFirstTap(); }}
              role="button"
              tabIndex={0}
              aria-label="Tap anywhere to start Iris"
            />
          )}

          {/* ── Left panel — Scene Mode ───────────────────── */}
          <button
            className="triptych-panel triptych-scene flex-1 flex flex-col items-center justify-center relative"
            onClick={() => handleSelectMode("scene")}
            aria-label="Scene Mode: Describe what the camera sees"
            style={{ animation: "panelSlideLeft 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}
          >
            <span
              className="absolute left-2.5 top-1/2 text-[9px] tracking-[0.3em] uppercase"
              style={{
                color: "rgba(79,195,247,0.2)",
                transform: "translateY(-50%) rotate(-90deg)",
                transformOrigin: "center",
                whiteSpace: "nowrap",
              }}
            >
              Scene Mode
            </span>

            <div
              className="triptych-icon"
              style={{ background: "rgba(79,195,247,0.05)", animationDelay: "0s" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4FC3F7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            <p className="text-white text-[14px] font-medium mt-5 tracking-wide">Scene</p>
            <p className="text-[#555] text-[10px] mt-1.5 text-center px-3 leading-relaxed">
              Describe your surroundings
            </p>
          </button>

          {/* ── Separator ─────────────────────────────────── */}
          <div className="w-px" style={{ background: "rgba(255,255,255,0.05)" }} />

          {/* ── Center panel — Branding ───────────────────── */}
          <div
            className="flex-[1.4] flex flex-col items-center relative"
            style={{
              background: "#050505",
              animation: "fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) both",
            }}
          >
            <div className="flex flex-col items-center pt-20 sm:pt-24">
              <h1
                className="text-white text-[44px] sm:text-[52px] leading-[1] tracking-tight"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                Iris
              </h1>
              <p className="text-[#555] text-[11px] tracking-[0.15em] uppercase mt-3">
                Visual Assistant
              </p>
            </div>

            <div className="flex-1 flex items-center justify-center w-full px-4">
              <div
                className="rounded-xl overflow-hidden border border-[#1a1a1a] w-full"
                style={{ aspectRatio: "1 / 1", maxWidth: "180px", boxShadow: "0 0 24px rgba(0,0,0,0.4)" }}
              >
                <HazardMap hazards={landingHazards} userLocation={userLocation} compact />
              </div>
            </div>

            <div className="pb-8 flex flex-col items-center gap-3">
              {voiceListening && (
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full bg-[#EF5350]"
                    style={{ animation: "breathe 2s ease-in-out infinite" }}
                  />
                  <span className="text-[#555] text-[10px]">Say a mode or tap</span>
                </div>
              )}
              <p className="text-[#2a2a2a] text-[9px] tracking-[0.2em] uppercase">
                Hook &apos;Em Hacks 2026
              </p>
            </div>
          </div>

          {/* ── Separator ─────────────────────────────────── */}
          <div className="w-px" style={{ background: "rgba(255,255,255,0.05)" }} />

          {/* ── Right panel — Read Mode ───────────────────── */}
          <button
            className="triptych-panel triptych-read flex-1 flex flex-col items-center justify-center relative"
            onClick={() => handleSelectMode("read")}
            aria-label="Read Mode: Read any text the camera sees"
            style={{ animation: "panelSlideRight 0.6s cubic-bezier(0.22,1,0.36,1) 0.2s both" }}
          >
            <span
              className="absolute right-2.5 top-1/2 text-[9px] tracking-[0.3em] uppercase"
              style={{
                color: "rgba(129,199,132,0.2)",
                transform: "translateY(-50%) rotate(90deg)",
                transformOrigin: "center",
                whiteSpace: "nowrap",
              }}
            >
              Read Mode
            </span>

            <div
              className="triptych-icon"
              style={{ background: "rgba(129,199,132,0.05)", animationDelay: "0.5s" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#81C784" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>

            <p className="text-white text-[14px] font-medium mt-5 tracking-wide">Read</p>
            <p className="text-[#555] text-[10px] mt-1.5 text-center px-3 leading-relaxed">
              Signs, menus &amp; documents
            </p>
          </button>
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
          onClick={handleScreenTap}
          onTouchStart={(e) => {
            e.preventDefault();
            handleScreenTap();
          }}
          role="button"
          tabIndex={0}
          aria-label={
            isListening
              ? "Tap to stop recording and send your question"
              : appState === "thinking"
                ? "Analyzing your question"
                : appState === "speaking"
                  ? "Playing response"
                  : mode === "scene"
                    ? "Tap anywhere to start speaking your question"
                    : "Tap anywhere to read text in view"
          }
        />
      )}
    </main>
  );
}
