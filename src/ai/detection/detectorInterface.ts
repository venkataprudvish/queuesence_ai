import { BoundingBox } from '../../types';

export interface DetectionFrameResult {
  frameIndex: number;
  inferenceLatencyMs: number;
  personBoxes: BoundingBox[];
  executionProvider: 'webgpu' | 'wasm' | 'uninitialized';
}

export interface PersonDetectorEngine {
  isReady(): boolean;
  initialize(modelUrl: string, provider: 'webgpu' | 'wasm'): Promise<void>;
  detectFrame(imageBuffer: ImageBitmap | ImageData): Promise<DetectionFrameResult>;
  dispose(): void;
}
