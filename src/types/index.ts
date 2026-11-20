export type MainTab = 'home' | 'monitor' | 'analytics' | 'history' | 'profile';

export type AppFlowState = 'splash' | 'onboarding' | 'auth' | 'app';

export type MonitorSubMode = 'live' | 'video' | 'audit';

export interface Point2D {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
}

export interface QueueRegion {
  id: string;
  name: string;
  points: Point2D[]; // Normalized polygon vertices (typically 4 corners of queue lane)
  entryEdgeIndex: number; // 0..3
  exitEdgeIndex: number; // 0..3
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  classId: number; // 0 = person in COCO
}

export interface TrackedPerson {
  trackId: number;
  bbox: BoundingBox;
  centroid: Point2D;
  footPoint: Point2D;
  inQueueRegion: boolean;
  firstSeenTimestamp: number;
  lastSeenTimestamp: number;
  framesObserved: number;
  state: 'tentative' | 'confirmed' | 'occluded';
}

export type ReliabilityLevel = 'insufficient_data' | 'low' | 'moderate' | 'high';

export interface WaitTimePrediction {
  peopleInQueue: number;
  observedServiceRatePerMin: number | null; // people served per minute
  smoothedServiceRatePerMin: number | null;
  estimatedWaitSeconds: number | null; // null when insufficient data or zero rate
  estimatedWaitFormatted: string;
  reliability: ReliabilityLevel;
  reliabilityReason: string;
  completedDeparturesCount: number;
  lastUpdatedTimestamp: number;
}

export interface QueueTimelinePoint {
  timestampOffsetSec: number;
  timeLabel: string;
  queueCount: number;
  estimatedWaitMinutes: number | null;
  serviceRatePerMin: number;
}

export interface QueueSessionSummary {
  id: string;
  title: string;
  locationLabel: string;
  sourceType: 'live_camera' | 'uploaded_video' | 'sample_demo';
  isSampleData: boolean;
  startedAt: string; // ISO string
  endedAt: string;
  durationSeconds: number;
  peakQueueCount: number;
  averageQueueCount: number;
  totalEntered: number;
  totalServed: number;
  averageWaitSeconds: number;
  averageServiceRatePerMin: number;
  reliability: ReliabilityLevel;
  timeline: QueueTimelinePoint[];
  notes?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  mode: 'authenticated' | 'guest_demo' | 'local_eval';
  createdAt: string;
}

export interface UserPreferences {
  preferredCameraFacing: 'environment' | 'user';
  targetInferenceFps: 15 | 24 | 30;
  confidenceThreshold: number; // e.g., 0.45
  executionProvider: 'webgpu' | 'wasm';
  showSampleDemoData: boolean;
  autoSaveSessionSummaries: boolean;
  privacyLocalProcessingOnly: boolean;
  highContrastDaylightLegibility: boolean;
}

export interface SystemReadinessStatus {
  milestone: number;
  cameraApiSupported: boolean;
  secureContext: boolean;
  webWorkerSupported: boolean;
  webGpuSupported: boolean;
  onnxModelLoaded: boolean;
  onnxModelPath: string;
  firebaseConfigured: boolean;
}
