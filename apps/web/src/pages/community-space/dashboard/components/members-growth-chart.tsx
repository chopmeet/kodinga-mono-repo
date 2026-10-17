import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { MonthlyNewMembers } from '../form/UseCommunityDashboard';
import { ChartTooltip, formatCompact, GRID_COLOR, SERIES, TICK } from '@/pages/shared/chart-theme';

// One series: the panel title names it, no legend box
function MembersGrowthChart({ data }: { data: MonthlyNewMembers }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Nouveaux membres par mois sur 12 mois">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={{ stroke: GRID_COLOR }} interval="preserveStartEnd" />
          <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={40} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="newMembers"
            name="Nouveaux membres"
            stroke={SERIES[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MembersGrowthChart;
