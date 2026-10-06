import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function SubmitButton({ isLoading, children }: { isLoading?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading && <LoaderCircle className="size-5 animate-spin" />}
      {children}
    </button>
  );
}
