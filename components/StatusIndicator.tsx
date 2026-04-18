"use client";

import { AppState, AppMode, SessionEntry } from "@/lib/types";

interface StatusIndicatorProps {
  state: AppState;
  mode: AppMode;
  isListening: boolean;
  responseText: string | null;
  sessionHistory: SessionEntry[];
  onReplayEntry?: (entry: SessionEntry) => void;
  onSwitchMode?: () => void;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function StatusPill({
  label,
  color,
  animate,
}: {
  label: string;
  color: string;
  animate?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-3.5 py-2 min-h-[36px]">
      <span
        className={`w-2.5 h-2.5 rounded-full ${color}`}
        style={animate ? { animation: "breathe 2s ease-in-out infinite" } : undefined}
      />
      <span className="text-[#E0E0E0] text-[13px] font-medium">{label}</span>
    </div>
  );
}

export default function StatusIndicator({
  state,
  mode,
  isListening,
  responseText,
  sessionHistory,
  onReplayEntry,
  onSwitchMode,
}: StatusIndicatorProps) {
  const modeAccent = mode === "scene" ? "#4FC3F7" : "#81C784";

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex flex-col"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex justify-between items-center px-5 pt-14">
        <span className="text-[#B0B0B0] text-[13px] font-medium">SceneSpeak</span>

        <div className="flex items-center gap-2">
          {isListening && (
            <StatusPill label="Listening" color="bg-[#EF5350]" animate />
          )}
          {state === "thinking" && (
            <StatusPill label="Analyzing" color="bg-[#FFB74D]" animate />
          )}
          {state === "speaking" && (
            <StatusPill label="Speaking" color="bg-[#66BB6A]" />
          )}
          {state === "idle" && (
            <StatusPill label="Ready" color="bg-[#808080]" />
          )}

          {/* Mode switch — 44px minimum tap target */}
          <button
            className="pointer-events-auto flex items-center justify-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full min-w-[44px] min-h-[44px] px-3.5 active:bg-white/10 transition-colors border border-[#333333]"
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
            <span style={{ color: modeAccent }} className="text-[13px] font-semibold">
              {mode === "scene" ? "Scene" : "Read"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Center prompt ───────────────────────────────── */}
      {state === "idle" && (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/[0.07] flex items-center justify-center">
              {mode === "scene" ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#B0B0B0]">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#B0B0B0]">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              )}
            </div>
            <p className="text-[#B0B0B0] text-[15px] text-center leading-relaxed">
              {mode === "scene"
                ? "Tap anywhere to ask a question"
                : "Tap anywhere to read text in view"}
            </p>
          </div>
        </div>
      )}

      {isListening && (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-[#EF5350]/15 flex items-center justify-center"
              style={{ animation: "breathe 2s ease-in-out infinite" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#EF5350]">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <p className="text-[#E0E0E0] text-[15px]">
              {mode === "scene" ? "Listening..." : "Listening — or tap again to just read"}
            </p>
            <p className="text-[#808080] text-[13px]">Tap again when done</p>
          </div>
        </div>
      )}

      {state === "thinking" && (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-[#FFB74D]/15 flex items-center justify-center"
              style={{ animation: "breathe 1.5s ease-in-out infinite" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#FFB74D]">
                {mode === "scene" ? (
                  <>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  </>
                ) : (
                  <>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </>
                )}
              </svg>
            </div>
            <p className="text-[#E0E0E0] text-[15px]">
              {mode === "scene" ? "Analyzing scene..." : "Reading text..."}
            </p>
          </div>
        </div>
      )}

      {state === "speaking" && <div className="flex-1" />}

      {/* ── Response panel ──────────────────────────────── */}
      {state === "speaking" && responseText && (
        <div className="px-5 pb-4">
          <div className="rounded-2xl bg-black/70 backdrop-blur-md border border-[#333333] p-5 max-w-lg mx-auto">
            <p className="text-[#E0E0E0] text-[15px] leading-relaxed">
              {responseText}
            </p>
          </div>
        </div>
      )}

      {/* ── Session history ─────────────────────────────── */}
      {sessionHistory.length > 0 && state !== "speaking" && (
        <div className="px-5 pb-8">
          <div className="rounded-2xl bg-black/50 backdrop-blur-md border border-[#333333] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#B0B0B0] text-[13px] font-medium">
                Session history
              </span>
              <span className="text-[#808080] text-[13px]">
                {sessionHistory.length}{" "}
                {sessionHistory.length === 1 ? "scene" : "scenes"}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pointer-events-auto">
              {sessionHistory.map((entry) => (
                <button
                  key={entry.id}
                  className="flex-shrink-0 text-center min-w-[44px] min-h-[44px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplayEntry?.(entry);
                  }}
                  aria-label={`Replay response for: ${entry.question}`}
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#333333] active:border-[#555555] transition-colors">
                    <img
                      src={`data:image/jpeg;base64,${entry.thumbnail}`}
                      alt={entry.question}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[#808080] text-[11px] mt-1.5 w-16 truncate">
                    {formatTime(entry.timestamp)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {sessionHistory.length === 0 && state !== "speaking" && (
        <div className="pb-10" />
      )}
    </div>
  );
}
