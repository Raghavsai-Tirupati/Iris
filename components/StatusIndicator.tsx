"use client";

import { AppState } from "@/lib/types";

interface StatusIndicatorProps {
  state: AppState;
}

const stateLabels: Record<AppState, string> = {
  idle: "Hold the button and speak",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

export default function StatusIndicator({ state }: StatusIndicatorProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-12 px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="bg-black/70 backdrop-blur-sm rounded-full px-6 py-3">
        <p className="text-white text-xl font-medium text-center">
          {stateLabels[state]}
        </p>
      </div>
    </div>
  );
}
