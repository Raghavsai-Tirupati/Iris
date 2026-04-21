"use client";

import { AppState, AppMode } from "@/lib/types";

interface StatusIndicatorProps {
  state: AppState;
  mode: AppMode;
  isListening: boolean;
  responseText: string | null;
  onSwitchMode?: () => void;
}

export default function StatusIndicator({
  state,
  mode,
  isListening,
  responseText,
  onSwitchMode,
}: StatusIndicatorProps) {
  const modeAccent = mode === "scene" ? "#4FC3F7" : "#81C784";
  const modeLabel = mode === "scene" ? "Scene" : "Read";

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex flex-col"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* ── Top black bar ──────────────────────────────── */}
      <div className="bg-black px-5 pt-12 pb-3 flex items-center justify-between">
        {/* Left — branding */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/iris-logo.png" alt="" width={22} height={22} style={{ opacity: 0.85 }} />
            <span className="text-white text-[18px] tracking-tight" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
              Iris
            </span>
          </div>
          <span className="text-[#444] text-[12px]">/</span>
          <span style={{ color: modeAccent }} className="text-[12px] font-semibold uppercase tracking-wider">
            {modeLabel} Mode
          </span>
        </div>

        {/* Right — status + toggle */}
        <div className="flex items-center gap-2">
          {/* Status pill */}
          {isListening && (
            <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-3 py-1.5">
              <span
                className="w-2 h-2 rounded-full bg-[#EF5350]"
                style={{ animation: "breathe 2s ease-in-out infinite" }}
              />
              <span className="text-[#E0E0E0] text-[11px] font-medium">Listening</span>
            </div>
          )}
          {state === "thinking" && (
            <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-3 py-1.5">
              <span
                className="w-2 h-2 rounded-full bg-[#FFB74D]"
                style={{ animation: "breathe 1.5s ease-in-out infinite" }}
              />
              <span className="text-[#E0E0E0] text-[11px] font-medium">Analyzing</span>
            </div>
          )}
          {state === "speaking" && (
            <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-3 py-1.5">
              <span
                className="w-2 h-2 rounded-full bg-[#66BB6A]"
                style={{ animation: "breathe 2s ease-in-out infinite" }}
              />
              <span className="text-[#E0E0E0] text-[11px] font-medium">Speaking</span>
            </div>
          )}

          {/* Mode toggle */}
          <button
            className="pointer-events-auto flex items-center justify-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full min-w-[44px] min-h-[44px] px-3 active:bg-[#252525] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onSwitchMode?.();
            }}
            aria-label={`Switch to ${mode === "scene" ? "Read" : "Scene"} mode`}
          >
            {mode === "scene" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4FC3F7]">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#81C784]">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Left/right black borders ───────────────────── */}
      <div className="flex-1 relative flex">
        <div className="w-3 bg-black" />
        <div className="flex-1" />
        <div className="w-3 bg-black" />
      </div>

      {/* ── Bottom black bar ───────────────────────────── */}
      <div className="bg-black px-5 pt-3 pb-6">
        {/* Response panel — persists until next tap */}
        {responseText && (
          <div className="rounded-2xl bg-[#111] border border-[#222] p-4 max-w-lg mx-auto mb-3">
            <p className="text-[#E0E0E0] text-[14px] leading-relaxed">
              {responseText}
            </p>
          </div>
        )}

        {/* Bottom info row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: state === "idle" ? "#555" : modeAccent,
                boxShadow: state !== "idle" ? `0 0 8px ${modeAccent}40` : "none",
              }}
            />
            <span className="text-[#666] text-[11px]">
              {state === "idle"
                ? "Tap to describe"
                : state === "listening"
                  ? "Listening..."
                  : state === "thinking"
                    ? "Processing..."
                    : "Playing response"}
            </span>
          </div>
          <span className="text-[#333] text-[10px] uppercase tracking-widest">
            Live
          </span>
        </div>
      </div>
    </div>
  );
}
