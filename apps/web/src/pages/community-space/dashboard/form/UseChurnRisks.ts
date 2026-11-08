import { useState } from 'react';

import { customToast } from '@kodinga/ui';
import { copyText } from '@/pages/community-space/members/form/UseInvitationForm';
import type { ChurnRisk } from '@/utils/api/ai/ai.type';
import { useGenerateChurnNudgeMutation, useLazyGetChurnDashboardQuery, useSendChurnNudgeMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { useUser } from '@/utils/Utils';

/**
 * Members who may leave, read on demand: the first reading evaluates the members, which is slow.
 * A nudge really reaches the member, as a notification: it is confirmed first.
 */
function UseChurnRisks(slug: string) {
  const me = useUser();
  const [load, { data, isFetching, error }] = useLazyGetChurnDashboardQuery();
  const [sendNudge, { isLoading: isSending }] = useSendChurnNudgeMutation();
  const [generateNudge, { isLoading: isWriting, originalArgs: writing }] = useGenerateChurnNudgeMutation();
  /** The member whose nudge waits for its confirmation */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return {
    isLoaded: !!data,
    risks: (data?.members ?? []).filter((m) => m.risk_level !== 'low' && m.user_id !== me?.id),
    isFetching,
    loadError: error ? parseApiError(error).message : null,
    analyze: () => void load({ slug }),
    refresh: () => void load({ slug, refresh: true }),
    /** The member whose message the AI is writing */
    writingId: isWriting ? writing : undefined,
    /** Replaces the template of the analysis with a message written for this member */
    write: async (risk: ChurnRisk) => {
      try {
        await generateNudge(risk.id).unwrap();
        customToast.success({ message: 'Message réécrit par l’IA : relisez-le avant de l’envoyer.' });
      } catch (err) {
        customToast.error({ message: parseApiError(err).message });
      }
    },
    confirmingId,
    isSending,
    askToSend: (risk: ChurnRisk) => setConfirmingId(risk.id),
    cancelSend: () => setConfirmingId(null),
    copy: async (risk: ChurnRisk) => {
      if (await copyText(risk.suggested_nudge)) customToast.success({ message: 'Message copié.' });
      else customToast.error({ message: 'Copie impossible : sélectionnez le message et copiez-le.' });
    },
    send: async (risk: ChurnRisk, name: string) => {
      try {
        await sendNudge(risk.id).unwrap();
        setConfirmingId(null);
        customToast.success({ message: `Relance envoyée à ${name}.` });
      } catch (err) {
        customToast.error({ message: parseApiError(err).message });
      }
    },
  };
}

export default UseChurnRisks;
