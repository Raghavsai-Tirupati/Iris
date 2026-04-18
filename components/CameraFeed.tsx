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

      // Freeze: show the captured frame as a still image
      setFrozenSrc(canvas.toDataURL("image/jpeg", 0.9));
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 350);

      // Return base64 for the API (lower quality to save bandwidth)
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
        className="fixed inset-0 bg-[#050510] flex items-center justify-center p-8"
        role="alert"
      >
        <p className="text-white/70 text-lg text-center leading-relaxed">
          {error}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Live camera feed — hidden when frozen */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`fixed inset-0 w-full h-full object-cover ${frozenSrc ? "invisible" : ""}`}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Frozen still image */}
      {frozenSrc && (
        <img
          src={frozenSrc}
          alt=""
          className="fixed inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
      )}

      {/* Vignette overlay — always on top of camera/frozen image */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Bottom gradient for text readability */}
      <div
        className="fixed bottom-0 left-0 right-0 h-40 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
        }}
      />

      {/* Top gradient */}
      <div
        className="fixed top-0 left-0 right-0 h-28 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)",
        }}
      />

      {/* Camera flash effect */}
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
