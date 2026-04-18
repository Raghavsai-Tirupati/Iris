"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import VoiceInput from "@/components/VoiceInput";
import AudioPlayer from "@/components/AudioPlayer";
import StatusIndicator from "@/components/StatusIndicator";
import { AppState, Message } from "@/lib/types";

export default function Home() {
  const cameraRef = useRef<CameraFeedHandle>(null);
  const [appState, setAppState] = useState<AppState>("idle");
  const [history, setHistory] = useState<Message[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Welcome message on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(
        "Welcome to SceneSpeak. Tap anywhere to ask a question."
      );
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setAppState("thinking");

      // Capture current frame
      const imageBase64 = cameraRef.current?.captureFrame();
      if (!imageBase64) {
        setAppState("idle");
        return;
      }

      // Add user message to history
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
          const responseText = decodeURIComponent(
            response.headers.get("X-Response-Text") || ""
          );
          setHistory([
            ...newHistory,
            { role: "assistant", content: responseText },
          ]);
          setAudioBlob(blob);
          setFallbackText(responseText || null);
          setAppState("speaking");
        } else {
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }
          setHistory([
            ...newHistory,
            { role: "assistant", content: data.text },
          ]);
          setAudioBlob(null);
          setFallbackText(data.text);
          setAppState("speaking");
        }
      } catch (error) {
        console.error("Request failed:", error);
        setAudioBlob(null);
        setFallbackText("Sorry, something went wrong. Please try again.");
        setAppState("speaking");
      }
    },
    [history]
  );

  const handleAudioFinished = useCallback(() => {
    setAudioBlob(null);
    setFallbackText(null);
    setAppState("idle");
  }, []);

  const handleListeningChange = useCallback((listening: boolean) => {
    setIsListening(listening);
    if (listening) {
      setAppState("listening");
    }
  }, []);

  const isBusy = appState === "thinking" || appState === "speaking";

  return (
    <main className="fixed inset-0 bg-[#111]">
      {/* Camera background */}
      <CameraFeed ref={cameraRef} />

      {/* Status indicator with pulsing red dot */}
      <StatusIndicator state={appState} isListening={isListening} />

      {/* Audio player */}
      <AudioPlayer
        audioBlob={audioBlob}
        fallbackText={appState === "speaking" ? fallbackText : null}
        onFinished={handleAudioFinished}
      />

      {/* Voice input — registers full-screen tap handler */}
      <VoiceInput
        onTranscript={handleTranscript}
        isDisabled={isBusy}
        isListening={isListening}
        onListeningChange={handleListeningChange}
      />
    </main>
  );
}
