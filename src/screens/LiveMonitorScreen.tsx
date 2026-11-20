import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Square,
  Play,
  RotateCcw,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  Save,
  RefreshCw,
  FileVideo,
  Activity,
  Cpu,
  Aperture,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../hooks/useAppStore';
import { Point2D, QueueSessionSummary, QueueTimelinePoint, TrackedPerson } from '../types';
import { computeWaitTimePrediction } from '../queue-engine/prediction/waitTimePredictor';
import {
  ActiveStreamDiagnostics,
  CameraDeviceOption,
  CameraErrorDetail,
  CameraLifecycleState,
  CameraPermissionStatus,
  acquireCameraStreamWithFallback,
  classifyCameraError,
  enumerateVideoInputDevices,
  queryCameraPermissionState,
} from '../camera/cameraManager';
import {
  detectPeopleInFrame,
  getActiveModelIdentity,
  initializePretrainedDetector,
  ModelRuntimeIdentity,
} from '../ai/detection/personDetector';
import { ByteTracker } from '../ai/tracking/byteTrackEngine';
import { QueueCountingEngine, QueueCountingSnapshot } from '../queue-engine/counting/regionCounter';

const ROI_PRESETS: { name: string; points: Point2D[] }[] = [
  {
    name: 'Standard Service Lane',
    points: [
      { x: 0.14, y: 0.18 },
      { x: 0.86, y: 0.18 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 },
    ],
  },
  {
    name: 'Wide Counter Zone',
    points: [
      { x: 0.06, y: 0.22 },
      { x: 0.94, y: 0.22 },
      { x: 0.96, y: 0.94 },
      { x: 0.04, y: 0.94 },
    ],
  },
  {
    name: 'Narrow Corridor Queue',
    points: [
      { x: 0.28, y: 0.16 },
      { x: 0.72, y: 0.16 },
      { x: 0.78, y: 0.92 },
      { x: 0.22, y: 0.92 },
    ],
  },
];

const INITIAL_DIAGNOSTICS: ActiveStreamDiagnostics = {
  deviceId: '',
  trackLabel: 'No active stream',
  facingMode: 'uninitialized',
  intrinsicWidth: 0,
  intrinsicHeight: 0,
  aspectRatio: 1.6,
  reportedFps: null,
  measuredPreviewFps: 0,
  trackReadyState: 'none',
  trackMuted: false,
  orientationAngle: 0,
  constraintTierUsed: 'None',
};

const EMPTY_COUNT_SNAPSHOT: QueueCountingSnapshot = {
  annotatedTracks: [],
  totalDetectedInFrame: 0,
  currentQueueCount: 0,
  outsideQueueCount: 0,
  currentlyBeingServedCount: 0,
  peopleAheadOfSelected: 0,
  selectedCustomerPosition: 0,
  totalEnteredCount: 0,
  totalCompletedServiceExits: 0,
  totalAbandonedExits: 0,
  serviceCompletionTimestampsMs: [],
};

export const LiveMonitorScreen: React.FC = () => {
  const {
    queueRegion,
    setQueueRegion,
    resetQueueRegion,
    preferences,
    updatePreferences,
    addSessionSummary,
    setMonitorSubMode,
    addDatasetFrame,
    recordAcceptanceTestResult,
  } = useAppStore();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isAcquiringRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const isInferenceBusyRef = useRef<boolean>(false);

  const trackerRef = useRef<ByteTracker>(
    new ByteTracker({
      highConfidenceThreshold: preferences.confidenceThreshold,
      trackingTimeoutMs: 3500,
    })
  );
  const countingEngineRef = useRef<QueueCountingEngine>(new QueueCountingEngine());
  const timelineHistoryRef = useRef<QueueTimelinePoint[]>([]);
  const peakQueueRef = useRef<number>(0);
  const queueSamplesRef = useRef<number[]>([]);

  const [lifecycleState, setLifecycleState] = useState<CameraLifecycleState>('idle');
  const [permissionStatus, setPermissionStatus] = useState<CameraPermissionStatus>('unknown');
  const [cameraError, setCameraError] = useState<CameraErrorDetail | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [streamDiagnostics, setStreamDiagnostics] =
    useState<ActiveStreamDiagnostics>(INITIAL_DIAGNOSTICS);
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);

  // Real AI Detection & Tracking Telemetry State
  const [modelIdentity, setModelIdentity] = useState<ModelRuntimeIdentity>(() =>
    getActiveModelIdentity()
  );
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [measuredAiFps, setMeasuredAiFps] = useState<number>(0);
  const [inferenceLatencyMs, setInferenceLatencyMs] = useState<number>(0);
  const [countSnapshot, setCountSnapshot] =
    useState<QueueCountingSnapshot>(EMPTY_COUNT_SNAPSHOT);
  const [trackingTimeoutSec, setTrackingTimeoutSec] = useState<number>(3.5);
  const [targetPositionMode, setTargetPositionMode] = useState<'last_in_queue' | number>(
    'last_in_queue'
  );

  const [sessionStartTimeMs, setSessionStartTimeMs] = useState<number>(() => Date.now());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [quickTestNumber, setQuickTestNumber] = useState<number>(1);
  const [quickGroundTruth, setQuickGroundTruth] = useState<number>(1);

  // Preload the pretrained person detector on mount so it's ready immediately
  useEffect(() => {
    let mounted = true;
    initializePretrainedDetector('lite_mobilenet_v2')
      .then((identity) => {
        if (mounted) setModelIdentity(identity);
      })
      .catch(() => {
        if (mounted) setModelIdentity(getActiveModelIdentity());
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Keep ByteTracker threshold & timeout synced
  useEffect(() => {
    trackerRef.current.updateConfig({
      highConfidenceThreshold: preferences.confidenceThreshold,
      trackingTimeoutMs: Math.round(trackingTimeoutSec * 1000),
    });
  }, [preferences.confidenceThreshold, trackingTimeoutSec]);

  // Stop all active camera tracks and release hardware lock
  const stopCameraStream = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isInferenceBusyRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLifecycleState('idle');
    setMeasuredAiFps(0);
    setStreamDiagnostics((prev) => ({
      ...INITIAL_DIAGNOSTICS,
      orientationAngle: prev.orientationAngle,
    }));
  }, []);

  useEffect(() => {
    let mounted = true;
    queryCameraPermissionState().then((state) => {
      if (mounted) setPermissionStatus(state);
    });
    enumerateVideoInputDevices().then((devices) => {
      if (mounted) setAvailableCameras(devices);
    });
    return () => {
      mounted = false;
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Synchronize intrinsic video dimensions & orientation when phone rotates or stream loads
  const syncVideoDimensions = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    const angle =
      typeof window !== 'undefined' && window.screen?.orientation
        ? window.screen.orientation.angle
        : 0;

    if (!video || !stream) {
      setStreamDiagnostics((prev) => ({ ...prev, orientationAngle: angle }));
      return;
    }

    const track = stream.getVideoTracks()[0];
    const settings = track ? track.getSettings() : {};
    const vw = video.videoWidth || settings.width || 640;
    const vh = video.videoHeight || settings.height || 480;

    if (overlayCanvasRef.current && vw > 0 && vh > 0) {
      overlayCanvasRef.current.width = vw;
      overlayCanvasRef.current.height = vh;
    }

    setStreamDiagnostics((prev) => ({
      ...prev,
      deviceId: settings.deviceId || prev.deviceId,
      trackLabel: track?.label || 'Active Video Track',
      facingMode: settings.facingMode || preferences.preferredCameraFacing,
      intrinsicWidth: vw,
      intrinsicHeight: vh,
      aspectRatio: vh > 0 ? Number((vw / vh).toFixed(3)) : 1.6,
      reportedFps: settings.frameRate ? Math.round(settings.frameRate) : null,
      trackReadyState: track ? track.readyState : 'none',
      trackMuted: track ? track.muted : false,
      orientationAngle: angle,
    }));
  }, [preferences.preferredCameraFacing]);

  // Draw Queue Region Polygon AND Real Detected/Tracked Person Bounding Boxes on Canvas
  const renderCanvasOverlay = useCallback(
    (tracks: TrackedPerson[]) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const pts = queueRegion.points;
      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * width, pts[0].y * height);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * width, pts[i].y * height);
        }
        ctx.closePath();

        ctx.fillStyle = 'rgba(36, 76, 58, 0.14)';
        ctx.fill();
        ctx.lineWidth = Math.max(2, Math.round(width / 240));
        ctx.strokeStyle = '#244C3A';
        ctx.stroke();

        // Draw Service Exit Edge & Queue Entry Edge Labels
        const exitMidX = ((pts[0].x + pts[1].x) / 2) * width;
        const exitMidY = ((pts[0].y + pts[1].y) / 2) * height;
        ctx.fillStyle = '#244C3A';
        ctx.fillRect(exitMidX - 68, Math.max(4, exitMidY - 24), 136, 20);
        ctx.fillStyle = '#F7F5EC';
        ctx.font = '600 11px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SERVICE EXIT EDGE', exitMidX, Math.max(18, exitMidY - 10));

        const entryMidX = ((pts[2].x + pts[3].x) / 2) * width;
        const entryMidY = ((pts[2].y + pts[3].y) / 2) * height;
        ctx.fillStyle = '#A8B9A0';
        ctx.fillRect(entryMidX - 68, Math.min(height - 24, entryMidY + 4), 136, 20);
        ctx.fillStyle = '#252B26';
        ctx.fillText('QUEUE ENTRY EDGE', entryMidX, Math.min(height - 10, entryMidY + 18));

        // Draw draggable polygon corner handles (1-4)
        pts.forEach((pt, idx) => {
          const cx = pt.x * width;
          const cy = pt.y * height;

          ctx.beginPath();
          ctx.arc(cx, cy, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFDF6';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#244C3A';
          ctx.stroke();

          ctx.fillStyle = '#244C3A';
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.fillText(String(idx + 1), cx, cy + 3.5);
        });
      }

      // Draw Real Detected & Tracked People Bounding Boxes
      tracks.forEach((trk) => {
        const bx1 = trk.bbox.x1 * width;
        const by1 = trk.bbox.y1 * height;
        const bw = (trk.bbox.x2 - trk.bbox.x1) * width;
        const bh = (trk.bbox.y2 - trk.bbox.y1) * height;

        const isInQueue = trk.inQueueRegion;
        const strokeColor = isInQueue ? '#244C3A' : '#A8B9A0';
        const fillTint = isInQueue
          ? 'rgba(36, 76, 58, 0.18)'
          : 'rgba(168, 185, 160, 0.12)';

        ctx.fillStyle = fillTint;
        ctx.fillRect(bx1, by1, bw, bh);

        ctx.lineWidth = isInQueue ? 3 : 2;
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(bx1, by1, bw, bh);

        // Draw ground-contact footPoint marker
        const fx = trk.footPoint.x * width;
        const fy = trk.footPoint.y * height;
        ctx.beginPath();
        ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isInQueue ? '#477A55' : '#777D75';
        ctx.fill();

        // Draw Track ID + Confidence Header Label
        const confPercent = Math.round(trk.bbox.confidence * 100);
        const tagText = `${isInQueue ? 'QUEUE' : 'OUTSIDE'} #${trk.trackId} · ${confPercent}%`;
        ctx.font = '700 11px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(tagText).width + 12;
        const labelY = Math.max(22, by1);

        ctx.fillStyle = isInQueue ? '#244C3A' : '#FFFDF6';
        ctx.fillRect(bx1, labelY - 20, textWidth, 20);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx1, labelY - 20, textWidth, 20);

        ctx.fillStyle = isInQueue ? '#F7F5EC' : '#252B26';
        ctx.textAlign = 'left';
        ctx.fillText(tagText, bx1 + 6, labelY - 6);
      });
    },
    [queueRegion]
  );

  // Re-render overlay when ROI changes even in standby
  useEffect(() => {
    renderCanvasOverlay(countSnapshot.annotatedTracks);
  }, [queueRegion, countSnapshot.annotatedTracks, renderCanvasOverlay]);

  // Asynchronous Non-Blocking Frame Loop (Preview FPS + Real AI Detection & Tracking)
  const startMonitoringLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    let previewFrameCount = 0;
    let aiFrameCount = 0;
    let lastWindowTime = performance.now();
    let lastVideoTime = -1;
    let lastInferenceStartTime = 0;

    const loop = (now: number) => {
      const video = videoRef.current;
      const minIntervalMs = 1000 / Math.max(5, preferences.targetInferenceFps);

      if (video && !video.paused && !video.ended && video.readyState >= 2) {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          previewFrameCount++;
        }

        // Launch asynchronous AI inference when not busy (automatically drops stale frames)
        if (
          aiEnabled &&
          !isInferenceBusyRef.current &&
          now - lastInferenceStartTime >= minIntervalMs
        ) {
          isInferenceBusyRef.current = true;
          lastInferenceStartTime = now;

          detectPeopleInFrame(video, preferences.confidenceThreshold)
            .then((detResult) => {
              const timestampMs = Date.now();
              const trackedPeople = trackerRef.current.update(
                detResult.boxes,
                timestampMs
              );
              const snapshot = countingEngineRef.current.processFrameTracks(
                trackedPeople,
                queueRegion,
                timestampMs,
                targetPositionMode,
                Math.round(trackingTimeoutSec * 1000)
              );

              aiFrameCount++;
              setInferenceLatencyMs(detResult.inferenceLatencyMs);
              setCountSnapshot(snapshot);
              setModelIdentity(getActiveModelIdentity());
              renderCanvasOverlay(snapshot.annotatedTracks);

              // Record periodic session statistics
              peakQueueRef.current = Math.max(
                peakQueueRef.current,
                snapshot.currentQueueCount
              );
              queueSamplesRef.current.push(snapshot.currentQueueCount);
            })
            .catch(() => {
              // Keep loop alive on transient frame error
            })
            .finally(() => {
              isInferenceBusyRef.current = false;
            });
        }
      }

      const elapsed = now - lastWindowTime;
      if (elapsed >= 1000) {
        const realVideoFps = Math.round((previewFrameCount * 1000) / elapsed);
        const realAiFps = Math.round((aiFrameCount * 1000) / elapsed);
        setStreamDiagnostics((prev) => ({
          ...prev,
          measuredPreviewFps: realVideoFps,
        }));
        setMeasuredAiFps(realAiFps);
        previewFrameCount = 0;
        aiFrameCount = 0;
        lastWindowTime = now;
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [
    aiEnabled,
    preferences.confidenceThreshold,
    preferences.targetInferenceFps,
    queueRegion,
    targetPositionMode,
    trackingTimeoutSec,
    renderCanvasOverlay,
  ]);

  // Restart loop parameters when ROI or thresholds update while active
  useEffect(() => {
    if (lifecycleState === 'active') {
      startMonitoringLoop();
    }
  }, [
    lifecycleState,
    aiEnabled,
    preferences.confidenceThreshold,
    preferences.targetInferenceFps,
    queueRegion,
    targetPositionMode,
    trackingTimeoutSec,
    startMonitoringLoop,
  ]);

  // Start or switch camera stream with single-stream mutex protection
  const startCameraStream = useCallback(
    async (overrideFacing?: 'environment' | 'user', overrideDeviceId?: string) => {
      if (isAcquiringRef.current) return;
      isAcquiringRef.current = true;

      setCameraError(null);
      setLifecycleState('requesting_permission');

      try {
        stopCameraStream();
        setLifecycleState('initializing_stream');

        const targetFacing = overrideFacing ?? preferences.preferredCameraFacing;
        const targetDevice =
          overrideDeviceId !== undefined ? overrideDeviceId : selectedDeviceId;

        const { stream, tierLabel } = await acquireCameraStreamWithFallback({
          selectedDeviceId: targetDevice || undefined,
          preferredFacing: targetFacing,
        });

        streamRef.current = stream;
        setPermissionStatus('granted');

        const devices = await enumerateVideoInputDevices();
        setAvailableCameras(devices);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            setLifecycleState('interrupted');
            setCameraError({
              code: 'STREAM_INTERRUPTED',
              title: 'Camera Stream Disconnected',
              message:
                'The active camera stream ended unexpectedly (hardware disconnect or OS background interruption).',
              remediation: 'Tap Reconnect Camera below to re-initialize the camera feed.',
              canFallbackToVideoUpload: true,
            });
          };

          videoTrack.onmute = () => {
            setLifecycleState('interrupted');
            setStreamDiagnostics((prev) => ({ ...prev, trackMuted: true }));
          };

          videoTrack.onunmute = () => {
            setLifecycleState('active');
            setStreamDiagnostics((prev) => ({ ...prev, trackMuted: false }));
          };
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        trackerRef.current.reset();
        countingEngineRef.current.reset();
        timelineHistoryRef.current = [];
        peakQueueRef.current = 0;
        queueSamplesRef.current = [];
        setCountSnapshot(EMPTY_COUNT_SNAPSHOT);

        setStreamDiagnostics((prev) => ({
          ...prev,
          constraintTierUsed: tierLabel,
        }));
        syncVideoDimensions();
        setLifecycleState('active');
        setSessionStartTimeMs(Date.now());
      } catch (err: unknown) {
        const classified = classifyCameraError(err);
        setCameraError(classified);
        if (classified.code === 'PERMISSION_DENIED') {
          setPermissionStatus('denied');
        }
        setLifecycleState('error');
      } finally {
        isAcquiringRef.current = false;
      }
    },
    [
      preferences.preferredCameraFacing,
      selectedDeviceId,
      stopCameraStream,
      syncVideoDimensions,
    ]
  );

  // Handle orientation changes & window resizes on Android smartphones
  useEffect(() => {
    const handleResizeOrOrientation = () => {
      syncVideoDimensions();
    };
    window.addEventListener('resize', handleResizeOrOrientation);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleResizeOrOrientation);
    }
    return () => {
      window.removeEventListener('resize', handleResizeOrOrientation);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleResizeOrOrientation);
      }
    };
  }, [syncVideoDimensions]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    let closestIdx: number | null = null;
    let minDist = 0.09;
    queueRegion.points.forEach((pt, idx) => {
      const dist = Math.hypot(pt.x - normX, pt.y - normY);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== null) {
      setDraggingCornerIndex(closestIdx);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingCornerIndex === null) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = Math.min(0.96, Math.max(0.04, (e.clientX - rect.left) / rect.width));
    const normY = Math.min(0.94, Math.max(0.06, (e.clientY - rect.top) / rect.height));

    const updatedPoints = queueRegion.points.map((pt, idx) =>
      idx === draggingCornerIndex
        ? { x: Number(normX.toFixed(3)), y: Number(normY.toFixed(3)) }
        : pt
    );
    setQueueRegion({
      ...queueRegion,
      points: updatedPoints,
    });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingCornerIndex !== null) {
      setDraggingCornerIndex(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleToggleFrontRear = () => {
    const nextFacing =
      preferences.preferredCameraFacing === 'environment' ? 'user' : 'environment';
    setSelectedDeviceId('');
    updatePreferences({ preferredCameraFacing: nextFacing });
    if (lifecycleState === 'active' || lifecycleState === 'interrupted') {
      startCameraStream(nextFacing, '');
    }
  };

  // Real Waiting-Time Prediction derived from live QueueCountingEngine snapshot
  const livePrediction = computeWaitTimePrediction({
    peopleInQueue: countSnapshot.peopleAheadOfSelected,
    departureTimestampsMs: countSnapshot.serviceCompletionTimestampsMs,
    sessionStartTimeMs,
    currentTimeMs: Date.now(),
  });

  // Capture current video frame + detected bounding boxes into the Custom Queue Dataset (Milestones 5 & 6)
  const handleCaptureDatasetFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0) return;

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 320;
    thumbCanvas.height = Math.round((320 * video.videoHeight) / video.videoWidth);
    const tCtx = thumbCanvas.getContext('2d');
    if (!tCtx) return;
    tCtx.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height);

    const detectedBoxes = countSnapshot.annotatedTracks.map((t) => ({ ...t.bbox }));

    addDatasetFrame({
      id: `frame-${Date.now()}`,
      recordingId: `live-session-${sessionStartTimeMs}`,
      sourceLabel: `Android Camera (${streamDiagnostics.trackLabel})`,
      capturedAt: new Date().toISOString(),
      imageWidth: video.videoWidth,
      imageHeight: video.videoHeight,
      thumbnailDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.75),
      groundTruthBoxes: detectedBoxes,
      pretrainedPredictedBoxes: detectedBoxes,
    });

    setSavedNotice(
      `Captured frame (${detectedBoxes.length} person boxes) into Custom Dataset.`
    );
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleSaveLiveSession = () => {
    const now = new Date();
    const durationSec = Math.max(5, Math.round((Date.now() - sessionStartTimeMs) / 1000));
    const samples = queueSamplesRef.current;
    const avgQueue =
      samples.length > 0
        ? Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1))
        : countSnapshot.currentQueueCount;

    const newSession: QueueSessionSummary = {
      id: `session-${Date.now()}`,
      title: `${queueRegion.name} — Live AI Monitoring`,
      locationLabel: streamDiagnostics.trackLabel || 'Android Live Camera',
      sourceType: 'live_camera',
      isSampleData: false,
      startedAt: new Date(sessionStartTimeMs).toISOString(),
      endedAt: now.toISOString(),
      durationSeconds: durationSec,
      peakQueueCount: Math.max(peakQueueRef.current, countSnapshot.currentQueueCount),
      averageQueueCount: avgQueue,
      totalEntered: countSnapshot.totalEnteredCount,
      totalServed: countSnapshot.totalCompletedServiceExits,
      averageWaitSeconds: livePrediction.estimatedWaitSeconds ?? 0,
      averageServiceRatePerMin: livePrediction.smoothedServiceRatePerMin ?? 0,
      reliability: livePrediction.reliability,
      timeline: [
        {
          timestampOffsetSec: 0,
          timeLabel: new Date(sessionStartTimeMs).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          queueCount: countSnapshot.currentQueueCount,
          estimatedWaitMinutes:
            livePrediction.estimatedWaitSeconds !== null
              ? Number((livePrediction.estimatedWaitSeconds / 60).toFixed(1))
              : null,
          serviceRatePerMin: livePrediction.smoothedServiceRatePerMin ?? 0,
        },
      ],
    };

    addSessionSummary(
      newSession,
      `${streamDiagnostics.trackLabel} (${streamDiagnostics.intrinsicWidth}x${streamDiagnostics.intrinsicHeight})`,
      `${modelIdentity.modelName} (${modelIdentity.modelVersion})`
    );
    setSavedNotice('Session summary saved to History & synced with Firestore.');
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const isStreamRunning = lifecycleState === 'active' || lifecycleState === 'interrupted';
  const dynamicAspectRatio =
    isStreamRunning &&
    streamDiagnostics.intrinsicWidth > 0 &&
    streamDiagnostics.intrinsicHeight > 0
      ? `${streamDiagnostics.intrinsicWidth} / ${streamDiagnostics.intrinsicHeight}`
      : '16 / 10';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera Feed, Real Bounding Boxes, Tracking IDs & ROI */}
        <div className="lg:col-span-7 space-y-4">
          <Card padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
              <div className="flex items-center gap-2 text-xs text-[#777D75]">
                <span className="font-semibold text-[#252B26]">
                  {lifecycleState === 'active'
                    ? 'Live AI Detection & Tracking Active'
                    : lifecycleState === 'requesting_permission' ||
                      lifecycleState === 'initializing_stream'
                    ? 'Initializing Camera Hardware...'
                    : lifecycleState === 'interrupted'
                    ? 'Camera Stream Interrupted'
                    : 'Camera Preview Standby'}
                </span>
                <span aria-hidden="true">·</span>
                <span>ROI: {queueRegion.name}</span>
              </div>
              <span className="text-xs font-mono-tabular text-[#244C3A] font-semibold">
                {lifecycleState === 'active'
                  ? `AI: ${measuredAiFps} FPS (${inferenceLatencyMs} ms) · Preview: ${streamDiagnostics.measuredPreviewFps} FPS`
                  : `Model: ${modelIdentity.status.toUpperCase()}`}
              </span>
            </div>

            {/* Dynamic Aspect-Ratio Viewport */}
            <div
              style={{ aspectRatio: dynamicAspectRatio }}
              className="relative w-full max-h-[72vh] mx-auto rounded-xl overflow-hidden bg-[#F7F5EC] border border-[#E1E6DA] select-none transition-all"
            >
              <video
                ref={videoRef}
                playsInline
                muted
                onLoadedMetadata={syncVideoDimensions}
                onResize={syncVideoDimensions}
                className={`w-full h-full object-contain ${
                  isStreamRunning ? 'block' : 'hidden'
                }`}
              />

              {!isStreamRunning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                  <Camera className="w-8 h-8 text-[#244C3A] mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-[#252B26]">
                    Android Live Camera + Real-Time Person Detection
                  </p>
                  <p className="text-xs text-[#777D75] max-w-sm mt-1">
                    Tap &ldquo;Start Live Monitoring&rdquo; to detect people, assign ByteTrack IDs,
                    count people inside the Queue Region polygon, and compute waiting times.
                  </p>
                </div>
              )}

              <canvas
                ref={overlayCanvasRef}
                width={640}
                height={400}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
              />
            </div>

            {cameraError && (
              <div className="mt-3 p-4 rounded-xl bg-[#F7F5EC] border border-[#C66B5B] space-y-2.5 text-xs text-[#252B26]">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#C66B5B] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-[#C66B5B]">
                      {cameraError.title} ({cameraError.code})
                    </p>
                    <p className="text-[#252B26]">{cameraError.message}</p>
                    <p className="text-[#777D75]">{cameraError.remediation}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => startCameraStream()}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Retry / Reconnect Camera
                  </Button>
                  {cameraError.canFallbackToVideoUpload && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setMonitorSubMode('video')}
                      icon={<FileVideo className="w-3.5 h-3.5" />}
                    >
                      Use Video Upload Fallback
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Primary Camera & AI Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {!isStreamRunning ? (
                  <Button
                    variant="primary"
                    onClick={() => startCameraStream()}
                    disabled={
                      lifecycleState === 'requesting_permission' ||
                      lifecycleState === 'initializing_stream'
                    }
                    icon={<Play className="w-4 h-4" />}
                  >
                    {lifecycleState === 'requesting_permission' ||
                    lifecycleState === 'initializing_stream'
                      ? 'Starting Camera...'
                      : 'Start Live Monitoring'}
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={stopCameraStream}
                    icon={<Square className="w-4 h-4" />}
                  >
                    Stop Monitoring
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleToggleFrontRear}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  {preferences.preferredCameraFacing === 'environment'
                    ? 'Switch to Front'
                    : 'Switch to Rear'}
                </Button>

                {isStreamRunning && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCaptureDatasetFrame}
                    icon={<Aperture className="w-3.5 h-3.5" />}
                  >
                    Capture Frame for Dataset
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetQueueRegion}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Reset ROI
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Camera Facing or Hardware Device Selection"
                  value={selectedDeviceId || preferences.preferredCameraFacing}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'environment' || val === 'user') {
                      setSelectedDeviceId('');
                      updatePreferences({ preferredCameraFacing: val });
                      if (isStreamRunning) {
                        startCameraStream(val, '');
                      }
                    } else {
                      setSelectedDeviceId(val);
                      if (isStreamRunning) {
                        startCameraStream(preferences.preferredCameraFacing, val);
                      }
                    }
                  }}
                  className="min-h-[40px] px-3 py-1.5 text-xs bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26] focus:outline-none focus:border-[#244C3A]"
                >
                  <option value="environment">Auto Rear Camera (Environment)</option>
                  <option value="user">Auto Front Camera (User)</option>
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Queue Region Geometry Presets */}
          <Card padding="sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#252B26]">
                Queue Region (ROI) Geometry Presets
              </span>
              <span className="text-[11px] text-[#777D75]">
                Drag corners 1–4 on video to customize polygon
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ROI_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() =>
                    setQueueRegion({
                      ...queueRegion,
                      name: preset.name,
                      points: preset.points,
                    })
                  }
                  className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium border text-left transition-colors cursor-pointer ${
                    queueRegion.name === preset.name
                      ? 'bg-[#244C3A] text-[#F7F5EC] border-[#244C3A]'
                      : 'bg-[#F7F5EC] text-[#252B26] border-[#E1E6DA] hover:border-[#A8B9A0]'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </Card>

          {/* Hardware & Performance Diagnostics */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#244C3A]" />
                <h3 className="text-sm font-semibold text-[#252B26]">
                  Camera &amp; AI Performance Diagnostics
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-[#477A55] font-semibold">
                {modelIdentity.backendEngine}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-[11px] text-[#777D75]">Detection FPS</p>
                <p className="font-mono-tabular font-semibold text-[#244C3A] mt-0.5">
                  {measuredAiFps} FPS
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-[11px] text-[#777D75]">Inference Latency</p>
                <p className="font-mono-tabular font-semibold text-[#252B26] mt-0.5">
                  {inferenceLatencyMs} ms/frame
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-[11px] text-[#777D75]">Camera Resolution</p>
                <p className="font-mono-tabular font-semibold text-[#252B26] mt-0.5">
                  {streamDiagnostics.intrinsicWidth > 0
                    ? `${streamDiagnostics.intrinsicWidth}×${streamDiagnostics.intrinsicHeight}`
                    : 'Standby'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-[11px] text-[#777D75]">Preview Render Rate</p>
                <p className="font-mono-tabular font-semibold text-[#252B26] mt-0.5">
                  {streamDiagnostics.measuredPreviewFps} FPS
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Queue Counting, Multi-Person Tracking & Waiting-Time Prediction */}
        <div className="lg:col-span-5 space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#244C3A]" />
                <h2 className="text-base font-semibold text-[#252B26]">
                  Live Queue Intelligence
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAiEnabled((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  aiEnabled
                    ? 'bg-[#244C3A] text-[#F7F5EC]'
                    : 'bg-[#E1E6DA] text-[#252B26]'
                }`}
              >
                {aiEnabled ? 'AI Detector: ON' : 'AI Detector: PAUSED'}
              </button>
            </div>

            {/* Active Model Provenance Banner */}
            <div className="p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#777D75]">Active Model:</span>
                <span className="font-semibold text-[#252B26]">{modelIdentity.modelName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777D75]">Version &amp; Status:</span>
                <span className="font-mono-tabular text-[#477A55] font-semibold">
                  {modelIdentity.modelVersion} ({modelIdentity.trainingType})
                </span>
              </div>
            </div>

            {/* Primary Live Readouts */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-xs text-[#777D75] mb-1">People in Queue (ROI)</p>
                <p className="text-3xl font-bold text-[#252B26] font-mono-tabular">
                  {countSnapshot.currentQueueCount}
                </p>
                <p className="text-[11px] text-[#777D75] mt-1">
                  Total in frame: {countSnapshot.totalDetectedInFrame} ({countSnapshot.outsideQueueCount} outside)
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-xs text-[#777D75] mb-1">Estimated Wait Time</p>
                <p className="text-xl font-bold text-[#244C3A] font-mono-tabular">
                  {livePrediction.estimatedWaitFormatted}
                </p>
                <p className="text-[11px] text-[#777D75] mt-1">
                  Ahead: {countSnapshot.peopleAheadOfSelected} · Rate:{' '}
                  {livePrediction.smoothedServiceRatePerMin !== null
                    ? `${livePrediction.smoothedServiceRatePerMin}/min`
                    : 'Calibrating'}
                </p>
              </div>
            </div>

            {/* Entry / Service Exit / Being Served Telemetry */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-[11px] text-[#777D75]">Entered Queue</p>
                <p className="text-base font-bold text-[#252B26] font-mono-tabular">
                  {countSnapshot.totalEnteredCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-[11px] text-[#777D75]">At Counter</p>
                <p className="text-base font-bold text-[#244C3A] font-mono-tabular">
                  {countSnapshot.currentlyBeingServedCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <p className="text-[11px] text-[#777D75]">Served Exits</p>
                <p className="text-base font-bold text-[#477A55] font-mono-tabular">
                  {countSnapshot.totalCompletedServiceExits}
                </p>
              </div>
            </div>

            {/* Prediction Reliability Indicator */}
            <div className="p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[#252B26]">
                  Prediction Confidence &amp; Reliability
                </span>
                <span
                  className={`font-semibold uppercase text-[11px] ${
                    livePrediction.reliability === 'high'
                      ? 'text-[#477A55]'
                      : livePrediction.reliability === 'moderate'
                      ? 'text-[#244C3A]'
                      : livePrediction.reliability === 'low'
                      ? 'text-[#D49A45]'
                      : 'text-[#777D75]'
                  }`}
                >
                  {livePrediction.reliability.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[#777D75] leading-relaxed">
                {livePrediction.reliabilityReason}
              </p>
            </div>
          </Card>

          {/* Detection, Tracking & Service Completion Controls */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#244C3A]" />
              <h3 className="text-sm font-semibold text-[#252B26]">
                Detection, Tracking &amp; Service Controls
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="live-conf-slider" className="font-medium text-[#252B26]">
                    Person Detection Confidence Threshold
                  </label>
                  <span className="font-mono-tabular font-semibold text-[#244C3A]">
                    {Math.round(preferences.confidenceThreshold * 100)}%
                  </span>
                </div>
                <input
                  id="live-conf-slider"
                  type="range"
                  min={0.25}
                  max={0.85}
                  step={0.05}
                  value={preferences.confidenceThreshold}
                  onChange={(e) =>
                    updatePreferences({ confidenceThreshold: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#244C3A] cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#252B26] mb-1">
                    Tracking Timeout
                  </label>
                  <select
                    value={trackingTimeoutSec}
                    onChange={(e) => setTrackingTimeoutSec(Number(e.target.value))}
                    className="w-full min-h-[38px] px-2.5 py-1.5 bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26]"
                  >
                    <option value={1.5}>1.5 sec (Fast Expiry)</option>
                    <option value={3.5}>3.5 sec (Default)</option>
                    <option value={6.0}>6.0 sec (Heavy Occlusion)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#252B26] mb-1">
                    Wait Target Position
                  </label>
                  <select
                    value={String(targetPositionMode)}
                    onChange={(e) =>
                      setTargetPositionMode(
                        e.target.value === 'last_in_queue'
                          ? 'last_in_queue'
                          : Number(e.target.value)
                      )
                    }
                    className="w-full min-h-[38px] px-2.5 py-1.5 bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26]"
                  >
                    <option value="last_in_queue">New Arrival (End of Queue)</option>
                    <option value="2">2nd Person in Line (1 Ahead)</option>
                    <option value="3">3rd Person in Line (2 Ahead)</option>
                    <option value="5">5th Person in Line (4 Ahead)</option>
                  </select>
                </div>
              </div>

              {/* Manual Service Completion Control (Part 7 Requirement) */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
                <div>
                  <p className="font-semibold text-[#252B26]">
                    Manual Service-Completion Control
                  </p>
                  <p className="text-[11px] text-[#777D75]">
                    Log verified customer completion to update service rate
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    countingEngineRef.current.recordManualServiceCompletion(Date.now());
                    setCountSnapshot((prev) => ({
                      ...prev,
                      totalCompletedServiceExits: prev.totalCompletedServiceExits + 1,
                      serviceCompletionTimestampsMs:
                        countingEngineRef.current.getServiceCompletionTimestamps(),
                    }));
                  }}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Complete Service
                </Button>
              </div>

              {/* Quick 14-Scenario Ground-Truth Logger */}
              <div className="p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] space-y-2">
                <p className="font-semibold text-[#252B26]">
                  Record Live Reading into Acceptance Test Suite
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Select Acceptance Test Scenario"
                    value={quickTestNumber}
                    onChange={(e) => setQuickTestNumber(Number(e.target.value))}
                    className="min-h-[36px] px-2.5 py-1 bg-[#FFFDF6] border border-[#E1E6DA] rounded-lg text-xs"
                  >
                    {Array.from({ length: 14 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        Test #{num}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#777D75]">Ground Truth:</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={quickGroundTruth}
                      onChange={(e) => setQuickGroundTruth(Number(e.target.value))}
                      className="w-14 min-h-[36px] px-2 py-1 bg-[#FFFDF6] border border-[#E1E6DA] rounded-lg text-center font-mono-tabular"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      recordAcceptanceTestResult(
                        quickTestNumber,
                        quickGroundTruth,
                        countSnapshot.currentQueueCount,
                        0,
                        measuredAiFps,
                        inferenceLatencyMs,
                        `Recorded from Live Monitor (${streamDiagnostics.trackLabel})`
                      );
                      setSavedNotice(
                        `Logged Test #${quickTestNumber}: Detected ${countSnapshot.currentQueueCount} vs Ground Truth ${quickGroundTruth}.`
                      );
                      setTimeout(() => setSavedNotice(null), 3500);
                    }}
                  >
                    Log Test Result
                  </Button>
                </div>
              </div>
            </div>

            {savedNotice && (
              <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#477A55] text-xs text-[#477A55] font-medium">
                {savedNotice}
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={handleSaveLiveSession}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              Save Monitoring Session Summary
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
