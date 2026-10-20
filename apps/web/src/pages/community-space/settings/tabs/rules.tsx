import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button, EmptyAlert } from '@kodinga-mono-repo/ui';
import { type CommunityRule, useSpaceSettings } from '../form/UseSpaceSettings';
import RuleModal from '../modals/rule-modal';

function RulesTab() {
  const { rules, addRule, editRule, removeRule } = useSpaceSettings();
  const [modal, setModal] = useState<{ open: boolean; rule: CommunityRule | null }>({ open: false, rule: null });

  const save = (values: { title: string; description: string }, editing: CommunityRule | null) => (editing ? editRule(editing, values) : addRule(values));
  const [removing, setRemoving] = useState<string | null>(null);
  const remove = async (rule: CommunityRule) => {
    setRemoving(rule.id);
    await removeRule(rule);
    setRemoving(null);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Règles</h2>
          <p className="text-sm text-slate-500">La charte de la communauté, dans l'ordre où les membres la lisent. Une nouvelle règle s’ajoute à la fin.</p>
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
                <Button variant="ghost" size="icon-sm" aria-label={`Modifier « ${rule.title} »`} onClick={() => setModal({ open: true, rule })}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Supprimer « ${rule.title} »`}
                  className="text-red-600 hover:text-red-700"
                  disabled={removing === rule.id}
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
