import { TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartTooltip, formatCompact, formatXof, GRID_COLOR, SERIES, TICK } from '@/pages/shared/chart-theme';
import type { MonthlyRevenue } from '@/utils/api/billing/billing.type';

const MONTHS = 12;
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });

type Point = { month: string; label: string; gross: number; fees: number; net: number; count: number };

/** The last 12 months up to the latest payment, empty months at 0 (the time axis has no gaps) */
function toPoints(monthly: MonthlyRevenue[]): Point[] {
  if (monthly.length === 0) return [];
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  const [year, month] = monthly[monthly.length - 1].month.split('-').map(Number);
  return Array.from({ length: MONTHS }, (_, i) => {
    const date = new Date(year, month - 1 - (MONTHS - 1 - i), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const m = byMonth.get(key);
    return { month: key, label: monthFormat.format(date), gross: Number(m?.gross ?? 0), fees: Number(m?.fees ?? 0), net: Number(m?.net ?? 0), count: m?.payments_count ?? 0 };
  });
}

type TooltipProps = { active?: boolean; payload?: { payload?: Point }[]; label?: ReactNode; netLabel: string };

/** Net in the series color; gross and commission as plain rows of the same tooltip */
function RevenueTooltip({ active, payload, label, netLabel }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!point) return null;
  return (
    <ChartTooltip
      active={active}
      label={label}
      format={formatXof}
      payload={[
        { name: netLabel, value: point.net, color: SERIES[0] },
        { name: 'Payé par les membres', value: point.gross, color: '#cbd5e1' },
        { name: 'Commission Kodinga', value: point.fees, color: '#cbd5e1' },
      ]}
    />
  );
}

type Props = {
  monthly: MonthlyRevenue[];
  /** Who the net goes to, from the reader's point of view */
  netLabel?: string;
  emptyText?: string;
};

/** Magnitude over time, one measure: net revenue per month, in bars */
function RevenueChart({
  monthly,
  netLabel = 'Net pour vous',
  emptyText = 'Aucun paiement reçu pour l’instant : vos revenus mois par mois s’afficheront ici.',
}: Props) {
  const points = toPoints(monthly);

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
        <TrendingUp className="size-6 text-slate-400" aria-hidden />
        <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-64 w-full" role="img" aria-label="Revenus nets par mois, sur les 12 derniers mois">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={8}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={48} />
            <Tooltip content={<RevenueTooltip netLabel={netLabel} />} cursor={{ fill: '#f1f5f9' }} />
            <Bar isAnimationActive={false} dataKey="net" name={netLabel} fill={SERIES[0]} maxBarSize={32} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Revenus par mois</caption>
        <thead>
          <tr>
            <th>Mois</th>
            <th>Payé par les membres</th>
            <th>Commission Kodinga</th>
            <th>{netLabel}</th>
            <th>Paiements</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <td>{p.label}</td>
              <td>{formatXof(p.gross)}</td>
              <td>{formatXof(p.fees)}</td>
              <td>{formatXof(p.net)}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default RevenueChart;
