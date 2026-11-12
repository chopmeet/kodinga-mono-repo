import { Ban, Check, Copy, Link2, Plus, Send } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  cn,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  SelectInput,
} from '@kodinga/ui';
import type { SpaceRole } from '@/data/community-space.data';
import { dateFormat } from '@/pages/shared/row-actions';
import type { CommunityInvitation, InvitationStatus } from '@/utils/api/community/community.type';
import { getName, memberRoleLabel } from '@/utils/Utils';
import { invitableRoles } from '../form/member-permissions';
import UseInvitationForm, { copyText, EMAIL_MAX_DAYS, invitationLink } from '../form/UseInvitationForm';
import UseInvitationList, { type InvitationList } from '../form/UseInvitationList';
import UseShareLink from '../form/UseShareLink';

const DURATIONS = [
  { value: '1', label: '1 jour' },
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
];

const statusStyle: Record<InvitationStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  accepted: { label: 'Acceptée', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  declined: { label: 'Refusée', className: 'border-border bg-subtle text-soft' },
  expired: { label: 'Expirée', className: 'border-border bg-subtle text-soft' },
  revoked: { label: 'Révoquée', className: 'border-border bg-subtle text-soft' },
};

/** A pending invitation past its date is expired, even before the api says so */
const statusOf = (i: CommunityInvitation): InvitationStatus => (i.status === 'pending' && !i.is_valid ? 'expired' : i.status);

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
        className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-subtle px-3 text-sm text-body"
      />
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copier ${label.toLowerCase()}`}>
        {copied ? <Check /> : <Copy />}
        {copied ? 'Copié' : 'Copier'}
      </Button>
    </div>
  );
}

/** The reusable link of the community: anyone with it joins as a member, until it expires or is revoked below */
function ShareLink({ slug }: { slug: string }) {
  const { shareLink, link, isLoading, reveal } = UseShareLink(slug);
  return (
    <section aria-labelledby="community-share-link" className="rounded-xl border border-border p-4">
      <h3 id="community-share-link" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Link2 className="size-4 text-brand-strong" aria-hidden />
        Lien de la communauté
      </h3>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">Toute personne qui a ce lien rejoint la communauté comme membre : nombre de personnes illimité, valable 30 jours.</p>
      {shareLink ? (
        <>
          <LinkField id="community-share-link-url" link={link} label="Lien de la communauté" />
          <p className="mt-2 text-xs text-muted-foreground">
            Utilisé {shareLink.uses_count} fois · expire le {dateFormat.format(new Date(shareLink.expires_at))}
          </p>
        </>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={reveal} isLoading={isLoading}>
          <Link2 />
          Obtenir le lien
        </Button>
      )}
    </section>
  );
}

/** One invitation: who, role, status; revoke while pending, send again when it went by email */
function InvitationRow({ i, list, slug }: { i: CommunityInvitation; list: InvitationList; slug: string }) {
  const status = statusOf(i);
  const style = statusStyle[status] ?? statusStyle.pending;
  const who = i.email || 'Lien partageable';
  const renewed = list.renewed[i.id];
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{who}</span>
        <span>{memberRoleLabel[i.role] ?? i.role}</span>
        {!i.email && i.uses_count !== undefined && (
          <span>{i.max_uses ? `utilisé ${i.uses_count} fois sur ${i.max_uses}` : `utilisé ${i.uses_count} fois`}</span>
        )}
        {status === 'pending' && i.expires_at && <span>expire le {dateFormat.format(new Date(i.expires_at))}</span>}
        {i.accepted_at && <span>acceptée le {dateFormat.format(new Date(i.accepted_at))}</span>}
        <span>par {getName(i.invited_by) || i.invited_by.username}</span>
        <span className={cn('rounded-full border px-2 py-0.5 font-semibold', style.className)}>{style.label}</span>
        <span className="ml-auto flex gap-1">
          {i.email && (status === 'pending' || status === 'expired') && (
            <Button type="button" variant="ghost" size="sm" disabled={!!list.busyId} onClick={() => list.resend(i)} aria-label={`Renvoyer l'invitation à ${i.email}`}>
              <Send /> Renvoyer
            </Button>
          )}
          {status === 'pending' && (
            <Button type="button" variant="ghost" size="sm" disabled={!!list.busyId} onClick={() => list.revoke(i)} aria-label={`Révoquer l'invitation : ${who}`}>
              <Ban /> Révoquer
            </Button>
          )}
        </span>
      </div>
      {renewed && (
        <div className="mt-2">
          <LinkField id={`invitation-${i.id}`} link={invitationLink(slug, renewed)} label={`Nouveau lien pour ${i.email}`} />
        </div>
      )}
    </li>
  );
}

/** Invitations of the community: pending first, the past ones (accepted, expired, revoked) on demand */
function Invitations({ slug }: { slug: string }) {
  const list = UseInvitationList(slug);
  const [showPast, setShowPast] = useState(false);

  return (
    <section aria-labelledby="community-invitations" className="mt-6 border-t border-border-soft pt-5">
      <h3 id="community-invitations" className="text-sm font-semibold text-foreground">
        Invitations en attente {!list.isLoading && <span className="font-normal text-faint tabular-nums">{list.pending.length}</span>}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Le lien d'une invitation n'est affiché qu'à sa création ; renvoyez une invitation par email pour en obtenir un nouveau.</p>
      {list.isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">Chargement…</p>
      ) : list.loadError ? (
        <p className="py-4 text-sm text-red-700">{list.loadError}</p>
      ) : list.pending.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Aucune invitation en attente.</p>
      ) : (
        <ul className="mt-3 space-y-3" aria-label="Invitations en attente">
          {list.pending.map((i) => (
            <InvitationRow key={i.id} i={i} list={list} slug={slug} />
          ))}
        </ul>
      )}
      {list.others.length > 0 && (
        <>
          <button type="button" className="mt-4 text-sm font-semibold text-brand-strong hover:underline" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
            {showPast ? 'Masquer' : 'Voir'} les invitations passées ({list.others.length})
          </button>
          {showPast && (
            <ul className="mt-3 space-y-3" aria-label="Invitations passées">
              {list.others.map((i) => (
                <InvitationRow key={i.id} i={i} list={list} slug={slug} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

type Props = { slug: string; communityName: string; actor: SpaceRole; open: boolean; onClose: () => void };

/** Creates invitations (a shareable link, or by email) and lists them with their status (owner and admins) */
function InviteMembersModal({ slug, communityName, actor, open, onClose }: Props) {
  const { form, created, restart, onSubmit } = UseInvitationForm(slug);
  const {
    register,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const roles = invitableRoles(actor).map((role) => ({ value: role, label: memberRoleLabel[role] }));
  // By email: one person, 30 days at most
  const byEmail = !!watch('email')?.trim();
  const durations = byEmail ? DURATIONS.filter((d) => Number(d.value) <= EMAIL_MAX_DAYS) : DURATIONS;

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
            Partagez un lien, ou invitez une personne par email : elle rejoint {communityName} dès qu'elle accepte, sans validation de l'équipe ni abonnement.
          </DialogDescription>
        </DialogHeader>

        <ShareLink slug={slug} />

        {created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              {created.email ? <Send className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              {created.email ? `Invitation envoyée à ${created.email}` : 'Lien prêt à partager'}
            </p>
            <p className="mt-1 mb-3 text-xs text-emerald-900/80">
              {memberRoleLabel[created.role] ?? created.role}
              {!created.email && created.max_uses ? ` · ${created.max_uses} utilisation${created.max_uses > 1 ? 's' : ''}` : ''}
              {created.expires_at ? ` · expire le ${dateFormat.format(new Date(created.expires_at))}` : ''}
              {created.email ? ' · vous pouvez aussi lui transmettre ce lien' : ''}
            </p>
            <LinkField id="invitation-created" link={invitationLink(slug, created.invite_code)} label="Lien d'invitation" />
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={restart}>
              <Plus />
              Nouvelle invitation
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-x-4 sm:grid-cols-2">
            <SelectInput label="Rôle à l'arrivée" options={roles} error={errors.role?.message} {...register('role')} />
            <SelectInput label="Valable" options={durations} error={errors.expires_in_days?.message} {...register('expires_in_days')} />
            <Input
              id="invitation-email"
              type="email"
              label="Email (facultatif)"
              fieldHelp={`L’invitation lui sera envoyée par email (${EMAIL_MAX_DAYS} jours au plus).`}
              error={errors.email?.message}
              {...register('email')}
            />
            {/* By email: one person, the number of uses does not apply */}
            {!byEmail && (
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
            )}
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" isLoading={isSubmitting}>
                {byEmail ? <Send /> : <Link2 />}
                {byEmail ? 'Envoyer l’invitation' : 'Créer le lien'}
              </Button>
            </div>
          </form>
        )}

        <Invitations slug={slug} />
      </DialogContent>
    </Dialog>
  );
}

export default InviteMembersModal;
