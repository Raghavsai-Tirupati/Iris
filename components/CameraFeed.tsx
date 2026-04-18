"use client";

import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

export interface CameraFeedHandle {
  captureAndFreeze: () => string | null;
  unfreeze: () => void;
}

const CameraFeed = forwardRef<CameraFeedHandle>(function CameraFeed(_, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [frozenSrc, setFrozenSrc] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError(
          "Camera access denied. Please allow camera access to use SceneSpeak."
        );
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    captureAndFreeze(): string | null {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return null;

      const maxWidth = 1024;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, width, height);

      setFrozenSrc(canvas.toDataURL("image/jpeg", 0.9));
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 350);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      return dataUrl.split(",")[1];
    },

    unfreeze() {
      setFrozenSrc(null);
    },
  }));

  if (error) {
    return (
      <div
        className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center p-8"
        role="alert"
      >
        <p className="text-white/50 text-sm text-center leading-relaxed font-[family-name:var(--font-pixel)]">
          {error}
        </p>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`fixed inset-0 w-full h-full object-cover ${frozenSrc ? "invisible" : ""}`}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {frozenSrc && (
        <img
          src={frozenSrc}
          alt=""
          className="fixed inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
      )}

      {/* Subtle edge darkening */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 15%, transparent 80%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {showFlash && (
        <div
          className="fixed inset-0 bg-white pointer-events-none z-30"
          style={{ animation: "cameraFlash 0.35s ease-out forwards" }}
          aria-hidden="true"
        />
      )}
    </>
  );
});

export default CameraFeed;
