import { QueueSessionSummary } from '../../types';

export interface AggregatedAnalytics {
  totalSessions: number;
  totalPeopleServed: number;
  overallAvgWaitSeconds: number;
  overallAvgServiceRate: number;
  peakQueueObserved: number;
  peakPeriodLabel: string;
}

export function aggregateSessionMetrics(sessions: QueueSessionSummary[]): AggregatedAnalytics {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalPeopleServed: 0,
      overallAvgWaitSeconds: 0,
      overallAvgServiceRate: 0,
      peakQueueObserved: 0,
      peakPeriodLabel: 'No sessions recorded',
    };
  }

  let totalServed = 0;
  let weightedWaitSum = 0;
  let rateSum = 0;
  let peakQueueObserved = 0;
  let peakSessionTitle = sessions[0].title;

  for (const s of sessions) {
    totalServed += s.totalServed;
    weightedWaitSum += s.averageWaitSeconds;
    rateSum += s.averageServiceRatePerMin;
    if (s.peakQueueCount > peakQueueObserved) {
      peakQueueObserved = s.peakQueueCount;
      peakSessionTitle = `${s.locationLabel} (${new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    }
  }

  return {
    totalSessions: sessions.length,
    totalPeopleServed: totalServed,
    overallAvgWaitSeconds: Math.round(weightedWaitSum / sessions.length),
    overallAvgServiceRate: Number((rateSum / sessions.length).toFixed(2)),
    peakQueueObserved,
    peakPeriodLabel: peakSessionTitle,
  };
}

/**
 * Clearly labelled sample demonstration sessions used ONLY when the user
 * enables Demonstration Mode for live college presentation of chart layouts.
 */
export const SAMPLE_DEMO_SESSIONS: QueueSessionSummary[] = [
  {
    id: 'sample-session-cafeteria-noon',
    title: 'Main Campus Cafeteria — Lunch Peak (Sample)',
    locationLabel: 'Student Union Counter A',
    sourceType: 'sample_demo',
    isSampleData: true,
    startedAt: '2026-11-16T12:10:00.000Z',
    endedAt: '2026-11-16T12:40:00.000Z',
    durationSeconds: 1800,
    peakQueueCount: 14,
    averageQueueCount: 9,
    totalEntered: 68,
    totalServed: 64,
    averageWaitSeconds: 245,
    averageServiceRatePerMin: 2.13,
    reliability: 'high',
    notes: 'Sample demonstration dataset illustrating midday cafeteria queue surge and steady 2.1 people/min service rate.',
    timeline: [
      { timestampOffsetSec: 0, timeLabel: '12:10', queueCount: 5, estimatedWaitMinutes: 2.4, serviceRatePerMin: 2.1 },
      { timestampOffsetSec: 300, timeLabel: '12:15', queueCount: 8, estimatedWaitMinutes: 3.8, serviceRatePerMin: 2.1 },
      { timestampOffsetSec: 600, timeLabel: '12:20', queueCount: 12, estimatedWaitMinutes: 5.5, serviceRatePerMin: 2.2 },
      { timestampOffsetSec: 900, timeLabel: '12:25', queueCount: 14, estimatedWaitMinutes: 6.4, serviceRatePerMin: 2.2 },
      { timestampOffsetSec: 1200, timeLabel: '12:30', queueCount: 10, estimatedWaitMinutes: 4.8, serviceRatePerMin: 2.1 },
      { timestampOffsetSec: 1500, timeLabel: '12:35', queueCount: 7, estimatedWaitMinutes: 3.5, serviceRatePerMin: 2.0 },
      { timestampOffsetSec: 1800, timeLabel: '12:40', queueCount: 4, estimatedWaitMinutes: 1.9, serviceRatePerMin: 2.1 },
    ],
  },
  {
    id: 'sample-session-admin-desk',
    title: 'Registrar Helpdesk — Morning Window (Sample)',
    locationLabel: 'Admin Block Hallway',
    sourceType: 'sample_demo',
    isSampleData: true,
    startedAt: '2026-11-16T09:30:00.000Z',
    endedAt: '2026-11-16T09:55:00.000Z',
    durationSeconds: 1500,
    peakQueueCount: 8,
    averageQueueCount: 5,
    totalEntered: 24,
    totalServed: 22,
    averageWaitSeconds: 340,
    averageServiceRatePerMin: 0.88,
    reliability: 'high',
    notes: 'Sample demonstration dataset showing slower document verification service rate (0.88 people/min).',
    timeline: [
      { timestampOffsetSec: 0, timeLabel: '09:30', queueCount: 3, estimatedWaitMinutes: 3.4, serviceRatePerMin: 0.9 },
      { timestampOffsetSec: 300, timeLabel: '09:35', queueCount: 6, estimatedWaitMinutes: 6.7, serviceRatePerMin: 0.9 },
      { timestampOffsetSec: 600, timeLabel: '09:40', queueCount: 8, estimatedWaitMinutes: 9.4, serviceRatePerMin: 0.85 },
      { timestampOffsetSec: 900, timeLabel: '09:45', queueCount: 6, estimatedWaitMinutes: 6.8, serviceRatePerMin: 0.88 },
      { timestampOffsetSec: 1200, timeLabel: '09:50', queueCount: 4, estimatedWaitMinutes: 4.4, serviceRatePerMin: 0.9 },
      { timestampOffsetSec: 1500, timeLabel: '09:55', queueCount: 2, estimatedWaitMinutes: 2.2, serviceRatePerMin: 0.9 },
    ],
  },
  {
    id: 'sample-session-library-checkout',
    title: 'Central Library Circulation Desk (Sample)',
    locationLabel: 'Ground Floor West',
    sourceType: 'sample_demo',
    isSampleData: true,
    startedAt: '2026-11-15T16:00:00.000Z',
    endedAt: '2026-11-15T16:20:00.000Z',
    durationSeconds: 1200,
    peakQueueCount: 6,
    averageQueueCount: 3,
    totalEntered: 35,
    totalServed: 35,
    averageWaitSeconds: 105,
    averageServiceRatePerMin: 1.75,
    reliability: 'high',
    notes: 'Sample demonstration dataset for rapid barcode self-checkout assistance.',
    timeline: [
      { timestampOffsetSec: 0, timeLabel: '16:00', queueCount: 2, estimatedWaitMinutes: 1.1, serviceRatePerMin: 1.8 },
      { timestampOffsetSec: 300, timeLabel: '16:05', queueCount: 5, estimatedWaitMinutes: 2.9, serviceRatePerMin: 1.7 },
      { timestampOffsetSec: 600, timeLabel: '16:10', queueCount: 6, estimatedWaitMinutes: 3.4, serviceRatePerMin: 1.75 },
      { timestampOffsetSec: 900, timeLabel: '16:15', queueCount: 3, estimatedWaitMinutes: 1.7, serviceRatePerMin: 1.8 },
      { timestampOffsetSec: 1200, timeLabel: '16:20', queueCount: 1, estimatedWaitMinutes: 0.6, serviceRatePerMin: 1.7 },
    ],
  },
];
