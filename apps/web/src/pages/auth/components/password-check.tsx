import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@kodinga/ui';

// Mirrors the api validators (min_length 8, NumericPasswordValidator); the server stays the source of truth
export const passwordRules = [
  { id: 'length', test: (v: string) => v.length >= 8 },
  { id: 'notNumeric', test: (v: string) => v.length > 0 && !/^\d+$/.test(v) },
  { id: 'letterAndDigit', test: (v: string) => /[a-z]/i.test(v) && /\d/.test(v) },
] as const;

export function PasswordCheck({ password }: { password: string }) {
  const { t } = useTranslation();
  return (
    <ul className="grid gap-1.5 text-sm" aria-label={t('auth.password.rules')}>
      {passwordRules.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={cn('flex items-center gap-2', ok ? 'text-emerald-700' : 'text-slate-500')}>
            {ok ? <Check className="size-4" /> : <X className="size-4 text-slate-400" />}
            {t(`auth.password.${rule.id}`)}
          </li>
        );
      })}
    </ul>
  );
}
