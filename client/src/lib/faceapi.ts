import * as faceapi from "@vladmandic/face-api";

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

/** Detects the single most prominent face in a video frame and returns its 128-d descriptor. */
export async function detectDescriptor(
  video: HTMLVideoElement
): Promise<{ descriptor: number[]; box: faceapi.Box } | null> {
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;
  return { descriptor: Array.from(result.descriptor), box: result.detection.box };
}
