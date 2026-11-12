import { formatXof, SERIES } from '@/pages/shared/chart-theme';
import type { PaymentMethodStat } from '@/utils/api/admin/admin.type';

// 5 parts of a whole are easier to compare as sorted bars than as pie slices.
// Plain HTML bars: one hue, value + share written next to each.
// analytics/financial/ → payment_methods_30d: what was collected per PayDunya channel over 30 days
export default function PaymentMethodsBars({ methods }: { methods: PaymentMethodStat[] }) {
  const data = [...methods].sort((a, b) => b.amount - a.amount);
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Aucun paiement encaissé sur les 30 derniers jours.</p>;
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const max = data[0]?.amount ?? 1;

  return (
    <div>
      <ul className="space-y-3">
        {data.map((d) => (
          <li key={d.method}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-body">{d.method}</span>
              <span className="text-foreground tabular-nums">
                <span className="font-semibold">{formatXof(d.amount)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{Math.round((d.amount / total) * 100)} %</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.amount / max) * 100}%`, backgroundColor: SERIES[0] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        Total encaissé via PayDunya : <span className="font-semibold text-body">{formatXof(total)}</span>
      </p>
    </div>
  );
}
