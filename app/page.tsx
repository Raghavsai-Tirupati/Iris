"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import StatusIndicator from "@/components/StatusIndicator";
import { AppState, Message } from "@/lib/types";

// Tiny silent WAV to unlock Safari audio playback on user gesture
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

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

// ─── Intro Screen ───────────────────────────────────────────────────────────

function IntroScreen({
  onStart,
  dismissing,
}: {
  onStart: () => void;
  dismissing: boolean;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const u = new SpeechSynthesisUtterance(
        "Welcome to SceneSpeak. Tap anywhere to begin."
      );
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      style={{
        background: "#050510",
        animation: dismissing ? "fadeOut 0.5s ease-out forwards" : undefined,
      }}
      onClick={onStart}
      onTouchStart={(e) => {
        e.preventDefault();
        onStart();
      }}
      role="button"
      tabIndex={0}
      aria-label="Tap anywhere to begin using SceneSpeak"
    >
      {/* Floating gradient orbs */}
      <div
        className="absolute rounded-full"
        style={{
          width: "500px",
          height: "500px",
          top: "-15%",
          left: "-20%",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          animation: "orbFloat1 12s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "450px",
          height: "450px",
          bottom: "-10%",
          right: "-15%",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
          animation: "orbFloat2 14s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "300px",
          height: "300px",
          top: "35%",
          right: "5%",
          background:
            "radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)",
          animation: "orbFloat3 10s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <h1
          className="text-7xl font-bold tracking-tight"
          style={{
            animation: "fadeInUp 1s ease-out",
            background: "linear-gradient(135deg, #ffffff 0%, #a78bfa 50%, #818cf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          SceneSpeak
        </h1>

        {/* Divider line */}
        <div
          className="w-12 h-px mt-5"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(167,139,250,0.5), transparent)",
            animation: "fadeInUp 1s ease-out 0.15s both",
          }}
        />

        {/* Tagline */}
        <p
          className="text-white/50 text-lg mt-5 font-light tracking-wide"
          style={{ animation: "fadeInUp 1s ease-out 0.25s both" }}
        >
          Your AI-powered visual guide
        </p>

        {/* Tap prompt */}
        <p
          className="text-white/25 text-sm mt-20 tracking-widest uppercase font-medium"
          style={{ animation: "pulse-glow 3s ease-in-out infinite" }}
        >
          Tap anywhere to begin
        </p>
      </div>

      {/* Hackathon credit */}
      <div
        className="absolute bottom-10 flex flex-col items-center gap-2"
        style={{ animation: "fadeInUp 1s ease-out 0.6s both" }}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5">
          <span className="text-white/25 text-xs tracking-wide">
            Hook &apos;Em Hacks 2026
          </span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span className="text-white/25 text-xs tracking-wide">
            Multimodal Search &amp; Generation
          </span>
        </div>
      </div>
    </div>
  );
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

  const [introState, setIntroState] = useState<
    "visible" | "dismissing" | "hidden"
  >("visible");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Initialize speech recognition once
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
      // Safari kills continuous recognition randomly — restart if still listening
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Already running
        }
      }
    };

    recognition.onerror = () => {};

    recognitionRef.current = recognition;
  }, []);

  // Unfreeze camera whenever we return to idle
  useEffect(() => {
    if (appState === "idle") {
      cameraRef.current?.unfreeze();
      setResponseText(null);
    }
  }, [appState]);

  // Dismiss intro and enter the app
  const handleIntroTap = useCallback(() => {
    if (introState !== "visible") return;

    // Unlock audio during this user gesture
    const audio = audioRef.current;
    if (audio) {
      audio.src = SILENT_WAV;
      audio.play().then(() => audio.pause()).catch(() => {});
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));

    // Start fade-out, then hide
    setIntroState("dismissing");
    setTimeout(() => setIntroState("hidden"), 500);
  }, [introState]);

  // Process the transcript: call Gemini API then play audio response
  const processRequest = useCallback(async (transcript: string) => {
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

        // Play via the pre-unlocked audio element
        const audio = audioRef.current;
        if (audio) {
          const url = URL.createObjectURL(blob);
          audio.src = url;
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
        speakFallback(data.text);
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Something went wrong";
      setResponseText(msg);
      setAppState("speaking");
      speakFallback(msg);
    }
  }, []);

  // Browser TTS fallback
  const speakFallback = useCallback((text: string | null) => {
    if (text) {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => setAppState("idle");
      u.onerror = () => setAppState("idle");
      window.speechSynthesis.speak(u);
    } else {
      setAppState("idle");
    }
  }, []);

  // Full-screen tap handler
  const handleScreenTap = useCallback(() => {
    // Unlock audio on every tap (Safari requires user gesture)
    const audio = audioRef.current;
    if (audio) {
      audio.src = SILENT_WAV;
      audio.play().then(() => audio.pause()).catch(() => {});
    }
    // Unlock SpeechSynthesis too
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));

    const isBusy = appState === "thinking" || appState === "speaking";
    if (isBusy) return;

    if (isListening) {
      // === STOP LISTENING ===
      playChime(440);
      setIsListening(false);

      // Stop recognition
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped
      }

      // Grab transcript immediately — no async callback needed
      const transcript = transcriptRef.current;
      transcriptRef.current = "";

      // Clear frame timeout if still pending
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);

      // Process the request
      processRequest(transcript);
    } else {
      // === START LISTENING ===
      playChime(1200);
      setIsListening(true);
      setAppState("listening");

      // Reset transcript
      transcriptRef.current = "";

      // Start speech recognition
      try {
        recognitionRef.current?.start();
      } catch {
        // Already started
      }

      // Capture photo 500ms after tap — freezes the camera with flash
      frameTimeoutRef.current = setTimeout(() => {
        frameRef.current = cameraRef.current?.captureAndFreeze() || null;
      }, 500);
    }
  }, [appState, isListening, processRequest]);

  return (
    <main className="fixed inset-0 bg-[#111]">
      {/* Intro screen — shown once per session */}
      {introState !== "hidden" && (
        <IntroScreen
          onStart={handleIntroTap}
          dismissing={introState === "dismissing"}
        />
      )}

      {/* Camera feed (live or frozen) */}
      <CameraFeed ref={cameraRef} />

      {/* Status indicator + response text */}
      {introState === "hidden" && (
        <StatusIndicator
          state={appState}
          isListening={isListening}
          responseText={responseText}
        />
      )}

      {/* Pre-unlocked audio element for playback */}
      <audio ref={audioRef} className="hidden" playsInline />

      {/* Full-screen tap target (only active after intro dismissed) */}
      {introState === "hidden" && (
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
                  : "Tap anywhere to start speaking your question"
          }
        />
      )}
    </main>
  );
}
