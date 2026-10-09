import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ColgateWrapper, EmptyAlert, Pagination, SearchInput, TopTitle } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { useCommunitySpace } from '../community-space-context';
import UseSpaceMembers, { type MemberRoleFilter, type MemberStatusFilter } from './form/UseSpaceMembers';
import SanctionModal, { type SanctionTarget } from './modals/sanction-modal';
import MembersTable from './tables/members-table';

const statusFilters: { value: MemberStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'pending', label: 'En attente' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'banned', label: 'Bannis' },
];

const roleFilters: { value: MemberRoleFilter; label: string }[] = [
  { value: 'all', label: 'Tous les rôles' },
  { value: 'team', label: 'Équipe' },
  { value: 'member', label: 'Membres' },
];

const isStatus = (value: string | null): value is MemberStatusFilter => statusFilters.some((f) => f.value === value);

function CommunityMembers() {
  const { community, role: actor } = useCommunitySpace();
  // ?status=pending: link from the dashboard "À traiter" panel
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status');
  const status: MemberStatusFilter = isStatus(statusParam) ? statusParam : 'all';
  const [role, setRole] = useState<MemberRoleFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [sanctionTarget, setSanctionTarget] = useState<SanctionTarget | null>(null);

  const list = UseSpaceMembers(community, { search, status, role });
  const visible = list.filtered.slice((page - 1) * size, page * size);

  const setStatus = (value: MemberStatusFilter) => {
    setParams(value === 'all' ? {} : { status: value }, { replace: true });
    setPage(1);
  };

  return (
    <div className="community__members">
      <TopTitle
        title="Membres"
        paragraph={`${community.members_count.toLocaleString('fr-FR')} membres dans ${community.name}`}
      />

      {list.counts.pending > 0 && status !== 'pending' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {list.counts.pending > 1
              ? `${list.counts.pending} demandes d'adhésion attendent votre décision.`
              : "1 demande d'adhésion attend votre décision."}
          </span>
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setStatus('pending')}>
            Voir les demandes
          </button>
        </div>
      )}

      <ColgateWrapper className="border border-neutral-200 p-4">
        <SearchInput
          id="space-members-search"
          size="md"
          className="md:max-w-sm"
          label="Rechercher un membre"
          clearLabel="Effacer la recherche"
          placeholder="Nom, pseudo, ville…"
          value={search}
          onValueChange={(value: string) => {
            setSearch(value);
            setPage(1);
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
            {statusFilters.map((f) => (
              <FilterChip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
                {f.label} <span className="tabular-nums opacity-70">{list.counts[f.value]}</span>
              </FilterChip>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par rôle">
            {roleFilters.map((f) => (
              <FilterChip
                key={f.value}
                active={role === f.value}
                onClick={() => {
                  setRole(f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {list.filtered.length === 0 ? (
            <EmptyAlert text="Aucun membre ne correspond à ces critères." />
          ) : (
            <>
              <MembersTable
                members={visible}
                actor={actor}
                onApprove={list.approve}
                onReject={list.reject}
                onReactivate={list.reactivate}
                onSanction={setSanctionTarget}
                onChangeRole={list.changeRole}
              />
              <Pagination
                totalItems={list.filtered.length}
                currentPage={page}
                perPage={size}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setSize(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Échantillon de démonstration : {list.members.length} membres sur {community.members_count.toLocaleString('fr-FR')}.
        </p>
      </ColgateWrapper>

      <SanctionModal
        target={sanctionTarget}
        onCancel={() => setSanctionTarget(null)}
        onConfirm={(member, sanction) => {
          list.sanction(member, sanction);
          setSanctionTarget(null);
        }}
      />
    </div>
  );
}

export default CommunityMembers;
