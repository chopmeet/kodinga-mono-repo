import { RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, EmptyAlert, Skeleton } from '@kodinga/ui';
import { parseApiError } from '@/utils/api/errors';

type Props = {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Height of the loading placeholder (tailwind class) */
  skeleton?: string;
  children: ReactNode;
};

/** Loading placeholder, or the api error with a retry button, around a block fed by one query */
export default function QueryState({ isLoading, error, onRetry, skeleton = 'h-48', children }: Props) {
  if (isLoading) return <Skeleton className={`w-full ${skeleton}`} aria-label="Chargement" />;
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <EmptyAlert text={parseApiError(error).message} />
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          Réessayer
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
