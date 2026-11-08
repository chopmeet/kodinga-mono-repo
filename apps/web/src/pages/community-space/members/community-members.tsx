import { RotateCw, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button, ColgateWrapper, EmptyAlert, Pagination, SearchInput, TopTitle } from '@kodinga/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { parseApiError } from '@/utils/api/errors';
import { useCommunitySpace } from '../community-space-context';
import { canInvite } from './form/member-permissions';
import UseSpaceMembers, { type MemberRoleFilter, type MemberStatusFilter, type SpaceMember } from './form/UseSpaceMembers';
import InviteMembersModal from './modals/invite-members-modal';
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
  { value: 'owner', label: 'Propriétaire' },
  { value: 'admin', label: 'Administrateurs' },
  { value: 'moderator', label: 'Modérateurs' },
  { value: 'member', label: 'Membres' },
];

const isStatus = (value: string | null): value is MemberStatusFilter => statusFilters.some((f) => f.value === value);

/** /c/:slug/members — members of the community and join requests */
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
  const [sanctionTarget, setSanctionTarget] = useState<SanctionTarget<SpaceMember> | null>(null);
  const [inviting, setInviting] = useState(false);

  const list = UseSpaceMembers(community.slug, { search, status, role, page, size });
  const pending = list.counts.pending ?? 0;

  const setStatus = (value: MemberStatusFilter) => {
    setParams(value === 'all' ? {} : { status: value }, { replace: true });
    setPage(1);
  };

  return (
    <div className="community__members">
      <div className="flex flex-wrap items-start justify-between gap-4 [&>:last-child]:mb-4">
        <TopTitle
          title="Membres"
          paragraph={`${(list.counts.active ?? community.members_count).toLocaleString('fr-FR')} membres actifs dans ${community.name}`}
        />
        {canInvite(actor) && (
          <Button onClick={() => setInviting(true)}>
            <UserPlus />
            Inviter des membres
          </Button>
        )}
      </div>

      {pending > 0 && status !== 'pending' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{pending > 1 ? `${pending} demandes d'adhésion attendent votre décision.` : "1 demande d'adhésion attend votre décision."}</span>
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
          placeholder="Nom, pseudo, titre…"
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
                {f.label} {list.counts[f.value] !== undefined && <span className="tabular-nums opacity-70">{list.counts[f.value]}</span>}
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

        <div className="mt-5" aria-busy={list.isFetching}>
          {list.error ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyAlert text={parseApiError(list.error).message} />
              <Button variant="outline" size="sm" onClick={() => list.refetch()}>
                <RotateCw />
                Réessayer
              </Button>
            </div>
          ) : !list.isLoading && list.members.length === 0 ? (
            <EmptyAlert text="Aucun membre ne correspond à ces critères." />
          ) : (
            <div className={list.isFetching && !list.isLoading ? 'opacity-60 transition-opacity' : undefined}>
              <MembersTable
                members={list.members}
                actor={actor}
                isLoading={list.isLoading}
                onApprove={list.approve}
                onReject={list.reject}
                onSanction={setSanctionTarget}
                onChangeRole={list.changeRole}
              />
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
            </div>
          )}
        </div>
      </ColgateWrapper>

      {canInvite(actor) && (
        <InviteMembersModal slug={community.slug} communityName={community.name} actor={actor} open={inviting} onClose={() => setInviting(false)} />
      )}

      <SanctionModal<SpaceMember>
        target={sanctionTarget}
        onCancel={() => setSanctionTarget(null)}
        onConfirm={async (member, sanction) => {
          if (await list.sanction(member, sanction)) setSanctionTarget(null);
        }}
      />
    </div>
  );
}

export default CommunityMembers;
