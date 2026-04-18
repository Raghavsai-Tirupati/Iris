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

export default function Home() {
  const cameraRef = useRef<CameraFeedHandle>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<string | null>(null);
  const frameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const isListeningRef = useRef(false);
  const historyRef = useRef<Message[]>([]);

  const [appState, setAppState] = useState<AppState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Welcome message on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      const u = new SpeechSynthesisUtterance(
        "Welcome to SceneSpeak. Tap anywhere to ask a question."
      );
      window.speechSynthesis.speak(u);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
      {/* Camera feed (live or frozen) */}
      <CameraFeed ref={cameraRef} />

      {/* Status indicator + response text */}
      <StatusIndicator
        state={appState}
        isListening={isListening}
        responseText={responseText}
      />

      {/* Pre-unlocked audio element for playback */}
      <audio ref={audioRef} className="hidden" playsInline />

      {/* Full-screen tap target */}
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
    </main>
  );
}
