import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, customToast } from '@kodinga-mono-repo/ui';
import { getCommunityMembers } from '@/data/admin-community-details.data';
import { useCommunitySpace } from '../../community-space-context';
import ConfirmByNameModal from '../modals/confirm-by-name-modal';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function DangerBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
      <div className="max-w-xl">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

/**
 * Owner only (SectionGuard "danger"). With the api: PATCH .../members/<id>/ role=owner
 * (the previous owner becomes admin) and DELETE communities/<slug>/ (soft delete).
 */
function DangerTab() {
  const { community } = useCommunitySpace();
  const navigate = useNavigate();
  // Ownership can only go to an active administrator of the community
  const admins = useMemo(() => getCommunityMembers(community).filter((m) => m.role === 'admin' && m.status === 'active'), [community]);
  const [heirId, setHeirId] = useState('');
  const [dialog, setDialog] = useState<'transfer' | 'delete' | null>(null);
  const heir = admins.find((a) => a.id === heirId);

  const transfer = async () => {
    await wait(400);
    setDialog(null);
    customToast.success({ message: `${heir?.name} est maintenant propriétaire. Vous restez administrateur.` });
    navigate(`/c/${community.slug}/dashboard`);
  };

  const remove = async () => {
    await wait(400);
    setDialog(null);
    customToast.success({ message: `« ${community.name} » a été supprimée.` });
    navigate('/c', { replace: true });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Zone sensible</h2>
      <p className="mb-5 text-sm text-slate-500">Actions réservées au propriétaire, à manier avec précaution.</p>

      <div className="divide-y divide-red-100 rounded-xl border border-red-200">
        <DangerBlock
          title="Transférer la propriété"
          description="Le nouveau propriétaire obtient tous les droits, y compris les paiements. Vous devenez administrateur."
        >
          <label htmlFor="heir" className="sr-only">
            Nouveau propriétaire
          </label>
          <select
            id="heir"
            value={heirId}
            onChange={(e) => setHeirId(e.target.value)}
            className="custom-form-control bg-background px-3 py-2 text-sm"
            disabled={admins.length === 0}
          >
            <option value="">{admins.length ? 'Choisir un administrateur' : 'Aucun administrateur'}</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button variant="outline" disabled={!heir} onClick={() => setDialog('transfer')}>
            <ArrowRightLeft />
            Transférer
          </Button>
        </DangerBlock>
        <DangerBlock
          title="Supprimer la communauté"
          description="Elle disparaît de Kodinga pour tous ses membres. Les abonnements en cours ne seront pas renouvelés."
        >
          <Button variant="danger" onClick={() => setDialog('delete')}>
            <Trash2 />
            Supprimer
          </Button>
        </DangerBlock>
      </div>

      <ConfirmByNameModal
        open={dialog === 'transfer'}
        title={`Transférer « ${community.name} » à ${heir?.name ?? ''} ?`}
        description="Vous ne pourrez pas annuler vous-même ce transfert : seul le nouveau propriétaire pourra vous le rendre."
        confirmText={community.name}
        actionLabel="Transférer la propriété"
        onCancel={() => setDialog(null)}
        onConfirm={transfer}
      />
      <ConfirmByNameModal
        open={dialog === 'delete'}
        title={`Supprimer « ${community.name} » ?`}
        description={`Ses ${community.members_count.toLocaleString('fr-FR')} membres perdront l'accès au fil, aux ressources et aux événements.`}
        confirmText={community.name}
        actionLabel="Supprimer définitivement"
        onCancel={() => setDialog(null)}
        onConfirm={remove}
      />
    </div>
  );
}

export default DangerTab;
