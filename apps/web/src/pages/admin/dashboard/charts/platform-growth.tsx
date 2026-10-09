import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { type MonthlyGrowth, monthlyGrowth } from '@/data/admin-dashboard.data';
import { ChartTooltip, formatCompact, formatNumber, GRID_COLOR, SERIES, TICK } from '@/pages/shared/chart-theme';

type Metric = { key: keyof Omit<MonthlyGrowth, 'month'>; label: string };

// Publications (~19k) and new members (~3k) differ too much for one axis: small multiples,
// one series and one axis each. The title names the series, so no legend box.
const METRICS: Metric[] = [
  { key: 'newMembers', label: 'Nouveaux membres' },
  { key: 'posts', label: 'Publications' },
];

function MiniLine({ metric }: { metric: Metric }) {
  const last = monthlyGrowth[monthlyGrowth.length - 1][metric.key];

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm text-slate-600">{metric.label} par mois</span>
        <span className="text-sm font-semibold text-slate-900 tabular-nums">
          {formatNumber(last)} <span className="font-normal text-slate-500">en oct.</span>
        </span>
      </figcaption>
      <div className="h-56 w-full" role="img" aria-label={`${metric.label} par mois sur 12 mois`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthlyGrowth} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={{ stroke: GRID_COLOR }} interval="preserveStartEnd" />
            <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={40} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey={metric.key}
              name={metric.label}
              stroke={SERIES[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function PlatformGrowthCharts() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {METRICS.map((metric) => (
        <MiniLine key={metric.key} metric={metric} />
      ))}
    </div>
  );
}
