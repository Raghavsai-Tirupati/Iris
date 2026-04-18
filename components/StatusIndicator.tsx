"use client";

import { AppState } from "@/lib/types";

interface StatusIndicatorProps {
  state: AppState;
  isListening: boolean;
  responseText: string | null;
}

export default function StatusIndicator({
  state,
  isListening,
  responseText,
}: StatusIndicatorProps) {
  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex flex-col"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Top status pill */}
      <div className="flex justify-center pt-14 px-4">
        <div
          className="flex items-center gap-2.5 rounded-full px-5 py-2.5 border border-white/10"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          {/* State dot */}
          <span
            className={`w-2 h-2 rounded-full ${
              state === "idle"
                ? "bg-white/50"
                : state === "listening"
                  ? "bg-red-400"
                  : state === "thinking"
                    ? "bg-amber-400"
                    : "bg-emerald-400"
            }`}
          >
            {(state === "listening" || state === "thinking") && (
              <span
                className={`absolute w-2 h-2 rounded-full ${
                  state === "listening" ? "bg-red-400" : "bg-amber-400"
                }`}
                style={{ animation: "breathe 1.5s ease-in-out infinite" }}
              />
            )}
          </span>

          <p className="text-white/90 text-sm font-medium tracking-wide">
            {state === "idle" && "Tap anywhere to ask"}
            {state === "listening" && "Listening"}
            {state === "thinking" && "Analyzing"}
            {state === "speaking" && "Speaking"}
          </p>

          {/* Animated dots for loading states */}
          {(state === "thinking" || state === "listening") && (
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-white/70"
                  style={{
                    animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Recording indicator */}
      {isListening && (
        <div className="flex justify-center mt-4">
          <div className="relative flex items-center justify-center">
            <span
              className="absolute w-8 h-8 rounded-full border-2 border-red-400/60"
              style={{ animation: "breathe 2s ease-in-out infinite" }}
            />
            <span
              className="absolute w-5 h-5 rounded-full border border-red-400/40"
              style={{
                animation: "breathe 2s ease-in-out 0.3s infinite",
              }}
            />
            <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Response text card at bottom */}
      {state === "speaking" && responseText && (
        <div className="px-5 pb-14" style={{ animation: "slideUp 0.4s ease-out" }}>
          <div
            className="rounded-2xl px-5 py-4 border border-white/10 max-w-lg mx-auto"
            style={{
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div className="flex items-start gap-3">
              {/* Accent bar */}
              <div className="w-0.5 self-stretch rounded-full bg-gradient-to-b from-indigo-400 to-purple-500 flex-shrink-0 mt-1" />
              <p className="text-white/90 text-base leading-relaxed">
                {responseText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom vignette gradient for readability */}
      {state === "idle" && (
        <div className="px-5 pb-12">
          <p
            className="text-white/30 text-xs text-center tracking-widest uppercase"
            style={{ animation: "pulse-glow 3s ease-in-out infinite" }}
          >
            Tap to speak
          </p>
        </div>
      )}
    </div>
  );
}
