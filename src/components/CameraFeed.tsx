import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { InferenceStatus } from "@/types";

// ────────────────────────────────────────────────────────────────
// CameraFeed — HTML5 getUserMedia video element
// ────────────────────────────────────────────────────────────────

export interface CameraFeedHandle {
  videoElement: HTMLVideoElement | null;
  stop: () => void;
  restart: () => void;
}

interface CameraFeedProps {
  onStatusChange?: (status: InferenceStatus) => void;
  className?: string;
}

export const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(
  function CameraFeed({ onStatusChange, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isActive, setIsActive] = useState(false);

    const stopCamera = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsActive(false);
    }, []);

    const startCamera = useCallback(async () => {
      onStatusChange?.("awaiting_permission");

      try {
        // Prefer rear camera for agricultural field use
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
            setIsActive(true);
            onStatusChange?.("active");
            console.log("[CameraFeed] 📷 Camera stream active");
          } catch (playErr) {
            if (playErr instanceof DOMException && playErr.name === "AbortError") {
              // Harmless interruption during HMR or quick remount
              console.debug("[CameraFeed] Video play() interrupted by fresh load.");
              return;
            }
            throw playErr;
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[CameraFeed] ❌ Camera access failed:", err);

        if (err instanceof DOMException) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            onStatusChange?.("permission_denied");
          } else {
            onStatusChange?.("error");
          }
        } else {
          onStatusChange?.("error");
        }
      }
    }, [onStatusChange]);

    // Expose video element and controls to parent
    useImperativeHandle(
      ref,
      () => ({
        get videoElement() {
          return videoRef.current;
        },
        stop: stopCamera,
        restart: () => {
          stopCamera();
          startCamera();
        },
      }),
      [stopCamera, startCamera]
    );

    // Auto-start on mount, clean up on unmount
    useEffect(() => {
      startCamera();
      return () => stopCamera();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={className}
        style={{
          // Mirror the front camera for a natural feel;
          // rear camera (environment) does not mirror.
          transform: "scaleX(1)",
          objectFit: "cover",
          width: "100%",
          height: "100%",
          display: isActive ? "block" : "none",
        }}
      />
    );
  }
);
