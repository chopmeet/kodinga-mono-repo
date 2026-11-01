import { useEffect, useState } from 'react';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@kodinga-mono-repo/ui';
import SettingSwitch from '@/pages/shared/setting-switch';
import type { PointRule, PointRulesUpdate } from '@/utils/api/gamification/gamification.type';

type Draft = Record<string, { points: string; is_active: boolean }>;

const toDraft = (rules: PointRule[]): Draft => Object.fromEntries(rules.map((r) => [r.action, { points: String(r.points), is_active: r.is_active }]));

type Props = {
  open: boolean;
  rules: PointRule[];
  onOpenChange: (open: boolean) => void;
  /** true once the api accepted it: the dialog closes */
  onSave: (input: PointRulesUpdate) => Promise<boolean>;
};

/** Points of each action in the community: only the changed rules are sent, with an optional note (kept in the history) */
function RulesModal({ open, rules, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rules));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(rules));
      setNote('');
      setError(null);
    }
  }, [open, rules]);

  const set = (action: string, patch: Partial<Draft[string]>) => setDraft((d) => ({ ...d, [action]: { ...d[action], ...patch } }));

  const submit = async () => {
    const changed = rules.filter((r) => draft[r.action] && (Number(draft[r.action].points) !== r.points || draft[r.action].is_active !== r.is_active));
    if (changed.some((r) => !/^\d+$/.test(draft[r.action].points))) {
      setError('Les points sont des nombres entiers, 0 ou plus.');
      return;
    }
    if (changed.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    const saved = await onSave({
      rules: changed.map((r) => ({ action: r.action, points: Number(draft[r.action].points), is_active: draft[r.action].is_active })),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setSaving(false);
    if (saved) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent position="top" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Barème des points</DialogTitle>
          <DialogDescription>Points gagnés pour chaque action dans la communauté. Les points déjà gagnés ne changent pas.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-slate-100" aria-label="Règles du barème">
          {rules.map((r) => (
            <li key={r.action} className="grid grid-cols-[1fr_6rem] items-center gap-3 py-2">
              <SettingSwitch
                label={r.label}
                description={r.points !== r.default_points ? `Par défaut : ${r.default_points}` : r.description}
                checked={draft[r.action]?.is_active ?? r.is_active}
                onCheckedChange={(is_active) => set(r.action, { is_active })}
              />
              <Input
                id={`rule-${r.action}`}
                type="number"
                min={0}
                aria-label={`Points : ${r.label}`}
                value={draft[r.action]?.points ?? ''}
                onChange={(e) => set(r.action, { points: e.target.value })}
                customClassContainer="mb-0!"
              />
            </li>
          ))}
        </ul>
        <Input id="rules-note" label="Note (facultatif)" placeholder="Ex. : on valorise davantage les formations" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} isLoading={saving}>
            Enregistrer le barème
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RulesModal;
