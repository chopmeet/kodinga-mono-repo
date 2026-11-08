import { customToast } from '@kodinga/ui';
import { useExportHackathonApplicationsMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ApplicationStatus } from '@/utils/api/hackathon/hackathon.type';
import { downloadText } from '@/utils/Utils';

/**
 * The applications of a hackathon in a CSV file, made by the api with the filter shown (organizers).
 * A BOM first: spreadsheets then read its accents as UTF-8.
 */
function UseApplicationsExport(slug: string, hackathonSlug: string) {
  const [exportApplications, { isLoading }] = useExportHackathonApplicationsMutation();

  return {
    isExporting: isLoading,
    exportCsv: async (status?: ApplicationStatus) => {
      try {
        const csv = await exportApplications({ slug, hackathonSlug, status }).unwrap();
        downloadText(`${hackathonSlug}-candidatures${status ? `-${status}` : ''}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
      }
    },
  };
}

export default UseApplicationsExport;
