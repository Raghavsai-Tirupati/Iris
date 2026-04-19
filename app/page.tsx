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

    // 3. Request camera + mic permissions now (not on page load)
    cameraRef.current?.startCamera();
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); })
      .catch(() => {});

    // 4. Default to scene mode, transition to camera after 0.5s hold
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

    // Brief delay to let final recognition result land
    setTimeout(() => {
      const transcript = transcriptRef.current;
      transcriptRef.current = "";
      processRequest(transcript);
    }, 300);
  }, [processRequest]);

  return (
    <main className="fixed inset-0 bg-[#0a0a0a]">
      {/* ── Landing screen — animated iris from reference ── */}
      {(screen === "landing" || screen === "dismissing") && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: "#0a0a0f",
            padding: 40,
            animation: screen === "dismissing" ? "fadeOut 0.4s ease-out forwards" : undefined,
          }}
          onClick={handleFirstTap}
          onTouchStart={(e) => { e.preventDefault(); handleFirstTap(); }}
          role="button"
          tabIndex={0}
          aria-label="Tap to start Iris"
        >
          {/* Ambient vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 48%, rgba(107,76,154,0.08) 0%, rgba(26,58,92,0.04) 35%, transparent 70%)",
            opacity: 0,
            animation: "vignetteIn 2.4s ease-out 0.4s forwards",
          }} />

          {/* Star specks */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: [
              "radial-gradient(1px 1px at 23% 31%, rgba(255,255,255,0.25), transparent 60%)",
              "radial-gradient(1px 1px at 71% 22%, rgba(255,255,255,0.18), transparent 60%)",
              "radial-gradient(1px 1px at 12% 74%, rgba(255,255,255,0.15), transparent 60%)",
              "radial-gradient(1px 1px at 88% 66%, rgba(255,255,255,0.2), transparent 60%)",
              "radial-gradient(1px 1px at 55% 12%, rgba(255,255,255,0.12), transparent 60%)",
              "radial-gradient(1px 1px at 42% 88%, rgba(255,255,255,0.14), transparent 60%)",
            ].join(","),
            opacity: 0,
            animation: "vignetteIn 3s ease-out 0.8s forwards",
          }} />

          {/* Content */}
          <div className="relative z-[2] flex flex-col items-center">
            {/* Eye mark */}
            <div className="relative" style={{ width: 200, height: 200, display: "grid", placeItems: "center" }}>
              {/* Bloom glow */}
              <div className="absolute rounded-full" style={{
                inset: -80,
                background: "radial-gradient(circle at 50% 50%, rgba(107,76,154,0.45) 0%, rgba(64,66,128,0.22) 28%, rgba(26,58,92,0.12) 50%, transparent 72%)",
                filter: "blur(6px)",
                opacity: 0,
                transform: "scale(0.7)",
                animation: "bloomIn 1.8s cubic-bezier(.22,.61,.36,1) 1.8s forwards, bloomBreathe 6s ease-in-out 4s infinite",
              }} />

              <svg viewBox="0 0 200 200" style={{ position: "relative", width: "100%", height: "100%", overflow: "visible" }}>
                <defs>
                  <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#2a5a88" />
                    <stop offset="45%" stopColor="#3a4a8c" />
                    <stop offset="80%" stopColor="#6b4c9a" />
                    <stop offset="100%" stopColor="#3a2a5c" />
                  </radialGradient>
                  <radialGradient id="pupilGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#05050a" />
                    <stop offset="70%" stopColor="#0a0a14" />
                    <stop offset="100%" stopColor="#1a1a2a" />
                  </radialGradient>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7a5cb0" />
                    <stop offset="50%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#2a5a88" />
                  </linearGradient>
                  <clipPath id="eyeClip">
                    <path d="M 20 100 Q 100 40, 180 100 Q 100 160, 20 100 Z" />
                  </clipPath>
                </defs>

                {/* Blink wrapper — quick blink 1s after eye fully opens */}
                <g style={{ transformOrigin: "100px 100px", animation: "blink 0.18s ease-in-out 4.5s 1" }}>
                  {/* Ring that draws in */}
                  <circle cx="100" cy="100" r="70" fill="none" stroke="url(#ringGrad)" strokeWidth="1.2"
                    style={{ strokeDasharray: 440, strokeDashoffset: 440, animation: "ringDraw 1.6s cubic-bezier(.65,.05,.36,1) 0.2s forwards" }} />

                  {/* Iris clipped to almond */}
                  <g clipPath="url(#eyeClip)">
                    <g style={{ transformOrigin: "100px 100px", transform: "scale(0)", opacity: 0, animation: "irisOpen 1.4s cubic-bezier(.22,.61,.36,1) 1.7s forwards" }}>
                      <circle cx="100" cy="100" r="52" fill="url(#irisGrad)" />
                      {/* Striations */}
                      <g style={{ opacity: 0, animation: "fadeIn 1.2s ease-out 2.2s forwards" }}>
                        {[[100,52,100,64],[124,58,119,69],[142,75,134,83],[148,100,136,100],[142,125,134,117],[124,142,119,131],[100,148,100,136],[76,142,81,131],[58,125,66,117],[52,100,64,100],[58,75,66,83],[76,58,81,69],[112,54,110,66],[134,66,128,75],[146,88,135,93],[146,112,135,107],[134,134,128,125],[112,146,110,134],[88,146,90,134],[66,134,72,125],[54,112,65,107],[54,88,65,93],[66,66,72,75],[88,54,90,66]].map(([x1,y1,x2,y2], i) => (
                          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" strokeLinecap="round" />
                        ))}
                      </g>
                      <circle cx="100" cy="100" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
                      <circle cx="100" cy="100" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                      {/* Pupil */}
                      <g style={{ transformOrigin: "100px 100px", transform: "scale(0)", animation: "pupilIn 0.6s cubic-bezier(.34,1.56,.64,1) 2.5s forwards" }}>
                        <circle cx="100" cy="100" r="18" fill="url(#pupilGrad)" />
                        <g style={{ opacity: 0, animation: "fadeIn 0.7s ease-out 2.8s forwards" }}>
                          <ellipse cx="93" cy="93" rx="3.5" ry="2" fill="rgba(255,255,255,0.9)" />
                          <circle cx="106" cy="106" r="1" fill="rgba(255,255,255,0.35)" />
                        </g>
                      </g>
                    </g>
                  </g>

                  {/* Eyelid outlines */}
                  <path d="M 20 100 Q 100 40, 180 100" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" strokeLinecap="round"
                    style={{ opacity: 0, animation: "fadeIn 0.8s ease-out 1.5s forwards" }} />
                  <path d="M 20 100 Q 100 160, 180 100" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" strokeLinecap="round"
                    style={{ opacity: 0, animation: "fadeIn 0.8s ease-out 1.5s forwards" }} />
                </g>
              </svg>
            </div>

            {/* Wordmark */}
            <div style={{
              marginTop: 56, fontSize: 48, fontWeight: 300, letterSpacing: "0.32em", paddingLeft: "0.32em",
              color: "#fff", opacity: 0, transform: "translateY(8px)",
              animation: "textUp 1.2s cubic-bezier(.22,.61,.36,1) 2.7s forwards",
            }}>IRIS</div>

            {/* Tagline */}
            <div style={{
              marginTop: 20, fontSize: 16, fontWeight: 300, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.5)", opacity: 0, transform: "translateY(8px)",
              animation: "textUp 1.2s cubic-bezier(.22,.61,.36,1) 3.0s forwards",
            }}>See with sound.</div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 left-0 right-0 text-center" style={{
            fontSize: 12, fontWeight: 400, letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.3)", opacity: 0,
            animation: "fadeIn 1.6s ease-out 3.4s forwards",
          }}>
            Hook &apos;Em Hacks 2026 <span style={{ display: "inline-block", margin: "0 0.7em", opacity: 0.6 }}>&bull;</span> UT Austin
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
