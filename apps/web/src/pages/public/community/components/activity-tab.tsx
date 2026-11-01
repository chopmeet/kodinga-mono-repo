import { Activity } from 'lucide-react';

import { MemberActivityView } from '@/pages/shared/member-activity';
import { MyCommunityPoints } from '@/pages/shared/member-points';
import { parseApiError } from '@/utils/api/errors';
import { useGetMemberActivityQuery } from '@/utils/api/community/community.api';
import { SectionHeader } from './section-header';

/** "Mon activité" (members only): what the signed-in member did in this community (communities/<slug>/me/dashboard/) */
export function ActivityTab({ slug }: { slug: string }) {
  const { data, isLoading, error } = useGetMemberActivityQuery(slug);

  return (
    <section>
      <SectionHeader eyebrow="Votre parcours ici" title="Mon activité" aside={<Activity className="size-7 text-blue-900" aria-hidden />}>
        Vos événements, formations, candidatures et hackathons dans cette communauté.
      </SectionHeader>
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement de votre activité…</p>
      ) : error || !data ? (
        <p className="py-12 text-center text-sm text-slate-500">{error ? parseApiError(error).message : 'Votre activité n’a pas pu être chargée.'}</p>
      ) : (
        <MemberActivityView activity={data} communitySlug={slug} />
      )}
      <h3 className="mt-8 mb-3 text-lg font-semibold text-slate-900">Mes points ici</h3>
      <MyCommunityPoints slug={slug} />
    </section>
  );
}
