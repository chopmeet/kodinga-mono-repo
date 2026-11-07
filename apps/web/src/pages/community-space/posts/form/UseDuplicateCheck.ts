import { useCheckDuplicatesQuery } from '@/utils/api/community/community.api';
import { useDebounced } from '@/utils/hooks/useDebounced';

/** A title this long says enough to compare it */
const MIN_TITLE = 10;

/**
 * While a new question is written: the questions of the community close to it, once the writing
 * pauses. Never blocks publishing; an error of the api shows nothing.
 */
function UseDuplicateCheck({ slug, enabled, title, content }: { slug: string; enabled: boolean; title: string; content: string }) {
  // Strings, not an object: an object made again at each render would never settle
  const pausedTitle = useDebounced(title.trim(), 800);
  const pausedContent = useDebounced(content.trim(), 800);
  const ready = enabled && !!slug && pausedTitle.length >= MIN_TITLE;
  const { data } = useCheckDuplicatesQuery({ slug, title: pausedTitle, content: pausedContent }, { skip: !ready });
  return ready ? (data?.duplicates ?? []).filter((d) => d.url.startsWith('/')) : [];
}

export default UseDuplicateCheck;
