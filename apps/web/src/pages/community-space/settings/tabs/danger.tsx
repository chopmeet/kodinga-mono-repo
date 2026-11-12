import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, customToast } from '@kodinga/ui';
import { useAppDispatch } from '@/redux/hook';
import { CommunityApi, useArchiveCommunityMutation, useChangeMemberRoleMutation, useGetCommunityMembersQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { getName } from '@/utils/Utils';
import { useCommunitySpace } from '../../community-space-context';
import ConfirmByNameModal from '../modals/confirm-by-name-modal';

function DangerBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
      <div className="max-w-xl">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </section>
  );
}

/**
 * Owner only (SectionGuard "danger"): PATCH .../members/<id>/ role=owner (the previous owner
 * becomes admin) and DELETE communities/<slug>/ (the api archives it).
 */
function DangerTab() {
  const { community } = useCommunitySpace();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // Ownership can only go to an active administrator of the community
  const { data } = useGetCommunityMembersQuery({ slug: community.slug, role: 'admin', status: 'active', page_size: 100 });
  const admins = (data?.results ?? []).filter((m) => m.role === 'admin' && m.status === 'active').map((m) => ({ id: m.id, name: getName(m.user) || m.user.username }));
  const [changeRole] = useChangeMemberRoleMutation();
  const [archive] = useArchiveCommunityMutation();
  const [heirId, setHeirId] = useState('');
  const [dialog, setDialog] = useState<'transfer' | 'delete' | null>(null);
  const heir = admins.find((a) => a.id === heirId);

  const transfer = async () => {
    if (!heir) return;
    try {
      await changeRole({ slug: community.slug, memberId: heir.id, role: 'owner' }).unwrap();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return;
    }
    setDialog(null);
    customToast.success({ message: `${heir.name} est maintenant propriétaire. Vous restez administrateur.` });
    // Your role changed: the space reads it again
    dispatch(CommunityApi.util.invalidateTags([{ type: 'communities', id: community.slug }, 'communities']));
    navigate(`/c/${community.slug}/dashboard`);
  };

  const remove = async () => {
    try {
      await archive(community.slug).unwrap();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return;
    }
    setDialog(null);
    customToast.success({ message: `« ${community.name} » a été supprimée.` });
    navigate('/dashboard/communities', { replace: true });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Zone sensible</h2>
      <p className="mb-5 text-sm text-muted-foreground">Actions réservées au propriétaire, à manier avec précaution.</p>

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
