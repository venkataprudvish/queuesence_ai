export interface OnnxModelSpecification {
  modelName: string;
  expectedPath: string;
  inputTensorName: string;
  inputShape: [number, number, number, number]; // [batch, channels, height, width]
  tensorLayout: 'NCHW';
  normalization: '0_to_1_float32';
  outputShape: [number, number, number]; // e.g., [1, 84, 8400] for YOLOv8n
  personClassIndex: number;
  defaultConfidenceThreshold: number;
  defaultIouThreshold: number;
}

export const YOLOV8N_ONNX_SPEC: OnnxModelSpecification = {
  modelName: 'YOLOv8n Person Detector (COCO)',
  expectedPath: '/models/yolov8n.onnx',
  inputTensorName: 'images',
  inputShape: [1, 3, 640, 640],
  tensorLayout: 'NCHW',
  normalization: '0_to_1_float32',
  outputShape: [1, 84, 8400],
  personClassIndex: 0,
  defaultConfidenceThreshold: 0.45,
  defaultIouThreshold: 0.5,
};

/**
 * Verifies whether the ONNX model file exists in /public/models/
 * without fabricating model presence or outputs.
 */
export async function checkOnnxModelAvailability(path = YOLOV8N_ONNX_SPEC.expectedPath): Promise<{
  available: boolean;
  statusMessage: string;
}> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    // Vite dev server returns text/html for missing SPA routes, so verify it is binary/octet-stream
    if (response.ok && !contentType.includes('text/html')) {
      return {
        available: true,
        statusMessage: `Verified ONNX model binary at ${path}.`,
      };
    }
    return {
      available: false,
      statusMessage: `Model binary not yet placed at ${path} (Scheduled for Milestone 4 ONNX Integration).`,
    };
  } catch {
    return {
      available: false,
      statusMessage: `Unable to reach ${path} (Scheduled for Milestone 4 ONNX Integration).`,
    };
  }
}
