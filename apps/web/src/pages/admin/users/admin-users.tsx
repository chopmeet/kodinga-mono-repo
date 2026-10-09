import { UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, cn, ColgateWrapper, EmptyAlert, Pagination, SearchInput, TopTitle } from '@kodinga-mono-repo/ui';
import type { AdminUser, UserRoleFilter, UserStatusFilter } from '@/data/admin-users.data';
import { useDebounced } from '@/utils/hooks/useDebounced';
import UsersOverview from './components/users-overview';
import UseUsersList from './form/UseUsersList';
import InviteAdminModal from '../shared/invite-admin-modal';
import UserDetailsSheet from './modals/user-details-sheet';
import UsersTable from './tables/users-table';

const roleFilters: { value: UserRoleFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'member', label: 'Membres' },
  { value: 'creator', label: 'Créateurs' },
  { value: 'staff', label: 'Administrateurs' },
];

const statusFilters: { value: UserStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'unverified', label: 'Email non vérifié' },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      )}
    >
      {children}
    </button>
  );
}

function AdminUsers() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRoleFilter>('all');
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const debouncedSearch = useDebounced(search.trim());
  useEffect(() => setPage(1), [debouncedSearch]);

  const list = UseUsersList({ search: debouncedSearch, role, status, page, size });
  // Keep the sheet in sync with the latest version of the user after an action
  const selected = list.users.find((u) => u.id === selectedId) ?? null;

  const withPageReset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="admin__users">
      <TopTitle title="Utilisateurs" paragraph="Tous les comptes de la plateforme" />

      <section aria-label="Indicateurs utilisateurs" className="mb-6">
        <UsersOverview users={list.users} />
      </section>

      <ColgateWrapper className="border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            id="admin-users-search"
            size="md"
            className="md:max-w-sm"
            label="Rechercher un utilisateur"
            clearLabel="Effacer la recherche"
            placeholder="Nom, email, ville…"
            value={search}
            onValueChange={setSearch}
          />
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus />
            Inviter un administrateur
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par rôle">
            {roleFilters.map((f) => (
              <Chip key={f.value} active={role === f.value} onClick={() => withPageReset(setRole)(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
            {statusFilters.map((f) => (
              <Chip key={f.value} active={status === f.value} onClick={() => withPageReset(setStatus)(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-5" aria-busy={list.isFetching}>
          {!list.isLoading && list.total === 0 ? (
            <EmptyAlert text="Aucun utilisateur ne correspond à ces critères." />
          ) : (
            <>
              <div className={list.isFetching && !list.isLoading ? 'opacity-60 transition-opacity' : undefined}>
                <UsersTable
                  users={list.results}
                  isLoading={list.isLoading}
                  onView={(u: AdminUser) => setSelectedId(u.id)}
                  onToggleActive={list.toggleActive}
                  onToggleStaff={list.toggleStaff}
                />
              </div>
              {list.total > 0 && (
                <Pagination
                  totalItems={list.total}
                  currentPage={page}
                  perPage={size}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setSize(n);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      </ColgateWrapper>

      <UserDetailsSheet
        user={selected}
        onClose={() => setSelectedId(null)}
        onToggleActive={list.toggleActive}
        onToggleStaff={list.toggleStaff}
      />
      <InviteAdminModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        existingEmails={list.users.map((u) => u.email)}
        onInvited={list.addAdmin}
      />
    </div>
  );
}

export default AdminUsers;
