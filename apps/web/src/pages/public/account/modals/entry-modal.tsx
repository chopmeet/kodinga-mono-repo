import type { ReactNode } from 'react';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@kodinga-mono-repo/ui';

/** Dialog of a profile entry (experience, education, project): its form, Cancel / Save */
export function EntryModal({
  open,
  title,
  busy,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          id="entry-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="grid gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          {children}
          {error && (
            <p role="alert" className="text-sm text-red-600 sm:col-span-2">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" form="entry-form" isLoading={busy}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Labelled text input of the entry forms */
export function Field({ label, wide, ...props }: { label: string; wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="custom-form-label">{label}</span>
      <input {...props} className="custom-form-control bg-background px-3 py-2 disabled:opacity-50" />
    </label>
  );
}
