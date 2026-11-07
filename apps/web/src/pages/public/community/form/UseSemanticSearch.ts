import { useState } from 'react';

import { useSemanticSearchMutation } from '@/utils/api/community/community.api';
import type { SemanticSearchResult } from '@/utils/api/ai/ai.type';
import { parseApiError } from '@/utils/api/errors';

/** At least this many letters: a shorter query has no meaning to compare */
export const MIN_QUERY = 3;

/**
 * A search by meaning in the posts and lessons of the community, asked on purpose (a click): the
 * words of the feed search are compared to what was published, not only matched.
 */
function UseSemanticSearch(slug: string) {
  const [search, { isLoading }] = useSemanticSearchMutation();
  const [result, setResult] = useState<SemanticSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  return {
    result,
    error,
    isLoading,
    run: async (query: string) => {
      setError(null);
      try {
        setResult(await search({ slug, query }).unwrap());
      } catch (err) {
        setResult(null);
        setError(parseApiError(err).message);
      }
    },
    clear: () => {
      setResult(null);
      setError(null);
    },
  };
}

export default UseSemanticSearch;
