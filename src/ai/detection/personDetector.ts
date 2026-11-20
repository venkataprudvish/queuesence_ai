/**
 * QueueSense — Real-Time Pretrained & Custom ONNX Person Detection Engine (Milestones 3 & 4)
 *
 * Supports two genuine browser-executable neural network backends:
 * 1. Pretrained COCO-SSD (MobileNetV2 / Lite-MobileNetV2 via TensorFlow.js WebGL/CPU) — works out-of-the-box
 *    on Intel integrated graphics and Android browsers without external servers.
 * 2. Ultralytics YOLOv8n / YOLO26n ONNX (via ONNX Runtime Web) — executes `/models/yolov8n.onnx` or any
 *    custom fine-tuned `.onnx` model uploaded by the operator.
 *
 * Performs:
 * - Person class filtering (`person` / `classId === 0`)
 * - Confidence threshold filtering
 * - Non-Maximum Suppression (NMS) IoU deduplication
 * - Normalized [0..1] coordinate conversion matching the exact intrinsic video frame
 */

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as ort from 'onnxruntime-web';
import { BoundingBox } from '../../types';
import { computeBoundingBoxIoU } from '../tracking/byteTrackEngine';

export type ActiveDetectorBackend = 'coco-ssd-mobilenet-v2' | 'onnx-yolo-custom';

export interface ModelRuntimeIdentity {
  modelName: string;
  modelVersion: string;
  trainingType: 'Pretrained' | 'Custom Fine-Tuned';
  modelFileLoaded: string;
  backendEngine: string;
  status: 'unloaded' | 'loading' | 'ready' | 'error';
  errorMessage?: string;
}

export interface FrameDetectionOutput {
  boxes: BoundingBox[]; // Normalized 0..1 coordinates (x1, y1, x2, y2)
  inferenceLatencyMs: number;
  rawCandidateCount: number;
}

let cocoModelInstance: cocoSsd.ObjectDetection | null = null;
let onnxSessionInstance: ort.InferenceSession | null = null;
let activeBackendType: ActiveDetectorBackend = 'coco-ssd-mobilenet-v2';

let currentIdentity: ModelRuntimeIdentity = {
  modelName: 'COCO-SSD Lite-MobileNetV2 (Person Detector)',
  modelVersion: 'v2.2.3-pretrained',
  trainingType: 'Pretrained',
  modelFileLoaded: 'tfjs-GraphModel (coco-ssd/lite_mobilenet_v2)',
  backendEngine: 'TensorFlow.js WebGL / CPU',
  status: 'unloaded',
};

export function getActiveModelIdentity(): ModelRuntimeIdentity {
  return { ...currentIdentity };
}

/**
 * Applies Greedy Non-Maximum Suppression (NMS) to prevent duplicate overlapping person boxes.
 */
export function applyNonMaximumSuppression(
  boxes: BoundingBox[],
  iouThreshold = 0.45
): BoundingBox[] {
  if (boxes.length <= 1) return boxes;
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept: BoundingBox[] = [];

  for (const candidate of sorted) {
    let shouldSuppress = false;
    for (const existing of kept) {
      if (computeBoundingBoxIoU(candidate, existing) > iouThreshold) {
        shouldSuppress = true;
        break;
      }
    }
    if (!shouldSuppress) {
      kept.push(candidate);
    }
  }
  return kept;
}

/**
 * Initializes the default pretrained person detector (TensorFlow.js COCO-SSD).
 * Automatically selects WebGL if supported on Intel iGPU / Android GPU, falling back to CPU.
 */
export async function initializePretrainedDetector(
  base: 'lite_mobilenet_v2' | 'mobilenet_v2' = 'lite_mobilenet_v2'
): Promise<ModelRuntimeIdentity> {
  if (cocoModelInstance && currentIdentity.status === 'ready' && activeBackendType === 'coco-ssd-mobilenet-v2') {
    return getActiveModelIdentity();
  }

  currentIdentity = {
    modelName:
      base === 'mobilenet_v2'
        ? 'COCO-SSD MobileNetV2 (High-Recall Person Detector)'
        : 'COCO-SSD Lite-MobileNetV2 (Fast Person Detector)',
    modelVersion: 'v2.2.3-pretrained',
    trainingType: 'Pretrained',
    modelFileLoaded: `tfjs-coco-ssd/${base}`,
    backendEngine: 'Initializing...',
    status: 'loading',
  };

  try {
    await tf.ready();
    const backend = tf.getBackend() || 'cpu';
    cocoModelInstance = await cocoSsd.load({ base });
    activeBackendType = 'coco-ssd-mobilenet-v2';

    currentIdentity = {
      modelName:
        base === 'mobilenet_v2'
          ? 'COCO-SSD MobileNetV2 (High-Recall Person Detector)'
          : 'COCO-SSD Lite-MobileNetV2 (Fast Person Detector)',
      modelVersion: 'v2.2.3-pretrained',
      trainingType: 'Pretrained',
      modelFileLoaded: `tfjs-coco-ssd/${base}`,
      backendEngine: `TensorFlow.js (${backend.toUpperCase()})`,
      status: 'ready',
    };
    return getActiveModelIdentity();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    currentIdentity = {
      ...currentIdentity,
      status: 'error',
      errorMessage: `Failed to load pretrained person detector: ${msg}`,
    };
    throw err;
  }
}

/**
 * Loads a custom or pretrained Ultralytics YOLO ONNX model binary (`.onnx`) via ONNX Runtime Web.
 */
export async function initializeCustomYoloOnnxDetector(
  modelSource: ArrayBuffer | string,
  fileName: string,
  isCustomTrained: boolean
): Promise<ModelRuntimeIdentity> {
  currentIdentity = {
    modelName: isCustomTrained ? 'QueueSense Custom Fine-Tuned YOLO' : 'Ultralytics YOLOv8n / YOLO26n ONNX',
    modelVersion: isCustomTrained ? 'v1.0-custom-queue' : 'v8.3-pretrained-onnx',
    trainingType: isCustomTrained ? 'Custom Fine-Tuned' : 'Pretrained',
    modelFileLoaded: fileName,
    backendEngine: 'ONNX Runtime Web (WASM CPU)',
    status: 'loading',
  };

  try {
    ort.env.wasm.numThreads = 1;
    const session =
      typeof modelSource === 'string'
        ? await ort.InferenceSession.create(modelSource, { executionProviders: ['wasm'] })
        : await ort.InferenceSession.create(modelSource, { executionProviders: ['wasm'] });

    onnxSessionInstance = session;
    activeBackendType = 'onnx-yolo-custom';

    currentIdentity = {
      ...currentIdentity,
      status: 'ready',
    };
    return getActiveModelIdentity();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    currentIdentity = {
      ...currentIdentity,
      status: 'error',
      errorMessage: `ONNX load error: ${msg}`,
    };
    throw err;
  }
}

// Reusable offscreen canvas for YOLO 640x640 tensor preprocessing
let preprocessCanvas: HTMLCanvasElement | null = null;

/**
 * Executes real person detection on an HTMLVideoElement, HTMLImageElement, or HTMLCanvasElement.
 */
export async function detectPeopleInFrame(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  confidenceThreshold = 0.45,
  nmsIouThreshold = 0.45
): Promise<FrameDetectionOutput> {
  const t0 = performance.now();

  const sourceWidth =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;

  const sourceHeight =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { boxes: [], inferenceLatencyMs: 0, rawCandidateCount: 0 };
  }

  // Path 1: Pretrained TensorFlow.js COCO-SSD Detector
  if (activeBackendType === 'coco-ssd-mobilenet-v2') {
    if (!cocoModelInstance) {
      await initializePretrainedDetector();
    }
    if (!cocoModelInstance) {
      return { boxes: [], inferenceLatencyMs: 0, rawCandidateCount: 0 };
    }

    const predictions = await cocoModelInstance.detect(source, 25, confidenceThreshold);
    const candidateBoxes: BoundingBox[] = [];

    for (const pred of predictions) {
      if (pred.class !== 'person') continue;
      if (pred.score < confidenceThreshold) continue;

      const [x, y, w, h] = pred.bbox;
      if (w <= 4 || h <= 8) continue;

      const x1 = Math.max(0, Math.min(1, x / sourceWidth));
      const y1 = Math.max(0, Math.min(1, y / sourceHeight));
      const x2 = Math.max(0, Math.min(1, (x + w) / sourceWidth));
      const y2 = Math.max(0, Math.min(1, (y + h) / sourceHeight));

      if (x2 > x1 && y2 > y1) {
        candidateBoxes.push({
          x1,
          y1,
          x2,
          y2,
          confidence: Number(pred.score.toFixed(3)),
          classId: 0,
        });
      }
    }

    const deduplicated = applyNonMaximumSuppression(candidateBoxes, nmsIouThreshold);
    const inferenceLatencyMs = Math.round(performance.now() - t0);

    return {
      boxes: deduplicated,
      inferenceLatencyMs,
      rawCandidateCount: candidateBoxes.length,
    };
  }

  // Path 2: Ultralytics YOLO ONNX Runtime Web Detector ([1, 3, 640, 640] -> [1, 84, 8400])
  if (activeBackendType === 'onnx-yolo-custom' && onnxSessionInstance) {
    const modelSize = 640;
    if (!preprocessCanvas) {
      preprocessCanvas = document.createElement('canvas');
      preprocessCanvas.width = modelSize;
      preprocessCanvas.height = modelSize;
    }
    const ctx = preprocessCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { boxes: [], inferenceLatencyMs: 0, rawCandidateCount: 0 };
    }

    ctx.drawImage(source, 0, 0, modelSize, modelSize);
    const imgData = ctx.getImageData(0, 0, modelSize, modelSize).data;

    const float32Data = new Float32Array(3 * modelSize * modelSize);
    const channelStride = modelSize * modelSize;
    for (let i = 0; i < channelStride; i++) {
      const pixelOffset = i * 4;
      float32Data[i] = imgData[pixelOffset] / 255.0; // R
      float32Data[channelStride + i] = imgData[pixelOffset + 1] / 255.0; // G
      float32Data[2 * channelStride + i] = imgData[pixelOffset + 2] / 255.0; // B
    }

    const inputName = onnxSessionInstance.inputNames[0] || 'images';
    const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, modelSize, modelSize]);
    const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };

    const results = await onnxSessionInstance.run(feeds);
    const outputName = onnxSessionInstance.outputNames[0];
    const outputTensor = results[outputName];
    const data = outputTensor.data as Float32Array;
    const dims = outputTensor.dims; // Typically [1, 84, 8400] or [1, 5, 8400] for single-class person YOLO

    const numAnchors = dims[2] || 8400;
    const candidateBoxes: BoundingBox[] = [];

    for (let a = 0; a < numAnchors; a++) {
      // Class 0 (person) score is at row index 4
      const personConfidence = data[4 * numAnchors + a];
      if (personConfidence < confidenceThreshold) continue;

      const cx = data[0 * numAnchors + a];
      const cy = data[1 * numAnchors + a];
      const w = data[2 * numAnchors + a];
      const h = data[3 * numAnchors + a];

      const x1 = Math.max(0, Math.min(1, (cx - w / 2) / modelSize));
      const y1 = Math.max(0, Math.min(1, (cy - h / 2) / modelSize));
      const x2 = Math.max(0, Math.min(1, (cx + w / 2) / modelSize));
      const y2 = Math.max(0, Math.min(1, (cy + h / 2) / modelSize));

      if (x2 > x1 && y2 > y1) {
        candidateBoxes.push({
          x1,
          y1,
          x2,
          y2,
          confidence: Number(personConfidence.toFixed(3)),
          classId: 0,
        });
      }
    }

    const deduplicated = applyNonMaximumSuppression(candidateBoxes, nmsIouThreshold);
    const inferenceLatencyMs = Math.round(performance.now() - t0);

    return {
      boxes: deduplicated,
      inferenceLatencyMs,
      rawCandidateCount: candidateBoxes.length,
    };
  }

  return { boxes: [], inferenceLatencyMs: 0, rawCandidateCount: 0 };
}
