import { customToast } from '@kodinga-mono-repo/ui';
import { copyText } from '@/pages/community-space/members/form/UseInvitationForm';
import type { ChurnRisk } from '@/utils/api/ai/ai.type';
import { useLazyGetChurnDashboardQuery, useMarkChurnNudgedMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { useUser } from '@/utils/Utils';

/**
 * Members who may leave, read on demand: the first reading evaluates the members and writes the
 * messages, which is slow. The api sends nothing to the member: "relancé" only records it.
 */
function UseChurnRisks(slug: string) {
  const me = useUser();
  const [load, { data, isFetching, error }] = useLazyGetChurnDashboardQuery();
  const [markNudged, { isLoading: isMarking, originalArgs: marking }] = useMarkChurnNudgedMutation();

  return {
    isLoaded: !!data,
    risks: (data?.members ?? []).filter((m) => m.risk_level !== 'low' && m.user_id !== me?.id),
    isFetching,
    loadError: error ? parseApiError(error).message : null,
    analyze: () => void load({ slug }),
    refresh: () => void load({ slug, refresh: true }),
    markingId: isMarking ? marking : undefined,
    copy: async (risk: ChurnRisk) => {
      if (await copyText(risk.suggested_nudge)) customToast.success({ message: 'Message copié.' });
      else customToast.error({ message: 'Copie impossible : sélectionnez le message et copiez-le.' });
    },
    markSent: async (risk: ChurnRisk) => {
      try {
        await markNudged(risk.id).unwrap();
        customToast.success({ message: 'Membre noté comme relancé.' });
      } catch (err) {
        customToast.error({ message: parseApiError(err).message });
      }
    },
  };
}

export default UseChurnRisks;
