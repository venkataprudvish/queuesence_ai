/**
 * QueueSense — Engineering Audit, Model Selection Matrix & Training Status Registry
 * (Supports Milestone 1 Audit & Part 2 / Part 11 Model Information Transparency)
 */

export interface CandidateModelBenchmark {
  id: string;
  name: string;
  architecture: string;
  paramsMillions: number;
  cocoMap50: number;
  cocoMap50_95: number;
  estimatedIntelCpuMs: string;
  memoryFootprintMb: number;
  occlusionHandling: 'Moderate' | 'Good' | 'High';
  smallPersonRecall: 'Moderate' | 'Good' | 'High';
  intelIntegratedGpuSuitability: 'Recommended Primary' | 'Secondary Option' | 'Heavy on CPU';
  notes: string;
}

export const CANDIDATE_MODEL_MATRIX: CandidateModelBenchmark[] = [
  {
    id: 'yolo26n-onnx',
    name: 'Ultralytics YOLO26n / YOLOv8n (Nano)',
    architecture: 'CNN Anchor-Free CSPDarknet Nano (ONNX NCHW 640×640)',
    paramsMillions: 3.2,
    cocoMap50: 52.6,
    cocoMap50_95: 37.3,
    estimatedIntelCpuMs: '42–68 ms/frame (14–23 FPS on Intel iGPU/CPU)',
    memoryFootprintMb: 14,
    occlusionHandling: 'Moderate',
    smallPersonRecall: 'Good',
    intelIntegratedGpuSuitability: 'Recommended Primary',
    notes:
      'Best latency-to-accuracy trade-off for consumer laptops with Intel integrated graphics and Android mobile browsers without CUDA.',
  },
  {
    id: 'yolo26s-onnx',
    name: 'Ultralytics YOLO26s / YOLOv8s (Small)',
    architecture: 'CNN Anchor-Free CSPDarknet Small (ONNX NCHW 640×640)',
    paramsMillions: 11.2,
    cocoMap50: 61.8,
    cocoMap50_95: 44.9,
    estimatedIntelCpuMs: '115–165 ms/frame (6–9 FPS on Intel CPU)',
    memoryFootprintMb: 44,
    occlusionHandling: 'Good',
    smallPersonRecall: 'High',
    intelIntegratedGpuSuitability: 'Secondary Option',
    notes:
      'Higher recall under partial queue occlusion; best used via FastAPI Python ONNX/OpenVINO backend or at 480×480 resolution on CPU.',
  },
  {
    id: 'rf-detr-nano',
    name: 'RF-DETR Base / RT-DETR-L',
    architecture: 'Vision Transformer End-to-End Detector (No NMS)',
    paramsMillions: 32.0,
    cocoMap50: 69.5,
    cocoMap50_95: 53.0,
    estimatedIntelCpuMs: '380–620 ms/frame (1.5–2.5 FPS without discrete GPU)',
    memoryFootprintMb: 135,
    occlusionHandling: 'High',
    smallPersonRecall: 'High',
    intelIntegratedGpuSuitability: 'Heavy on CPU',
    notes:
      'Strong global attention for crowded queues, but transformer self-attention exceeds real-time frame budgets on non-CUDA Intel integrated graphics.',
  },
];

export interface AuditFinding {
  id: string;
  subsystem: string;
  status: 'Repaired in Milestone 2' | 'Verified Working' | 'Scheduled Next Milestone';
  problem: string;
  rootCause: string;
  affectedComponent: string;
  recommendedSolution: string;
  verificationMethod: string;
}

export const ENGINEERING_AUDIT_FINDINGS: AuditFinding[] = [
  {
    id: 'AUD-01',
    subsystem: 'Android Camera Constraints & Fallback',
    status: 'Repaired in Milestone 2',
    problem:
      'Single-shot getUserMedia constraint could fail with OverconstrainedError or fail to select the rear lens on certain Android browsers.',
    rootCause:
      'LiveMonitorScreen previously called getUserMedia once with a single constraint object without progressive fallback tiers.',
    affectedComponent: 'src/screens/LiveMonitorScreen.tsx, src/camera/cameraManager.ts',
    recommendedSolution:
      'Implement multi-tier constraint negotiation (Exact deviceId -> Exact Rear 720p -> Ideal Rear 720p -> VGA 640x480 -> Bare video fallback).',
    verificationMethod:
      'Test rear/front lens toggle and device selector on Android Chrome and inspect Active Constraint Tier in Live Camera Diagnostics.',
  },
  {
    id: 'AUD-02',
    subsystem: 'Video Aspect Ratio & Canvas Coordinate Alignment',
    status: 'Repaired in Milestone 2',
    problem:
      'Using object-cover on a fixed 16:10 container cropped portrait smartphone streams (e.g., 9:16 or 3:4) and desynchronized canvas coordinates.',
    rootCause:
      'Hardcoded aspect-[16/10] with object-cover clipped the top and bottom of portrait Android camera streams.',
    affectedComponent: 'src/screens/LiveMonitorScreen.tsx, src/camera/cameraManager.ts',
    recommendedSolution:
      'Dynamically adapt viewport aspect ratio to the intrinsic videoWidth × videoHeight and map canvas coordinates to the exact rendered video rectangle.',
    verificationMethod:
      'Rotate phone between Portrait and Landscape and verify zero stretching, zero cropping, and 1:1 ROI polygon alignment.',
  },
  {
    id: 'AUD-03',
    subsystem: 'Stream Interruption, Disconnect & Permission Recovery',
    status: 'Repaired in Milestone 2',
    problem:
      'Incoming phone calls, OS backgrounding, or USB camera unplugging left the video element frozen without diagnostic state or auto-recovery.',
    rootCause:
      'No listeners were attached to MediaStreamTrack ended/mute/unmute events or navigator.mediaDevices devicechange.',
    affectedComponent: 'src/camera/cameraManager.ts, src/screens/LiveMonitorScreen.tsx',
    recommendedSolution:
      'Bind track.onended, track.onmute, track.onunmute, and devicechange listeners with immediate diagnostic alerts and 1-tap / automatic stream recovery.',
    verificationMethod:
      'Simulate track termination or revoke/restore camera permission and verify diagnostic state transitions.',
  },
  {
    id: 'AUD-04',
    subsystem: 'Concurrent Stream Mutex & Track Cleanup',
    status: 'Repaired in Milestone 2',
    problem:
      'Rapidly clicking Start Camera or switching Front/Rear lenses could overlap getUserMedia requests and lock Android camera hardware.',
    rootCause:
      'Lack of an initialization mutex lock during asynchronous getUserMedia resolution.',
    affectedComponent: 'src/screens/LiveMonitorScreen.tsx',
    recommendedSolution:
      'Enforce a strict in-flight mutex ref and stop all existing MediaStreamTracks before requesting a new hardware stream.',
    verificationMethod:
      'Rapidly toggle Front/Rear camera 5 times and confirm only 1 active MediaStreamTrack exists.',
  },
  {
    id: 'AUD-05',
    subsystem: 'Real-Time Person Detection (Pretrained Model)',
    status: 'Scheduled Next Milestone',
    problem:
      'ONNX model binary (/models/yolov8n.onnx) is not yet bundled or executed against live video frames.',
    rootCause:
      'Milestone 1 intentionally established only the UI and typed interfaces without fabricating AI outputs.',
    affectedComponent: 'src/ai/inference/onnxConfig.ts, src/ai/detection/detectorInterface.ts',
    recommendedSolution:
      'In Milestone 3 & 4, integrate real pretrained person detection (ONNX Runtime Web / Web Worker or Python FastAPI backend) and map real bounding boxes.',
    verificationMethod:
      'Stand 1, 3, and 5 people in front of the camera in Milestone 3/4 and verify real bounding boxes and confidence scores.',
  },
  {
    id: 'AUD-06',
    subsystem: 'Multi-Person Tracking & Queue Region Counting',
    status: 'Scheduled Next Milestone',
    problem:
      'ByteTrack IoU math and ray-casting polygon counter exist in src/ai/tracking and src/queue-engine/counting, but are not yet fed live frame detections.',
    rootCause:
      'Awaiting Milestone 3/4 person detector integration and Milestone 7/8 tracking pipeline binding.',
    affectedComponent: 'src/ai/tracking/byteTrackEngine.ts, src/queue-engine/counting/regionCounter.ts',
    recommendedSolution:
      'Connect detector bounding boxes to ByteTrack state machine in Milestone 7 and trigger ROI entry/exit transitions in Milestone 8.',
    verificationMethod:
      'Walk across queue polygon boundary and verify persistent anonymous track IDs and accurate ROI count.',
  },
];
