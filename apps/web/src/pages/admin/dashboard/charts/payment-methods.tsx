import { paymentMethods } from '@/data/admin-dashboard.data';
import { formatXof, SERIES } from '@/pages/shared/chart-theme';

// 5 parts of a whole are easier to compare as sorted bars than as pie slices.
// Plain HTML bars: one hue, value + share written next to each.
export default function PaymentMethodsBars() {
  const data = [...paymentMethods].sort((a, b) => b.amount - a.amount);
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const max = data[0]?.amount ?? 1;

  return (
    <div>
      <ul className="space-y-3">
        {data.map((d) => (
          <li key={d.method}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-700">{d.method}</span>
              <span className="text-slate-900 tabular-nums">
                <span className="font-semibold">{formatXof(d.amount)}</span>
                <span className="ml-2 text-xs text-slate-500">{Math.round((d.amount / total) * 100)} %</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.amount / max) * 100}%`, backgroundColor: SERIES[0] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        Total encaissé via PayDunya : <span className="font-semibold text-slate-700">{formatXof(total)}</span>
      </p>
    </div>
  );
}
