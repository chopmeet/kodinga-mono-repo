import { RotateCw, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Button, ColgateWrapper, EmptyAlert, Pagination, SearchInput, TopTitle } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { SoonBadge } from '@/pages/shared/row-actions';
import { parseApiError } from '@/utils/api/errors';
import type { User } from '@/utils/api/user/user.type';
import { useDebounced } from '@/utils/hooks/useDebounced';
import UsersOverview from './components/users-overview';
import UseUsersList, { type UserStatusFilter } from './form/UseUsersList';
import UserDetailsSheet from './modals/user-details-sheet';
import UsersTable from './tables/users-table';

// Shown, not selectable yet: the api does not filter on roles
const roleFilters = ['Tous', 'Membres', 'Créateurs', 'Administrateurs'];
const SOON = "Bientôt disponible : l'API ne permet pas encore ce filtre";

const statusFilters: { value: UserStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'unverified', label: 'Email non vérifié' },
  { value: 'suspended', label: 'Suspendus' },
];

function AdminUsers() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [size, setSize] = useState(10);
  const [selected, setSelected] = useState<User | null>(null);
  const debouncedSearch = useDebounced(search.trim());

  // The page belongs to one search: a new search or filter starts again from page 1
  const searchKey = `${status}|${debouncedSearch}|${size}`;
  const [paging, setPaging] = useState({ key: searchKey, page: 1 });
  const page = paging.key === searchKey ? paging.page : 1;

  const list = UseUsersList({ search: debouncedSearch, status, page, size });

  return (
    <div className="admin__users">
      <TopTitle title="Utilisateurs" paragraph="Tous les comptes de la plateforme" />

      <section aria-label="Indicateurs utilisateurs" className="mb-6">
        <UsersOverview />
      </section>

      <ColgateWrapper className="border border-neutral-200 p-4">
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
          <Button disabled title="Bientôt disponible : l'API ne permet pas encore d'inviter un administrateur">
            <UserPlus />
            Inviter un administrateur
            <SoonBadge className="ml-1 bg-white/80" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par rôle">
            {roleFilters.map((label, i) => (
              <FilterChip key={label} active={i === 0} onClick={() => undefined} disabled={i > 0} title={i > 0 ? SOON : undefined}>
                {label}
              </FilterChip>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
            {statusFilters.map((f) => (
              <FilterChip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-5" aria-busy={list.isFetching}>
          {list.error && !list.hasData ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
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
                <UsersTable users={list.results} isLoading={list.isLoading} onView={setSelected} />
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

      <UserDetailsSheet user={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default AdminUsers;
