import { Check, X } from 'lucide-react';

import { cn } from '@kodinga-mono-repo/ui';

// Mirrors the api validators (min_length 8, NumericPasswordValidator); the server stays the source of truth
export const passwordRules = [
  { id: 'length', label: 'Au moins 8 caractères', test: (v: string) => v.length >= 8 },
  { id: 'notNumeric', label: 'Pas uniquement des chiffres', test: (v: string) => v.length > 0 && !/^\d+$/.test(v) },
  { id: 'letterAndDigit', label: 'Lettres et chiffres (recommandé)', test: (v: string) => /[a-z]/i.test(v) && /\d/.test(v) },
] as const;

export function PasswordCheck({ password }: { password: string }) {
  return (
    <ul className="grid gap-1.5 text-sm" aria-label="Exigences du mot de passe">
      {passwordRules.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className={cn('flex items-center gap-2', ok ? 'text-emerald-700' : 'text-slate-500')}>
            {ok ? <Check className="size-4" /> : <X className="size-4 text-slate-400" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
