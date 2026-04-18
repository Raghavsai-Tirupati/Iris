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
  useEffect(() => {
    let cancelled = false;

    const doSpeak = () => {
      if (cancelled) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        "Welcome to SceneSpeak. Choose a mode to begin."
      );
      u.rate = 1.8;
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
    };
  }, []);

  const unlockAudio = () => {
    const a = document.createElement("audio");
    a.src = SILENT_WAV;
    a.play().then(() => a.pause()).catch(() => {});
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "#111",
        animation: dismissing ? "fadeOut 0.4s ease-out forwards" : undefined,
      }}
    >
      <div className="flex-1 min-h-0" />

      {/* Logo */}
      <div
        className="flex flex-col items-center px-8"
        style={{ animation: "fadeInUp 0.5s ease-out" }}
      >
        <h1 className="text-white text-[32px] font-semibold tracking-tight">
          SceneSpeak
        </h1>
        <p className="text-white/40 text-[15px] mt-2">
          Your AI-powered visual guide
        </p>
      </div>

      {/* Mode buttons */}
      <div
        className="flex flex-col gap-3 px-8 mt-12"
        style={{ animation: "fadeInUp 0.5s ease-out 0.1s both" }}
      >
        {/* Scene Mode */}
        <button
          className="w-full rounded-2xl border border-white/[0.15] bg-white/[0.04] p-5 text-left active:bg-white/[0.08] transition-colors"
          onClick={() => {
            unlockAudio();
            onSelectMode("scene");
          }}
          aria-label="Scene Mode: Tap to ask questions about what the camera sees"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl border border-white/[0.12] bg-white/[0.04] flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-white text-[16px] font-medium">Scene Mode</p>
              <p className="text-white/35 text-[13px] mt-0.5">
                Ask about what you see
              </p>
            </div>
          </div>
        </button>

        {/* Read Mode */}
        <button
          className="w-full rounded-2xl border border-white/[0.15] bg-white/[0.04] p-5 text-left active:bg-white/[0.08] transition-colors"
          onClick={() => {
            unlockAudio();
            onSelectMode("read");
          }}
          aria-label="Read Mode: Read any text the camera sees"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl border border-white/[0.12] bg-white/[0.04] flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <p className="text-white text-[16px] font-medium">Read Mode</p>
              <p className="text-white/35 text-[13px] mt-0.5">
                Read text from signs, menus, documents
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex-1 min-h-0" />

      {/* Bottom */}
      <div
        className="flex flex-col items-center pb-8"
        style={{ animation: "fadeInUp 0.5s ease-out 0.2s both" }}
      >
        <p className="text-white/20 text-[11px]">
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
