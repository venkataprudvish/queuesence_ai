import React, { useState } from 'react';
import { BarChart2, Clock, Users, TrendingUp, Eye } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../hooks/useAppStore';
import { aggregateSessionMetrics } from '../queue-engine/analytics/sessionAggregator';
import { formatWaitDuration } from '../queue-engine/prediction/waitTimePredictor';
import {
  QueueLengthWaitChart,
  ServiceRateTrendChart,
  SessionComparisonBarChart,
} from '../charts/QueueCharts';

export const AnalyticsScreen: React.FC = () => {
  const { activeSessions, preferences, updatePreferences, navigateToMonitor } = useAppStore();
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const metrics = aggregateSessionMetrics(activeSessions);
  const currentSession =
    activeSessions.find((s) => s.id === selectedSessionId) || activeSessions[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#252B26] font-display">
            Queue Analytics & Trends
          </h1>
          <p className="text-sm text-[#777D75]">
            Inspect queue length trajectories, waiting-time estimates, service rates, and session
            comparisons.
          </p>
        </div>

        <Button
          variant={preferences.showSampleDemoData ? 'secondary' : 'outline'}
          size="sm"
          onClick={() =>
            updatePreferences({ showSampleDemoData: !preferences.showSampleDemoData })
          }
          icon={<Eye className="w-4 h-4" />}
        >
          {preferences.showSampleDemoData
            ? 'Hide Sample Demo Dataset'
            : 'Load Sample Demo Dataset'}
        </Button>
      </div>

      {activeSessions.length === 0 ? (
        <EmptyState
          icon={<BarChart2 className="w-6 h-6" />}
          title="No Queue Analytics Available Yet"
          description="Analytics charts require at least one saved monitoring session. Record a session in the Monitor tab or load the clearly labelled Sample Demonstration Dataset to inspect chart behavior."
          actionLabel="Load Sample Demonstration Dataset"
          onAction={() => updatePreferences({ showSampleDemoData: true })}
          secondaryActionLabel="Open Live Monitor"
          onSecondaryAction={() => navigateToMonitor('live')}
        />
      ) : (
        <>
          {preferences.showSampleDemoData && (
            <div className="p-3.5 rounded-xl bg-[#FFFDF6] border border-[#D49A45] flex flex-wrap items-center justify-between gap-2 text-xs text-[#252B26]">
              <span>
                <strong className="text-[#D49A45] font-semibold">Demonstration Mode Notice:</strong>{' '}
                Charts currently include clearly labelled sample demonstration sessions for college
                evaluation.
              </span>
              <button
                type="button"
                onClick={() => updatePreferences({ showSampleDemoData: false })}
                className="text-xs font-semibold text-[#244C3A] underline cursor-pointer"
              >
                Switch to Clean State
              </button>
            </div>
          )}

          {/* Historical Statistics Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md">
              <div className="flex items-center justify-between text-xs text-[#777D75] mb-1.5">
                <span>Total People Served</span>
                <Users className="w-4 h-4 text-[#244C3A]" />
              </div>
              <p className="text-2xl font-bold text-[#252B26] font-mono-tabular">
                {metrics.totalPeopleServed}
              </p>
              <p className="text-xs text-[#777D75] mt-1">
                Across {metrics.totalSessions} sessions
              </p>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between text-xs text-[#777D75] mb-1.5">
                <span>Average Wait Time</span>
                <Clock className="w-4 h-4 text-[#244C3A]" />
              </div>
              <p className="text-2xl font-bold text-[#252B26] font-mono-tabular">
                {formatWaitDuration(metrics.overallAvgWaitSeconds)}
              </p>
              <p className="text-xs text-[#777D75] mt-1">Mean session wait</p>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between text-xs text-[#777D75] mb-1.5">
                <span>Mean Service Rate</span>
                <TrendingUp className="w-4 h-4 text-[#244C3A]" />
              </div>
              <p className="text-2xl font-bold text-[#252B26] font-mono-tabular">
                {metrics.overallAvgServiceRate}/min
              </p>
              <p className="text-xs text-[#777D75] mt-1">Observed exits per min</p>
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between text-xs text-[#777D75] mb-1.5">
                <span>Peak Queue Period</span>
                <BarChart2 className="w-4 h-4 text-[#D49A45]" />
              </div>
              <p className="text-2xl font-bold text-[#252B26] font-mono-tabular">
                {metrics.peakQueueObserved} people
              </p>
              <p className="text-xs text-[#777D75] mt-1 truncate" title={metrics.peakPeriodLabel}>
                {metrics.peakPeriodLabel}
              </p>
            </Card>
          </div>

          {/* Session Selector for Timeline Charts */}
          {currentSession && (
            <Card padding="md" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#252B26]">
                    Queue Length & Waiting-Time Trends
                  </h2>
                  <p className="text-xs text-[#777D75]">
                    Forest Green (#244C3A) shows active queue count · Muted Sage (#A8B9A0) shows
                    estimated wait in minutes
                  </p>
                </div>

                <select
                  aria-label="Select session for timeline trend chart"
                  value={currentSession.id}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="min-h-[40px] px-3 py-1.5 text-xs bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26] focus:outline-none focus:border-[#244C3A]"
                >
                  {activeSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <QueueLengthWaitChart data={currentSession.timeline} />
            </Card>
          )}

          {/* Service Rate & Session Comparison Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {currentSession && (
              <Card padding="md" className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-[#252B26]">
                    Observed Service Rate Stability
                  </h2>
                  <p className="text-xs text-[#777D75]">
                    Completed service departures per minute ({currentSession.locationLabel})
                  </p>
                </div>
                <ServiceRateTrendChart data={currentSession.timeline} />
              </Card>
            )}

            <Card padding="md" className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-[#252B26]">
                  Multi-Session Comparison
                </h2>
                <p className="text-xs text-[#777D75]">
                  Peak queue count (Forest Green) vs average wait minutes (Muted Sage)
                </p>
              </div>
              <SessionComparisonBarChart sessions={activeSessions} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
