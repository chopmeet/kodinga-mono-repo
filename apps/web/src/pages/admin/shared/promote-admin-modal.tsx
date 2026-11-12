import { Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kodinga/ui';
import { useGetUsersQuery, useToggleUserAdminMutation } from '@/utils/api/user/user.api';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { getName, isAdmin, nameInitials } from '@/utils/Utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Gives super-admin rights to an existing account (POST admin/users/<id>/toggle-admin/).
 * The api has no invitation by email: the person needs a Kodinga account first.
 */
function PromoteAdminModal({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 300);
  const { data, isFetching } = useGetUsersQuery({ search: query, page_size: 6 }, { skip: !open || query.length < 2 });
  const [toggleAdmin] = useToggleUserAdminMutation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (!next) setSearch('');
    onOpenChange(next);
  };

  const promote = async (id: string, name: string) => {
    setPendingId(id);
    try {
      await toggleAdmin({ id, is_superadmin: true }).unwrap();
      customToast.success({ message: `${name} est maintenant super-administrateur.` });
      close(false);
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    } finally {
      setPendingId(null);
    }
  };

  const results = query.length >= 2 ? (data?.results ?? []) : [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>Ajouter un super-administrateur</DialogTitle>
          <DialogDescription>
            Cherchez un compte Kodinga existant par nom, email ou pseudo. Il aura accès à toute l'administration.
          </DialogDescription>
        </DialogHeader>

        <label htmlFor="promote-admin-search" className="sr-only">
          Rechercher un compte
        </label>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            id="promote-admin-search"
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="Nom, email ou pseudo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="custom-form-control block w-full bg-background py-2 pr-4 pl-9"
          />
        </div>

        <div className="min-h-24" aria-live="polite" aria-busy={isFetching}>
          {query.length < 2 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Saisissez au moins 2 caractères.</p>
          ) : !isFetching && results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun compte ne correspond à « {query} ».</p>
          ) : (
            <ul className="divide-y divide-border-soft" aria-label="Comptes trouvés">
              {results.map((u) => {
                const name = getName(u) || u.email;
                const already = isAdmin(u);
                return (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white" aria-hidden>
                      {nameInitials(name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                    </span>
                    {already ? (
                      <span className="text-xs font-medium text-violet-700">Déjà super-admin</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={pendingId === u.id}
                        disabled={pendingId !== null || !u.is_active}
                        title={u.is_active ? undefined : 'Compte suspendu'}
                        onClick={() => promote(u.id, name)}
                        aria-label={`Nommer ${name} super-administrateur`}
                      >
                        <ShieldCheck />
                        Nommer
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PromoteAdminModal;
