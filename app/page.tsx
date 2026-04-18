"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import StatusIndicator from "@/components/StatusIndicator";
import { AppState, Message } from "@/lib/types";

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
      className="fixed inset-0 z-50 cursor-pointer"
      style={{
        background: "#0a0a0a",
        animation: dismissing ? "fadeOut 0.4s ease-out forwards" : undefined,
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
      {/* Border frame */}
      <div className="absolute inset-4 border border-white/[0.08]" />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
        <h1
          className="font-[family-name:var(--font-pixel)] text-white text-2xl sm:text-3xl text-center leading-relaxed"
          style={{ animation: "fadeInUp 0.6s ease-out" }}
        >
          SCENESPEAK
        </h1>

        <p
          className="text-white/40 text-sm mt-6 tracking-widest uppercase"
          style={{ animation: "fadeInUp 0.6s ease-out 0.1s both" }}
        >
          AI-powered visual guide
        </p>

        <div
          className="mt-16 flex items-center gap-2"
          style={{ animation: "fadeInUp 0.6s ease-out 0.2s both" }}
        >
          <span className="font-[family-name:var(--font-pixel)] text-white/20 text-[10px]">
            [
          </span>
          <span className="font-[family-name:var(--font-pixel)] text-white/30 text-[10px] tracking-wider">
            TAP TO BEGIN
          </span>
          <span
            className="font-[family-name:var(--font-pixel)] text-white/30 text-[10px]"
            style={{ animation: "blink 1s step-end infinite" }}
          >
            _
          </span>
          <span className="font-[family-name:var(--font-pixel)] text-white/20 text-[10px]">
            ]
          </span>
        </div>
      </div>

      {/* Bottom info */}
      <div
        className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-1"
        style={{ animation: "fadeInUp 0.6s ease-out 0.4s both" }}
      >
        <p className="text-white/15 text-[10px] font-[family-name:var(--font-pixel)] tracking-wide">
          HOOK &apos;EM HACKS 2026
        </p>
        <p className="text-white/10 text-[9px] tracking-widest uppercase">
          Multimodal Search &amp; Generation
        </p>
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

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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

  useEffect(() => {
    if (appState === "idle") {
      cameraRef.current?.unfreeze();
      setResponseText(null);
    }
  }, [appState]);

  const handleIntroTap = useCallback(() => {
    if (introState !== "visible") return;
    const audio = audioRef.current;
    if (audio) {
      audio.src = SILENT_WAV;
      audio.play().then(() => audio.pause()).catch(() => {});
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    setIntroState("dismissing");
    setTimeout(() => setIntroState("hidden"), 400);
  }, [introState]);

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
  }, [speakFallback]);

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
      playChime(440);
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped
      }
      const transcript = transcriptRef.current;
      transcriptRef.current = "";
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      processRequest(transcript);
    } else {
      playChime(1200);
      setIsListening(true);
      setAppState("listening");
      transcriptRef.current = "";
      try {
        recognitionRef.current?.start();
      } catch {
        // Already started
      }
      frameTimeoutRef.current = setTimeout(() => {
        frameRef.current = cameraRef.current?.captureAndFreeze() || null;
      }, 500);
    }
  }, [appState, isListening, processRequest]);

  return (
    <main className="fixed inset-0 bg-[#0a0a0a]">
      {introState !== "hidden" && (
        <IntroScreen
          onStart={handleIntroTap}
          dismissing={introState === "dismissing"}
        />
      )}

      <CameraFeed ref={cameraRef} />

      {introState === "hidden" && (
        <StatusIndicator
          state={appState}
          isListening={isListening}
          responseText={responseText}
        />
      )}

      <audio ref={audioRef} className="hidden" playsInline />

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
