import React, { useState } from 'react';
import {
  Clock,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../hooks/useAppStore';
import { formatWaitDuration } from '../queue-engine/prediction/waitTimePredictor';
import { QueueSessionSummary } from '../types';

export const HistoryScreen: React.FC = () => {
  const {
    activeSessions,
    recordedSessions,
    preferences,
    updatePreferences,
    deleteSessionSummary,
    clearRecordedSessions,
    navigateToMonitor,
  } = useAppStore();

  const [expandedId, setExpandedId] = useState<string | null>(
    activeSessions[0]?.id ?? null
  );

  const handleExportCsv = (sessions: QueueSessionSummary[]) => {
    if (sessions.length === 0) return;
    const headers = [
      'Session ID',
      'Title',
      'Location',
      'Source Type',
      'Started At',
      'Duration (sec)',
      'Peak Queue',
      'Avg Queue',
      'Total Entered',
      'Total Served',
      'Avg Wait (sec)',
      'Service Rate (/min)',
    ];
    const rows = sessions.map((s) => [
      s.id,
      `"${s.title.replace(/"/g, '""')}"`,
      `"${s.locationLabel.replace(/"/g, '""')}"`,
      s.sourceType,
      s.startedAt,
      s.durationSeconds,
      s.peakQueueCount,
      s.averageQueueCount,
      s.totalEntered,
      s.totalServed,
      s.averageWaitSeconds,
      s.averageServiceRatePerMin,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `queuesense_sessions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#252B26] font-display">
            Monitoring Session History
          </h1>
          <p className="text-sm text-[#777D75]">
            Review past queue monitoring summaries, duration metrics, and interval logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updatePreferences({ showSampleDemoData: !preferences.showSampleDemoData })
            }
            icon={<Eye className="w-4 h-4" />}
          >
            {preferences.showSampleDemoData ? 'Hide Sample Data' : 'Show Sample Data'}
          </Button>

          {activeSessions.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExportCsv(activeSessions)}
              icon={<Download className="w-4 h-4" />}
            >
              Export CSV
            </Button>
          )}

          {recordedSessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearRecordedSessions}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Clear Recorded
            </Button>
          )}
        </div>
      </div>

      {activeSessions.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="No Session Summaries in History"
          description="Completed queue monitoring sessions and saved calibration logs appear here. Start a session in the Monitor tab or enable Sample Demonstration Data."
          actionLabel="Start Monitoring Session"
          onAction={() => navigateToMonitor('live')}
          secondaryActionLabel="Show Sample Demo Sessions"
          onSecondaryAction={() => updatePreferences({ showSampleDemoData: true })}
        />
      ) : (
        <div className="space-y-4">
          {activeSessions.map((session) => {
            const isExpanded = expandedId === session.id;
            const durationMins = Math.max(1, Math.round(session.durationSeconds / 60));

            return (
              <Card key={session.id} padding="md" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#777D75]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#244C3A]" />
                        {new Date(session.startedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Duration: {durationMins} min</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.locationLabel}</span>
                      {session.isSampleData && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#D49A45]">
                            Sample Demonstration Data
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-[#252B26]">
                      {session.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {!session.isSampleData && (
                      <button
                        type="button"
                        aria-label="Delete session summary"
                        onClick={() => deleteSessionSummary(session.id)}
                        className="min-h-[40px] px-2.5 text-xs text-[#C66B5B] hover:bg-[#F7F5EC] rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : session.id)
                      }
                      icon={
                        isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      }
                    >
                      {isExpanded ? 'Hide Details' : 'Session Details'}
                    </Button>
                  </div>
                </div>

                {/* Key Session Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E1E6DA]">
                  <div className="p-3 rounded-xl bg-[#F7F5EC]">
                    <p className="text-[11px] text-[#777D75]">Average Waiting Time</p>
                    <p className="text-base font-bold text-[#244C3A] font-mono-tabular mt-0.5">
                      {formatWaitDuration(session.averageWaitSeconds)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F7F5EC]">
                    <p className="text-[11px] text-[#777D75]">Peak / Mean Queue</p>
                    <p className="text-base font-bold text-[#252B26] font-mono-tabular mt-0.5">
                      {session.peakQueueCount} peak · {session.averageQueueCount} avg
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F7F5EC]">
                    <p className="text-[11px] text-[#777D75]">Entered / Served</p>
                    <p className="text-base font-bold text-[#252B26] font-mono-tabular mt-0.5">
                      {session.totalEntered} in · {session.totalServed} out
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F7F5EC]">
                    <p className="text-[11px] text-[#777D75]">Service Rate</p>
                    <p className="text-base font-bold text-[#252B26] font-mono-tabular mt-0.5">
                      {session.averageServiceRatePerMin} people/min
                    </p>
                  </div>
                </div>

                {/* Expanded Session Timeline Details */}
                {isExpanded && (
                  <div className="pt-3 border-t border-[#E1E6DA] space-y-3">
                    {session.notes && (
                      <p className="text-xs text-[#777D75] leading-relaxed">{session.notes}</p>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#E1E6DA] text-[#777D75]">
                            <th className="py-2 pr-4 font-medium">Time Interval</th>
                            <th className="py-2 px-4 font-medium">Queue Count</th>
                            <th className="py-2 px-4 font-medium">Estimated Wait</th>
                            <th className="py-2 pl-4 font-medium">Service Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E1E6DA]/60 font-mono-tabular">
                          {session.timeline.map((pt, i) => (
                            <tr key={i} className="text-[#252B26]">
                              <td className="py-2 pr-4">{pt.timeLabel}</td>
                              <td className="py-2 px-4">{pt.queueCount} people</td>
                              <td className="py-2 px-4 text-[#244C3A] font-semibold">
                                {pt.estimatedWaitMinutes !== null
                                  ? `${pt.estimatedWaitMinutes} min`
                                  : 'Calibrating'}
                              </td>
                              <td className="py-2 pl-4">{pt.serviceRatePerMin}/min</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
