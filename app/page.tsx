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
      "Welcome to SceneSpeak. Tap anywhere to describe your surroundings, or hold and speak to ask a question. Say scene mode or read mode to begin."
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
      u.rate = 1.0;
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
            audio.playbackRate = 1.0;
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
      {/* ── Landing screen ─────────────────────────────── */}
      {(screen === "landing" || screen === "dismissing") && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
          style={{
            background: "#000000",
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
              aria-label="Tap anywhere to start SceneSpeak"
            />
          )}

          {/* ── Branding ────────────────────────────────────── */}
          <div className="relative z-10 flex flex-col px-8 pt-16 sm:pt-20">
            <h1
              className="font-[family-name:var(--font-serif)] text-white text-[38px] sm:text-[48px] leading-[1.1] tracking-tight"
              style={{ animation: "fadeInUp 0.5s ease-out" }}
            >
              SceneSpeak
            </h1>
            <p
              className="text-[#999] text-[14px] tracking-wide mt-2"
              style={{ animation: "fadeInUp 0.5s ease-out 0.05s both" }}
            >
              AI-powered visual guide for the world around you
            </p>
          </div>

          {/* ── Map card ─────────────────────────────────── */}
          <div
            className="relative z-10 px-8 mt-10"
            style={{ animation: "fadeInUp 0.5s ease-out 0.1s both" }}
          >
            <div className="rounded-2xl overflow-hidden border border-[#222] h-[220px] sm:h-[260px]" style={{ boxShadow: "0 0 30px rgba(0,0,0,0.4)" }}>
              <HazardMap hazards={landingHazards} userLocation={userLocation} compact />
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full bg-[#4FC3F7]"
                  style={{ boxShadow: "0 0 6px rgba(79,195,247,0.5)" }}
                />
                <span className="text-[#666] text-[11px]">You</span>
                <span className="text-[#333] mx-1">&bull;</span>
                <span
                  className="w-2 h-2 rounded-full bg-[#EF5350]"
                  style={{ boxShadow: "0 0 6px rgba(239,83,80,0.5)" }}
                />
                <span className="text-[#666] text-[11px]">Hazards</span>
              </div>
              {landingHazards.length > 0 && (
                <span className="text-[#555] text-[11px]">
                  {landingHazards.length} reported
                </span>
              )}
            </div>
          </div>

          {/* ── Mode buttons ─────────────────────────────── */}
          <div
            className="relative z-10 flex flex-col px-8 mt-10"
            style={{ animation: "fadeInUp 0.5s ease-out 0.15s both" }}
          >
            <div className="w-full h-px bg-[#222222]" />

            <button
              className="w-full py-5 text-left active:opacity-60 transition-opacity min-h-[44px]"
              onClick={() => handleSelectMode("scene")}
              aria-label="Scene Mode: Tap to ask questions about what the camera sees"
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-white text-[22px] sm:text-[26px] font-medium">
                    <span className="text-[#4FC3F7]">01</span>
                    <span className="ml-4">Scene Mode</span>
                  </p>
                  <p className="text-[#666666] text-[13px] mt-1 ml-[48px]">
                    Ask about what you see
                  </p>
                </div>
                <span className="text-[#333333] text-[22px] font-light">&rarr;</span>
              </div>
            </button>

            <div className="w-full h-px bg-[#222222]" />

            <button
              className="w-full py-5 text-left active:opacity-60 transition-opacity min-h-[44px]"
              onClick={() => handleSelectMode("read")}
              aria-label="Read Mode: Read any text the camera sees"
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-white text-[22px] sm:text-[26px] font-medium">
                    <span className="text-[#81C784]">02</span>
                    <span className="ml-4">Read Mode</span>
                  </p>
                  <p className="text-[#666666] text-[13px] mt-1 ml-[48px]">
                    Read signs, menus, documents
                  </p>
                </div>
                <span className="text-[#333333] text-[22px] font-light">&rarr;</span>
              </div>
            </button>

            <div className="w-full h-px bg-[#222222]" />

            {voiceListening && (
              <div className="flex items-center gap-2 mt-4">
                <span
                  className="w-2 h-2 rounded-full bg-[#EF5350]"
                  style={{ animation: "breathe 2s ease-in-out infinite" }}
                />
                <span className="text-[#666666] text-[13px]">
                  Listening — say a mode, or tap to choose
                </span>
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────── */}
          <div className="flex-1 min-h-[40px]" />
          <div
            className="relative z-10 px-8 pb-6"
            style={{ animation: "fadeInUp 0.5s ease-out 0.2s both" }}
          >
            <p className="text-[#444] text-[11px] tracking-[0.15em] uppercase">
              Hook &apos;Em Hacks 2026 &bull; UT Austin
            </p>
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
