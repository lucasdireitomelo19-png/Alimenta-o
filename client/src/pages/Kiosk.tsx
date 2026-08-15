import { useEffect, useRef, useState } from "react";
import { api, type AccessLog, type CheckinResult } from "../lib/api";
import { loadModels, detectDescriptor } from "../lib/faceapi";
import { useCamera } from "../lib/useCamera";

const SCAN_INTERVAL_MS = 1200;
const RESULT_DISPLAY_MS = 3000;

export default function Kiosk() {
  const { videoRef, ready } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const busyRef = useRef(false);

  useEffect(() => {
    loadModels().then(() => setModelsReady(true));
  }, []);

  useEffect(() => {
    const poll = setInterval(() => api.listLogs(8).then(setLogs), 2000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!ready || !modelsReady) return;
    const interval = setInterval(async () => {
      if (!scanning || busyRef.current || !videoRef.current) return;
      busyRef.current = true;
      try {
        const detected = await detectDescriptor(videoRef.current);
        if (detected) {
          setScanning(false);
          const res = await api.checkin(detected.descriptor);
          setResult(res);
          setTimeout(() => {
            setResult(null);
            setScanning(true);
          }, RESULT_DISPLAY_MS);
        }
      } finally {
        busyRef.current = false;
      }
    }, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, modelsReady, scanning, videoRef]);

  return (
    <div className="kiosk">
      <div className="kiosk-main">
        <div className={`kiosk-frame ${result ? (result.granted ? "granted" : "denied") : ""}`}>
          <video ref={videoRef} autoPlay muted playsInline className="kiosk-video" />
          {!modelsReady && <div className="kiosk-overlay">Carregando reconhecimento facial…</div>}
          {modelsReady && scanning && !result && (
            <div className="kiosk-overlay subtle">Posicione o rosto na câmera</div>
          )}
          {result && (
            <div className="kiosk-result">
              {result.granted ? (
                <>
                  <div className="kiosk-icon ok">✓</div>
                  <div className="kiosk-name">{result.employee?.name}</div>
                  <div className="kiosk-sub">{result.employee?.companyName}</div>
                  <div className="kiosk-meal">{result.mealType} — passagem liberada</div>
                </>
              ) : (
                <>
                  <div className="kiosk-icon fail">✕</div>
                  <div className="kiosk-name">{result.employee?.name ?? "Não reconhecido"}</div>
                  <div className="kiosk-sub">{result.reason}</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="kiosk-log">
        <h3>Atividade recente</h3>
        <ul>
          {logs.map((log) => (
            <li key={log.id} className={log.granted ? "log-ok" : "log-fail"}>
              <span className="log-time">{log.ts.slice(11, 16)}</span>
              <span className="log-name">{log.employee_name ?? "Não reconhecido"}</span>
              <span className="log-reason">{log.reason}</span>
            </li>
          ))}
          {!logs.length && <li className="muted">Sem acessos ainda.</li>}
        </ul>
      </aside>
    </div>
  );
}
