import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { communitiesByAccess } from '@/data/admin-dashboard.data';
import { ChartTooltip, formatNumber, SERIES } from '@/pages/shared/chart-theme';

// 3 parts of a whole: a donut is fine; the legend carries value + share so identity is never color alone
export default function CommunitiesByAccessDonut() {
  const total = communitiesByAccess.reduce((sum, d) => sum + d.communities, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0" role="img" aria-label="Répartition des communautés par type d'accès">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={communitiesByAccess}
              dataKey="communities"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="#fff"
              strokeWidth={2}
            >
              {communitiesByAccess.map((d, i) => (
                <Cell key={d.id} fill={SERIES[i]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground">{formatNumber(total)}</span>
          <span className="text-xs text-muted-foreground">communautés</span>
        </div>
      </div>

      <ul className="w-full space-y-2 text-sm">
        {communitiesByAccess.map((d, i) => (
          <li key={d.id} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: SERIES[i] }} />
            <span className="text-soft">{d.label}</span>
            <span className="ml-auto font-semibold text-foreground tabular-nums">{formatNumber(d.communities)}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {Math.round((d.communities / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
