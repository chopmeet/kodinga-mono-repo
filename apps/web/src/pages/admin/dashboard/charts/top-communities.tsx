import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartTooltip, formatCompact, GRID_COLOR, SERIES, TICK } from '@/pages/shared/chart-theme';
import type { CommunityRanking } from '../form/UseAdminDashboard';

// Magnitude of one measure: a single hue, sorted, value labels at the bar end
export default function TopCommunitiesBarChart({ communities }: { communities: CommunityRanking[] }) {
  const data = [...communities].sort((a, b) => b.members - a.members);

  if (data.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-400">Aucune communauté pour le moment.</p>;
  }

  return (
    <div className="h-72 w-full" role="img" aria-label={`Top ${data.length} des communautés par nombre de membres`}>
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
