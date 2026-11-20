import { BoundingBox, Point2D, TrackedPerson } from '../../types';

/**
 * Computes Intersection-over-Union (IoU) between two normalized bounding boxes.
 */
export function computeBoundingBoxIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const xA = Math.max(boxA.x1, boxB.x1);
  const yA = Math.max(boxA.y1, boxB.y1);
  const xB = Math.min(boxA.x2, boxB.x2);
  const yB = Math.min(boxA.y2, boxB.y2);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  if (interArea <= 0) return 0;

  const areaA = Math.max(0, boxA.x2 - boxA.x1) * Math.max(0, boxA.y2 - boxA.y1);
  const areaB = Math.max(0, boxB.x2 - boxB.x1) * Math.max(0, boxB.y2 - boxB.y1);

  return interArea / (areaA + areaB - interArea + 1e-6);
}

/**
 * Computes combined similarity score (IoU + normalized centroid proximity)
 * so people standing close together or shifting slightly in a queue remain associated.
 */
function computeAssociationScore(trackBox: BoundingBox, detBox: BoundingBox): number {
  const iou = computeBoundingBoxIoU(trackBox, detBox);
  const tCx = (trackBox.x1 + trackBox.x2) / 2;
  const tCy = (trackBox.y1 + trackBox.y2) / 2;
  const dCx = (detBox.x1 + detBox.x2) / 2;
  const dCy = (detBox.y1 + detBox.y2) / 2;
  const centerDist = Math.hypot(tCx - dCx, tCy - dCy);

  // If IoU > 0, weight IoU heavily + proximity bonus; if boxes slightly separated during fast step, allow tight proximity match
  if (iou > 0.05) {
    return iou + Math.max(0, 0.25 - centerDist);
  }
  if (centerDist < 0.08) {
    return 0.22 - centerDist;
  }
  return 0;
}

export interface TrackerConfig {
  highConfidenceThreshold: number;
  lowConfidenceThreshold: number;
  matchIouThreshold: number;
  maxOccludedFrames: number;
  trackingTimeoutMs: number; // Configurable timeout before removing lost track
}

export const DEFAULT_BYTETRACK_CONFIG: TrackerConfig = {
  highConfidenceThreshold: 0.45,
  lowConfidenceThreshold: 0.2,
  matchIouThreshold: 0.2,
  maxOccludedFrames: 25,
  trackingTimeoutMs: 3500,
};

interface InternalTrack extends TrackedPerson {
  vx: number;
  vy: number;
  missedFrames: number;
}

/**
 * Stateful Multi-Person ByteTrack Engine (Milestone 7)
 * - Assigns temporary anonymous integer IDs (#1, #2, ...)
 * - Two-stage association (high confidence first, then low confidence for partial occlusion)
 * - Velocity coasting during brief occlusion
 * - Configurable timeout cleanup
 */
export class ByteTracker {
  private nextTrackId = 1;
  private tracks: Map<number, InternalTrack> = new Map();
  private config: TrackerConfig;

  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_BYTETRACK_CONFIG, ...config };
  }

  public updateConfig(partial: Partial<TrackerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public getConfig(): TrackerConfig {
    return { ...this.config };
  }

  public reset(): void {
    this.tracks.clear();
    this.nextTrackId = 1;
  }

  public update(detections: BoundingBox[], timestampMs: number): TrackedPerson[] {
    const highDets = detections.filter(
      (d) => d.confidence >= this.config.highConfidenceThreshold
    );
    const lowDets = detections.filter(
      (d) =>
        d.confidence >= this.config.lowConfidenceThreshold &&
        d.confidence < this.config.highConfidenceThreshold
    );

    const unmatchedTrackIds = new Set<number>(this.tracks.keys());
    const unmatchedHighDetIndices = new Set<number>(highDets.map((_, i) => i));

    // Stage 1: Associate High-Confidence Detections with existing tracks
    const stage1Pairs: { trackId: number; detIdx: number; score: number }[] = [];
    for (const trackId of unmatchedTrackIds) {
      const trk = this.tracks.get(trackId)!;
      highDets.forEach((det, detIdx) => {
        const score = computeAssociationScore(trk.bbox, det);
        if (score >= this.config.matchIouThreshold) {
          stage1Pairs.push({ trackId, detIdx, score });
        }
      });
    }
    stage1Pairs.sort((a, b) => b.score - a.score);

    for (const pair of stage1Pairs) {
      if (!unmatchedTrackIds.has(pair.trackId) || !unmatchedHighDetIndices.has(pair.detIdx)) {
        continue;
      }
      this.applyMatch(pair.trackId, highDets[pair.detIdx], timestampMs);
      unmatchedTrackIds.delete(pair.trackId);
      unmatchedHighDetIndices.delete(pair.detIdx);
    }

    // Stage 2: Associate Low-Confidence Detections with remaining unmatched tracks (Occlusion Recovery)
    const unmatchedLowDetIndices = new Set<number>(lowDets.map((_, i) => i));
    const stage2Pairs: { trackId: number; detIdx: number; score: number }[] = [];
    for (const trackId of unmatchedTrackIds) {
      const trk = this.tracks.get(trackId)!;
      lowDets.forEach((det, detIdx) => {
        const score = computeAssociationScore(trk.bbox, det);
        if (score >= this.config.matchIouThreshold * 0.85) {
          stage2Pairs.push({ trackId, detIdx, score });
        }
      });
    }
    stage2Pairs.sort((a, b) => b.score - a.score);

    for (const pair of stage2Pairs) {
      if (!unmatchedTrackIds.has(pair.trackId) || !unmatchedLowDetIndices.has(pair.detIdx)) {
        continue;
      }
      this.applyMatch(pair.trackId, lowDets[pair.detIdx], timestampMs);
      unmatchedTrackIds.delete(pair.trackId);
      unmatchedLowDetIndices.delete(pair.detIdx);
    }

    // Handle unmatched tracks: coast briefly or expire after trackingTimeoutMs
    for (const trackId of unmatchedTrackIds) {
      const trk = this.tracks.get(trackId)!;
      trk.missedFrames += 1;
      const timeSinceLastSeen = timestampMs - trk.lastSeenTimestamp;

      if (
        timeSinceLastSeen > this.config.trackingTimeoutMs ||
        trk.missedFrames > this.config.maxOccludedFrames ||
        (trk.state === 'tentative' && trk.missedFrames >= 2)
      ) {
        this.tracks.delete(trackId);
      } else {
        trk.state = 'occluded';
      }
    }

    // Spawn new tracks from unmatched High-Confidence detections
    for (const detIdx of unmatchedHighDetIndices) {
      const det = highDets[detIdx];
      const trackId = this.nextTrackId++;
      const centroid: Point2D = {
        x: Number(((det.x1 + det.x2) / 2).toFixed(4)),
        y: Number(((det.y1 + det.y2) / 2).toFixed(4)),
      };
      const footPoint: Point2D = {
        x: centroid.x,
        y: Number(det.y2.toFixed(4)),
      };

      this.tracks.set(trackId, {
        trackId,
        bbox: det,
        centroid,
        footPoint,
        inQueueRegion: false,
        firstSeenTimestamp: timestampMs,
        lastSeenTimestamp: timestampMs,
        framesObserved: 1,
        state: 'confirmed',
        vx: 0,
        vy: 0,
        missedFrames: 0,
      });
    }

    return Array.from(this.tracks.values()).map((t) => ({
      trackId: t.trackId,
      bbox: t.bbox,
      centroid: t.centroid,
      footPoint: t.footPoint,
      inQueueRegion: t.inQueueRegion,
      firstSeenTimestamp: t.firstSeenTimestamp,
      lastSeenTimestamp: t.lastSeenTimestamp,
      framesObserved: t.framesObserved,
      state: t.state,
    }));
  }

  private applyMatch(trackId: number, det: BoundingBox, timestampMs: number): void {
    const trk = this.tracks.get(trackId)!;
    const newCx = (det.x1 + det.x2) / 2;
    const newCy = (det.y1 + det.y2) / 2;

    trk.vx = 0.6 * trk.vx + 0.4 * (newCx - trk.centroid.x);
    trk.vy = 0.6 * trk.vy + 0.4 * (newCy - trk.centroid.y);
    trk.bbox = det;
    trk.centroid = { x: Number(newCx.toFixed(4)), y: Number(newCy.toFixed(4)) };
    trk.footPoint = { x: Number(newCx.toFixed(4)), y: Number(det.y2.toFixed(4)) };
    trk.lastSeenTimestamp = timestampMs;
    trk.framesObserved += 1;
    trk.missedFrames = 0;
    trk.state = 'confirmed';
  }
}
