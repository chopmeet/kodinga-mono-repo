import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga/ui';
import i18n from '@/utils/i18n';
import { isExpired } from '@/pages/community-space/opportunities/opportunity-labels';
import { useAppSelector } from '@/redux/hook';
import { useApplyToOpportunityMutation, useGetMyOpportunityApplicationsQuery, useGetOpportunityQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';

export type ApplyValues = { resume_url: string; cover_letter: string; portfolio_url: string };

/**
 * /opportunities/:opportunitySlug(?from=<community>) — an offer, and the application of the
 * signed-in member (the api checks the membership of the community of the offer)
 */
function UseOpportunityPage() {
  const { opportunitySlug = '' } = useParams();
  const [params] = useSearchParams();
  const { pathname, search } = useLocation();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const meId = useAppSelector((s) => s.user.user?.id);
  const from = params.get('from');

  const query = useGetOpportunityQuery(opportunitySlug, { skip: !opportunitySlug });
  const mine = useGetMyOpportunityApplicationsQuery(undefined, { skip: !signedIn });
  const [apply, { isLoading: isApplying }] = useApplyToOpportunityMutation();
  const offer = query.data;
  const application = (mine.data ?? []).find((a) => a.opportunity?.slug === opportunitySlug) ?? null;

  return {
    offer,
    isLoading: query.isLoading,
    notFound: (query.error as FetchBaseQueryError | undefined)?.status === 404,
    back: from
      ? { to: `/communities/${from}?tab=opportunities`, label: i18n.t('discover.offer.backCommunity') }
      : { to: '/opportunities', label: i18n.t('discover.offer.backAll') },
    signedIn,
    loginUrl: `/auth/login?next=${encodeURIComponent(pathname + search)}`,
    isPoster: !!offer && offer.poster?.id === meId,
    isOpen: !!offer && offer.status === 'open' && !isExpired(offer),
    application,
    hasApplied: !!offer?.has_applied || !!application,
    isApplying,
    /** true once sent: the dialog closes */
    apply: async (values: ApplyValues) => {
      try {
        await apply({ opportunitySlug, ...values }).unwrap();
        customToast.success({ message: i18n.t('discover.offer.modal.sent') });
        return true;
      } catch (error) {
        const parsed = parseApiError(error);
        // Raw DRF answers ({detail} or a list) for this app
        const data = (error as { data?: unknown }).data;
        const raw = typeof data === 'object' && data && 'detail' in data ? String((data as { detail: unknown }).detail) : Array.isArray(data) ? String(data[0]) : null;
        customToast.error({ message: raw ?? parsed.message });
        return false;
      }
    },
  };
}

export type OpportunityPage = ReturnType<typeof UseOpportunityPage>;

export default UseOpportunityPage;
