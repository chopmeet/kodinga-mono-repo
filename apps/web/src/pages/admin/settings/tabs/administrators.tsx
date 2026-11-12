import { RotateCw, ShieldOff, UserPlus } from 'lucide-react';
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
  EmptyAlert,
} from '@kodinga/ui';
import { parseApiError } from '@/utils/api/errors';
import { useGetUsersQuery, useToggleUserAdminMutation } from '@/utils/api/user/user.api';
import type { User } from '@/utils/api/user/user.type';
import { getName, isAdmin, useUser } from '@/utils/Utils';
import PromoteAdminModal from '../../shared/promote-admin-modal';
import AdministratorsTable from '../tables/administrators-table';

function AdministratorsSettingsTab() {
  const currentUser = useUser();
  // The api has no role filter on users/: the super-admins are picked from the first 100 accounts
  const { data, isLoading, error, refetch } = useGetUsersQuery({ page_size: 100 });
  const admins = (data?.results ?? []).filter(isAdmin);
  const [toggleAdmin, { isLoading: isRevoking }] = useToggleUserAdminMutation();
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [revoking, setRevoking] = useState<User | null>(null);
  const revokingName = revoking ? getName(revoking) || revoking.email : '';

  // Guards: the platform always keeps one super admin, and nobody removes their own access
  const revokeBlockedReason = (admin: User) => {
    if (admins.length <= 1) return 'Impossible de retirer le dernier super-administrateur.';
    if (currentUser && admin.id === currentUser.id) return 'Vous ne pouvez pas retirer votre propre accès.';
    return null;
  };

  const askRevoke = (admin: User) => {
    const reason = revokeBlockedReason(admin);
    if (reason) customToast.error({ message: reason });
    else setRevoking(admin);
  };

  const revoke = async () => {
    if (!revoking) return;
    try {
      await toggleAdmin({ id: revoking.id, is_superadmin: false }).unwrap();
      customToast.success({ message: `${revokingName} n'est plus super-administrateur.` });
      setRevoking(null);
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Super-administrateurs</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Accès complet à l'administration : communautés, utilisateurs, paiements et paramètres. Gardez cette liste courte.
          </p>
        </div>
        <Button onClick={() => setPromoteOpen(true)}>
          <UserPlus />
          Ajouter un super-administrateur
        </Button>
      </div>

      {error && !data ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyAlert text={parseApiError(error).message} />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw />
            Réessayer
          </Button>
        </div>
      ) : (
        <>
          <AdministratorsTable admins={admins} isLoading={isLoading} currentUserId={currentUser?.id} onRevoke={askRevoke} />
          {data && (
            <p className="mt-2 text-xs text-muted-foreground">
              {admins.length} super-administrateur{admins.length > 1 ? 's' : ''}
            </p>
          )}
        </>
      )}

      <PromoteAdminModal open={promoteOpen} onOpenChange={setPromoteOpen} />

      <Dialog open={!!revoking} onOpenChange={(open) => !open && !isRevoking && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer l'accès de {revokingName} ?</DialogTitle>
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
