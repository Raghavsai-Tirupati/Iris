"use client";

import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

export interface CameraFeedHandle {
  capture: () => string | null;
}

const CameraFeed = forwardRef<CameraFeedHandle>(function CameraFeed(_, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

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
          "Camera access denied. Please allow camera access to use Iris."
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
    capture(): string | null {
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

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      return dataUrl.split(",")[1];
    },
  }));

  if (error) {
    return (
      <div
        className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center p-8"
        role="alert"
      >
        <p className="text-white/50 text-sm text-center leading-relaxed">
          {error}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black" aria-hidden="true" />
      <div className="fixed top-[88px] bottom-[100px] left-3 right-3 rounded-2xl overflow-hidden z-[1]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </>
  );
});

export default CameraFeed;
