import { ReliabilityLevel, WaitTimePrediction } from '../../types';

export interface WaitPredictionInput {
  peopleInQueue: number;
  departureTimestampsMs: number[]; // Timestamps of observed service completions
  sessionStartTimeMs: number;
  currentTimeMs: number;
  previousSmoothedRatePerMin?: number | null;
  emaAlpha?: number; // Exponential moving average smoothing factor (default 0.35)
}

export function formatWaitDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return 'Awaiting observations';
  }
  if (seconds === 0) {
    return '0 min (Immediate)';
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.round(seconds % 60);
  if (mins === 0) {
    return `${remSecs} sec`;
  }
  if (remSecs === 0) {
    return `${mins} min`;
  }
  return `${mins}m ${remSecs}s`;
}

/**
 * Computes waiting-time prediction using:
 *   Estimated Waiting Time = People Ahead / Observed Service Rate
 *
 * Includes safeguards for:
 * - Zero service rate
 * - Insufficient observations (< 2 completed service departures)
 * - Exponential moving average (EMA) smoothing against sudden rate spikes
 */
export function computeWaitTimePrediction(input: WaitPredictionInput): WaitTimePrediction {
  const {
    peopleInQueue,
    departureTimestampsMs,
    sessionStartTimeMs,
    currentTimeMs,
    previousSmoothedRatePerMin = null,
    emaAlpha = 0.35,
  } = input;

  const validPeople = Math.max(0, Math.floor(peopleInQueue));
  const completedCount = departureTimestampsMs.length;
  const elapsedMinutes = Math.max(0.1, (currentTimeMs - sessionStartTimeMs) / 60000);

  if (validPeople === 0) {
    return {
      peopleInQueue: 0,
      observedServiceRatePerMin: completedCount >= 2 ? Number((completedCount / elapsedMinutes).toFixed(2)) : null,
      smoothedServiceRatePerMin: previousSmoothedRatePerMin,
      estimatedWaitSeconds: 0,
      estimatedWaitFormatted: '0 min (No queue)',
      reliability: completedCount >= 3 ? 'high' : 'moderate',
      reliabilityReason: 'Queue region is currently clear (0 people ahead).',
      completedDeparturesCount: completedCount,
      lastUpdatedTimestamp: currentTimeMs,
    };
  }

  // Require at least 2 observed service completions before claiming a valid rate
  if (completedCount < 2) {
    return {
      peopleInQueue: validPeople,
      observedServiceRatePerMin: null,
      smoothedServiceRatePerMin: null,
      estimatedWaitSeconds: null,
      estimatedWaitFormatted: 'Calibrating service rate...',
      reliability: 'insufficient_data',
      reliabilityReason: `Observed ${completedCount} of 2 minimum service completions required to calculate rate.`,
      completedDeparturesCount: completedCount,
      lastUpdatedTimestamp: currentTimeMs,
    };
  }

  // Compute interval-based service rate across recent window (up to last 6 departures)
  const sorted = [...departureTimestampsMs].sort((a, b) => a - b);
  const recentWindow = sorted.slice(-6);
  const windowSpanMinutes = (currentTimeMs - recentWindow[0]) / 60000;

  if (windowSpanMinutes <= 0.05) {
    return {
      peopleInQueue: validPeople,
      observedServiceRatePerMin: null,
      smoothedServiceRatePerMin: null,
      estimatedWaitSeconds: null,
      estimatedWaitFormatted: 'Stabilizing intervals...',
      reliability: 'insufficient_data',
      reliabilityReason: 'Observation time window is too short (< 3 seconds).',
      completedDeparturesCount: completedCount,
      lastUpdatedTimestamp: currentTimeMs,
    };
  }

  const rawRatePerMin = recentWindow.length / windowSpanMinutes;

  if (rawRatePerMin <= 0.01) {
    return {
      peopleInQueue: validPeople,
      observedServiceRatePerMin: 0,
      smoothedServiceRatePerMin: 0,
      estimatedWaitSeconds: null,
      estimatedWaitFormatted: 'Queue stalled (0/min)',
      reliability: 'low',
      reliabilityReason: 'Observed service rate is near zero; waiting time cannot be bounded.',
      completedDeparturesCount: completedCount,
      lastUpdatedTimestamp: currentTimeMs,
    };
  }

  const smoothedRate =
    previousSmoothedRatePerMin && previousSmoothedRatePerMin > 0
      ? emaAlpha * rawRatePerMin + (1 - emaAlpha) * previousSmoothedRatePerMin
      : rawRatePerMin;

  // Formula: Estimated Waiting Time (min) = People Ahead / Smoothed Service Rate (people/min)
  const estimatedWaitMinutes = validPeople / smoothedRate;
  const estimatedWaitSeconds = Math.round(estimatedWaitMinutes * 60);

  let reliability: ReliabilityLevel = 'low';
  let reliabilityReason = 'Limited departure samples collected; estimate may fluctuate.';

  if (completedCount >= 6 && elapsedMinutes >= 2) {
    reliability = 'high';
    reliabilityReason = `Based on ${completedCount} verified service completions with EMA smoothing.`;
  } else if (completedCount >= 3) {
    reliability = 'moderate';
    reliabilityReason = `Based on ${completedCount} service completions; confidence increases with more exits.`;
  }

  return {
    peopleInQueue: validPeople,
    observedServiceRatePerMin: Number(rawRatePerMin.toFixed(2)),
    smoothedServiceRatePerMin: Number(smoothedRate.toFixed(2)),
    estimatedWaitSeconds,
    estimatedWaitFormatted: formatWaitDuration(estimatedWaitSeconds),
    reliability,
    reliabilityReason,
    completedDeparturesCount: completedCount,
    lastUpdatedTimestamp: currentTimeMs,
  };
}
