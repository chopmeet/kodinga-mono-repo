import { ShieldOff, UserPlus } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga-mono-repo/ui';
import type { AdminUser } from '@/data/admin-users.data';
import { useUser } from '@/utils/Utils';
import InviteAdminModal from '../../shared/invite-admin-modal';
import { useSettings } from '../admin-settings';
import AdministratorsTable, { isPending } from '../tables/administrators-table';

function AdministratorsSettingsTab() {
  const { admins, setAdmins } = useSettings();
  const currentUser = useUser();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoking, setRevoking] = useState<AdminUser | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Guards: the platform always keeps one super admin, and nobody removes their own access
  const revokeBlockedReason = (admin: AdminUser) => {
    if (admins.length <= 1) return 'Impossible de retirer le dernier super-administrateur.';
    if (currentUser && admin.id === currentUser.id) return 'Vous ne pouvez pas retirer votre propre accès.';
    return null;
  };

  const askRevoke = (admin: AdminUser) => {
    const reason = revokeBlockedReason(admin);
    if (reason) customToast.error({ message: reason });
    else setRevoking(admin);
  };

  const revoke = async () => {
    if (!revoking) return;
    setIsRevoking(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setAdmins((list) => list.filter((a) => a.id !== revoking.id));
    customToast.success({ message: `${revoking.full_name} n'est plus super-administrateur.` });
    setIsRevoking(false);
    setRevoking(null);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Super-administrateurs</h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Accès complet à l'administration : communautés, utilisateurs, paiements et paramètres. Gardez cette liste courte.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus />
          Inviter un super-administrateur
        </Button>
      </div>

      <AdministratorsTable
        admins={admins}
        currentUserId={currentUser?.id}
        onResendInvite={(admin) => customToast.success({ message: `Invitation renvoyée à ${admin.email}.` })}
        onRevoke={askRevoke}
      />
      <p className="mt-2 text-xs text-slate-500">
        {admins.length} super-administrateur{admins.length > 1 ? 's' : ''}
        {admins.some(isPending) && ` · ${admins.filter(isPending).length} invitation(s) en attente`}
      </p>

      <InviteAdminModal
        title="Inviter un super-administrateur"
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        existingEmails={admins.map((a) => a.email)}
        onInvited={(admin) => setAdmins((list) => [...list, admin])}
      />

      <Dialog open={!!revoking} onOpenChange={(open) => !open && !isRevoking && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer l'accès de {revoking?.full_name} ?</DialogTitle>
            <DialogDescription>
              Ce compte perdra immédiatement l'accès à l'administration. Il restera un compte membre classique.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)} disabled={isRevoking}>
              Annuler
            </Button>
            <Button variant="danger" onClick={revoke} isLoading={isRevoking}>
              <ShieldOff />
              Retirer l'accès
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdministratorsSettingsTab;
