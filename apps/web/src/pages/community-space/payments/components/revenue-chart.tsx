import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { BillingSummary } from '@/data/community-billing.data';
import { ChartTooltip, formatCompact, formatXof, GRID_COLOR, SERIES, TICK } from '@/pages/shared/chart-theme';

// One series (gross amount): the panel title names it, no legend
function RevenueChart({ data }: { data: BillingSummary['monthlyRevenue'] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Montant encaissé par mois sur 12 mois">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={{ stroke: GRID_COLOR }} interval="preserveStartEnd" />
          <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={44} />
          <Tooltip content={<ChartTooltip format={formatXof} />} cursor={{ fill: '#f1f5f9' }} />
          <Bar isAnimationActive={false} dataKey="revenue" name="Encaissé" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RevenueChart;
