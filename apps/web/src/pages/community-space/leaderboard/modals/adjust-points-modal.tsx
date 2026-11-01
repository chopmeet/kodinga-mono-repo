import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@kodinga-mono-repo/ui';
import type { PointsAdjustment } from '@/utils/api/gamification/gamification.type';
import { getName } from '@/utils/Utils';
import UseAdjustPointsForm from '../form/UseAdjustPointsForm';

type Props = {
  open: boolean;
  slug: string;
  onOpenChange: (open: boolean) => void;
  /** true once the api accepted it: the dialog closes */
  onAdjust: (input: PointsAdjustment) => Promise<boolean>;
};

/** Manual adjustment of the points of one member (POST .../gamification/points/adjust/): a member found by name, a signed number, a reason */
function AdjustPointsModal({ open, slug, onOpenChange, onAdjust }: Props) {
  const form = UseAdjustPointsForm({ open, slug, onOpenChange, onAdjust });
  const { register, errors, isSubmitting, member } = form;

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>Ajuster des points</DialogTitle>
          <DialogDescription>Ajoutez ou retirez des points à un membre, par exemple pour une aide remarquable ou un abus. Le motif est gardé dans le journal.</DialogDescription>
        </DialogHeader>
        <form id="adjust-form" onSubmit={form.onSubmit} noValidate>
          {member ? (
            <p className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span>
                Membre : <strong className="text-slate-900">{member.name}</strong>
              </span>
              <button type="button" className="font-semibold text-blue-900 hover:underline" onClick={() => form.setMember(null)}>
                Changer
              </button>
            </p>
          ) : (
            <div className="mb-4">
              <Input
                id="adjust-member"
                label="Membre"
                required
                placeholder="Nom ou pseudo (2 lettres au moins)"
                value={form.search}
                onChange={(e) => form.setSearch(e.target.value)}
                error={form.memberError ? 'Choisissez le membre concerné' : undefined}
              />
              {form.results.length > 0 && (
                <ul aria-label="Membres trouvés" className="-mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                  {form.results.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => form.setMember({ id: m.user.id, name: getName(m.user) })}
                      >
                        {getName(m.user)} <span className="text-slate-400">@{m.user.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Input
            id="adjust-points"
            type="number"
            label="Points"
            required
            fieldHelp="Négatif pour en retirer (ex. -20)"
            error={errors.points?.message}
            {...register('points')}
          />
          <Input id="adjust-reason" label="Motif" required error={errors.reason?.message} {...register('reason')} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="adjust-form" isLoading={isSubmitting}>
            Ajuster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AdjustPointsModal;
