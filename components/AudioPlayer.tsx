"use client";

import { useEffect, useRef, useCallback } from "react";

interface AudioPlayerProps {
  audioBlob: Blob | null;
  fallbackText: string | null;
  onFinished: () => void;
}

export default function AudioPlayer({
  audioBlob,
  fallbackText,
  onFinished,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const speakFallback = useCallback(
    (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = onFinished;
      utterance.onerror = onFinished;
      window.speechSynthesis.speak(utterance);
    },
    [onFinished]
  );

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const audio = audioRef.current;
      if (audio) {
        audio.src = url;
        audio.play().catch(() => {
          // If audio play fails, try fallback
          URL.revokeObjectURL(url);
          if (fallbackText) {
            speakFallback(fallbackText);
          } else {
            onFinished();
          }
        });
      }
      return () => URL.revokeObjectURL(url);
    } else if (fallbackText) {
      speakFallback(fallbackText);
    }
  }, [audioBlob, fallbackText, onFinished, speakFallback]);

  return (
    <audio
      ref={audioRef}
      onEnded={onFinished}
      onError={onFinished}
      className="hidden"
      aria-hidden="true"
    />
  );
}
