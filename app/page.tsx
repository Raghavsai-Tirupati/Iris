"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import StatusIndicator from "@/components/StatusIndicator";
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
  const frameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const isListeningRef = useRef(false);
  const modeRef = useRef<AppMode>("scene");
  const audioUnlockedRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [screen, setScreen] = useState<"landing" | "dismissing" | "camera">("landing");
  const [mode, setMode] = useState<AppMode>("scene");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [eyeOpen, setEyeOpen] = useState(false);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Request mic permission on mount ───────────────────
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); })
      .catch(() => {});
  }, []);

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
    if (appState === "idle") {
      frameRef.current = null;
    }
  }, [appState]);

  // ── First tap — unlock audio + welcome speech (must use onTouchStart on iOS) ──
  // ── First tap — unlock audio, open eye, go to camera in scene mode ──
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

    // 2. Speak welcome — must be in the SAME touchstart handler for iOS Safari
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      "Welcome to Iris. Tap anywhere to describe your surroundings, or hold and speak to ask a question."
    );
    u.rate = 1.0;
    window.speechSynthesis.speak(u);

    // 3. Default to scene mode, open eye, transition to camera
    setMode("scene");
    modeRef.current = "scene";
    setEyeOpen(true);
    setTimeout(() => {
      setScreen("dismissing");
      setTimeout(() => setScreen("camera"), 500);
    }, 1300);
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

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imageBase64,
            transcript,
            history: [],
            mode: currentMode,
          }),
        });

        const contentType = response.headers.get("content-type");

        if (contentType?.includes("audio/mpeg")) {
          const blob = await response.blob();
          const text = decodeURIComponent(
            response.headers.get("X-Response-Text") || ""
          );
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
    // If speaking/thinking, stop everything and reset to idle
    if (appState === "speaking") {
      window.speechSynthesis.cancel();
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      setAppState("idle");
      return;
    }
    if (appState === "thinking") return;

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
      // First tap — kill any leftover state, start fresh
      window.speechSynthesis.cancel();
      playChime(1200);
      setResponseText(null);
      frameRef.current = null;
      transcriptRef.current = "";
      setIsListening(true);
      setAppState("listening");

      // Capture frame after short delay
      frameTimeoutRef.current = setTimeout(() => {
        frameRef.current = cameraRef.current?.capture() || null;
      }, 500);

      // Start speech recognition fresh
      try { recognitionRef.current?.stop(); } catch { /* */ }
      setTimeout(() => {
        try { recognitionRef.current?.start(); } catch { /* */ }
      }, 100);

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
      {/* ── Landing screen — tap the eye to start ────── */}
      {(screen === "landing" || screen === "dismissing") && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: "#000",
            animation: screen === "dismissing" ? "fadeOut 0.5s ease-out forwards" : undefined,
          }}
          onClick={handleFirstTap}
          onTouchStart={(e) => { e.preventDefault(); handleFirstTap(); }}
          role="button"
          tabIndex={0}
          aria-label="Tap to start Iris"
        >
          {/* Eye */}
          <svg
            width="220"
            height="136"
            viewBox="0 0 100 60"
            fill="none"
            style={{
              transform: eyeOpen ? undefined : "scaleY(0.22)",
              animation: eyeOpen ? "eyeOpen 0.8s cubic-bezier(0.22,1,0.36,1) forwards" : undefined,
            }}
          >
            <path
              d="M5 30 Q25 5, 50 5 Q75 5, 95 30 Q75 55, 50 55 Q25 55, 5 30 Z"
              stroke="white"
              strokeWidth="1.5"
            />
            <circle
              cx="50" cy="30" r="14"
              stroke="white" strokeWidth="1.2"
              style={{
                opacity: eyeOpen ? undefined : 0,
                transform: eyeOpen ? undefined : "scale(0.2)",
                transformOrigin: "50px 30px",
                animation: eyeOpen ? "pupilReveal 0.5s ease-out 0.35s both" : undefined,
              }}
            />
            <circle
              cx="50" cy="30" r="6"
              fill="white"
              style={{
                opacity: eyeOpen ? undefined : 0,
                transform: eyeOpen ? undefined : "scale(0.2)",
                transformOrigin: "50px 30px",
                animation: eyeOpen ? "pupilReveal 0.5s ease-out 0.35s both" : undefined,
              }}
            />
          </svg>

          {/* "Iris" text — appears after eye opens */}
          <h1
            className="text-white text-[48px] sm:text-[56px] leading-[1] tracking-tight mt-5"
            style={{
              fontFamily: '"Times New Roman", Times, serif',
              opacity: eyeOpen ? undefined : 0,
              animation: eyeOpen ? "irisReveal 0.5s ease-out 0.55s both" : undefined,
            }}
          >
            Iris
          </h1>

          {/* Bottom */}
          <div className="absolute bottom-7 flex flex-col items-center gap-3">
            {!eyeOpen && (
              <p className="text-[#333] text-[11px] tracking-[0.1em]">
                Tap to open
              </p>
            )}
            <p className="text-[#1a1a1a] text-[9px] tracking-[0.2em] uppercase">
              Hook &apos;Em Hacks 2026
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
