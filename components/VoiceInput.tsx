"use client";

import { useRef, useCallback, useEffect } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isDisabled: boolean;
  isListening: boolean;
  onListeningChange: (listening: boolean) => void;
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

export default function VoiceInput({
  onTranscript,
  isDisabled,
  isListening,
  onListeningChange,
}: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);

  // Keep ref in sync so callbacks always see latest value
  useEffect(() => {
    listeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Gather all results into one transcript
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        onTranscript(transcript.trim());
      }
    };

    recognition.onerror = () => {
      onListeningChange(false);
    };

    recognition.onend = () => {
      // If we're still supposed to be listening (continuous mode interrupted), restart
      // Otherwise do nothing — toggle() handles the state
    };

    recognitionRef.current = recognition;
  }, [onTranscript, onListeningChange]);

  const toggle = useCallback(() => {
    if (isDisabled || !recognitionRef.current) return;

    if (listeningRef.current) {
      // Stop listening — low chime
      playChime(440);
      recognitionRef.current.stop();
      onListeningChange(false);
    } else {
      // Start listening — high chime
      playChime(1200);
      onListeningChange(true);
      try {
        recognitionRef.current.start();
      } catch {
        // Already started
      }
    }
  }, [isDisabled, onListeningChange]);

  // Expose toggle as a click handler on the entire screen
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      // Prevent double-firing from touch + click
      if (e.type === "touchstart") {
        e.preventDefault();
      }
      toggle();
    };

    window.addEventListener("touchstart", handler, { passive: false });
    window.addEventListener("click", handler);

    return () => {
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("click", handler);
    };
  }, [toggle]);

  // This component renders no visible UI — the full screen is the tap target
  // The pulsing red dot is rendered by StatusIndicator
  return null;
}
