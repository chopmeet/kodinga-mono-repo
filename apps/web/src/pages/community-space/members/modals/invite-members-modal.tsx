import { Check, Copy, Link2, Plus } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  SelectInput,
} from '@kodinga-mono-repo/ui';
import type { SpaceRole } from '@/data/community-space.data';
import { memberRoleLabel } from '@/pages/shared/community-labels';
import { dateFormat, SoonBadge } from '@/pages/shared/row-actions';
import { useGetCommunityInvitationsQuery } from '@/utils/api/community/community.api';
import type { CommunityInvitation } from '@/utils/api/community/community.type';
import { getName } from '@/utils/Utils';
import { invitableRoles } from '../form/member-permissions';
import UseInvitationForm, { copyText, invitationLink } from '../form/UseInvitationForm';

const DURATIONS = [
  { value: '1', label: '1 jour' },
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
];

/** Read-only link + copy button */
function LinkField({ id, link, label }: { id: string; link: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      customToast.error({ message: 'Copie impossible : sélectionnez le lien et copiez-le.' });
    }
  };
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        aria-label={label}
        readOnly
        value={link}
        onFocus={(e) => e.target.select()}
        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
      />
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copier ${label.toLowerCase()}`}>
        {copied ? <Check /> : <Copy />}
        {copied ? 'Copié' : 'Copier'}
      </Button>
    </div>
  );
}

const usesLabel = (i: CommunityInvitation) => `${i.uses_count} / ${i.max_uses} utilisation${i.max_uses > 1 ? 's' : ''}`;

/** Invitation links still usable (GET communities/<slug>/invitations/) */
function ActiveInvitations({ slug }: { slug: string }) {
  const { data = [], isLoading } = useGetCommunityInvitationsQuery(slug);
  const active = data.filter((i) => i.is_valid);

  return (
    <section aria-labelledby="active-invitations" className="mt-6 border-t border-slate-100 pt-5">
      <h3 id="active-invitations" className="text-sm font-semibold text-slate-900">
        Liens actifs {!isLoading && <span className="font-normal text-slate-400 tabular-nums">{active.length}</span>}
      </h3>
      {isLoading ? (
        <p className="py-4 text-sm text-slate-500">Chargement…</p>
      ) : active.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">Aucun lien actif pour le moment.</p>
      ) : (
        <ul className="mt-3 space-y-3" aria-label="Liens d'invitation actifs">
          {active.map((i, index) => (
            <li key={i.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{memberRoleLabel[i.role]}</span>
                <span>{usesLabel(i)}</span>
                {i.expires_at && <span>expire le {dateFormat.format(new Date(i.expires_at))}</span>}
                {i.email && <span>pour {i.email}</span>}
                <span>par {getName(i.invited_by) || i.invited_by.username}</span>
                <button type="button" disabled title="Bientôt disponible" className="ml-auto flex cursor-not-allowed items-center gap-1 text-slate-400">
                  Révoquer <SoonBadge />
                </button>
              </div>
              <LinkField id={`invitation-${i.id}`} link={invitationLink(slug, i.invite_code)} label={`Lien d'invitation ${index + 1}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Props = { slug: string; communityName: string; actor: SpaceRole; open: boolean; onClose: () => void };

/** Creates invitation links and lists the active ones (owner and admins) */
function InviteMembersModal({ slug, communityName, actor, open, onClose }: Props) {
  const { form, created, restart, onSubmit } = UseInvitationForm(slug);
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;
  const roles = invitableRoles(actor).map((role) => ({ value: role, label: memberRoleLabel[role] }));

  const close = () => {
    restart();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && close()}>
      <DialogContent position="top" className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Inviter des membres</DialogTitle>
          <DialogDescription>
            Partagez un lien : la personne rejoint {communityName} dès qu'elle l'accepte, sans validation de l'équipe ni abonnement.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Link2 className="size-4" aria-hidden />
              Lien prêt à partager
            </p>
            <p className="mt-1 mb-3 text-xs text-emerald-900/80">
              {memberRoleLabel[created.role]} · {usesLabel(created)}
              {created.expires_at ? ` · expire le ${dateFormat.format(new Date(created.expires_at))}` : ''}
              {created.email ? ` · envoyée par email à ${created.email}` : ''}
            </p>
            <LinkField id="invitation-created" link={invitationLink(slug, created.invite_code)} label="Lien d'invitation" />
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={restart}>
              <Plus />
              Créer un autre lien
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-x-4 sm:grid-cols-2">
            <SelectInput label="Rôle à l'arrivée" options={roles} {...register('role')} />
            <SelectInput label="Valable" options={DURATIONS} {...register('expires_in_days')} />
            <Input
              id="invitation-uses"
              type="number"
              min={1}
              max={1000}
              label="Nombre d'utilisations"
              fieldHelp="1 pour une personne, plus pour un groupe."
              error={errors.max_uses?.message}
              {...register('max_uses')}
            />
            <Input
              id="invitation-email"
              type="email"
              label="Email (facultatif)"
              fieldHelp="L’invitation lui sera envoyée par email."
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" isLoading={isSubmitting}>
                <Link2 />
                Créer le lien
              </Button>
            </div>
          </form>
        )}

        <ActiveInvitations slug={slug} />
      </DialogContent>
    </Dialog>
  );
}

export default InviteMembersModal;
