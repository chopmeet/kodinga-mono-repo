import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga/ui';
import i18n from '@/utils/i18n';
import { useAppSelector } from '@/redux/hook';
import { useAddProjectCommentMutation, useGetProjectCommentsQuery, useGetProjectQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';

/** /projects/:projectSlug(?from=<community>) — a project of a member: votes and feedback */
function UseProjectPage() {
  const { projectSlug = '' } = useParams();
  const [params] = useSearchParams();
  const { pathname, search } = useLocation();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const meId = useAppSelector((s) => s.user.user?.id);
  const from = params.get('from');

  const query = useGetProjectQuery(projectSlug, { skip: !projectSlug });
  const comments = useGetProjectCommentsQuery(projectSlug, { skip: !projectSlug });
  const [addComment, { isLoading: isCommenting }] = useAddProjectCommentMutation();
  const loginUrl = `/auth/login?next=${encodeURIComponent(pathname + search)}`;

  return {
    project: query.data,
    isLoading: query.isLoading,
    notFound: (query.error as FetchBaseQueryError | undefined)?.status === 404,
    back: from
      ? { to: `/communities/${from}?tab=projects`, label: i18n.t('discover.project.backCommunity') }
      : { to: '/', label: i18n.t('discover.project.backExplore') },
    signedIn,
    loginUrl,
    /** What the vote button needs */
    voter: { membership: signedIn ? ('member' as const) : ('visitor' as const), loginUrl },
    isOwner: !!query.data && query.data.owner?.id === meId,
    comments: comments.data ?? [],
    isCommenting,
    /** true once posted: the field is emptied */
    comment: async (content: string, parentId?: string) => {
      try {
        await addComment({ projectSlug, content, ...(parentId ? { parent_id: parentId } : {}) }).unwrap();
        return true;
      } catch (error) {
        const data = (error as { data?: { detail?: string } }).data;
        customToast.error({ message: data?.detail ?? parseApiError(error).message });
        return false;
      }
    },
  };
}

export type ProjectPage = ReturnType<typeof UseProjectPage>;

export default UseProjectPage;
