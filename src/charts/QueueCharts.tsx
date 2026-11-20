import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { QueueSessionSummary, QueueTimelinePoint } from '../types';
import { QS_COLORS } from '../styles/theme';

interface TimelineChartProps {
  data: QueueTimelinePoint[];
}

export const QueueLengthWaitChart: React.FC<TimelineChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={QS_COLORS.borderSage} />
          <XAxis
            dataKey="timeLabel"
            tick={{ fill: QS_COLORS.textSecondary, fontSize: 11 }}
            axisLine={{ stroke: QS_COLORS.borderSage }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: QS_COLORS.textSecondary, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: QS_COLORS.cardCream,
              borderColor: QS_COLORS.borderSage,
              borderRadius: '12px',
              color: QS_COLORS.textPrimary,
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="queueCount"
            name="Queue Length (People)"
            stroke={QS_COLORS.brandPrimary}
            strokeWidth={2.5}
            fill={QS_COLORS.brandPrimary}
            fillOpacity={0.14}
          />
          <Area
            type="monotone"
            dataKey="estimatedWaitMinutes"
            name="Estimated Wait (Min)"
            stroke={QS_COLORS.secondarySage}
            strokeWidth={2}
            fill={QS_COLORS.secondarySage}
            fillOpacity={0.22}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ServiceRateTrendChart: React.FC<TimelineChartProps> = ({ data }) => {
  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={QS_COLORS.borderSage} />
          <XAxis
            dataKey="timeLabel"
            tick={{ fill: QS_COLORS.textSecondary, fontSize: 11 }}
            axisLine={{ stroke: QS_COLORS.borderSage }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: QS_COLORS.textSecondary, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: QS_COLORS.cardCream,
              borderColor: QS_COLORS.borderSage,
              borderRadius: '12px',
              color: QS_COLORS.textPrimary,
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="serviceRatePerMin"
            name="Service Rate (People/min)"
            stroke={QS_COLORS.brandPrimary}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: QS_COLORS.brandPrimary }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface SessionComparisonChartProps {
  sessions: QueueSessionSummary[];
}

export const SessionComparisonBarChart: React.FC<SessionComparisonChartProps> = ({
  sessions,
}) => {
  const chartData = sessions.slice(0, 6).map((s) => ({
    name: s.locationLabel.length > 16 ? `${s.locationLabel.slice(0, 15)}…` : s.locationLabel,
    peakQueue: s.peakQueueCount,
    avgWaitMin: Number((s.averageWaitSeconds / 60).toFixed(1)),
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={QS_COLORS.borderSage} />
          <XAxis
            dataKey="name"
            tick={{ fill: QS_COLORS.textSecondary, fontSize: 11 }}
            axisLine={{ stroke: QS_COLORS.borderSage }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: QS_COLORS.textSecondary, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: QS_COLORS.cardCream,
              borderColor: QS_COLORS.borderSage,
              borderRadius: '12px',
              color: QS_COLORS.textPrimary,
              fontSize: '12px',
            }}
          />
          <Bar
            dataKey="peakQueue"
            name="Peak Queue (People)"
            fill={QS_COLORS.brandPrimary}
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="avgWaitMin"
            name="Avg Wait (Min)"
            fill={QS_COLORS.secondarySage}
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
