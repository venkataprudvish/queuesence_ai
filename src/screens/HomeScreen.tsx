import React from 'react';
import {
  Video,
  FileVideo,
  Clock,
  Users,
  Activity,
  ArrowUpRight,
  Sliders,
  Compass,
  LogIn,
  PlayCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../hooks/useAppStore';
import { aggregateSessionMetrics } from '../queue-engine/analytics/sessionAggregator';
import { formatWaitDuration } from '../queue-engine/prediction/waitTimePredictor';

export const HomeScreen: React.FC = () => {
  const {
    user,
    preferences,
    updatePreferences,
    activeSessions,
    navigateToMonitor,
    setActiveTab,
    setFlowState,
  } = useAppStore();

  const metrics = aggregateSessionMetrics(activeSessions);

  return (
    <div className="space-y-8">
      {/* Welcome & Primary Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <Card padding="lg" className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#777D75] mb-3">
              <span>
                Operator: <strong className="text-[#252B26] font-medium">{user?.displayName || 'Guest Evaluator'}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {preferences.showSampleDemoData
                  ? 'Sample Demonstration Dataset Active'
                  : 'Clean Evaluation Mode (Real Data Only)'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#252B26] font-display tracking-tight mb-3">
              Don&apos;t Just Wait. Know Your Wait.
            </h1>
            <p className="text-sm sm:text-base text-[#777D75] leading-relaxed mb-6 max-w-xl">
              Monitor real-world queues using local browser computer vision, configure polygonal
              service lanes, and compute waiting-time estimates from verified service completions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigateToMonitor('live')}
              icon={<Video className="w-4 h-4" />}
            >
              Start Live Monitoring
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigateToMonitor('video')}
              icon={<FileVideo className="w-4 h-4" />}
            >
              Analyze Video
            </Button>
          </div>
        </Card>

        {/* Demonstration & Flow Controls Card */}
        <Card padding="md" className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#252B26] mb-1">
              Demonstration & Flow Controls
            </h2>
            <p className="text-xs text-[#777D75] leading-relaxed mb-4">
              Switch between clean evaluation state and clearly labelled sample demonstration data,
              or inspect onboarding and authentication screens.
            </p>

            <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-[#252B26]">
                  Sample Demonstration Data
                </p>
                <p className="text-[11px] text-[#777D75]">
                  {preferences.showSampleDemoData
                    ? 'Showing 3 labelled sample sessions in charts'
                    : 'Hidden — showing only recorded sessions'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.showSampleDemoData}
                onClick={() =>
                  updatePreferences({ showSampleDemoData: !preferences.showSampleDemoData })
                }
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  preferences.showSampleDemoData
                    ? 'bg-[#244C3A] text-[#F7F5EC]'
                    : 'bg-[#E1E6DA] text-[#244C3A]'
                }`}
              >
                {preferences.showSampleDemoData ? 'Enabled' : 'Enable Demo Data'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E1E6DA]">
            <button
              type="button"
              onClick={() => setFlowState('splash')}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#F7F5EC] hover:bg-[#E1E6DA]/60 text-xs font-medium text-[#252B26] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5 text-[#244C3A]" />
              <span>Splash</span>
            </button>
            <button
              type="button"
              onClick={() => setFlowState('onboarding')}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#F7F5EC] hover:bg-[#E1E6DA]/60 text-xs font-medium text-[#252B26] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-[#244C3A]" />
              <span>Onboarding</span>
            </button>
            <button
              type="button"
              onClick={() => setFlowState('auth')}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#F7F5EC] hover:bg-[#E1E6DA]/60 text-xs font-medium text-[#252B26] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 text-[#244C3A]" />
              <span>Auth Screen</span>
            </button>
          </div>
        </Card>
      </section>

      {/* Quick Queue Statistics (4-column KPI strip below hero split) */}
      <section aria-label="Quick Queue Statistics">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#252B26]">Quick Queue Statistics</h2>
          <span className="text-xs text-[#777D75]">
            {activeSessions.length === 0
              ? 'No sessions recorded yet'
              : preferences.showSampleDemoData
              ? 'Includes labelled sample demonstration sessions'
              : 'Computed from recorded sessions'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="flex items-center justify-between text-xs text-[#777D75] mb-2">
              <span>Sessions Analyzed</span>
              <Activity className="w-4 h-4 text-[#244C3A]" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#252B26] font-mono-tabular">
              {metrics.totalSessions}
            </p>
            <p className="text-xs text-[#777D75] mt-1">
              {metrics.totalSessions === 0 ? 'Ready to record' : 'Saved summaries'}
            </p>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between text-xs text-[#777D75] mb-2">
              <span>Average Wait Time</span>
              <Clock className="w-4 h-4 text-[#244C3A]" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#252B26] font-mono-tabular">
              {metrics.totalSessions > 0
                ? formatWaitDuration(metrics.overallAvgWaitSeconds)
                : '—'}
            </p>
            <p className="text-xs text-[#777D75] mt-1">
              {metrics.totalSessions > 0 ? 'Across active sessions' : 'Awaiting session data'}
            </p>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between text-xs text-[#777D75] mb-2">
              <span>Mean Service Rate</span>
              <Sliders className="w-4 h-4 text-[#244C3A]" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#252B26] font-mono-tabular">
              {metrics.totalSessions > 0 ? `${metrics.overallAvgServiceRate}/min` : '—'}
            </p>
            <p className="text-xs text-[#777D75] mt-1">
              {metrics.totalSessions > 0 ? 'Verified exits per minute' : 'Requires ≥ 2 exits'}
            </p>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between text-xs text-[#777D75] mb-2">
              <span>Peak Queue Count</span>
              <Users className="w-4 h-4 text-[#244C3A]" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#252B26] font-mono-tabular">
              {metrics.totalSessions > 0 ? `${metrics.peakQueueObserved} people` : '—'}
            </p>
            <p className="text-xs text-[#777D75] mt-1 truncate" title={metrics.peakPeriodLabel}>
              {metrics.peakPeriodLabel}
            </p>
          </Card>
        </div>
      </section>

      {/* Recent Monitoring Sessions & Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#252B26]">
              Recent Monitoring Sessions
            </h2>
            {activeSessions.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="text-xs font-semibold text-[#244C3A] hover:underline flex items-center gap-1 cursor-pointer min-h-[36px]"
              >
                <span>View All History</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeSessions.length === 0 ? (
            <EmptyState
              icon={<Video className="w-6 h-6" />}
              title="No Monitoring Sessions Recorded Yet"
              description="Launch the Live Queue Monitor, upload a queue video, or enable Sample Demonstration Data above to explore historical charts and session summaries."
              actionLabel="Open Live Monitor"
              onAction={() => navigateToMonitor('live')}
              secondaryActionLabel="Load Sample Demo Data"
              onSecondaryAction={() => updatePreferences({ showSampleDemoData: true })}
            />
          ) : (
            <div className="space-y-3">
              {activeSessions.slice(0, 3).map((session) => (
                <Card
                  key={session.id}
                  padding="md"
                  onClick={() => setActiveTab('history')}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#777D75]">
                      <span>{session.locationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {new Date(session.startedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(session.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {session.isSampleData && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#D49A45] font-semibold">
                            Sample Demonstration Data
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-[#252B26]">{session.title}</h3>
                  </div>

                  <div className="flex items-center gap-6 text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E1E6DA]">
                    <div>
                      <p className="text-[11px] text-[#777D75]">Avg Wait</p>
                      <p className="text-sm font-bold text-[#244C3A] font-mono-tabular">
                        {formatWaitDuration(session.averageWaitSeconds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#777D75]">Peak Queue</p>
                      <p className="text-sm font-bold text-[#252B26] font-mono-tabular">
                        {session.peakQueueCount} people
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#777D75]">Service Rate</p>
                      <p className="text-sm font-bold text-[#252B26] font-mono-tabular">
                        {session.averageServiceRatePerMin}/min
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity & System Readiness Summary */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-base font-semibold text-[#252B26]">
            System Architecture Status
          </h2>
          <Card padding="md" className="space-y-4">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[#E1E6DA]">
                <span className="text-[#777D75]">Android Camera &amp; Live Preview</span>
                <span className="font-semibold text-[#477A55]">Active (Milestone 2)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E1E6DA]">
                <span className="text-[#777D75]">Person Detection &amp; Bounding Boxes</span>
                <span className="font-semibold text-[#477A55]">Active (Milestones 3–4)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E1E6DA]">
                <span className="text-[#777D75]">ByteTrack &amp; ROI Queue Counting</span>
                <span className="font-semibold text-[#477A55]">Active (Milestones 7–9)</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#777D75]">Firebase Cloud &amp; 14-Test Suite</span>
                <span className="font-semibold text-[#477A55]">Active (Milestones 10–11)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs text-[#777D75] leading-relaxed">
              Every displayed person count, bounding box, tracking ID, and waiting-time prediction
              originates from real camera or video frame processing.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => navigateToMonitor('audit')}
              >
                Audit &amp; Model Info
              </Button>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => setActiveTab('analytics')}
              >
                Queue Analytics
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};
