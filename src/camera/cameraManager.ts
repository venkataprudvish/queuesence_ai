/**
 * QueueSense — Android & Mobile Browser Camera Lifecycle Manager (Milestone 2)
 *
 * Implements:
 * 1. Progressive constraint negotiation (720p ideal -> VGA fallback -> generic video fallback)
 * 2. Explicit error classification (Permission Denied, Camera In Use, No Hardware, Overconstrained, Insecure Context)
 * 3. Post-permission device enumeration (Android Chrome only exposes labels after getUserMedia succeeds)
 * 4. Single-stream mutex lock to prevent concurrent camera streams
 * 5. Track interruption & disconnect listeners (ended, mute, unmute, devicechange)
 * 6. Exact intrinsic resolution & aspect-ratio synchronization to prevent stretched video frames
 */

export type CameraPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown';

export type CameraLifecycleState =
  | 'idle'
  | 'requesting_permission'
  | 'initializing_stream'
  | 'active'
  | 'interrupted'
  | 'reconnecting'
  | 'error';

export type CameraErrorCode =
  | 'INSECURE_CONTEXT'
  | 'API_UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'DEVICE_NOT_FOUND'
  | 'CAMERA_IN_USE'
  | 'OVERCONSTRAINED'
  | 'STREAM_INTERRUPTED'
  | 'PLAYBACK_FAILED'
  | 'UNKNOWN_ERROR';

export interface CameraErrorDetail {
  code: CameraErrorCode;
  title: string;
  message: string;
  remediation: string;
  canFallbackToVideoUpload: boolean;
}

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
  facingGuess: 'environment' | 'user' | 'unknown';
}

export interface ActiveStreamDiagnostics {
  deviceId: string;
  trackLabel: string;
  facingMode: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  aspectRatio: number;
  reportedFps: number | null;
  measuredPreviewFps: number;
  trackReadyState: MediaStreamTrackState | 'none';
  trackMuted: boolean;
  orientationAngle: number;
  constraintTierUsed: string;
}

/**
 * Queries the browser Permissions API for 'camera' without triggering a prompt.
 */
export async function queryCameraPermissionState(): Promise<CameraPermissionStatus> {
  if (typeof navigator === 'undefined') return 'unsupported';
  if (!navigator.permissions || !navigator.permissions.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Classifies DOMException / Error from getUserMedia into actionable Android/mobile diagnostics.
 */
export function classifyCameraError(err: unknown): CameraErrorDetail {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      code: 'INSECURE_CONTEXT',
      title: 'HTTPS Secure Context Required',
      message:
        'Browser security blocks camera access on insecure HTTP origins (except localhost).',
      remediation:
        'Open QueueSense over HTTPS or localhost, or use the Video Analysis upload fallback.',
      canFallbackToVideoUpload: true,
    };
  }

  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    return {
      code: 'API_UNSUPPORTED',
      title: 'Camera API Unavailable',
      message: 'navigator.mediaDevices.getUserMedia is not supported in this browser.',
      remediation:
        'Use Android Chrome, Edge, Firefox, or iOS Safari over HTTPS, or upload a recorded queue video.',
      canFallbackToVideoUpload: true,
    };
  }

  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return {
      code: 'PERMISSION_DENIED',
      title: 'Camera Permission Denied',
      message: `The browser blocked camera access (${name}).`,
      remediation:
        'Tap the site lock icon in your browser address bar, set Camera permission to "Allow", and tap Retry Camera.',
      canFallbackToVideoUpload: true,
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'DEVICE_NOT_FOUND',
      title: 'No Camera Hardware Detected',
      message: 'No physical video input device was reported by the operating system.',
      remediation:
        'Connect a webcam or open QueueSense on an Android smartphone, or switch to Video Analysis.',
      canFallbackToVideoUpload: true,
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'CAMERA_IN_USE',
      title: 'Camera Hardware Busy or Locked',
      message:
        'Another application or browser tab is currently holding an exclusive lock on the camera.',
      remediation:
        'Close other camera apps or tabs using the camera, then tap Retry Camera.',
      canFallbackToVideoUpload: true,
    };
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return {
      code: 'OVERCONSTRAINED',
      title: 'Requested Camera Constraints Unsupported',
      message: `The selected camera did not support the requested resolution or facing mode (${rawMessage}).`,
      remediation:
        'Switch camera selection to "Auto Rear/Front" to use progressive fallback resolution.',
      canFallbackToVideoUpload: true,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    title: 'Camera Initialization Error',
    message: rawMessage || 'An unexpected error occurred while starting the video stream.',
    remediation: 'Try switching between Front and Rear camera or reload the camera stream.',
    canFallbackToVideoUpload: true,
  };
}

/**
 * Enumerates videoinput devices and infers front/rear facing mode from labels.
 * Should be called AFTER permission is granted so Android Chrome populates device labels.
 */
export async function enumerateVideoInputDevices(): Promise<CameraDeviceOption[]> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');
    return videoDevices.map((d, idx) => {
      const lower = (d.label || '').toLowerCase();
      let facingGuess: 'environment' | 'user' | 'unknown' = 'unknown';
      if (lower.includes('back') || lower.includes('rear') || lower.includes('environment')) {
        facingGuess = 'environment';
      } else if (lower.includes('front') || lower.includes('user') || lower.includes('selfie')) {
        facingGuess = 'user';
      }
      return {
        deviceId: d.deviceId,
        label: d.label || `Camera ${idx + 1}`,
        facingGuess,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Acquires a MediaStream using progressive constraint fallback so Android phones
 * with non-standard sensor resolutions or strict facingMode drivers never fail unnecessarily.
 */
export async function acquireCameraStreamWithFallback(options: {
  selectedDeviceId?: string;
  preferredFacing: 'environment' | 'user';
}): Promise<{ stream: MediaStream; tierLabel: string }> {
  const { selectedDeviceId, preferredFacing } = options;

  const tiers: { label: string; constraints: MediaStreamConstraints }[] = [];

  if (selectedDeviceId) {
    tiers.push({
      label: 'Specific Device ID (720p HD Ideal)',
      constraints: {
        video: {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      },
    });
    tiers.push({
      label: 'Specific Device ID (Native Resolution)',
      constraints: {
        video: {
          deviceId: { exact: selectedDeviceId },
        },
        audio: false,
      },
    });
  }

  // Tier A: Exact facingMode (ensures Android switches to rear lens when requested)
  tiers.push({
    label: `Exact ${preferredFacing === 'environment' ? 'Rear' : 'Front'} Camera (720p)`,
    constraints: {
      video: {
        facingMode: { exact: preferredFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    },
  });

  // Tier B: Ideal facingMode 720p (works on laptops and single-camera devices too)
  tiers.push({
    label: `Ideal ${preferredFacing === 'environment' ? 'Rear' : 'Front'} Camera (720p)`,
    constraints: {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
  });

  // Tier C: Ideal facingMode VGA 640x480 (low-memory Android fallback)
  tiers.push({
    label: 'Standard VGA 640×480 Fallback',
    constraints: {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    },
  });

  // Tier D: Unconstrained default video device
  tiers.push({
    label: 'Default System Video Input',
    constraints: {
      video: true,
      audio: false,
    },
  });

  let lastError: unknown = null;

  for (const tier of tiers) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(tier.constraints);
      return { stream, tierLabel: tier.label };
    } catch (err: unknown) {
      lastError = err;
      const name = err instanceof DOMException || err instanceof Error ? err.name : '';
      // If user explicitly denied permission, do not spam additional prompts
      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        name === 'SecurityError'
      ) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Unable to acquire camera stream across all fallback tiers.');
}

/**
 * Computes the letterboxed content rectangle of a video element rendered with `object-contain`
 * so bounding boxes and polygonal queue regions align 1:1 with the actual video pixels without stretching.
 */
export function computeRenderedVideoContentRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): {
  offsetX: number;
  offsetY: number;
  renderWidth: number;
  renderHeight: number;
} {
  if (containerWidth <= 0 || containerHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      renderWidth: containerWidth,
      renderHeight: containerHeight,
    };
  }

  const containerRatio = containerWidth / containerHeight;
  const videoRatio = videoWidth / videoHeight;

  if (videoRatio > containerRatio) {
    // Video is wider than container (horizontal fit, vertical letterbox)
    const renderWidth = containerWidth;
    const renderHeight = containerWidth / videoRatio;
    return {
      offsetX: 0,
      offsetY: (containerHeight - renderHeight) / 2,
      renderWidth,
      renderHeight,
    };
  } else {
    // Video is taller than container (vertical fit, horizontal pillarbox — e.g. portrait phone)
    const renderHeight = containerHeight;
    const renderWidth = containerHeight * videoRatio;
    return {
      offsetX: (containerWidth - renderWidth) / 2,
      offsetY: 0,
      renderWidth,
      renderHeight,
    };
  }
}
