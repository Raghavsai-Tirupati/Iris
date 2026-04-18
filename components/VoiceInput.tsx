"use client";

import { useRef, useCallback, useEffect } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isDisabled: boolean;
  isListening: boolean;
  onListeningChange: (listening: boolean) => void;
}

export default function VoiceInput({
  onTranscript,
  isDisabled,
  isListening,
  onListeningChange,
}: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onListeningChange(false);
      onTranscript(transcript);
    };

    recognition.onerror = () => {
      onListeningChange(false);
    };

    recognition.onend = () => {
      onListeningChange(false);
    };

    recognitionRef.current = recognition;
  }, [onTranscript, onListeningChange]);

  const startListening = useCallback(() => {
    if (isDisabled || !recognitionRef.current) return;
    try {
      onListeningChange(true);
      recognitionRef.current.start();
    } catch {
      // Already started
    }
  }, [isDisabled, onListeningChange]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Already stopped
    }
  }, []);

  const handlePointerDown = () => {
    startListening();
  };

  const handlePointerUp = () => {
    stopListening();
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={isDisabled}
      autoFocus
      aria-label={
        isListening
          ? "Listening... Release to send"
          : isDisabled
            ? "Processing your request"
            : "Hold to speak your question"
      }
      className={`
        relative w-24 h-24 rounded-full border-4 transition-all duration-200
        flex items-center justify-center
        focus:outline-none focus:ring-4 focus:ring-white/50
        ${
          isDisabled
            ? "bg-gray-600 border-gray-500 cursor-not-allowed opacity-50"
            : isListening
              ? "bg-red-500 border-red-300 scale-110"
              : "bg-white/20 border-white/60 hover:bg-white/30 active:scale-95"
        }
      `}
    >
      {/* Pulsing ring when listening */}
      {isListening && (
        <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
      )}

      {/* Mic icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-10 h-10 text-white"
        aria-hidden="true"
      >
        <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
        <path d="M6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
      </svg>
    </button>
  );
}
