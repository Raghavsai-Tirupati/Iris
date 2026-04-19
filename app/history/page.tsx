"use client";

import { useEffect, useState } from "react";

interface HistoryEntry {
  id: string;
  timestamp: number;
  transcript: string;
  response: string;
  mode: string;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-[#1a1a1a] px-6 py-5 bg-[#0d0d0d]">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-[family-name:var(--font-serif)] text-[26px] sm:text-[32px] tracking-tight">
            SceneSpeak
            <span className="text-[#555] font-normal ml-2">/ Activity Log</span>
          </h1>
          <p className="text-[#666] text-[13px] mt-1">
            Caregiver View — review what the user asked and heard
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-10 h-10 rounded-full border-2 border-[#333] border-t-[#4FC3F7]"
                style={{ animation: "spin 1s linear infinite" }}
              />
              <p className="text-[#666] text-[14px]">Loading activity log...</p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="w-16 h-16 rounded-full bg-[#111] border border-[#222] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <p className="text-[#808080] text-[16px]">No activity yet</p>
            <p className="text-[#555] text-[13px] text-center max-w-sm leading-relaxed">
              Interactions will appear here as the user asks questions with SceneSpeak.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[#555] text-[12px]">
              {entries.length} interaction{entries.length !== 1 ? "s" : ""} recorded
            </p>
            {[...entries].reverse().map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl bg-[#111] border border-[#1a1a1a] p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      background: entry.mode === "scene" ? "rgba(79,195,247,0.12)" : "rgba(129,199,132,0.12)",
                      color: entry.mode === "scene" ? "#4FC3F7" : "#81C784",
                    }}
                  >
                    {entry.mode}
                  </span>
                  <span className="text-[#555] text-[12px]">
                    {new Date(entry.timestamp).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider mb-1">
                      User asked
                    </p>
                    <p className="text-[#ccc] text-[14px] leading-relaxed">
                      {entry.transcript}
                    </p>
                  </div>
                  <div className="w-full h-px bg-[#1a1a1a]" />
                  <div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider mb-1">
                      SceneSpeak said
                    </p>
                    <p className="text-[#E0E0E0] text-[14px] leading-relaxed">
                      {entry.response}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-[#1a1a1a] px-6 py-4 mt-8">
        <div className="max-w-3xl mx-auto text-[12px] text-[#444]">
          SceneSpeak &bull; Hook &apos;Em Hacks 2026
        </div>
      </footer>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
