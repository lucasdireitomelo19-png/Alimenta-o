import { useCallback, useEffect, useRef, useState } from "react";

export type FacingMode = "user" | "environment";

export function useCamera(initialFacing: FacingMode = "user") {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>(initialFacing);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: facing } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        setError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch((err) => setError(err.message || "Não foi possível acessar a câmera"));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === "user" ? "environment" : "user"));
  }, []);

  return { videoRef, ready, error, facing, toggleFacing };
}
