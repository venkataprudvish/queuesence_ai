import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  FileVideo,
  AlertCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Aperture,
  Save,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../hooks/useAppStore';
import { QueueSessionSummary, TrackedPerson } from '../types';
import {
  detectPeopleInFrame,
  getActiveModelIdentity,
  initializePretrainedDetector,
} from '../ai/detection/personDetector';
import { ByteTracker } from '../ai/tracking/byteTrackEngine';
import { QueueCountingEngine, QueueCountingSnapshot } from '../queue-engine/counting/regionCounter';
import { computeWaitTimePrediction } from '../queue-engine/prediction/waitTimePredictor';

interface VideoMetadata {
  fileName: string;
  fileSizeMB: string;
  mimeType: string;
  durationSec: number;
  width: number;
  height: number;
}

const SUPPORTED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
];

const EMPTY_VIDEO_SNAPSHOT: QueueCountingSnapshot = {
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

export const VideoAnalysisScreen: React.FC = () => {
  const { queueRegion, preferences, addDatasetFrame, addSessionSummary } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef<boolean>(false);

  const trackerRef = useRef<ByteTracker>(new ByteTracker());
  const countingRef = useRef<QueueCountingEngine>(new QueueCountingEngine());
  const peakQueueRef = useRef<number>(0);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<QueueCountingSnapshot>(EMPTY_VIDEO_SNAPSHOT);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [analysisStartMs, setAnalysisStartMs] = useState<number>(() => Date.now());

  useEffect(() => {
    initializePretrainedDetector('lite_mobilenet_v2').catch(() => {});
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const drawVideoOverlay = useCallback(
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
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#244C3A';
        ctx.stroke();
      }

      tracks.forEach((trk) => {
        const bx1 = trk.bbox.x1 * width;
        const by1 = trk.bbox.y1 * height;
        const bw = (trk.bbox.x2 - trk.bbox.x1) * width;
        const bh = (trk.bbox.y2 - trk.bbox.y1) * height;
        const isInQueue = trk.inQueueRegion;

        ctx.strokeStyle = isInQueue ? '#244C3A' : '#A8B9A0';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx1, by1, bw, bh);

        const label = `#${trk.trackId} · ${Math.round(trk.bbox.confidence * 100)}%`;
        ctx.fillStyle = isInQueue ? '#244C3A' : '#FFFDF6';
        ctx.fillRect(bx1, Math.max(0, by1 - 18), 86, 18);
        ctx.fillStyle = isInQueue ? '#F7F5EC' : '#252B26';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText(label, bx1 + 4, Math.max(12, by1 - 5));
      });
    },
    [queueRegion]
  );

  const runVideoDetectionLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const step = () => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended && v.readyState >= 2 && !busyRef.current) {
        busyRef.current = true;
        detectPeopleInFrame(v, preferences.confidenceThreshold)
          .then((det) => {
            const nowMs = Date.now();
            const tracks = trackerRef.current.update(det.boxes, nowMs);
            const snap = countingRef.current.processFrameTracks(
              tracks,
              queueRegion,
              nowMs
            );
            peakQueueRef.current = Math.max(peakQueueRef.current, snap.currentQueueCount);
            setLatencyMs(det.inferenceLatencyMs);
            setSnapshot(snap);
            drawVideoOverlay(snap.annotatedTracks);
          })
          .catch(() => {})
          .finally(() => {
            busyRef.current = false;
          });
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, [preferences.confidenceThreshold, queueRegion, drawVideoOverlay]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsAnalyzing(false);
    setSnapshot(EMPTY_VIDEO_SNAPSHOT);
    trackerRef.current.reset();
    countingRef.current.reset();
    peakQueueRef.current = 0;

    if (
      file.type &&
      !SUPPORTED_MIME_TYPES.includes(file.type) &&
      !file.name.match(/\.(mp4|webm|mov|m4v)$/i)
    ) {
      setErrorMsg(
        `Unsupported video format (${
          file.type || file.name
        }). Please select a browser-compatible MP4, WebM, or QuickTime (.mov) video.`
      );
      setMetadata(null);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextUrl = URL.createObjectURL(file);
    setVideoUrl(nextUrl);
    setMetadata({
      fileName: file.name,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      mimeType: file.type || 'video/mp4',
      durationSec: 0,
      width: 0,
      height: 0,
    });
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!Number.isFinite(v.duration) || v.videoWidth === 0) {
      setErrorMsg(
        'The selected video file appears corrupted or uses an unsupported video codec.'
      );
      return;
    }
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = v.videoWidth;
      overlayCanvasRef.current.height = v.videoHeight;
    }
    setMetadata((prev) =>
      prev
        ? {
            ...prev,
            durationSec: Math.round(v.duration),
            width: v.videoWidth,
            height: v.videoHeight,
          }
        : null
    );
    drawVideoOverlay([]);
  };

  const handleStartAnalysis = async () => {
    const v = videoRef.current;
    if (!v || !metadata || errorMsg) return;
    setAnalysisStartMs(Date.now());
    setIsAnalyzing(true);
    try {
      await v.play();
      runVideoDetectionLoop();
    } catch {
      runVideoDetectionLoop();
    }
  };

  const handleExtractDatasetFrame = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth <= 0) return;

    const thumb = document.createElement('canvas');
    thumb.width = 320;
    thumb.height = Math.round((320 * v.videoHeight) / v.videoWidth);
    const ctx = thumb.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, thumb.width, thumb.height);

    const boxes = snapshot.annotatedTracks.map((t) => ({ ...t.bbox }));
    addDatasetFrame({
      id: `vid-frame-${Date.now()}`,
      recordingId: `video-${metadata?.fileName || 'upload'}`,
      sourceLabel: `Video: ${metadata?.fileName || 'Uploaded Clip'}`,
      capturedAt: new Date().toISOString(),
      imageWidth: v.videoWidth,
      imageHeight: v.videoHeight,
      thumbnailDataUrl: thumb.toDataURL('image/jpeg', 0.75),
      groundTruthBoxes: boxes,
      pretrainedPredictedBoxes: boxes,
    });

    setNotice(`Extracted video frame (${boxes.length} person boxes) into Custom Dataset.`);
    setTimeout(() => setNotice(null), 3500);
  };

  const prediction = computeWaitTimePrediction({
    peopleInQueue: snapshot.peopleAheadOfSelected,
    departureTimestampsMs: snapshot.serviceCompletionTimestampsMs,
    sessionStartTimeMs: analysisStartMs,
    currentTimeMs: Date.now(),
  });

  const handleSaveVideoSession = () => {
    if (!metadata) return;
    const modelId = getActiveModelIdentity();
    const newSession: QueueSessionSummary = {
      id: `vid-session-${Date.now()}`,
      title: `Video Analysis: ${metadata.fileName}`,
      locationLabel: queueRegion.name,
      sourceType: 'uploaded_video',
      isSampleData: false,
      startedAt: new Date(analysisStartMs).toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds: metadata.durationSec || 30,
      peakQueueCount: Math.max(peakQueueRef.current, snapshot.currentQueueCount),
      averageQueueCount: snapshot.currentQueueCount,
      totalEntered: snapshot.totalEnteredCount,
      totalServed: snapshot.totalCompletedServiceExits,
      averageWaitSeconds: prediction.estimatedWaitSeconds ?? 0,
      averageServiceRatePerMin: prediction.smoothedServiceRatePerMin ?? 0,
      reliability: prediction.reliability,
      timeline: [
        {
          timestampOffsetSec: 0,
          timeLabel: '00:00',
          queueCount: snapshot.currentQueueCount,
          estimatedWaitMinutes:
            prediction.estimatedWaitSeconds !== null
              ? Number((prediction.estimatedWaitSeconds / 60).toFixed(1))
              : null,
          serviceRatePerMin: prediction.smoothedServiceRatePerMin ?? 0,
        },
      ],
    };
    addSessionSummary(newSession, `Uploaded Video (${metadata.width}x${metadata.height})`, modelId.modelName);
    setNotice('Video analysis session saved to History & Firestore.');
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Video Upload, Player & Real Detection Overlay */}
      <div className="lg:col-span-7 space-y-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-[#252B26]">
                Recorded Queue Video AI Analysis
              </h2>
              <p className="text-xs text-[#777D75]">
                Run real person detection, ByteTrack tracking, and frame extraction on uploaded
                queue videos.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-4 h-4" />}
            >
              Select Video
            </Button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#F7F5EC] border border-[#C66B5B] flex items-start gap-2.5 text-xs text-[#252B26]">
              <AlertCircle className="w-4 h-4 text-[#C66B5B] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#C66B5B] mb-0.5">Video File Error</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {!videoUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="w-full aspect-[16/10] rounded-xl bg-[#F7F5EC] border-2 border-dashed border-[#A8B9A0] hover:border-[#244C3A] transition-colors flex flex-col items-center justify-center p-6 text-center cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#FFFDF6] border border-[#E1E6DA] text-[#244C3A] flex items-center justify-center mb-3">
                <FileVideo className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#252B26] mb-1">
                Tap to Choose a Queue Video File
              </p>
              <p className="text-xs text-[#777D75] max-w-xs">
                Supports MP4 (H.264), WebM, and QuickTime (.mov). Processed locally in your
                browser.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-[#252B26] border border-[#E1E6DA]">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={runVideoDetectionLoop}
                  onError={() =>
                    setErrorMsg(
                      'Browser could not decode this video file. Verify it uses standard H.264/VP8/VP9 encoding.'
                    )
                  }
                  className="w-full h-full object-contain"
                />
                <canvas
                  ref={overlayCanvasRef}
                  width={640}
                  height={360}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={handleStartAnalysis}
                    disabled={Boolean(errorMsg)}
                    icon={<Play className="w-4 h-4" />}
                  >
                    {isAnalyzing ? 'Analyzing Video...' : 'Start AI Video Analysis'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExtractDatasetFrame}
                    icon={<Aperture className="w-3.5 h-3.5" />}
                  >
                    Extract Frame to Dataset
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (videoUrl) URL.revokeObjectURL(videoUrl);
                      setVideoUrl(null);
                      setMetadata(null);
                      setSnapshot(EMPTY_VIDEO_SNAPSHOT);
                    }}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Right Column: Video AI Detection & Queue Telemetry */}
      <div className="lg:col-span-5 space-y-4">
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#252B26]">
              Video Queue Telemetry
            </h3>
            <span className="text-xs font-mono-tabular text-[#244C3A]">
              {latencyMs > 0 ? `${latencyMs} ms/frame` : 'Ready'}
            </span>
          </div>

          {metadata && (
            <div className="p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#777D75]">File:</span>
                <span className="font-semibold text-[#252B26] truncate max-w-[180px]">
                  {metadata.fileName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777D75]">Resolution &amp; Duration:</span>
                <span className="font-mono-tabular text-[#252B26]">
                  {metadata.width}×{metadata.height} · {metadata.durationSec}s
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
              <p className="text-[11px] text-[#777D75]">Queue Count (In ROI)</p>
              <p className="text-2xl font-bold text-[#252B26] font-mono-tabular mt-0.5">
                {snapshot.currentQueueCount} people
              </p>
              <p className="text-[11px] text-[#777D75] mt-0.5">
                Total in frame: {snapshot.totalDetectedInFrame}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
              <p className="text-[11px] text-[#777D75]">Estimated Wait Time</p>
              <p className="text-lg font-bold text-[#244C3A] font-mono-tabular mt-0.5">
                {prediction.estimatedWaitFormatted}
              </p>
              <p className="text-[11px] text-[#777D75] mt-0.5">
                Served: {snapshot.totalCompletedServiceExits}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs">
            <span>Log Service Completion in Video</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                countingRef.current.recordManualServiceCompletion(Date.now());
                setSnapshot((prev) => ({
                  ...prev,
                  totalCompletedServiceExits: prev.totalCompletedServiceExits + 1,
                  serviceCompletionTimestampsMs:
                    countingRef.current.getServiceCompletionTimestamps(),
                }));
              }}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Complete Service
            </Button>
          </div>

          {notice && (
            <div className="p-2.5 rounded-xl bg-[#F7F5EC] border border-[#477A55] text-xs text-[#477A55] font-medium">
              {notice}
            </div>
          )}

          {metadata && (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={handleSaveVideoSession}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              Save Video Session Summary
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
};
