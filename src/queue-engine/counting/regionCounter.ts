import { Point2D, QueueRegion, TrackedPerson } from '../../types';

/**
 * Ray-casting algorithm to determine whether a normalized 2D point (0..1)
 * lies inside the user-configured queue polygon region.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-10) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks whether a person's ground-contact point or centroid is inside the
 * configured queue polygon (providing resilience when feet are partially occluded).
 */
export function isPersonInsideQueueRegion(person: TrackedPerson, region: QueueRegion): boolean {
  return (
    isPointInPolygon(person.footPoint, region.points) ||
    isPointInPolygon(person.centroid, region.points)
  );
}

/**
 * Computes distance from a person to the Service Exit Edge (edge between points[0] and points[1])
 * so queue positions can be ordered from front-of-line (closest to service counter) to back-of-line.
 */
export function distanceToServiceExitEdge(person: TrackedPerson, region: QueueRegion): number {
  if (region.points.length < 2) return person.centroid.y;
  const exitMidX = (region.points[0].x + region.points[1].x) / 2;
  const exitMidY = (region.points[0].y + region.points[1].y) / 2;
  return Math.hypot(person.centroid.x - exitMidX, person.centroid.y - exitMidY);
}

export function countPeopleInQueueRegion(
  tracks: TrackedPerson[],
  region: QueueRegion
): {
  activeQueueCount: number;
  qualifyingTrackIds: number[];
} {
  const qualifyingTrackIds: number[] = [];

  for (const track of tracks) {
    if (track.state === 'tentative') continue;
    if (isPersonInsideQueueRegion(track, region)) {
      qualifyingTrackIds.push(track.trackId);
    }
  }

  return {
    activeQueueCount: qualifyingTrackIds.length,
    qualifyingTrackIds,
  };
}

export interface QueueCountingSnapshot {
  annotatedTracks: TrackedPerson[];
  totalDetectedInFrame: number;
  currentQueueCount: number;
  outsideQueueCount: number;
  currentlyBeingServedCount: number;
  peopleAheadOfSelected: number;
  selectedCustomerPosition: number; // 1-based position in line (or last person in line)
  totalEnteredCount: number;
  totalCompletedServiceExits: number;
  totalAbandonedExits: number;
  serviceCompletionTimestampsMs: number[];
}

interface TrackQueueHistory {
  trackId: number;
  everEnteredQueue: boolean;
  currentlyInQueue: boolean;
  nearServiceCounter: boolean;
  lastSeenInQueueTimestamp: number;
  minDistanceToServiceEdge: number;
  countedAsExited: boolean;
}

/**
 * Dedicated Stateful Queue-Counting Engine (Milestones 6, 7 & 8)
 * - Distinguishes people inside the Queue Region from bystanders outside
 * - Prevents double-counting across temporary occlusion
 * - Identifies queue entries, service completions (passing near service edge), and non-service exits
 * - Calculates exact `peopleAhead` for a user-selected customer position
 */
export class QueueCountingEngine {
  private historyByTrack: Map<number, TrackQueueHistory> = new Map();
  private totalEnteredCount = 0;
  private totalCompletedServiceExits = 0;
  private totalAbandonedExits = 0;
  private serviceCompletionTimestampsMs: number[] = [];

  public reset(): void {
    this.historyByTrack.clear();
    this.totalEnteredCount = 0;
    this.totalCompletedServiceExits = 0;
    this.totalAbandonedExits = 0;
    this.serviceCompletionTimestampsMs = [];
  }

  public recordManualServiceCompletion(timestampMs: number = Date.now()): void {
    this.totalCompletedServiceExits += 1;
    this.serviceCompletionTimestampsMs.push(timestampMs);
  }

  public getServiceCompletionTimestamps(): number[] {
    return [...this.serviceCompletionTimestampsMs];
  }

  public processFrameTracks(
    tracks: TrackedPerson[],
    region: QueueRegion,
    timestampMs: number,
    targetPositionMode: 'last_in_queue' | number = 'last_in_queue',
    occlusionGraceMs = 2500
  ): QueueCountingSnapshot {
    const activeTrackIdSet = new Set<number>();

    const annotatedTracks: TrackedPerson[] = tracks.map((trk) => {
      activeTrackIdSet.add(trk.trackId);
      const inside = isPersonInsideQueueRegion(trk, region);
      const distToService = distanceToServiceExitEdge(trk, region);

      let hist = this.historyByTrack.get(trk.trackId);
      if (!hist) {
        hist = {
          trackId: trk.trackId,
          everEnteredQueue: false,
          currentlyInQueue: false,
          nearServiceCounter: false,
          lastSeenInQueueTimestamp: 0,
          minDistanceToServiceEdge: distToService,
          countedAsExited: false,
        };
        this.historyByTrack.set(trk.trackId, hist);
      }

      if (inside) {
        if (!hist.everEnteredQueue) {
          hist.everEnteredQueue = true;
          this.totalEnteredCount += 1;
        }
        hist.currentlyInQueue = true;
        hist.lastSeenInQueueTimestamp = timestampMs;
        hist.minDistanceToServiceEdge = Math.min(hist.minDistanceToServiceEdge, distToService);
        // Within top 22% of queue lane near Service Exit Edge counts as at the service counter
        hist.nearServiceCounter = distToService < 0.22;
      } else if (hist.currentlyInQueue) {
        // Person stepped outside polygon; allow brief grace period before declaring exit
        if (timestampMs - hist.lastSeenInQueueTimestamp > occlusionGraceMs) {
          hist.currentlyInQueue = false;
          hist.nearServiceCounter = false;
          if (!hist.countedAsExited) {
            hist.countedAsExited = true;
            if (hist.minDistanceToServiceEdge < 0.28) {
              this.totalCompletedServiceExits += 1;
              this.serviceCompletionTimestampsMs.push(timestampMs);
            } else {
              this.totalAbandonedExits += 1;
            }
          }
        }
      }

      return {
        ...trk,
        inQueueRegion: inside || hist.currentlyInQueue,
      };
    });

    // Check tracks that disappeared from the frame after being inside the queue
    for (const [trackId, hist] of this.historyByTrack.entries()) {
      if (!activeTrackIdSet.has(trackId) && hist.currentlyInQueue) {
        if (timestampMs - hist.lastSeenInQueueTimestamp > occlusionGraceMs) {
          hist.currentlyInQueue = false;
          hist.nearServiceCounter = false;
          if (!hist.countedAsExited) {
            hist.countedAsExited = true;
            if (hist.minDistanceToServiceEdge < 0.28) {
              this.totalCompletedServiceExits += 1;
              this.serviceCompletionTimestampsMs.push(timestampMs);
            } else {
              this.totalAbandonedExits += 1;
            }
          }
        }
      }
    }

    // Sort people currently inside the queue from front (closest to service counter) to back
    const inQueueTracks = annotatedTracks
      .filter((t) => t.inQueueRegion)
      .sort((a, b) => distanceToServiceExitEdge(a, region) - distanceToServiceExitEdge(b, region));

    const currentQueueCount = inQueueTracks.length;
    const outsideQueueCount = Math.max(0, annotatedTracks.length - currentQueueCount);
    const currentlyBeingServedCount = inQueueTracks.filter(
      (t) => distanceToServiceExitEdge(t, region) < 0.22
    ).length;

    let selectedCustomerPosition = currentQueueCount;
    if (typeof targetPositionMode === 'number' && targetPositionMode >= 1) {
      selectedCustomerPosition = Math.min(currentQueueCount, Math.floor(targetPositionMode));
    }

    const peopleAheadOfSelected =
      currentQueueCount === 0
        ? 0
        : targetPositionMode === 'last_in_queue'
        ? currentQueueCount
        : Math.max(0, selectedCustomerPosition - 1);

    return {
      annotatedTracks,
      totalDetectedInFrame: annotatedTracks.length,
      currentQueueCount,
      outsideQueueCount,
      currentlyBeingServedCount,
      peopleAheadOfSelected,
      selectedCustomerPosition,
      totalEnteredCount: this.totalEnteredCount,
      totalCompletedServiceExits: this.totalCompletedServiceExits,
      totalAbandonedExits: this.totalAbandonedExits,
      serviceCompletionTimestampsMs: [...this.serviceCompletionTimestampsMs],
    };
  }
}
