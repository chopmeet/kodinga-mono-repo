import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button, customToast, EmptyAlert } from '@kodinga-mono-repo/ui';
import type { CommunityRule } from '@/data/community-settings.data';
import { useSpaceSettings } from '../form/UseSpaceSettings';
import RuleModal from '../modals/rule-modal';

function RulesTab() {
  const { rules, setRules } = useSpaceSettings();
  const [modal, setModal] = useState<{ open: boolean; rule: CommunityRule | null }>({ open: false, rule: null });

  const save = (values: { title: string; description: string }, editing: CommunityRule | null) => {
    setRules((list) =>
      editing ? list.map((r) => (r.id === editing.id ? { ...r, ...values } : r)) : [...list, { id: `rule-${Date.now()}`, ...values }]
    );
    customToast.success({ message: editing ? 'Règle mise à jour.' : 'Règle ajoutée.' });
  };

  const move = (index: number, offset: -1 | 1) =>
    setRules((list) => {
      const next = [...list];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });

  const remove = (rule: CommunityRule) => {
    setRules((list) => list.filter((r) => r.id !== rule.id));
    customToast.success({ message: 'Règle supprimée.' });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Règles</h2>
          <p className="text-sm text-slate-500">La charte de la communauté, dans l'ordre où les membres la lisent.</p>
        </div>
        <Button onClick={() => setModal({ open: true, rule: null })}>
          <Plus />
          Ajouter une règle
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyAlert text="Aucune règle pour l'instant." />
      ) : (
        <ol aria-label="Règles de la communauté" className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rules.map((rule, i) => (
            <li key={rule.id} className="flex items-start gap-3 p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{rule.title}</p>
                {rule.description && <p className="text-sm text-slate-500">{rule.description}</p>}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button variant="ghost" size="icon-sm" aria-label={`Monter « ${rule.title} »`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Descendre « ${rule.title} »`}
                  disabled={i === rules.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Modifier « ${rule.title} »`} onClick={() => setModal({ open: true, rule })}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Supprimer « ${rule.title} »`}
                  className="text-red-600 hover:text-red-700"
                  onClick={() => remove(rule)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <RuleModal
        open={modal.open}
        rule={modal.rule}
        onOpenChange={(open) => setModal((m) => ({ ...m, open }))}
        onSave={save}
      />
    </div>
  );
}

export default RulesTab;
