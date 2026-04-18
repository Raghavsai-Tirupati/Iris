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
      {/* Top status bar */}
      <div className="flex justify-between items-center px-5 pt-14">
        <span className="font-[family-name:var(--font-pixel)] text-white/30 text-[9px]">
          SCENESPEAK
        </span>

        <div className="flex items-center gap-2">
          {/* Recording dot */}
          {isListening && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-red-500"
              style={{ animation: "blink 1s step-end infinite" }}
            />
          )}
          {state === "thinking" && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              style={{ animation: "blink 0.6s step-end infinite" }}
            />
          )}
          {state === "speaking" && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}

          <span className="font-[family-name:var(--font-pixel)] text-white/40 text-[9px] uppercase">
            {state === "idle" && "READY"}
            {state === "listening" && "REC"}
            {state === "thinking" && "WAIT"}
            {state === "speaking" && "PLAY"}
          </span>
        </div>
      </div>

      {/* Center message for idle state */}
      {state === "idle" && (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-[family-name:var(--font-pixel)] text-white/15 text-[10px] tracking-wider">
            TAP ANYWHERE
          </p>
        </div>
      )}

      {/* Listening indicator */}
      {isListening && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full bg-red-500"
              style={{ animation: "blink 1s step-end infinite" }}
            />
            <span className="font-[family-name:var(--font-pixel)] text-white/40 text-[10px]">
              LISTENING
            </span>
          </div>
        </div>
      )}

      {/* Thinking indicator */}
      {state === "thinking" && (
        <div className="flex-1 flex items-center justify-center">
          <span className="font-[family-name:var(--font-pixel)] text-white/30 text-[10px]">
            ANALYZING
            <span style={{ animation: "blink 0.5s step-end infinite" }}>_</span>
          </span>
        </div>
      )}

      {/* Spacer for speaking state */}
      {state === "speaking" && <div className="flex-1" />}

      {/* Response text at bottom */}
      {state === "speaking" && responseText && (
        <div className="px-5 pb-14">
          <div className="border border-white/[0.08] bg-black/60 p-4 max-w-lg mx-auto">
            <p className="text-white/70 text-sm leading-relaxed">
              {responseText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
