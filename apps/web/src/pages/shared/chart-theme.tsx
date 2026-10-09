import type { ReactNode } from 'react';

// Categorical slots validated with the dataviz validator (light surface): brand blue first.
// Slot 3 is below 3:1 contrast on white: always shown with a visible label/value next to it.
export const SERIES = ['#1D4ED8', '#eb6834', '#1baf7a'] as const;

export const GRID_COLOR = '#e2e8f0'; // slate-200: hairline, recessive
export const TICK = { fill: '#64748b', fontSize: 12 }; // slate-500 text, never the series color

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('fr-FR');

export const formatCompact = (v: number) => compact.format(v);
export const formatNumber = (v: number) => full.format(v);
export const formatXof = (v: number) => `${full.format(v)} FCFA`;

type TooltipRow = { name?: string | number; value?: number | string; color?: string };

/** HTML tooltip shared by the charts: series swatch + name + value in text ink */
export function ChartTooltip({
  active,
  payload,
  label,
  format = formatNumber,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: ReactNode;
  format?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-semibold text-slate-900">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((row) => (
          <li key={String(row.name)} className="flex items-center gap-2 text-slate-600">
            <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
            <span>{row.name}</span>
            <span className="ml-auto pl-3 font-semibold text-slate-900 tabular-nums">
              {typeof row.value === 'number' ? format(row.value) : row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
