import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartTooltip, formatCompact, formatNumber, GRID_COLOR, SERIES, TICK } from '@/pages/shared/chart-theme';
import type { MonthlyGrowthPoint } from '@/utils/api/admin/admin.type';

type Metric = { key: 'newMembers' | 'posts'; label: string };

// Publications (~19k) and new members (~3k) differ too much for one axis: small multiples,
// one series and one axis each. The title names the series, so no legend box.
const METRICS: Metric[] = [
  { key: 'newMembers', label: 'Nouveaux membres' },
  { key: 'posts', label: 'Publications' },
];

function MiniLine({ metric, data }: { metric: Metric; data: MonthlyGrowthPoint[] }) {
  const lastPoint = data[data.length - 1];
  const last = lastPoint ? lastPoint[metric.key] : 0;
  const monthLabel = lastPoint ? `en ${lastPoint.month.toLowerCase()}.` : '';

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm text-soft">{metric.label} par mois</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatNumber(last)} <span className="font-normal text-muted-foreground">{monthLabel}</span>
        </span>
      </figcaption>
      <div className="h-56 w-full" role="img" aria-label={`${metric.label} par mois sur 12 mois`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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

/** analytics/growth/: the 12 last months (the api fills the months without activity with 0) */
export default function PlatformGrowthCharts({ data }: { data: MonthlyGrowthPoint[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Pas encore d’activité à afficher.</p>;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {METRICS.map((metric) => (
        <MiniLine key={metric.key} metric={metric} data={data} />
      ))}
    </div>
  );
}
