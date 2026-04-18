"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import StatusIndicator from "@/components/StatusIndicator";
import { AppState, AppMode, Message, SessionEntry } from "@/lib/types";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function speakText(text: string, rate = 1.8) {
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

// ─── Intro Screen ───────────────────────────────────────────────────────────

function IntroScreen({
  onSelectMode,
  dismissing,
}: {
  onSelectMode: (mode: AppMode) => void;
  dismissing: boolean;
}) {
  const selectedRef = useRef(false);
  const [voiceListening, setVoiceListening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let recognition: SpeechRecognition | null = null;

    const startListening = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;

      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (selectedRef.current || cancelled) return;
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }
        const lower = transcript.toLowerCase();
        if (lower.includes("scene")) {
          selectedRef.current = true;
          try { recognition?.stop(); } catch { /* */ }
          onSelectMode("scene");
        } else if (lower.includes("read")) {
          selectedRef.current = true;
          try { recognition?.stop(); } catch { /* */ }
          onSelectMode("read");
        }
      };

      recognition.onend = () => {
        if (!cancelled && !selectedRef.current) {
          try { recognition?.start(); } catch { /* */ }
        }
      };

      recognition.onerror = () => {};

      try {
        recognition.start();
        setVoiceListening(true);
      } catch { /* */ }
    };

    const doSpeak = () => {
      if (cancelled) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        "Welcome to SceneSpeak. Say scene mode or read mode to begin. You can also tap the screen."
      );
      u.rate = 1.8;
      u.onend = () => {
        if (!cancelled && !selectedRef.current) startListening();
      };
      window.speechSynthesis.speak(u);
    };

    const timer = setTimeout(() => {
      if (window.speechSynthesis.getVoices().length > 0) {
        doSpeak();
      } else {
        window.speechSynthesis.addEventListener("voiceschanged", doSpeak, {
          once: true,
        });
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", doSpeak);
      window.speechSynthesis.cancel();
      try { recognition?.stop(); } catch { /* */ }
    };
  }, [onSelectMode]);

  const unlockAudio = () => {
    const a = document.createElement("audio");
    a.src = SILENT_WAV;
    a.play().then(() => a.pause()).catch(() => {});
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background: "#000000",
        animation: dismissing ? "fadeOut 0.4s ease-out forwards" : undefined,
      }}
    >
      {/* ── Text content — left aligned, editorial ────── */}
      <div className="relative z-10 flex flex-col px-8 pt-20 sm:pt-28">
        <h1
          className="font-[family-name:var(--font-serif)] text-white text-[42px] sm:text-[52px] leading-[1.1] tracking-tight"
          style={{ animation: "fadeInUp 0.5s ease-out" }}
        >
          SceneSpeak
        </h1>

        <p
          className="text-white text-[22px] sm:text-[26px] leading-snug mt-4 max-w-[320px]"
          style={{ animation: "fadeInUp 0.5s ease-out 0.05s both" }}
        >
          AI-powered visual guide for the world around you
        </p>

        <p
          className="text-[#808080] text-[12px] tracking-[0.2em] uppercase mt-6"
          style={{ animation: "fadeInUp 0.5s ease-out 0.1s both" }}
        >
          Your eyes, amplified
        </p>
      </div>

      {/* ── Mode options — typography only ──────────── */}
      <div
        className="relative z-10 flex flex-col px-8 mt-12"
        style={{ animation: "fadeInUp 0.5s ease-out 0.15s both" }}
      >
        <div className="w-full h-px bg-[#222222]" />

        <button
          className="w-full py-6 text-left active:opacity-60 transition-opacity min-h-[44px]"
          onClick={() => {
            unlockAudio();
            onSelectMode("scene");
          }}
          aria-label="Scene Mode: Tap to ask questions about what the camera sees"
        >
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-white text-[24px] sm:text-[28px] font-medium">
                <span className="text-[#4FC3F7]">01</span>
                <span className="ml-4">Scene Mode</span>
              </p>
              <p className="text-[#666666] text-[14px] mt-1 ml-[52px]">
                Ask about what you see
              </p>
            </div>
            <span className="text-[#333333] text-[24px] font-light">&rarr;</span>
          </div>
        </button>

        <div className="w-full h-px bg-[#222222]" />

        <button
          className="w-full py-6 text-left active:opacity-60 transition-opacity min-h-[44px]"
          onClick={() => {
            unlockAudio();
            onSelectMode("read");
          }}
          aria-label="Read Mode: Read any text the camera sees"
        >
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-white text-[24px] sm:text-[28px] font-medium">
                <span className="text-[#81C784]">02</span>
                <span className="ml-4">Read Mode</span>
              </p>
              <p className="text-[#666666] text-[14px] mt-1 ml-[52px]">
                Read signs, menus, documents
              </p>
            </div>
            <span className="text-[#333333] text-[24px] font-light">&rarr;</span>
          </div>
        </button>

        <div className="w-full h-px bg-[#222222]" />

        {/* Voice listening indicator */}
        {voiceListening && (
          <div className="flex items-center gap-2 mt-5">
            <span
              className="w-2 h-2 rounded-full bg-[#EF5350]"
              style={{ animation: "breathe 2s ease-in-out infinite" }}
            />
            <span className="text-[#666666] text-[13px]">
              Listening — say &quot;scene mode&quot; or &quot;read mode&quot;
            </span>
          </div>
        )}
      </div>

      {/* ── Geometric shapes — decorative ─────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Green semicircle */}
        <div
          className="absolute rounded-full"
          style={{
            width: 220,
            height: 220,
            background: "#4ADE80",
            bottom: -60,
            left: "15%",
          }}
        />
        {/* Pink diagonal bars */}
        <div className="absolute" style={{ bottom: 80, left: -20, transform: "rotate(-35deg)" }}>
          <div className="w-[140px] h-[8px] bg-[#F472B6] rounded-full mb-3" />
          <div className="w-[100px] h-[8px] bg-[#F472B6] rounded-full mb-3" />
          <div className="w-[120px] h-[8px] bg-[#F472B6] rounded-full" />
        </div>
        {/* Yellow rectangle */}
        <div
          className="absolute rounded-lg"
          style={{
            width: 50,
            height: 100,
            background: "#FACC15",
            bottom: 40,
            right: "35%",
          }}
        >
          <div className="w-5 h-5 rounded-full bg-black mt-5 mx-auto" />
        </div>
        {/* Cyan bar */}
        <div
          className="absolute rounded-sm"
          style={{
            width: 14,
            height: 120,
            background: "#22D3EE",
            bottom: 20,
            right: "22%",
          }}
        />
        {/* Magenta triangle */}
        <div
          className="absolute"
          style={{
            width: 0,
            height: 0,
            borderLeft: "35px solid transparent",
            borderRight: "35px solid transparent",
            borderBottom: "60px solid #E879F9",
            bottom: 100,
            right: "12%",
            transform: "rotate(30deg)",
          }}
        />
        {/* Blue arch */}
        <div
          className="absolute rounded-t-full"
          style={{
            width: 100,
            height: 50,
            border: "18px solid #60A5FA",
            borderBottom: "none",
            background: "transparent",
            bottom: -5,
            right: -10,
          }}
        />
        {/* Small blue circle */}
        <div
          className="absolute rounded-full"
          style={{
            width: 30,
            height: 30,
            background: "#60A5FA",
            bottom: 110,
            left: "30%",
          }}
        />
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="flex-1 min-h-0" />
      <div
        className="relative z-10 flex flex-col items-start px-8 pb-8"
        style={{ animation: "fadeInUp 0.5s ease-out 0.2s both" }}
      >
        <p className="text-[#555555] text-[12px] tracking-[0.15em] uppercase">
          Hook &apos;Em Hacks 2026 &bull; UT Austin
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
  const sessionIdRef = useRef(0);
  const modeRef = useRef<AppMode>("scene");

  const [screen, setScreen] = useState<"intro" | "dismissing" | "camera">("intro");
  const [mode, setMode] = useState<AppMode>("scene");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>([]);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

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

  // ── Mode selection from intro ─────────────────────────
  const handleSelectMode = useCallback(
    (selectedMode: AppMode) => {
      if (screen !== "intro") return;
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
    [screen]
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
      u.rate = 1.8;
      u.onend = () => setAppState("idle");
      u.onerror = () => setAppState("idle");
      window.speechSynthesis.speak(u);
    } else {
      setAppState("idle");
    }
  }, []);

  // ── Replay entry ──────────────────────────────────────
  const replayEntry = useCallback(
    (entry: SessionEntry) => {
      if (appState === "thinking" || appState === "speaking") return;
      window.speechSynthesis.cancel();
      setResponseText(entry.answer);
      setAppState("speaking");
      const u = new SpeechSynthesisUtterance(entry.answer);
      u.rate = 1.8;
      u.onend = () => setAppState("idle");
      u.onerror = () => setAppState("idle");
      window.speechSynthesis.speak(u);
    },
    [appState]
  );

  // ── Add session entry ─────────────────────────────────
  const addSessionEntry = useCallback(
    (thumbnail: string, question: string, answer: string) => {
      setSessionHistory((prev) => [
        ...prev,
        {
          id: ++sessionIdRef.current,
          thumbnail,
          question,
          answer,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  // ── Process request ───────────────────────────────────
  const processRequest = useCallback(
    async (transcript: string) => {
      const currentMode = modeRef.current;

      // In read mode, allow empty transcript (user just double-taps to read)
      if (!transcript && currentMode === "read") {
        transcript = "Read all visible text.";
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
        u.rate = 1.8;
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
          addSessionEntry(imageBase64, transcript, text);

          const audio = audioRef.current;
          if (audio) {
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.playbackRate = 1.4;
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
          addSessionEntry(imageBase64, transcript, data.text);
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
    [speakFallback, addSessionEntry]
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
      playChime(440);
      setIsListening(false);
      try { recognitionRef.current?.stop(); } catch { /* */ }
      const transcript = transcriptRef.current;
      transcriptRef.current = "";
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      processRequest(transcript);
    } else {
      playChime(1200);
      setIsListening(true);
      setAppState("listening");
      transcriptRef.current = "";
      try { recognitionRef.current?.start(); } catch { /* */ }
      frameTimeoutRef.current = setTimeout(() => {
        frameRef.current = cameraRef.current?.captureAndFreeze() || null;
      }, 500);
    }
  }, [appState, isListening, processRequest]);

  return (
    <main className="fixed inset-0 bg-[#0a0a0a]">
      {screen !== "camera" && (
        <IntroScreen
          onSelectMode={handleSelectMode}
          dismissing={screen === "dismissing"}
        />
      )}

      <CameraFeed ref={cameraRef} />

      {screen === "camera" && (
        <StatusIndicator
          state={appState}
          mode={mode}
          isListening={isListening}
          responseText={responseText}
          sessionHistory={sessionHistory}
          onReplayEntry={replayEntry}
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
