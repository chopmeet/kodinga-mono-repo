import { Activity } from 'lucide-react';

import { cn } from '@kodinga-mono-repo/ui';

const DAY_LABELS = ['Lun.', '', 'Mer.', '', 'Ven.', '', 'Dim.'];
const LEVELS = ['bg-blue-50', 'bg-blue-200', 'bg-blue-400', 'bg-primary'];
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

/** Monday-first week grid ending on `end`: 53 columns of 7 days */
function buildWeeks(end: Date) {
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const mondayOffset = (last.getDay() + 6) % 7;
  const start = new Date(last);
  start.setDate(last.getDate() - mondayOffset - 52 * 7);
  return Array.from({ length: 53 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      return day > last ? null : day;
    })
  );
}

type Props = {
  year: number;
  /** Contributions per ISO day (yyyy-mm-dd); empty until the api exposes the activity */
  counts?: Record<string, number>;
};

/** GitHub-like contribution grid over the last 12 months of `year` */
export function ActivityHeatmap({ year, counts = {} }: Props) {
  const now = new Date();
  const end = year >= now.getFullYear() ? now : new Date(year, 11, 31);
  const weeks = buildWeeks(end);
  const level = (n: number) => (n <= 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : 3);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // A month label above the first week that starts in that month
  const monthLabels = weeks.map((week, i) => {
    const first = week[0];
    if (!first) return '';
    const previous = weeks[i - 1]?.[0];
    return !previous || previous.getMonth() !== first.getMonth() ? monthFormat.format(first).replace(/^./, (c) => c.toUpperCase()) : '';
  });

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-grid min-w-full grid-cols-[2.5rem_1fr] gap-x-2" role="img" aria-label={`Contributions sur 12 mois jusqu'en ${year}`}>
          <span />
          <div className="grid grid-flow-col auto-cols-fr gap-1 text-xs text-slate-500">
            {monthLabels.map((label, i) => (
              <span key={i} className="whitespace-nowrap">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-2 grid grid-rows-7 gap-1 text-[11px] text-slate-500">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="flex h-3.5 items-center">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-2 grid grid-flow-col auto-cols-fr gap-1">
            {weeks.map((week, w) => (
              <div key={w} className="grid grid-rows-7 gap-1">
                {week.map((day, d) =>
                  day ? (
                    <span
                      key={d}
                      title={`${day.toLocaleDateString('fr-FR')} : ${counts[iso(day)] ?? 0} contribution(s)`}
                      className={cn('h-3.5 min-w-3 rounded-[3px]', LEVELS[level(counts[iso(day)] ?? 0)])}
                    />
                  ) : (
                    <span key={d} className="h-3.5" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Activity className="size-4" aria-hidden />
          Les contributions au fil du temps
        </span>
        <span className="flex items-center gap-1.5">
          Moins
          {LEVELS.map((c) => (
            <span key={c} className={cn('size-3 rounded-[3px]', c)} />
          ))}
          Plus
        </span>
      </div>
    </div>
  );
}
