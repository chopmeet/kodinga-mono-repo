import { customToast } from '@kodinga-mono-repo/ui';
import { parseApiError } from '@/utils/api/errors';
import {
  useAdjustPointsMutation,
  useGetPointRulesQuery,
  useGetPointTransactionsQuery,
  useUpdatePointRulesMutation,
} from '@/utils/api/community/community.api';
import type { PointRulesUpdate, PointsAdjustment } from '@/utils/api/gamification/gamification.type';
import { hasSpacePermission, useCommunitySpace } from '../../community-space-context';

/**
 * Points of the community: its rules (read by all, GET .../gamification/rules/) and, for the owner or
 * an admin allowed to manage the settings (GamificationService.check_can_manage_gamification), the
 * rules editing, the manual adjustments and the journal of the points.
 */
function UsePointsAdmin() {
  const space = useCommunitySpace();
  const slug = space.community.slug;
  const canManage = space.role === 'owner' || (space.role === 'admin' && hasSpacePermission(space, 'can_manage_settings'));

  const rules = useGetPointRulesQuery(slug);
  const journal = useGetPointTransactionsQuery(slug, { skip: !canManage });
  const [sendRules] = useUpdatePointRulesMutation();
  const [sendAdjustment] = useAdjustPointsMutation();

  /** true once the api accepted it: the dialog closes */
  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      customToast.success({ message });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  return {
    canManage,
    rules: rules.data ?? [],
    rulesLoading: rules.isLoading,
    journal: journal.data ?? [],
    journalLoading: journal.isLoading,
    saveRules: (input: PointRulesUpdate) => run(() => sendRules({ slug, ...input }).unwrap(), 'Barème des points enregistré.'),
    adjust: (input: PointsAdjustment) =>
      run(() => sendAdjustment({ slug, ...input }).unwrap(), input.points > 0 ? `${input.points} points ajoutés.` : `${-input.points} points retirés.`),
  };
}

export type PointsAdmin = ReturnType<typeof UsePointsAdmin>;

export default UsePointsAdmin;
