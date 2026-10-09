import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { topCommunities } from '@/data/admin-dashboard.data';
import { ChartTooltip, formatCompact, GRID_COLOR, SERIES, TICK } from '@/pages/shared/chart-theme';

// Magnitude of one measure: a single hue, sorted, value labels at the bar end
export default function TopCommunitiesBarChart() {
  const data = [...topCommunities].sort((a, b) => b.members - a.members);

  return (
    <div className="h-72 w-full" role="img" aria-label="Top 6 des communautés par nombre de membres">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={10}>
          <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
          <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <YAxis type="category" dataKey="name" tick={TICK} tickLine={false} axisLine={false} width={150} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar isAnimationActive={false} dataKey="members" name="Membres" fill={SERIES[0]} maxBarSize={24} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="members" position="right" formatter={(v) => formatCompact(Number(v))} style={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
