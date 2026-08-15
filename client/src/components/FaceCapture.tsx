import { useEffect, useState } from "react";
import { loadModels, detectDescriptor } from "../lib/faceapi";
import { useCamera } from "../lib/useCamera";

export default function FaceCapture({ onCaptured }: { onCaptured: (descriptor: number[]) => void }) {
  const { videoRef, ready, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "capturing" | "done" | "notfound">("idle");

  useEffect(() => {
    loadModels().then(() => setModelsReady(true));
  }, []);

  async function capture() {
    if (!videoRef.current) return;
    setStatus("capturing");
    const result = await detectDescriptor(videoRef.current);
    if (!result) {
      setStatus("notfound");
      return;
    }
    onCaptured(result.descriptor);
    setStatus("done");
  }

  return (
    <div className="face-capture">
      <video ref={videoRef} autoPlay muted playsInline className="camera-preview" />
      {error && <p className="error">{error}</p>}
      <button type="button" onClick={capture} disabled={!ready || !modelsReady} className="btn btn-secondary">
        {modelsReady ? (ready ? "Capturar rosto" : "Ligando câmera…") : "Carregando modelo…"}
      </button>
      {status === "done" && <p className="hint hint-ok">Rosto capturado ✓</p>}
      {status === "notfound" && <p className="hint hint-warn">Nenhum rosto detectado, tente de novo.</p>}
    </div>
  );
}
