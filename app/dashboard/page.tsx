"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

interface Hazard {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  timestamp: number;
}

const HazardMap = dynamic(() => import("./HazardMap"), { ssr: false });

export default function DashboardPage() {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hazard")
      .then((r) => r.json())
      .then((data) => {
        setHazards(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-[#222] px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-[28px] sm:text-[34px]">
              SceneSpeak — Hazard Dashboard
            </h1>
            <p className="text-[#808080] text-[14px] mt-1">
              For city planners &amp; university accessibility offices
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#4FC3F7] text-[24px] font-semibold">
              {hazards.length}
            </p>
            <p className="text-[#808080] text-[12px] uppercase tracking-wider">
              Reports
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-[#808080] text-[15px]">Loading hazard data...</p>
          </div>
        ) : hazards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
            <p className="text-[#808080] text-[15px]">No hazards reported yet.</p>
            <p className="text-[#555] text-[13px]">
              Hazards are automatically detected when users scan their environment with SceneSpeak.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl overflow-hidden border border-[#222] h-[500px] sm:h-[600px]">
              <HazardMap hazards={hazards} />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto hide-scrollbar">
              <h2 className="text-[#B0B0B0] text-[13px] font-medium uppercase tracking-wider mb-2">
                Recent Reports
              </h2>
              {[...hazards].reverse().map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg bg-[#111] border border-[#222] p-4"
                >
                  <p className="text-[#E0E0E0] text-[14px] leading-relaxed">
                    {h.description}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-[12px] text-[#666]">
                    <span>
                      {new Date(h.timestamp).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>
                      {h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#222] px-6 py-4 mt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[12px] text-[#555]">
          <span>SceneSpeak &bull; Hook &apos;Em Hacks 2026</span>
          <span>Data collected anonymously via AI-assisted hazard detection</span>
        </div>
      </footer>
    </div>
  );
}
