import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { CommunityPage } from '../form/UseCommunityPage';
import { MembershipActions } from './community-sidebar';

/** Content kept for the members: says why, and offers to join right there */
export function LockedPanel({ page, children }: { page: CommunityPage; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </span>
      <p className="mt-4 font-semibold text-foreground">{t('community.locked.title')}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>
      {/* Paid: the formulas are in the side panel */}
      {page.community?.pricing_type !== 'paid' && <MembershipActions page={page} className="mt-5 w-full max-w-xs" />}
    </div>
  );
}
