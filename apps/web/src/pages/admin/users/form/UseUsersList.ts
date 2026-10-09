import { useEffect, useMemo, useState } from 'react';

import { customToast } from '@kodinga-mono-repo/ui';
import { type AdminUser, adminUsers, type UserRoleFilter, type UserStatusFilter, userRole } from '@/data/admin-users.data';

const FAKE_LATENCY_MS = 300;

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export type UsersQuery = {
  search: string;
  role: UserRoleFilter;
  status: UserStatusFilter;
  page: number;
  size: number;
};

/**
 * Mock of an admin users endpoint (list + moderation). Changes live in local state.
 * With the api: GET users/ (paginated, ?q=&role=&status=) and PATCH users/<id>/ for the actions.
 */
function UseUsersList(query: UsersQuery) {
  const [users, setUsers] = useState<AdminUser[]>(adminUsers);

  const filtered = useMemo(() => {
    const needle = normalize(query.search.trim());
    return users.filter(
      (u) =>
        (!needle || normalize(`${u.full_name} ${u.email} ${u.username} ${u.city}`).includes(needle)) &&
        (query.role === 'all' || userRole(u) === query.role) &&
        (query.status === 'all' ||
          (query.status === 'active' && u.is_active) ||
          (query.status === 'suspended' && !u.is_active) ||
          (query.status === 'unverified' && !u.is_email_verified))
    );
  }, [users, query.search, query.role, query.status]);

  const key = JSON.stringify(query);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setLoadedKey(key), FAKE_LATENCY_MS);
    return () => clearTimeout(timer);
  }, [key]);

  const update = (user: AdminUser, patch: Partial<AdminUser>, message: string) => {
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, ...patch } : u)));
    customToast.success({ message });
  };

  const staffCount = users.filter((u) => u.is_staff).length;

  return {
    users,
    total: filtered.length,
    results: filtered.slice((query.page - 1) * query.size, query.page * query.size),
    isLoading: loadedKey === null,
    isFetching: loadedKey !== key,
    toggleActive: (u: AdminUser) =>
      update(u, { is_active: !u.is_active }, u.is_active ? `Le compte de ${u.full_name} est suspendu.` : `Le compte de ${u.full_name} est réactivé.`),
    toggleStaff: (u: AdminUser) => {
      // Never leave the platform without an administrator
      if (u.is_staff && staffCount <= 1) {
        customToast.error({ message: 'Impossible de retirer le dernier administrateur.' });
        return;
      }
      update(u, { is_staff: !u.is_staff }, u.is_staff ? `${u.full_name} n'est plus administrateur.` : `${u.full_name} est maintenant administrateur.`);
    },
    addAdmin: (user: AdminUser) => setUsers((list) => [user, ...list]),
  };
}

export default UseUsersList;
