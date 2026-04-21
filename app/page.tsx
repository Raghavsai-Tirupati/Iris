"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import CameraFeed, { CameraFeedHandle } from "@/components/CameraFeed";
import StatusIndicator from "@/components/StatusIndicator";
import { AppState, AppMode } from "@/lib/types";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const SVG_NS = "http://www.w3.org/2000/svg";

function speakText(text: string, rate = 1.0) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  window.speechSynthesis.speak(u);
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

// ─── Main App ───────────────────────────────────────────────────────────────

export default function Home() {
  const cameraRef = useRef<CameraFeedHandle>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const isListeningRef = useRef(false);
  const modeRef = useRef<AppMode>("scene");
  const audioUnlockedRef = useRef(false);
  const upperLashesRef = useRef<SVGGElement>(null);
  const lowerLashesRef = useRef<SVGGElement>(null);
  const irisFibersRef = useRef<SVGGElement>(null);
  const irisLookRef = useRef<SVGGElement>(null);

  const [screen, setScreen] = useState<"landing" | "dismissing" | "camera">("landing");
  const [mode, setMode] = useState<AppMode>("scene");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Procedural lash + iris fiber generation ───────────
  useEffect(() => {
    const upperG = upperLashesRef.current;
    if (upperG) {
      const samples: { x: number; y: number; t: number }[] = [];
      const steps = 52;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        samples.push({ x: 60 + 340 * t, y: 150 - 82 * Math.sin(Math.PI * t), t });
      }
      for (let i = 1; i < samples.length - 1; i++) {
        const p = samples[i];
        if (Math.random() < 0.25) continue;
        const prev = samples[i - 1], next = samples[i + 1];
        const dx = next.x - prev.x, dy = next.y - prev.y;
        const mag = Math.hypot(dx, dy) || 1;
        let nx = -dy / mag, ny = dx / mag;
        if (ny > 0) { nx = -nx; ny = -ny; }
        const cw = Math.sin(Math.PI * p.t);
        const ll = (18 + Math.random() * 22) * (0.4 + 0.6 * cw);
        const curl = (Math.random() - 0.5) * 14;
        const mx = p.x + nx * ll * 0.5 + curl;
        const my = p.y + ny * ll * 0.5;
        const ex = p.x + nx * ll + curl * 1.3 + (Math.random() - 0.5) * 6;
        const ey = p.y + ny * ll;
        const el = document.createElementNS(SVG_NS, "path");
        el.setAttribute("d", `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
        el.setAttribute("class", "iris-draw");
        el.setAttribute("pathLength", "1");
        el.setAttribute("stroke-width", (0.9 + Math.random() * 0.9).toFixed(2));
        el.style.setProperty("--delay", (2.3 + Math.random() * 0.55).toFixed(2) + "s");
        el.style.setProperty("--dur", (0.35 + Math.random() * 0.25).toFixed(2) + "s");
        el.style.opacity = (0.6 + Math.random() * 0.4).toFixed(2);
        upperG.appendChild(el);
      }
    }

    const lowerG = lowerLashesRef.current;
    if (lowerG) {
      for (let i = 2; i < 16; i++) {
        if (Math.random() < 0.45) continue;
        const t = i / 18;
        const x = 60 + 340 * t, y = 150 + 70 * Math.sin(Math.PI * t);
        const ll = 8 + Math.random() * 8;
        const curl = (Math.random() - 0.5) * 6;
        const el = document.createElementNS(SVG_NS, "path");
        el.setAttribute("d", `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${(x + curl * 0.4).toFixed(1)} ${(y + ll * 0.5).toFixed(1)} ${(x + curl).toFixed(1)} ${(y + ll).toFixed(1)}`);
        el.setAttribute("class", "iris-draw");
        el.setAttribute("pathLength", "1");
        el.setAttribute("stroke-width", (0.6 + Math.random() * 0.3).toFixed(2));
        el.style.setProperty("--delay", (3.0 + Math.random() * 0.3).toFixed(2) + "s");
        el.style.setProperty("--dur", "0.3s");
        el.style.opacity = (0.5 + Math.random() * 0.3).toFixed(2);
        el.style.stroke = "rgba(236,231,217,0.55)";
        lowerG.appendChild(el);
      }
    }

    const fibersG = irisFibersRef.current;
    if (fibersG) {
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const r1 = 16 + Math.random() * 5, r2 = 40 + Math.random() * 8;
        const el = document.createElementNS(SVG_NS, "line");
        el.setAttribute("x1", (230 + Math.cos(a) * r1).toFixed(2));
        el.setAttribute("y1", (150 + Math.sin(a) * r1).toFixed(2));
        el.setAttribute("x2", (230 + Math.cos(a) * r2).toFixed(2));
        el.setAttribute("y2", (150 + Math.sin(a) * r2).toFixed(2));
        el.setAttribute("class", "iris-draw");
        el.setAttribute("pathLength", "1");
        el.setAttribute("stroke-width", (0.5 + Math.random() * 0.6).toFixed(2));
        el.setAttribute("stroke", Math.random() > 0.5 ? "#2a1a3a" : "#4a3358");
        el.style.setProperty("--delay", (3.0 + Math.random() * 0.3).toFixed(2) + "s");
        el.style.setProperty("--dur", "0.5s");
        el.style.opacity = (0.5 + Math.random() * 0.4).toFixed(2);
        fibersG.appendChild(el);
      }
    }
  }, []);

  // ── Cursor tracking (smooth rAF) ──────────────────────
  useEffect(() => {
    const look = irisLookRef.current;
    if (!look || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: PointerEvent) => {
      tx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2 * 0.6));
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let rafId: number;
    function tick() {
      if (!look || !look.isConnected) return;
      cx += (tx - cx) * 0.3;
      cy += (ty - cy) * 0.3;
      look.style.setProperty("--mx", cx.toFixed(4));
      look.style.setProperty("--my", cy.toFixed(4));
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ── Speech recognition setup ──────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + " ";
      }
      transcriptRef.current = text.trim();
    };
    recognition.onend = () => {};
    recognition.onerror = () => {};
    recognitionRef.current = recognition;
  }, []);

  // ── Reset on idle — keep responseText visible ─────────
  useEffect(() => {
    if (appState === "idle") frameRef.current = null;
  }, [appState]);

  // ── First tap — unlock audio, welcome, go to camera ───
  const handleFirstTap = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    const a = document.createElement("audio");
    a.src = SILENT_WAV;
    a.play().then(() => a.pause()).catch(() => {});
    if (audioRef.current) {
      audioRef.current.src = SILENT_WAV;
      audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      "Welcome to Iris. Hold anywhere to speak, release to send."
    );
    u.rate = 1.0;
    window.speechSynthesis.speak(u);

    cameraRef.current?.startCamera();
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); })
      .catch(() => {});

    setMode("scene");
    modeRef.current = "scene";
    setTimeout(() => {
      setScreen("dismissing");
      setTimeout(() => setScreen("camera"), 400);
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch mode in camera view ────────────────────────
  const switchMode = useCallback(() => {
    const newMode = modeRef.current === "scene" ? "read" : "scene";
    setMode(newMode);
    modeRef.current = newMode;
    speakText(newMode === "scene" ? "Switched to scene mode." : "Switched to read mode.");
  }, []);

  // ── Speak fallback ────────────────────────────────────
  const speakFallback = useCallback((text: string | null) => {
    if (text) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.5;
      u.onend = () => setAppState("idle");
      u.onerror = () => setAppState("idle");
      window.speechSynthesis.speak(u);
    } else {
      setAppState("idle");
    }
  }, []);

  // ── Silent hazard reporting ────────────────────────────
  const reportHazardIfNeeded = useCallback((text: string, currentMode: AppMode) => {
    if (currentMode !== "scene") return;
    const hazardPattern = /stair|step|pothole|obstruct|uneven|construct|block|curb|crack|barrier|hazard|caution|watch out|be careful|obstacle|tripping|slip/i;
    if (!hazardPattern.test(text)) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        fetch("/api/hazard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            description: text,
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // ── Process request ───────────────────────────────────
  const processRequest = useCallback(
    async (transcript: string) => {
      const currentMode = modeRef.current;
      if (!transcript && currentMode === "read") transcript = "Read all visible text.";
      if (!transcript && currentMode === "scene") transcript = "Describe what you see.";
      if (!transcript) { setAppState("idle"); return; }

      setAppState("thinking");
      const imageBase64 = frameRef.current;
      if (!imageBase64) {
        setResponseText("I couldn't capture an image. Please try again.");
        setAppState("speaking");
        const u = new SpeechSynthesisUtterance("I couldn't capture an image. Please try again.");
        u.rate = 1.0;
        u.onend = () => setAppState("idle");
        window.speechSynthesis.speak(u);
        return;
      }

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageBase64, transcript, history: [], mode: currentMode }),
        });
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("audio/mpeg")) {
          const blob = await response.blob();
          const text = decodeURIComponent(response.headers.get("X-Response-Text") || "");
          setResponseText(text || null);
          setAppState("speaking");
          reportHazardIfNeeded(text, currentMode);
          const audio = audioRef.current;
          if (audio) {
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.playbackRate = 1.5;
            audio.onended = () => { URL.revokeObjectURL(url); setAppState("idle"); };
            audio.onerror = () => { URL.revokeObjectURL(url); speakFallback(text); };
            audio.play().catch(() => speakFallback(text));
          } else {
            speakFallback(text);
          }
        } else {
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          setResponseText(data.text);
          setAppState("speaking");
          reportHazardIfNeeded(data.text, currentMode);
          speakFallback(data.text);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Something went wrong";
        setResponseText(msg);
        setAppState("speaking");
        speakFallback(msg);
      }
    },
    [speakFallback, reportHazardIfNeeded]
  );

  // ── Hold-to-talk: press down → listen, lift → send ───
  const handlePressDown = useCallback(() => {
    if (appState === "speaking") {
      window.speechSynthesis.cancel();
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      setAppState("idle");
      return;
    }
    if (appState === "thinking" || isListening) return;

    window.speechSynthesis.cancel();
    playChime(1200);
    setResponseText(null);
    frameRef.current = null;
    transcriptRef.current = "";
    setIsListening(true);
    setAppState("listening");
    frameRef.current = cameraRef.current?.capture() || null;
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setTimeout(() => {
      try { recognitionRef.current?.start(); } catch { /* */ }
    }, 50);
  }, [appState, isListening]);

  const handlePressUp = useCallback(() => {
    if (!isListeningRef.current) return;
    playChime(440);
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setTimeout(() => {
      const transcript = transcriptRef.current;
      transcriptRef.current = "";
      processRequest(transcript);
    }, 300);
  }, [processRequest]);

  // ── Eyebrow hair data ─────────────────────────────────
  const browHairs = [
    { delay: "1.55s", d: "M 120 62 L 114 48" },
    { delay: "1.58s", d: "M 155 54 L 151 38" },
    { delay: "1.61s", d: "M 195 49 L 194 33" },
    { delay: "1.64s", d: "M 235 48 L 237 32" },
    { delay: "1.67s", d: "M 275 50 L 280 34" },
    { delay: "1.70s", d: "M 315 58 L 322 43" },
    { delay: "1.73s", d: "M 345 68 L 354 55" },
  ];

  return (
    <main className="fixed inset-0 bg-[#0b0b10]">
      {/* ── Landing — sketch-style eye ── */}
      {(screen === "landing" || screen === "dismissing") && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: "#0b0b10",
            padding: 40,
            animation: screen === "dismissing" ? "fadeOut 0.4s ease-out forwards" : undefined,
          }}
          onClick={handleFirstTap}
          onTouchStart={(e) => { e.preventDefault(); handleFirstTap(); }}
          role="button"
          tabIndex={0}
          aria-label="Tap to start Iris"
        >
          <div className="relative z-[2] flex flex-col items-center">
            {/* Eye mark */}
            <div style={{ position: "relative", width: 460, height: 300, display: "grid", placeItems: "center" }}
              role="img" aria-label="Iris logo: an eye opening">
              <svg viewBox="0 0 460 300" style={{ width: "100%", height: "100%", overflow: "visible" }} aria-hidden="true">
                <defs>
                  <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={2} seed="7" result="n" />
                    <feDisplacementMap in="SourceGraphic" in2="n" scale={1.3} />
                  </filter>
                  <radialGradient id="irisColor" cx="50%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="#9c7ab0" stopOpacity={0.55} />
                    <stop offset="45%" stopColor="#6a4a7a" stopOpacity={0.5} />
                    <stop offset="85%" stopColor="#301e3e" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#120a1a" stopOpacity={0.4} />
                  </radialGradient>
                  <linearGradient id="lidShade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000" stopOpacity={0.6} />
                    <stop offset="60%" stopColor="#000" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#000" stopOpacity={0} />
                  </linearGradient>
                  <clipPath id="almondClip">
                    <path d="M 60 150 C 125 65, 335 65, 400 150 C 335 225, 125 225, 60 150 Z" />
                  </clipPath>
                  <clipPath id="irisDiskClip">
                    <circle cx="230" cy="150" r="50" />
                  </clipPath>
                </defs>

                <g filter="url(#rough)">
                  {/* Eyebrow — bold sweep + re-trace + hairs */}
                  <g>
                    <path className="iris-draw" pathLength={1} strokeWidth="2.4"
                      style={{ "--delay": "1.1s", "--dur": "1.1s" } as React.CSSProperties}
                      d="M 85 72 C 155 40, 285 38, 360 68" />
                    <path className="iris-draw" pathLength={1} strokeWidth="1.3"
                      style={{ "--delay": "1.3s", "--dur": "0.9s", opacity: 0.55 } as React.CSSProperties}
                      d="M 90 78 C 160 48, 280 46, 355 75" />
                    <g stroke="rgba(236,231,217,0.55)" strokeWidth="0.9">
                      {browHairs.map(({ delay, d }) => (
                        <path key={d} className="iris-draw" pathLength={1}
                          style={{ "--delay": delay, "--dur": "0.4s" } as React.CSSProperties} d={d} />
                      ))}
                    </g>
                  </g>

                  {/* Eye (blinks/opens together) */}
                  <g className="eye-reveal">
                    {/* Crease */}
                    <path className="iris-draw" pathLength={1} stroke="rgba(236,231,217,0.22)" strokeWidth="0.9"
                      style={{ "--delay": "1.8s", "--dur": "1s" } as React.CSSProperties}
                      d="M 85 128 C 150 106, 320 108, 385 130" />

                    {/* Upper lid — bold + re-trace */}
                    <path className="iris-draw" pathLength={1} strokeWidth="2.6"
                      style={{ "--delay": "1.9s", "--dur": "1.1s" } as React.CSSProperties}
                      d="M 60 150 C 125 65, 335 65, 400 150" />
                    <path className="iris-draw" pathLength={1} strokeWidth="1.3"
                      style={{ "--delay": "2.1s", "--dur": "0.9s", opacity: 0.5 } as React.CSSProperties}
                      d="M 64 154 C 128 75, 330 75, 396 152" />

                    {/* Lower lid */}
                    <path className="iris-draw" pathLength={1} strokeWidth="1.5"
                      style={{ "--delay": "2.15s", "--dur": "1s" } as React.CSSProperties}
                      d="M 60 150 C 130 215, 330 215, 400 150" />

                    {/* Tear duct */}
                    <g strokeWidth="1.1">
                      <path className="iris-draw" pathLength={1}
                        style={{ "--delay": "2.5s", "--dur": "0.5s" } as React.CSSProperties}
                        d="M 64 152 Q 78 160, 92 155" />
                      <path className="iris-draw" pathLength={1} stroke="rgba(236,231,217,0.55)" strokeWidth="0.8"
                        style={{ "--delay": "2.55s", "--dur": "0.4s" } as React.CSSProperties}
                        d="M 70 158 Q 80 163, 90 160" />
                    </g>

                    {/* Dense lashes (procedural) */}
                    <g ref={upperLashesRef} strokeWidth="1.3" />
                    <g ref={lowerLashesRef} strokeWidth="0.9" />

                    {/* Iris (clipped to almond) */}
                    <g clipPath="url(#almondClip)">
                      <g className="iris-look" ref={irisLookRef}>
                        {/* Color fill */}
                        <circle className="iris-fade" cx="230" cy="150" r="48" fill="url(#irisColor)"
                          style={{ "--delay": "2.9s", "--to": "1" } as React.CSSProperties} />
                        {/* Limbal ring */}
                        <circle className="iris-draw" pathLength={1} cx="230" cy="150" r="48"
                          stroke="#1f1528" strokeWidth="2.2"
                          style={{ "--delay": "2.85s", "--dur": "0.9s" } as React.CSSProperties} />
                        {/* Inner ring */}
                        <circle className="iris-draw" pathLength={1} cx="230" cy="150" r="40"
                          stroke="#4a3358" strokeWidth="0.8" opacity={0.6}
                          style={{ "--delay": "3.05s", "--dur": "0.6s" } as React.CSSProperties} />
                        {/* Radial fibers (procedural) */}
                        <g clipPath="url(#irisDiskClip)">
                          <g ref={irisFibersRef} />
                        </g>
                        {/* Upper iris shadow from lid */}
                        <ellipse className="iris-fade" cx="230" cy="135" rx="50" ry="28"
                          fill="url(#lidShade)" clipPath="url(#irisDiskClip)"
                          style={{ "--delay": "3.1s", "--to": "0.75" } as React.CSSProperties} />
                        {/* Pupil */}
                        <g className="pupil-group">
                          <circle className="iris-draw" pathLength={1} cx="230" cy="150" r="15"
                            stroke="#000" strokeWidth="1.2"
                            style={{ "--delay": "3.2s", "--dur": "0.5s" } as React.CSSProperties} />
                          <circle className="iris-fade" cx="230" cy="150" r="15" fill="#060606"
                            style={{ "--delay": "3.35s", "--to": "1" } as React.CSSProperties} />
                          {/* Catchlight */}
                          <circle className="iris-fade" cx="238" cy="142" r="3.2" fill="#fdfbf5"
                            style={{ "--delay": "3.55s", "--to": "0.95" } as React.CSSProperties} />
                          <circle className="iris-fade" cx="240" cy="144" r="1" fill="#fff"
                            style={{ "--delay": "3.6s", "--to": "1" } as React.CSSProperties} />
                        </g>
                      </g>
                    </g>

                    {/* Corner scribble shading */}
                    <g stroke="rgba(236,231,217,0.22)" strokeWidth="0.7" fill="none">
                      <path className="iris-draw" pathLength={1}
                        style={{ "--delay": "3.4s", "--dur": "0.6s" } as React.CSSProperties}
                        d="M 75 140 q 8 4 16 2 q -10 6 -14 2 q 10 0 18 -2" />
                      <path className="iris-draw" pathLength={1}
                        style={{ "--delay": "3.45s", "--dur": "0.6s", opacity: 0.7 } as React.CSSProperties}
                        d="M 85 130 q 10 5 22 2 q -14 6 -20 2" />
                      <path className="iris-draw" pathLength={1}
                        style={{ "--delay": "3.5s", "--dur": "0.6s" } as React.CSSProperties}
                        d="M 370 135 q -10 5 -20 2 q 18 6 24 0" />
                      <path className="iris-draw" pathLength={1}
                        style={{ "--delay": "3.55s", "--dur": "0.6s", opacity: 0.7 } as React.CSSProperties}
                        d="M 360 148 q -12 3 -18 0" />
                    </g>
                  </g>
                </g>
              </svg>
            </div>

            {/* Wordmark — serif italic */}
            <div style={{
              marginTop: 36, fontFamily: "'Instrument Serif', serif",
              fontSize: 76, fontWeight: 400, fontStyle: "italic",
              letterSpacing: "0.01em", color: "#ece7d9",
              opacity: 0, transform: "translateY(10px)",
              animation: "textUp 1.2s cubic-bezier(.22,.61,.36,1) 3.6s forwards",
            }}>Iris</div>

            {/* Tagline */}
            <div style={{
              marginTop: 12, fontSize: 12, fontWeight: 300,
              letterSpacing: "0.42em", textTransform: "uppercase" as const,
              color: "rgba(236,231,217,0.55)",
              opacity: 0, transform: "translateY(8px)",
              animation: "textUp 1.2s cubic-bezier(.22,.61,.36,1) 3.9s forwards",
            }}>See with sound</div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 left-0 right-0 text-center z-[2]" style={{
            fontSize: 10, fontWeight: 400, letterSpacing: "0.4em",
            textTransform: "uppercase" as const, color: "rgba(236,231,217,0.22)",
            opacity: 0, animation: "textUp 1.6s ease-out 4.2s forwards",
          }}>
            Hook &apos;Em Hacks 2026 <span style={{ display: "inline-block", margin: "0 0.8em", opacity: 0.7 }}>&bull;</span> UT Austin
          </div>

          {/* Paper grain overlay */}
          <div className="landing-grain" aria-hidden="true" />
        </div>
      )}

      <CameraFeed ref={cameraRef} />

      {screen === "camera" && (
        <StatusIndicator
          state={appState}
          mode={mode}
          isListening={isListening}
          responseText={responseText}
          onSwitchMode={switchMode}
        />
      )}

      <audio ref={audioRef} className="hidden" playsInline />

      {screen === "camera" && (
        <div
          className="fixed inset-0 z-40"
          onMouseDown={handlePressDown}
          onMouseUp={handlePressUp}
          onTouchStart={(e) => { e.preventDefault(); handlePressDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressUp(); }}
          role="button"
          tabIndex={0}
          aria-label={
            isListening
              ? "Release to send your question"
              : appState === "thinking"
                ? "Analyzing your question"
                : appState === "speaking"
                  ? "Tap to stop response"
                  : mode === "scene"
                    ? "Hold to speak, release to send"
                    : "Hold to speak, release to read text"
          }
        />
      )}
    </main>
  );
}
