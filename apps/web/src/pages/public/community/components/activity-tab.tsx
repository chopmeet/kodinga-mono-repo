import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MemberActivityView } from '@/pages/shared/member-activity';
import { MyCommunityPoints } from '@/pages/shared/member-points';
import { parseApiError } from '@/utils/api/errors';
import { useGetMemberActivityQuery } from '@/utils/api/community/community.api';
import { SectionHeader } from './section-header';

/** "Mon activité" (members only): what the signed-in member did in this community (communities/<slug>/me/dashboard/) */
export function ActivityTab({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGetMemberActivityQuery(slug);

  return (
    <section>
      <SectionHeader eyebrow={t('community.activity.eyebrow')} title={t('community.activity.title')} aside={<Activity className="size-7 text-blue-900" aria-hidden />}>
        {t('community.activity.intro')}
      </SectionHeader>
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">{t('community.activity.loading')}</p>
      ) : error || !data ? (
        <p className="py-12 text-center text-sm text-slate-500">{error ? parseApiError(error).message : t('community.activity.failed')}</p>
      ) : (
        <MemberActivityView activity={data} communitySlug={slug} />
      )}
      <h3 className="mt-8 mb-3 text-lg font-semibold text-slate-900">{t('community.activity.points')}</h3>
      <MyCommunityPoints slug={slug} />
    </section>
  );
}
