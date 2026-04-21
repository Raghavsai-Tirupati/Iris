"use client";

import React, { useEffect, useRef, useState } from "react";

const DURATION = 3.2;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

const Easing = {
  easeOutExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
};

function useAnimationTime() {
  const [time, setTime] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number;
    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      setTime(Math.min(elapsed, DURATION));
      if (elapsed < DURATION) {
        rafId = requestAnimationFrame(tick);
      }
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return time;
}

function useCursorSpin(ref: React.RefObject<SVGSVGElement | null>, startAt = 0) {
  const [angle, setAngle] = useState(0);
  const state = useRef({
    angle: 0,
    omega: 0,
    lastX: null as number | null,
    lastY: null as number | null,
    lastT: null as number | null,
  });
  const startedRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => { startedRef.current = true; }, startAt * 1000);
    return () => clearTimeout(id);
  }, [startAt]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const SENS = 0.00002;
    const DAMP = 1.8;
    const MAX_OMEGA = 200;
    const REST_EPS = 0.6;

    const onMove = (e: MouseEvent) => {
      if (!startedRef.current) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const x = e.clientX;
      const y = e.clientY;
      const now = performance.now();

      const s = state.current;
      if (s.lastX != null && s.lastT != null) {
        const dt = Math.max(0.001, (now - s.lastT) / 1000);
        const vx = (x - s.lastX) / dt;
        const vy = (y - s.lastY!) / dt;
        const rx = x - cx;
        const ry = y - cy;
        const torque = -(rx * vy - ry * vx);
        s.omega += torque * SENS;
        s.omega = Math.max(-MAX_OMEGA, Math.min(MAX_OMEGA, s.omega));
      }
      s.lastX = x; s.lastY = y; s.lastT = now;
    };

    const reset = () => {
      const s = state.current;
      s.lastX = null; s.lastY = null; s.lastT = null;
    };

    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const s = state.current;
      s.omega *= Math.exp(-DAMP * dt);
      if (Math.abs(s.omega) < REST_EPS) s.omega = 0;
      s.angle += s.omega * dt;
      if (s.angle > 3600 || s.angle < -3600) s.angle = s.angle % 360;
      setAngle(s.angle);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", reset);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", reset);
    };
  }, [ref]);

  return angle;
}

function petalPath(len: number, wid: number, tipRound = 0.35) {
  const tip = -len;
  const shoulder = -len * 0.55;
  const cx1 = wid;
  const cx2 = wid * tipRound;
  return `M 0 0
          C ${cx1} ${shoulder * 0.2}, ${cx2} ${shoulder}, 0 ${tip}
          C ${-cx2} ${shoulder}, ${-cx1} ${shoulder * 0.2}, 0 0 Z`;
}

interface PetalProps {
  len: number;
  wid: number;
  stroke: string;
  sw?: number;
  fill?: string;
  tipRound?: number;
  crease?: boolean;
  creaseOp?: number;
  pitch?: number;
}

function Petal({
  len,
  wid,
  stroke,
  sw = 1.8,
  fill = "none",
  tipRound = 0.35,
  crease = true,
  creaseOp = 0.4,
  pitch = 1,
}: PetalProps) {
  const d = petalPath(Math.max(0.01, len), Math.max(0.01, wid), tipRound);
  const tip = -len;
  return (
    <g transform={`scale(1 ${pitch})`}>
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {crease && len > 12 && (
        <path
          d={`M 0 -2 Q 0 ${tip * 0.55} 0 ${tip * 0.92}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw * 0.55}
          strokeLinecap="round"
          opacity={creaseOp * Math.min(1, (len - 12) / 30)}
        />
      )}
    </g>
  );
}

export default function IrisBloom() {
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorSpin = useCursorSpin(svgRef, 2.0);
  const t = useAnimationTime();

  const BLOOM_DUR = 1.6;
  const bloomRaw = clamp(t / BLOOM_DUR, 0, 1);
  const bloom = Easing.easeOutExpo(bloomRaw);

  const OUTER_LEN_FINAL = 82;
  const OUTER_WID_FINAL = 26;
  const INNER_LEN_FINAL = 56;
  const INNER_WID_FINAL = 20;

  const OUTER_LEN_START = 8;
  const OUTER_WID_START = 4;
  const INNER_LEN_START = 5;
  const INNER_WID_START = 3;

  const lenEase = bloom;
  const widEase = Easing.easeInOutCubic(
    clamp((bloomRaw - 0.35) / 0.65, 0, 1)
  );
  const pitchEase = Easing.easeOutBack(bloomRaw);
  const pitch = 0.08 + 0.96 * pitchEase;
  const pitchSettled = pitch > 1 ? 1 + (pitch - 1) * 0.4 : pitch;

  const outerSpec = {
    len: OUTER_LEN_START + (OUTER_LEN_FINAL - OUTER_LEN_START) * lenEase,
    wid: OUTER_WID_START + (OUTER_WID_FINAL - OUTER_WID_START) * widEase,
    pitch: pitchSettled,
  };
  const innerSpec = {
    len: INNER_LEN_START + (INNER_LEN_FINAL - INNER_LEN_START) * lenEase,
    wid: INNER_WID_START + (INNER_WID_FINAL - INNER_WID_START) * widEase,
    pitch: pitchSettled,
  };

  const spin = (1 - bloom) * -14;

  const stamenGrow = clamp((t - 1.1) / 0.9, 0, 1);
  const dotPop = clamp((t - 1.4) / 0.6, 0, 1);

  const openT = clamp((t - 2.1) / Math.max(0.01, DURATION - 2.1), 0, 1);
  const breath = 1 + Math.sin(openT * Math.PI * 2) * 0.006;

  const STROKE = "#1e1a15";

  const OUTER_ANGLES = [0, 120, 240];
  const INNER_ANGLES = [60, 180, 300];

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", maxWidth: 320, maxHeight: 320 }}
    >
      <defs>
        <radialGradient id="bloom-outer" cx="50%" cy="85%" r="80%">
          <stop offset="0%" stopColor="#fbf2e6" />
          <stop offset="100%" stopColor="#e6cfb8" />
        </radialGradient>
        <radialGradient id="bloom-inner" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#fdf7ec" />
          <stop offset="100%" stopColor="#eedac4" />
        </radialGradient>
      </defs>

      <g transform={`translate(100,100) scale(${breath}) rotate(${spin + cursorSpin})`}>
        {OUTER_ANGLES.map((a) => (
          <g key={`o${a}`} transform={`rotate(${a})`}>
            <Petal
              len={outerSpec.len}
              wid={outerSpec.wid}
              pitch={outerSpec.pitch}
              stroke={STROKE}
              sw={1.8}
              fill="url(#bloom-outer)"
              crease
              creaseOp={0.4}
            />
          </g>
        ))}

        {INNER_ANGLES.map((a) => (
          <g key={`i${a}`} transform={`rotate(${a})`}>
            <Petal
              len={innerSpec.len}
              wid={innerSpec.wid}
              pitch={innerSpec.pitch}
              stroke={STROKE}
              sw={1.8}
              fill="url(#bloom-inner)"
              crease
              creaseOp={0.4}
            />
          </g>
        ))}

        {[0, 60, 120, 180, 240, 300].map((a) => {
          const se = Easing.easeOutCubic(stamenGrow);
          const stamenLen = 2 + 9 * se;
          const dotR = 1.9 * Easing.easeOutBack(dotPop);
          if (stamenGrow <= 0 && dotR <= 0) return null;
          return (
            <g key={`s${a}`} transform={`rotate(${a})`}>
              <line
                x1="0"
                y1="-2"
                x2="0"
                y2={-2 - stamenLen}
                stroke={STROKE}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
              {dotR > 0.02 && (
                <circle
                  cx="0"
                  cy={-2 - stamenLen - 1.5}
                  r={dotR}
                  fill={STROKE}
                />
              )}
            </g>
          );
        })}

        <circle r={1.2 + 1.8 * clamp(t / 0.6, 0, 1)} fill={STROKE} />
      </g>
    </svg>
  );
}
