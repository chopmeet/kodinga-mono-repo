import { RotateCw, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Button, ColgateWrapper, customToast, EmptyAlert, Pagination, SearchInput, TopTitle } from '@kodinga/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { parseApiError } from '@/utils/api/errors';
import {
  useToggleUserAdminMutation,
  useToggleUserStatusMutation,
  useVerifyUserEmailMutation,
} from '@/utils/api/user/user.api';
import type { User } from '@/utils/api/user/user.type';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { getName, isAdmin, useUser } from '@/utils/Utils';
import PromoteAdminModal from '../shared/promote-admin-modal';
import UsersOverview from './components/users-overview';
import UseUsersList, {
  type UserPeriodSelect,
  type UserRoleSelect,
  type UserStatusFilter,
} from './form/UseUsersList';
import SuspendUserModal from './modals/suspend-user-modal';
import UserDetailsSheet from './modals/user-details-sheet';
import UsersTable from './tables/users-table';

const roleFilters: { value: UserRoleSelect; label: string }[] = [
  { value: 'all', label: 'Tous les rôles' },
  { value: 'creator', label: 'Créateurs' },
  { value: 'member', label: 'Membres' },
  { value: 'admin', label: 'Administrateurs' },
];

const statusFilters: { value: UserStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'unverified', label: 'Email non vérifié' },
  { value: 'suspended', label: 'Suspendus' },
];

const periodFilters: { value: UserPeriodSelect; label: string }[] = [
  { value: 'all', label: 'Toutes dates' },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '90d', label: '90 derniers jours' },
];

function AdminUsers() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [role, setRole] = useState<UserRoleSelect>('all');
  const [period, setPeriod] = useState<UserPeriodSelect>('all');
  const [size, setSize] = useState(10);
  const [selected, setSelected] = useState<User | null>(null);
  const debouncedSearch = useDebounced(search.trim());

  // The page belongs to one search: a new search or filter starts again from page 1
  const searchKey = `${status}|${role}|${period}|${debouncedSearch}|${size}`;
  const [paging, setPaging] = useState({ key: searchKey, page: 1 });
  const page = paging.key === searchKey ? paging.page : 1;

  const list = UseUsersList({
    search: debouncedSearch,
    status,
    role,
    period,
    page,
    size,
  });

  const currentUser = useUser();
  const [toggleAdmin] = useToggleUserAdminMutation();
  const [toggleStatus, { isLoading: isSuspending }] = useToggleUserStatusMutation();
  const [verifyEmail] = useVerifyUserEmailMutation();
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [suspending, setSuspending] = useState<User | null>(null);

  // Each action answers the updated account: the open profile sheet follows it
  const run = async (action: Promise<User>, message: string) => {
    try {
      const updated = await action;
      setSelected((current) => (current?.id === updated.id ? updated : current));
      customToast.success({ message });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  const onToggleAdmin = (u: User) => {
    const name = getName(u) || u.email;
    if (isAdmin(u) && u.id === currentUser?.id) {
      customToast.error({ message: 'Vous ne pouvez pas retirer vos propres droits.' });
      return;
    }
    run(
      toggleAdmin({ id: u.id, is_superadmin: !isAdmin(u) }).unwrap(),
      isAdmin(u) ? `${name} n'est plus super-administrateur.` : `${name} est maintenant super-administrateur.`
    );
  };

  const onToggleStatus = (u: User) => {
    if (u.is_active) {
      if (u.id === currentUser?.id) {
        customToast.error({ message: 'Vous ne pouvez pas suspendre votre propre compte.' });
        return;
      }
      setSuspending(u);
      return;
    }
    run(toggleStatus({ id: u.id, is_active: true }).unwrap(), `Le compte de ${getName(u) || u.email} est réactivé.`);
  };

  const onVerifyEmail = (u: User) => {
    const name = getName(u) || u.email;
    run(
      verifyEmail(u.id).unwrap(),
      `L'adresse email de ${name} a été vérifiée avec succès.`
    );
  };

  const suspend = async (reason: string) => {
    if (!suspending) return;
    const ok = await run(
      toggleStatus({ id: suspending.id, is_active: false, reason }).unwrap(),
      `Le compte de ${getName(suspending) || suspending.email} est suspendu.`
    );
    if (ok) setSuspending(null);
  };

  return (
    <div className="admin__users">
      <TopTitle title="Utilisateurs" paragraph="Tous les comptes de la plateforme" />

      <section aria-label="Indicateurs utilisateurs" className="mb-6">
        <UsersOverview />
      </section>

      <ColgateWrapper className="border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            id="admin-users-search"
            size="md"
            className="md:max-w-sm"
            label="Rechercher un utilisateur"
            clearLabel="Effacer la recherche"
            placeholder="Nom, email, pseudo…"
            value={search}
            onValueChange={setSearch}
          />
          <Button onClick={() => setPromoteOpen(true)}>
            <UserPlus />
            Ajouter un administrateur
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Rôles : Tous, Créateurs, Membres, Administrateurs */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par rôle">
            {roleFilters.map((f) => (
              <FilterChip key={f.value} active={role === f.value} onClick={() => setRole(f.value)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          {/* Statut du compte */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
            {statusFilters.map((f) => (
              <FilterChip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          {/* Date de création : 7j, 30j, 90j */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par date de création">
            {periodFilters.map((p) => (
              <FilterChip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>
                {p.label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-5" aria-busy={list.isFetching}>
          {list.error && !list.hasData ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <p>{parseApiError(list.error).message}</p>
              <button
                type="button"
                onClick={() => list.refetch()}
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                <RotateCw className="size-4" />
                Réessayer
              </button>
            </div>
          ) : !list.isLoading && list.total === 0 ? (
            <EmptyAlert text="Aucun utilisateur ne correspond à ces critères." />
          ) : (
            <>
              <div className={list.isFetching && !list.isLoading ? 'opacity-60 transition-opacity' : undefined}>
                <UsersTable
                  users={list.results}
                  isLoading={list.isLoading}
                  onView={setSelected}
                  onToggleAdmin={onToggleAdmin}
                  onToggleStatus={onToggleStatus}
                  onVerifyEmail={onVerifyEmail}
                />
              </div>
              {list.total > 0 && (
                <Pagination
                  totalItems={list.total}
                  currentPage={page}
                  perPage={size}
                  onPageChange={(next) => setPaging({ key: searchKey, page: next })}
                  onPageSizeChange={setSize}
                />
              )}
            </>
          )}
        </div>
      </ColgateWrapper>

      <UserDetailsSheet
        user={selected}
        onClose={() => setSelected(null)}
        onToggleAdmin={onToggleAdmin}
        onToggleStatus={onToggleStatus}
        onVerifyEmail={onVerifyEmail}
      />
      <SuspendUserModal user={suspending} isLoading={isSuspending} onCancel={() => setSuspending(null)} onConfirm={suspend} />
      <PromoteAdminModal open={promoteOpen} onOpenChange={setPromoteOpen} />
    </div>
  );
}

export default AdminUsers;
